import type { AuthContext } from "@/lib/auth/types";

export function canAccessDepartment(context: AuthContext, departmentId: string) {
  return context.role === "organization_admin" || context.departmentIds.includes(departmentId);
}

export function canManageActivity(context: AuthContext, employeeId: string, _departmentId: string) {
  void _departmentId;
  return context.role === "sales_rep" && context.employeeId === employeeId;
}
