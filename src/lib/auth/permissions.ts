import type { AuthContext } from "@/lib/auth/types";

export function canAccessDepartment(context: AuthContext, departmentId: string) {
  return context.role === "organization_admin" || context.departmentIds.includes(departmentId);
}

export function canManageActivity(context: AuthContext, employeeId: string, departmentId: string) {
  return context.employeeId === employeeId || context.role === "organization_admin" || (context.role === "department_admin" && context.departmentIds.includes(departmentId));
}
