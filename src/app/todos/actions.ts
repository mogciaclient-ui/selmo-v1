"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/get-current-user";
export type TodoState = { success?: boolean; message?: string };
const content = z.object({ customerName: z.string().trim().max(200), title: z.string().trim().min(1, "ToDoを入力してください。").max(500, "ToDoは500文字以内で入力してください。"), dueDate: z.union([z.iso.date(), z.literal("")]) });
export async function saveTodo(_: TodoState, form: FormData): Promise<TodoState> {
  const user = await getCurrentUser();
  if (!user) return { message: "ログインし直してください。" };
  const operation = z.enum(["add", "edit", "toggle", "delete"]).safeParse(form.get("operation"));
  if (!operation.success) return { message: "操作が正しくありません。" };
  const now = new Date().toISOString();
  const parsed = ["add", "edit"].includes(operation.data) ? content.safeParse({ customerName: form.get("customerName") ?? "", title: form.get("title"), dueDate: form.get("dueDate") ?? "" }) : null;
  if (parsed && !parsed.success) return { message: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };
  const values = parsed?.success ? { customer_name: parsed.data.customerName, title: parsed.data.title, due_date: parsed.data.dueDate || null, updated_at: now } : {};
  if (operation.data === "add") {
    const { error } = await user.db.from("personal_todos").insert({ ...values, organization_id: user.organizationId, app_user_id: user.userId });
    if (error) return { message: "ToDoを追加できませんでした。" };
  } else {
    const id = z.uuid().safeParse(form.get("id"));
    if (!id.success) return { message: "対象のToDoが正しくありません。" };
    const query = user.db.from("personal_todos");
    let mutation;
    if (operation.data === "delete") mutation = query.delete();
    else if (operation.data === "toggle") {
      const completed = z.enum(["true", "false"]).safeParse(form.get("completed"));
      if (!completed.success) return { message: "完了状態が正しくありません。" };
      mutation = query.update({ completed_at: completed.data === "true" ? now : null, updated_at: now });
    } else mutation = query.update(values);
    const { data, error } = await mutation.eq("id", id.data).eq("organization_id", user.organizationId).eq("app_user_id", user.userId).select("id").maybeSingle();
    if (error || !data) return { message: "自分のToDoを更新できませんでした。" };
  }
  revalidatePath("/");
  return { success: true, message: operation.data === "delete" ? "ToDoを削除しました。" : "ToDoを保存しました。" };
}
