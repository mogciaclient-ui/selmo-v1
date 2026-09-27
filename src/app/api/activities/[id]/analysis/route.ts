import { getCurrentUser } from "@/lib/auth/get-current-user";
import { analyzeSalesTranscript } from "@/lib/openai/analyze-sales-transcript";

async function authorize(id: string) {
  const user = await getCurrentUser();
  if (!user) return { response: Response.json({ message: "ログインし直してください。" }, { status: 401 }) };
  let query = user.db.from("activities").select("id").eq("id", id).eq("organization_id", user.organizationId);
  if (user.role === "sales_rep") query = query.eq("employee_id", user.employeeId);
  if (user.role === "department_admin") query = query.in("department_id", user.departmentIds);
  const { data } = await query.maybeSingle();
  if (!data) return { response: Response.json({ message: "分析結果を表示する権限がありません。" }, { status: 404 }) };
  return { user };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const authorized = await authorize(id); if (authorized.response) return authorized.response; const user = authorized.user!;
  const { data, error } = await user.db.from("activity_ai_analyses").select("status,analysis,raw_transcript,separated_transcript,updated_at").eq("organization_id", user.organizationId).eq("activity_id", id).maybeSingle();
  if (error) return Response.json({ message: "分析結果を取得できませんでした。" }, { status: 500 });
  if (!data) return Response.json({ message: "分析結果はまだありません。" }, { status: 404 });
  return Response.json(data);
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const authorized = await authorize(id); if (authorized.response) return authorized.response; const user = authorized.user!;
  const { data } = await user.db.from("activity_ai_analyses").select("raw_transcript,audio_metrics").eq("organization_id", user.organizationId).eq("activity_id", id).maybeSingle();
  if (!data?.raw_transcript) return Response.json({ message: "再分析できる文字起こしがありません。" }, { status: 404 });
  try {
    const evaluated = await analyzeSalesTranscript(data.raw_transcript);
    const updatedAt = new Date().toISOString();
    const analysis = { ...evaluated.result, ...(data.audio_metrics ? { audioMetrics: data.audio_metrics } : {}) };
    const { error } = await user.db.from("activity_ai_analyses").update({ status: "completed", separated_transcript: evaluated.result.dialogue, analysis, model: evaluated.model, error_message: null, updated_at: updatedAt }).eq("organization_id", user.organizationId).eq("activity_id", id);
    if (error) throw error;
    return Response.json({ status: "completed", analysis, raw_transcript: data.raw_transcript, separated_transcript: evaluated.result.dialogue, updated_at: updatedAt });
  } catch (error) { return Response.json({ message: error instanceof Error ? error.message : "再分析に失敗しました。" }, { status: 500 }); }
}
