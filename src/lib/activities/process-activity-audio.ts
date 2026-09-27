import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { analyzeSalesTranscript } from "@/lib/openai/analyze-sales-transcript";
import { transcribeSalesAudio } from "@/lib/openai/transcribe-sales-audio";

export async function processActivityAudio(input: { organizationId: string; activityId: string; employeeId: string; audioPath: string }) {
  const db = createAdminClient();
  const match = { organization_id: input.organizationId, activity_id: input.activityId };
  try {
    const [{ data: audio, error: audioError }, { data: voice }, { data: activity }] = await Promise.all([
      db.storage.from("sales-audio").download(input.audioPath),
      db.from("employee_voice_references").select("storage_path").eq("organization_id", input.organizationId).eq("employee_id", input.employeeId).maybeSingle(),
      db.from("activities").select("common_report").match({ organization_id: input.organizationId, id: input.activityId }).maybeSingle(),
    ]);
    if (audioError || !audio) throw new Error("アップロードした音声を取得できませんでした。");
    const reference = voice?.storage_path ? (await db.storage.from("sales-audio").download(voice.storage_path)).data ?? undefined : undefined;
    const transcribed = await transcribeSalesAudio(audio, input.audioPath.split("/").at(-1) || "meeting.mp3", reference);
    const evaluated = await analyzeSalesTranscript(transcribed.transcript);
    const updatedAt = new Date().toISOString();
    const { error } = await db.from("activity_ai_analyses").update({
      status: "completed", raw_transcript: transcribed.transcript, separated_transcript: evaluated.result.dialogue,
      analysis: { ...evaluated.result, audioMetrics: transcribed.metrics }, audio_duration_seconds: transcribed.metrics.durationSeconds,
      audio_metrics: transcribed.metrics, model: `${process.env.OPENAI_DIARIZATION_MODEL || "gpt-4o-transcribe-diarize"} + ${evaluated.model}`,
      error_message: null, updated_at: updatedAt,
    }).match(match);
    if (error) throw error;
    await db.from("activities").update({ common_report: { ...(activity?.common_report ?? {}), speakerSeparationStatus: "completed", aiAnalysisStatus: "completed" }, updated_at: updatedAt }).match({ organization_id: input.organizationId, id: input.activityId });
  } catch (reason) {
    const updatedAt = new Date().toISOString();
    await db.from("activity_ai_analyses").update({ status: "failed", error_message: reason instanceof Error ? reason.message : "音声分析に失敗しました。", updated_at: updatedAt }).match(match);
    const { data: activity } = await db.from("activities").select("common_report").match({ organization_id: input.organizationId, id: input.activityId }).maybeSingle();
    await db.from("activities").update({ common_report: { ...(activity?.common_report ?? {}), speakerSeparationStatus: "failed", aiAnalysisStatus: "failed" }, updated_at: updatedAt }).match({ organization_id: input.organizationId, id: input.activityId });
  }
}
