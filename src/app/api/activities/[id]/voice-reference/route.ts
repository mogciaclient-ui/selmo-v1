import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/get-current-user";

const schema = z.object({ path: z.string().min(1).max(1000), contentType: z.string().min(1).max(100) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "ログインし直してください。" }, { status: 401 });
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !parsed.data.path.startsWith(`${user.organizationId}/voice-references/${user.employeeId}/`)) return Response.json({ message: "参照音声が不正です。" }, { status: 400 });
  const { data: activity } = await user.db.from("activities").select("id,employee_id").eq("organization_id", user.organizationId).eq("id", id).eq("employee_id", user.employeeId).maybeSingle();
  if (!activity) return Response.json({ message: "参照音声を登録する権限がありません。" }, { status: 403 });
  const { error } = await user.db.from("employee_voice_references").upsert({ employee_id: user.employeeId, organization_id: user.organizationId, storage_path: parsed.data.path, content_type: parsed.data.contentType, updated_at: new Date().toISOString() });
  if (error) return Response.json({ message: "参照音声を保存できませんでした。" }, { status: 500 });
  return Response.json({ success: true });
}
