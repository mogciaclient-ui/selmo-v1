"use client";

import { useState } from "react";
import { CheckCircle2, FileAudio, LoaderCircle, Mic2 } from "lucide-react";

const accepted = ".mp3,.m4a,.wav,.webm,.mp4,audio/*,video/mp4";
export function AudioAnalysisUpload({ activityId }: { activityId: string }) {
  const [audioPath, setAudioPath] = useState("");
  const [audioType, setAudioType] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [referenceReady, setReferenceReady] = useState(false);

  async function upload(file: File, kind: "meeting" | "voice-reference") {
    setUploading(true); setMessage("");
    try {
      const prepared = await fetch(`/api/activities/${activityId}/audio-upload`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file.name, contentType: normalizedType(file), size: file.size, kind }) });
      const target = await prepared.json() as { path?: string; signedUrl?: string; message?: string; contentType?: string };
      if (!prepared.ok || !target.path || !target.signedUrl) throw new Error(target.message || "アップロードを開始できませんでした。");
      const body = new FormData(); body.append("cacheControl", "3600"); body.append("", file);
      const uploaded = await fetch(target.signedUrl, { method: "PUT", body });
      if (!uploaded.ok) throw new Error("音声をアップロードできませんでした。");
      if (kind === "voice-reference") {
        const saved = await fetch(`/api/activities/${activityId}/voice-reference`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: target.path, contentType: target.contentType }) });
        if (!saved.ok) throw new Error("参照音声を登録できませんでした。");
        setReferenceReady(true); setMessage("営業音声を登録しました。以後の商談にも自動で使用します。");
      } else {
        setAudioPath(target.path); setAudioType(target.contentType || normalizedType(file)); setMessage(`${file.name} をアップロードしました。活動登録後、自動で分析します。`);
      }
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "アップロードに失敗しました。"); }
    finally { setUploading(false); }
  }

  return <div className="space-y-4">
    <input type="hidden" name="audioPath" value={audioPath}/><input type="hidden" name="audioContentType" value={audioType}/>
    <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/50 px-5 py-6 text-center hover:bg-amber-50">
      {uploading ? <LoaderCircle className="animate-spin text-amber-800"/> : audioPath ? <CheckCircle2 className="text-emerald-600"/> : <FileAudio className="text-amber-800"/>}
      <span className="mt-2 text-sm font-bold">{audioPath ? "音声アップロード済み" : "商談音声を選択"}</span>
      <span className="mt-1 text-xs text-slate-500">MP3・M4A・WAV・WebM・MP4／25MBまで</span>
      <input type="file" accept={accepted} disabled={uploading} className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file, "meeting"); }}/>
    </label>
    <details className="rounded-xl border border-slate-200 bg-white">
      <summary className="cursor-pointer px-4 py-3 text-xs font-bold text-slate-600"><span className="inline-flex items-center gap-2"><Mic2 size={15}/>初回のみ：営業本人の声を登録して識別精度を上げる</span></summary>
      <div className="border-t p-4"><p className="text-xs leading-6 text-slate-500">営業本人だけが話している2〜10秒の音声を一度登録します。毎回の操作は不要です。</p><label className="mt-3 inline-flex cursor-pointer rounded-lg border border-amber-300 px-3 py-2 text-xs font-bold text-amber-900">{referenceReady ? "登録済み" : "参照音声を選択"}<input type="file" accept="audio/*" disabled={uploading} className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file, "voice-reference"); }}/></label></div>
    </details>
    {message && <p className="text-xs font-semibold text-slate-600">{message}</p>}
  </div>;
}

function normalizedType(file: File) {
  if (file.type === "video/mp4") return "video/mp4";
  if (file.type === "audio/mp4" || file.name.toLowerCase().endsWith(".m4a")) return "audio/x-m4a";
  return file.type || "audio/mpeg";
}
