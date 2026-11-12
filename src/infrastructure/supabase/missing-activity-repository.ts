import type { SupabaseClient } from "@supabase/supabase-js";
import type { RepositoryScope } from "@/application/ports/repository-scope";
import { tokyoDayStart } from "../../domain/schedules/rules.ts";

export type MissingActivityRow = {
  id: string; employee_id: string; starts_at: string; ends_at: string; activity_type: string;
  employees: { name: string } | { name: string }[] | null;
  customers: { name: string } | { name: string }[] | null;
};
export function canViewMissingActivities(scope: RepositoryScope, employeeId: string) {
  return scope.role !== "sales_rep" || employeeId === scope.employeeId;
}
export async function getMissingActivities(db: SupabaseClient, scope: RepositoryScope, employeeId?: string, now = new Date()): Promise<MissingActivityRow[]> {
  if (employeeId && !canViewMissingActivities(scope, employeeId)) throw new Error("この担当者の未入力予定を閲覧する権限がありません。");
  const rows: MissingActivityRow[] = [];
  const cutoff = tokyoDayStart(now);
  for (let offset = 0; ; offset += 1000) {
    let query = db.from("activities").select("id,employee_id,starts_at,ends_at,activity_type,employees(name),customers(name)")
      .eq("organization_id", scope.organizationId).in("activity_type", ["visit", "online"])
      .lt("starts_at", cutoff).not("status", "in", "(completed,cancelled,canceled)")
      .or("result.is.null,result.eq.").order("starts_at").order("id").range(offset, offset + 999);
    if (scope.role !== "organization_admin") query = query.in("department_id", scope.departmentIds);
    if (scope.role === "sales_rep") query = query.eq("employee_id", scope.employeeId);
    else if (employeeId) query = query.eq("employee_id", employeeId);
    const { data, error } = await query;
    if (error) throw new Error("未入力の予定を取得できませんでした。", { cause: error });
    rows.push(...(data ?? []) as unknown as MissingActivityRow[]);
    if (!data || data.length < 1000) break;
  }
  return rows;
}
export function missingCounts(rows: Pick<MissingActivityRow, "employee_id">[]) {
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.employee_id] = (counts[row.employee_id] ?? 0) + 1;
  return counts;
}
