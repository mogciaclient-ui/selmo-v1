import type { AuthContext } from "../../lib/auth/types.ts";
export type TodoItem = { id: string; customer_name: string; title: string; due_date: string | null; completed_at: string | null; created_at: string };
export async function findPersonalTodos(context: AuthContext): Promise<TodoItem[]> {
  const items: TodoItem[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await context.db.from("personal_todos").select("id,customer_name,title,due_date,completed_at,created_at").eq("organization_id", context.organizationId).eq("app_user_id", context.userId).order("created_at", { ascending: false }).order("id").range(start, start + 999);
    if (error) throw new Error("ToDoを取得できませんでした。");
    items.push(...data);
    if (data.length < 1000) return items;
  }
}
