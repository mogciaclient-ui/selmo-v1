"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Bot, LoaderCircle, Mic, MicOff, Pause, Play, Square } from "lucide-react";
import type { Scenario } from "./roleplay-workspace";
import { applyMicrophoneState, parseRealtimeEvent, RealtimeTranscript, type VoiceMessage } from "@/lib/roleplay/realtime-state";

type Props = { scenario: Scenario; messages: VoiceMessage[]; saving: boolean; onMessages: React.Dispatch<React.SetStateAction<VoiceMessage[]>>; onFinish: (messages: VoiceMessage[]) => void; onBack: () => void };
export function VoiceSession({ scenario, messages, saving, onMessages, onFinish, onBack }: Props) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const meterFrameRef = useRef<number>(0);
  const generationRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptRef = useRef(new RealtimeTranscript(messages));
  const mutedRef = useRef(false), pausedRef = useRef(false), endingRef = useRef(false);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [muted, setMuted] = useState(false), [paused, setPaused] = useState(false), [ending, setEnding] = useState(false);
  const [error, setError] = useState(""), [speaking, setSpeaking] = useState(false), [level, setLevel] = useState(0);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]), [deviceId, setDeviceId] = useState("");
  const [playbackBlocked, setPlaybackBlocked] = useState(false);

  function stop() {
    generationRef.current += 1;
    abortRef.current?.abort(); abortRef.current = null;
    if (connectTimerRef.current) clearTimeout(connectTimerRef.current);
    connectTimerRef.current = null;
    if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
    disconnectTimerRef.current = null;
    const pc = pcRef.current; pcRef.current = null;
    const channel = channelRef.current; channelRef.current = null;
    const stream = streamRef.current; streamRef.current = null;
    if (pc) { pc.onconnectionstatechange = null; pc.ontrack = null; }
    channel?.close(); pc?.close();
    stream?.getTracks().forEach(track => { track.onended = null; track.onmute = null; track.onunmute = null; track.stop(); });
    cancelAnimationFrame(meterFrameRef.current);
    if (audioContextRef.current) void audioContextRef.current.close().catch(() => undefined);
    audioContextRef.current = null;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.srcObject = null; }
  }
  useEffect(() => () => stop(), []);
  useEffect(() => {
    let active = true;
    const media = navigator.mediaDevices;
    if (!media?.enumerateDevices) return;
    const update = () => { void media.enumerateDevices().then(list => { if (active) setDevices(list.filter(device => device.kind === "audioinput")); }).catch(() => undefined); };
    update(); media.addEventListener("devicechange", update);
    return () => { active = false; media.removeEventListener("devicechange", update); };
  }, []);

  function fail(message: string) {
    stop(); endingRef.current = false; setEnding(false); setStatus("error"); setError(message); setLevel(0); setSpeaking(false);
  }
  async function playAudio() {
    try { void audioContextRef.current?.resume().catch(() => undefined); await audioRef.current?.play(); setPlaybackBlocked(false); }
    catch { setPlaybackBlocked(true); }
  }
  function send(event: object) {
    const channel = channelRef.current;
    if (channel?.readyState !== "open") return false;
    channel.send(JSON.stringify(event)); return true;
  }
  async function connect() {
    stop();
    const generation = generationRef.current;
    setStatus("connecting"); setError(""); setPlaybackBlocked(false); setLevel(0);
    mutedRef.current = false; pausedRef.current = false; endingRef.current = false;
    setMuted(false); setPaused(false); setEnding(false); setSpeaking(false);
    transcriptRef.current = new RealtimeTranscript(transcriptRef.current.messages);
    const abort = new AbortController(); abortRef.current = abort;
    let microphoneReady = false;
    connectTimerRef.current = setTimeout(() => {
      if (generation !== generationRef.current) return;
      fail(microphoneReady
        ? "音声AIへの接続がタイムアウトしました。ネットワークを確認して再接続してください。"
        : "マイクへの接続が完了しませんでした。ブラウザーとOSのマイク権限を確認して再試行してください。");
    }, 30_000);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("このブラウザーではマイクを利用できません。HTTPSまたはlocalhostで開いてください。");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) } });
      if (generation !== generationRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
      streamRef.current = stream;
      const track = stream.getAudioTracks()[0];
      if (!track || track.readyState !== "live") throw new Error("利用できるマイクが見つかりません。");
      microphoneReady = true;
      track.onended = () => { if (generation === generationRef.current) fail("マイクが切断されました。入力機器を確認して再接続してください。"); };
      track.onmute = () => { if (generation === generationRef.current) setError("ブラウザーまたはOSがマイク入力を停止しています。マイクの設定を確認してください。"); };
      track.onunmute = () => { if (generation === generationRef.current) setError(""); };
      void navigator.mediaDevices.enumerateDevices().then(list => { if (generation === generationRef.current) setDevices(list.filter(device => device.kind === "audioinput")); }).catch(() => undefined);
      // Meter measures the captured stream without routing the microphone to speakers.
      try {
        const context = new AudioContext(); audioContextRef.current = context;
        void context.resume().catch(() => undefined);
        if (generation !== generationRef.current) return;
        const analyser = context.createAnalyser(); analyser.fftSize = 1024;
        context.createMediaStreamSource(stream).connect(analyser);
        const samples = new Float32Array(analyser.fftSize); let lastUpdate = 0;
        function meter(time: number) {
          if (generation !== generationRef.current) return;
          if (time - lastUpdate > 100) {
            analyser.getFloatTimeDomainData(samples);
            const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
            setLevel(Math.min(100, Math.round(rms * 500))); lastUpdate = time;
          }
          meterFrameRef.current = requestAnimationFrame(meter);
        }
        meterFrameRef.current = requestAnimationFrame(meter);
      } catch { /* Audio metering must not prevent the WebRTC microphone working. */ }
      if (generation !== generationRef.current) return;
      const pc = new RTCPeerConnection(); pcRef.current = pc;
      pc.ontrack = event => {
        if (generation !== generationRef.current || !audioRef.current) return;
        audioRef.current.srcObject = event.streams[0] ?? new MediaStream([event.track]);
        void playAudio();
      };
      pc.onconnectionstatechange = () => {
        if (generation !== generationRef.current) return;
        if (pc.connectionState === "connected") { if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current); disconnectTimerRef.current = null; setError(""); }
        if (pc.connectionState === "disconnected" && !disconnectTimerRef.current) {
          setError("音声接続の復帰を待っています…");
          disconnectTimerRef.current = setTimeout(() => { if (generation === generationRef.current && pc.connectionState === "disconnected") fail("音声接続が切れました。再接続して続けてください。"); }, 5_000);
        }
        if (["failed", "closed"].includes(pc.connectionState)) fail("音声接続が切れました。再接続して続けてください。会話の記録は保持しています。");
      };
      pc.addTrack(track, stream);
      const channel = pc.createDataChannel("oai-events"); channelRef.current = channel;
      channel.addEventListener("message", event => {
        if (generation !== generationRef.current) return;
        const data = parseRealtimeEvent(event.data); if (!data) return;
        transcriptRef.current.process(data);
        if (data.type === "input_audio_buffer.speech_started") setSpeaking(true);
        if (data.type === "input_audio_buffer.speech_stopped") setSpeaking(false);
        if (["conversation.item.input_audio_transcription.completed", "response.output_audio_transcript.done", "response.audio_transcript.done"].includes(data.type)) onMessages(transcriptRef.current.messages);
        if (data.type === "conversation.item.input_audio_transcription.failed") setError("音声の文字起こしに失敗しました。もう一度話してください。");
        if (data.type === "response.done" && data.response?.status === "failed") setError(data.response.status_details?.error?.message ?? "AIの応答に失敗しました。再接続してください。");
        if (data.type === "error" && !["response_cancel_not_active", "input_audio_buffer_commit_empty"].includes(data.error?.code ?? "")) setError(data.error?.message ?? "音声セッションでエラーが発生しました。");
      });
      channel.addEventListener("close", () => { if (generation === generationRef.current) fail("音声接続が切れました。再接続して続けてください。"); });
      channel.addEventListener("error", () => { if (generation === generationRef.current) fail("音声通信でエラーが発生しました。再接続してください。"); });
      channel.addEventListener("open", () => {
        if (generation !== generationRef.current) return;
        if (connectTimerRef.current) clearTimeout(connectTimerRef.current);
        setStatus("connected");
        const history = transcriptRef.current.messages;
        if (history.length) send({ type: "conversation.item.create", item: { type: "message", role: "system", content: [{ type: "input_text", text: `接続が復帰しました。次の会話の続きとして顧客役を維持してください。\n${history.slice(-20).map(message => `${message.role === "sales" ? "営業" : "顧客"}: ${message.text}`).join("\n")}` }] } });
        else send({ type: "response.create", response: { output_modalities: ["audio"], instructions: "顧客役として『本日はよろしくお願いします。』程度の短い挨拶だけをしてください。質問や会社説明はせず、その後は営業担当者の発言を待ってください。" } });
      });
      const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
      const response = await fetch("/api/roleplay/realtime", { method: "POST", signal: abort.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sdp: offer.sdp, scenario }) });
      if (generation !== generationRef.current) return;
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.message ?? "音声AIへ接続できませんでした。"); }
      const sdp = await response.text();
      if (generation === generationRef.current) await pc.setRemoteDescription({ type: "answer", sdp });
    } catch (reason) {
      if (generation !== generationRef.current) return;
      const denied = reason instanceof DOMException && ["NotAllowedError", "PermissionDeniedError"].includes(reason.name);
      fail(denied ? "マイクが許可されていません。ブラウザーとOSのマイク権限を確認して再試行してください。" : reason instanceof Error ? reason.message : "マイクを開始できませんでした。");
    }
  }
  function toggleMute() {
    mutedRef.current = !mutedRef.current; setMuted(mutedRef.current);
    applyMicrophoneState(streamRef.current, mutedRef.current, pausedRef.current);
  }
  function togglePause() {
    pausedRef.current = !pausedRef.current; setPaused(pausedRef.current);
    applyMicrophoneState(streamRef.current, mutedRef.current, pausedRef.current);
    if (pausedRef.current) {
      if (transcriptRef.current.responseActive) send({ type: "response.cancel" });
      send({ type: "output_audio_buffer.clear" }); audioRef.current?.pause();
    } else void playAudio();
  }
  async function finish() {
    if (endingRef.current || saving) return;
    endingRef.current = true; setEnding(true); setError("");
    applyMicrophoneState(streamRef.current, true, true, true);
    const generation = generationRef.current;
    if (transcriptRef.current.speaking) send({ type: "input_audio_buffer.commit" });
    // Let the final VAD/commit + transcription events settle before grading.
    const started = Date.now();
    await new Promise<void>(resolve => {
      const poll = () => {
        if (generation !== generationRef.current || (Date.now() - started >= 700 && !transcriptRef.current.pending.size) || Date.now() - started >= 8_000) resolve();
        else setTimeout(poll, 100);
      }; poll();
    });
    if (generation !== generationRef.current) return;
    if (transcriptRef.current.pending.size) {
      endingRef.current = false; setEnding(false);
      applyMicrophoneState(streamRef.current, mutedRef.current, pausedRef.current);
      setError("最後の発言を文字起こししています。少し待ってからもう一度採点してください。"); return;
    }
    const finalMessages = transcriptRef.current.messages;
    if (!finalMessages.some(message => message.role === "sales")) {
      endingRef.current = false; setEnding(false); applyMicrophoneState(streamRef.current, mutedRef.current, pausedRef.current);
      setError("営業の発言がまだ記録されていません。マイク入力を確認して話してください。"); return;
    }
    onMessages(finalMessages); stop(); setStatus("idle"); endingRef.current = false; setEnding(false); onFinish(finalMessages);
  }
  function back() { stop(); onBack(); }
  const busy = saving || ending;
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><audio ref={audioRef} autoPlay playsInline/>
    <header className="flex flex-wrap items-center gap-3 border-b px-5 py-4"><button type="button" onClick={back} disabled={busy} aria-label="一覧に戻る"><ArrowLeft size={19}/></button><div><p className="text-xs font-bold text-amber-700">音声ロープレ</p><h2 className="font-bold">{scenario.title}</h2></div><div className="ml-auto flex flex-wrap gap-2">{status === "connected" && <button type="button" disabled={busy} onClick={togglePause} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold">{paused ? <Play size={15}/> : <Pause size={15}/>}{paused ? "再開" : "一時停止"}</button>}<button type="button" disabled={busy} onClick={back} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold text-red-700"><Square size={14}/>中断</button><button type="button" disabled={busy || status !== "connected" || paused} onClick={() => void finish()} className="rounded-lg bg-amber-100 px-4 py-2 text-xs font-bold disabled:opacity-50">{ending ? "最後の発言を確認中…" : saving ? "採点中…" : "終了して採点"}</button></div></header>
    <div className="grid min-h-[540px] lg:grid-cols-[260px_1fr]"><aside className="border-r bg-slate-50 p-5"><p className="text-xs font-bold text-slate-500">今回の顧客</p><p className="mt-2 text-sm leading-6">{scenario.customer}</p><p className="mt-5 text-xs font-bold text-slate-500">達成するゴール</p><p className="mt-2 text-sm leading-6">{scenario.objective}</p></aside><div className="min-w-0 p-5 md:p-8">
      {devices.length > 0 && <label className="mb-4 block text-xs font-bold text-slate-600">入力マイク<select aria-label="入力マイク" disabled={status === "connecting" || busy} value={deviceId} onChange={event => setDeviceId(event.target.value)} className="mt-2 block h-10 w-full rounded-lg border px-3"><option value="">システム既定</option>{devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `マイク ${index + 1}`}</option>)}</select><span className="mt-1 block font-normal text-slate-500">接続中に変更した場合は「接続し直す」を押してください。</span></label>}
      {status === "connecting" && <p role="status" className="flex items-center gap-2 text-sm font-bold text-amber-800"><LoaderCircle className="animate-spin"/>マイクと音声AIへ接続中…</p>}
      {(status === "idle" || status === "error") && <button type="button" disabled={busy} onClick={() => void connect()} className="my-5 rounded-xl bg-[#f2c94c] px-5 py-3 font-bold">{status === "error" || messages.length ? "マイクを再接続する" : "マイクを許可して開始"}</button>}
      {status === "connected" && <button type="button" disabled={busy} onClick={() => void connect()} className="mb-4 rounded-lg border px-4 py-2 text-sm font-bold">接続し直す</button>}
      {status === "connected" && <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><p role="status" className="text-sm font-bold">{ending ? "発言を確認中" : paused ? "一時停止中" : muted ? "マイクはミュート中" : speaking ? "音声を認識中" : "話しかけてください"}</p><button type="button" disabled={paused || busy} aria-label={muted ? "マイクをオン" : "マイクをミュート"} onClick={toggleMute} className="rounded-full bg-amber-100 p-3 disabled:opacity-40">{muted ? <MicOff size={20}/> : <Mic size={20}/>}</button></div><label className="mt-3 block text-xs text-slate-500">マイク入力レベル<meter aria-label="マイク入力レベル" min={0} max={100} value={muted || paused || ending ? 0 : level} className="mt-1 block h-4 w-full"/></label><p className="mt-2 text-xs text-slate-500">声を出しても入力レベルが動かない場合は、入力マイクを確認して再接続してください。</p></div>}
      {playbackBlocked && <button type="button" onClick={() => void playAudio()} className="mb-4 rounded-lg bg-amber-100 px-4 py-2 text-sm font-bold">AIの音声を再生する</button>}
      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="space-y-4">{messages.map((message, index) => <div key={index} className={`flex gap-3 ${message.role === "sales" ? "justify-end" : ""}`}>{message.role === "customer" && <Bot className="shrink-0 text-amber-800" size={20}/>}<p className={`max-w-[85%] whitespace-pre-wrap break-words rounded-xl px-4 py-3 text-sm leading-7 ${message.role === "sales" ? "bg-slate-950 text-white" : "bg-amber-50"}`}>{message.text}</p></div>)}</div>
    </div></div>
  </section>;
}
