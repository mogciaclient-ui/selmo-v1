"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { canAssignProcessing } from "@/domain/tasks/rules";
import { findProcessingMembers } from "@/infrastructure/supabase/processing-repository";
export type ProcessingState = { success?: boolean; message?: string };
const contentSchema = z.object({ customerName: z.string().trim().min(1, "客先名を入力してください。").max(200), content: z.string().trim().min(1, "処理内容を入力してください。").max(2000), dueDate: z.iso.date("期限を入力してください。"), assigneeId: z.uuid() });
export async function saveProcessingTask(_: ProcessingState, form: FormData): Promise<ProcessingState> {
  const user = await getCurrentUser();
  if (!user) return { message: "ログインし直してください。" };
  const operation = z.enum(["add", "edit", "resolve", "note", "delete"]).safeParse(form.get("operation"));
  if (!operation.success) return { message: "操作が正しくありません。" };
  const op = operation.data;
  const manager = canAssignProcessing(user.role);
  if (["add", "edit", "delete"].includes(op) && !manager) return { message: "処理を依頼・編集できるのは管理者です。" };
  const now = new Date().toISOString();
  let record = {};
  if (op === "add" || op === "edit") {
    const parsed = contentSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };
    const member = (await findProcessingMembers(user)).find(m => m.id === parsed.data.assigneeId);
    if (!member) return { message: "依頼できる担当者を選択してください。" };
    record = { customer_name: parsed.data.customerName, content: parsed.data.content, due_date: parsed.data.dueDate, assignee_user_id: member.id, department_id: member.departmentId, updated_at: now };
  } else if (op === "resolve") {
    const resolved = z.enum(["true", "false"]).safeParse(form.get("resolved"));
    if (!resolved.success) return { message: "解消状態が正しくありません。" };
    record = { resolved_at: resolved.data === "true" ? now : null, updated_at: now };
  } else if (op === "note") {
    const note = z.string().trim().max(2000).safeParse(form.get("progressNote"));
    if (!note.success) return { message: "対応メモは2000文字以内で入力してください。" };
    record = { progress_note: note.data, updated_at: now };
  }
  if (op === "add") {
    const { error } = await user.db.from("processing_tasks").insert({ ...record, organization_id: user.organizationId, requested_by: user.userId });
    if (error) return { message: "処理を依頼できませんでした。" };
  } else {
    const id = z.uuid().safeParse(form.get("id"));
    if (!id.success) return { message: "処理の指定が正しくありません。" };
    // Check the existing scope before an edit can move a task to another assignee.
    let lookup = user.db.from("processing_tasks").select("id").eq("id", id.data).eq("organization_id", user.organizationId);
    if (!manager) lookup = lookup.eq("assignee_user_id", user.userId);
    else if (user.role !== "organization_admin") lookup = lookup.in("department_id", user.departmentIds);
    const { data: existing, error: lookupError } = await lookup.maybeSingle();
    if (lookupError || !existing) return { message: "操作できる処理がありません。" };
    const query = user.db.from("processing_tasks");
    let mutation = (op === "delete" ? query.delete() : query.update(record)).eq("id", id.data).eq("organization_id", user.organizationId);
    if (!manager) mutation = mutation.eq("assignee_user_id", user.userId);
    else if (user.role !== "organization_admin") mutation = mutation.in("department_id", user.departmentIds);
    const { data, error } = await mutation.select("id").maybeSingle();
    if (error || !data) return { message: "処理を更新できませんでした。" };
  }
  revalidatePath("/");
  return { success: true, message: op === "resolve" ? "解消状態を更新しました。" : "処理を保存しました。" };
}
