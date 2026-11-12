import type { AuthRole } from "../../lib/auth/types.ts";
export const targetTypes = ["新規", "GUP", "他商材"] as const;
export function canManageProducts(role: AuthRole) { return ["department_admin", "department_admin_sales_rep", "organization_admin"].includes(role); }
export function canViewAllTargets(role: AuthRole) { return ["department_admin", "department_admin_sales_rep", "organization_admin"].includes(role); }
export type TargetActivity = { employee_id: string; starts_at: string; status: string; activity_type: string; schedule_details: { pickupId?: string } | null };
export function targetExecuted(id: string, employeeId: string, month: string, activities: TargetActivity[]) {
  return activities.some(activity => activity.employee_id === employeeId && activity.schedule_details?.pickupId === id
    && activity.status === "completed" && ["visit", "online"].includes(activity.activity_type)
    && new Date(activity.starts_at).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }).startsWith(`${month}-`));
}
export function executionRate(executed: number, total: number) { return total ? Math.round(executed / total * 100) : 0; }
