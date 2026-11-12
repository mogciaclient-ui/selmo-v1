import type { AuthContext } from "../../lib/auth/types.ts";
import { canAssignProcessing } from "../../domain/tasks/rules.ts";
export type ProcessingTask = { id: string; department_id: string; assignee_user_id: string; customer_name: string; content: string; due_date: string; progress_note: string; resolved_at: string | null; created_at: string; assigneeName: string };
export type ProcessingMember = { id: string; name: string; departmentId: string };
export function scopeProcessing<T extends { eq: (column: string, value: string) => unknown; in: (column: string, values: string[]) => unknown }>(query: T, context: AuthContext): T {
  query = query.eq("organization_id", context.organizationId) as T;
  if (!canAssignProcessing(context.role)) return query.eq("assignee_user_id", context.userId) as T;
  return context.role === "organization_admin" ? query : query.in("department_id", context.departmentIds) as T;
}
export async function findProcessingTasks(context: AuthContext): Promise<ProcessingTask[]> {
  const tasks: ProcessingTask[] = [];
  for (let start = 0; ; start += 1000) {
    const query = context.db.from("processing_tasks").select("id,department_id,assignee_user_id,customer_name,content,due_date,progress_note,resolved_at,created_at,assignee:app_users!processing_tasks_assignee_user_id_fkey(employees(name))").order("due_date").order("created_at").order("id");
    const { data, error } = await scopeProcessing(query, context).range(start, start + 999);
    if (error) throw new Error("処理一覧を取得できませんでした。");
    for (const row of data) {
      const assignee = Array.isArray(row.assignee) ? row.assignee[0] : row.assignee;
      const employee = Array.isArray(assignee?.employees) ? assignee.employees[0] : assignee?.employees;
      tasks.push({ ...row, assigneeName: employee?.name ?? "—" });
    }
    if (data.length < 1000) return tasks;
  }
}
export async function findProcessingMembers(context: AuthContext): Promise<ProcessingMember[]> {
  if (!canAssignProcessing(context.role)) return [];
  const { data, error } = await context.db.from("app_users").select("id,employees(name),app_user_departments(department_id,is_primary)").eq("organization_id", context.organizationId).eq("status", "active").order("created_at");
  if (error) throw new Error("処理の担当者を取得できませんでした。");
  return (data ?? []).flatMap(row => {
    const departments = row.app_user_departments.filter(d => context.role === "organization_admin" || context.departmentIds.includes(d.department_id)).toSorted((a, b) => Number(b.is_primary) - Number(a.is_primary));
    if (!departments.length) return [];
    const employee = Array.isArray(row.employees) ? row.employees[0] : row.employees;
    return [{ id: row.id, name: employee?.name ?? "名称未設定", departmentId: departments[0].department_id }];
  });
}
