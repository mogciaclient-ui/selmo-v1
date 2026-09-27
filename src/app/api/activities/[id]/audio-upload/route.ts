import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/get-current-user";

const requestSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.enum(["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/wav", "audio/webm", "video/mp4"]),
  size: z.number().int().positive().max(25 * 1024 * 1024),
  kind: z.enum(["meeting", "voice-reference"]).default("meeting"),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "ログインし直してください。" }, { status: 401 });
  const { id } = await context.params;
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "音声ファイルはMP3・M4A・WAV・WebM・MP4、25MB以下にしてください。" }, { status: 400 });
  let query = user.db.from("activities").select("id,employee_id,department_id").eq("id", id).eq("organization_id", user.organizationId);
  if (user.role === "sales_rep") query = query.eq("employee_id", user.employeeId);
  if (user.role === "department_admin") query = query.in("department_id", user.departmentIds);
  const { data: activity } = await query.maybeSingle();
  if (!activity) return Response.json({ message: "この活動へ音声を登録する権限がありません。" }, { status: 404 });
  if (parsed.data.kind === "voice-reference" && activity.employee_id !== user.employeeId) return Response.json({ message: "参照音声は本人だけ登録できます。" }, { status: 403 });
  const extension = safeExtension(parsed.data.fileName);
  const path = parsed.data.kind === "voice-reference"
    ? `${user.organizationId}/voice-references/${user.employeeId}/reference-${randomUUID()}.${extension}`
    : `${user.organizationId}/activities/${id}/${randomUUID()}.${extension}`;
  const { data, error } = await user.db.storage.from("sales-audio").createSignedUploadUrl(path, { upsert: false });
  if (error || !data) return Response.json({ message: "アップロード先を準備できませんでした。DB更新を適用してください。" }, { status: 500 });
  return Response.json({ path, signedUrl: data.signedUrl, contentType: parsed.data.contentType });
}

function safeExtension(fileName: string) {
  const extension = fileName.split(".").at(-1)?.toLowerCase();
  return extension && /^[a-z0-9]{2,5}$/.test(extension) ? extension : "mp3";
}
