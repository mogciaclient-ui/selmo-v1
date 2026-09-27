import "server-only";

export type TimedSpeech = { speaker: string; start: number; end: number; text: string };
export type AudioMetrics = {
  durationSeconds: number;
  speakingSeconds: number;
  silenceSeconds: number;
  overlapSeconds: number;
  longestSilenceSeconds: number;
  turns: number;
  charactersPerMinute: number;
};

type DiarizedResponse = { text?: string; duration?: number; segments?: Array<{ speaker?: string; start?: number; end?: number; text?: string }>; error?: { message?: string } };

export async function transcribeSalesAudio(audio: Blob, fileName: string, salespersonReference?: Blob) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEYが設定されていません。");
  const form = new FormData();
  form.set("model", process.env.OPENAI_DIARIZATION_MODEL || "gpt-4o-transcribe-diarize");
  form.set("file", audio, fileName);
  form.set("response_format", "diarized_json");
  form.set("chunking_strategy", "auto");
  if (salespersonReference) {
    form.append("known_speaker_names[]", "営業");
    form.append("known_speaker_references[]", `data:${salespersonReference.type || "audio/wav"};base64,${Buffer.from(await salespersonReference.arrayBuffer()).toString("base64")}`);
  }
  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form });
  const body = await response.json() as DiarizedResponse;
  if (!response.ok) throw new Error(body.error?.message || "音声の文字起こしに失敗しました。");
  const segments: TimedSpeech[] = (body.segments ?? []).flatMap((item) => {
    const text = item.text?.trim();
    return text ? [{ speaker: item.speaker || "話者", start: item.start ?? 0, end: item.end ?? 0, text }] : [];
  });
  const transcript = segments.length
    ? segments.map((item) => `[${clock(item.start)}-${clock(item.end)}] ${item.speaker}: ${item.text}`).join("\n")
    : body.text?.trim() || "";
  if (!transcript) throw new Error("音声から発言を取得できませんでした。");
  return { transcript, segments, metrics: calculateMetrics(segments, body.duration) };
}

function calculateMetrics(segments: TimedSpeech[], reportedDuration?: number): AudioMetrics {
  const ordered = segments.toSorted((a, b) => a.start - b.start);
  const durationSeconds = Math.max(reportedDuration ?? 0, ...ordered.map((item) => item.end), 0);
  const speakingSeconds = ordered.reduce((sum, item) => sum + Math.max(0, item.end - item.start), 0);
  let silenceSeconds = ordered[0]?.start ?? 0;
  let overlapSeconds = 0;
  let longestSilenceSeconds = silenceSeconds;
  for (let index = 1; index < ordered.length; index += 1) {
    const gap = ordered[index].start - ordered[index - 1].end;
    if (gap >= 0) { silenceSeconds += gap; longestSilenceSeconds = Math.max(longestSilenceSeconds, gap); }
    else overlapSeconds += Math.abs(gap);
  }
  silenceSeconds += Math.max(0, durationSeconds - (ordered.at(-1)?.end ?? 0));
  const characters = ordered.reduce((sum, item) => sum + item.text.replace(/\s/g, "").length, 0);
  return {
    durationSeconds: round(durationSeconds), speakingSeconds: round(speakingSeconds), silenceSeconds: round(silenceSeconds),
    overlapSeconds: round(overlapSeconds), longestSilenceSeconds: round(longestSilenceSeconds), turns: ordered.length,
    charactersPerMinute: durationSeconds ? Math.round(characters / (durationSeconds / 60)) : 0,
  };
}

const round = (value: number) => Math.round(value * 10) / 10;
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
