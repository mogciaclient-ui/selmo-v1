import type { AuthContext } from "@/lib/auth/types";
import { targetExecuted } from "../../domain/targets/rules.ts";
import type { TargetActivity } from "../../domain/targets/rules.ts";
export type TargetRow = {
  id: string; department_id: string; employee_id: string; customer_id: string; target_month: string;
  customer_type: string; product: string; estimated_profit: number; reason: string | null; created_at: string; updated_at: string;
  customers: { name: string; external_id: string | null; phone: string | null; address: string | null } | null;
  employees: { name: string } | null;
};
export type TargetHistory = { id: string; pickup_id: string; previous_note: string | null; note: string | null; changed_at: string };
export async function findTargets(context: AuthContext, month: string, employeeId = "") {
  const rows: TargetRow[] = [];
  for (let start = 0; ; start += 1000) {
    let query = context.db.from("monthly_customer_pickups").select("id,department_id,employee_id,customer_id,target_month,customer_type,product,estimated_profit,reason,created_at,updated_at,customers(name,external_id,phone,address),employees(name)").eq("organization_id", context.organizationId).eq("target_month", `${month}-01`).order("created_at", { ascending: false }).order("id");
    if (context.role === "sales_rep") query = query.eq("employee_id", context.employeeId);
    if (context.role !== "organization_admin") query = query.in("department_id", context.departmentIds);
    if (employeeId && context.role !== "sales_rep") query = query.eq("employee_id", employeeId);
    const { data, error } = await query.range(start, start + 999);
    if (error) throw new Error("ターゲットリストを取得できませんでした。");
    rows.push(...(data as unknown as TargetRow[]));
    if (data.length < 1000) break;
  }
  const activities: (TargetActivity & { id: string })[] = [];
  for (let offset = 0; offset < rows.length; offset += 100) {
    // Include appointments in other months too, so they can still be cancelled here.
    for (let start = 0; ; start += 1000) {
      let query = context.db.from("activities").select("id,employee_id,starts_at,status,activity_type,schedule_details").eq("organization_id", context.organizationId).in("schedule_details->>pickupId", rows.slice(offset, offset + 100).map(row => row.id)).in("activity_type", ["visit", "online"]).neq("status", "cancelled").order("id");
      if (context.role === "sales_rep") query = query.eq("employee_id", context.employeeId);
      if (context.role !== "organization_admin") query = query.in("department_id", context.departmentIds);
      if (employeeId && context.role !== "sales_rep") query = query.eq("employee_id", employeeId);
      const { data, error } = await query.range(start, start + 999);
      if (error) throw new Error("ターゲットの活動状況を取得できませんでした。");
      activities.push(...data as (TargetActivity & { id: string })[]);
      if (data.length < 1000) break;
    }
  }
  const history: TargetHistory[] = [];
  for (let offset = 0; offset < rows.length; offset += 100) {
    for (let start = 0; ; start += 1000) {
      const { data, error } = await context.db.from("target_note_history").select("id,pickup_id,previous_note,note,changed_at").in("pickup_id", rows.slice(offset, offset + 100).map(row => row.id)).order("changed_at", { ascending: false }).order("id").range(start, start + 999);
      if (error) throw new Error("メモの変更履歴を取得できませんでした。");
      history.push(...data);
      if (data.length < 1000) break;
    }
  }
  return rows.map(row => ({ ...row, executed: targetExecuted(row.id, row.employee_id, month, activities),
    appointmentIds: activities.filter(a => a.schedule_details?.pickupId === row.id && a.employee_id === row.employee_id && a.status === "scheduled").map(a => a.id),
    history: history.filter(h => h.pickup_id === row.id) }));
}
