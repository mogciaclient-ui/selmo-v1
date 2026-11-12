import type { AuthRole } from "./types.ts";

export const authRoles = ["sales_rep", "department_admin", "department_admin_sales_rep", "organization_admin"] as const;

export const roleLabels: Record<AuthRole, string> = {
  sales_rep: "営業担当",
  department_admin: "部門管理者",
  department_admin_sales_rep: "部門管理者兼営業担当",
  organization_admin: "本部管理者",
};

export function isDepartmentAdmin(role: AuthRole) {
  return role === "department_admin" || role === "department_admin_sales_rep";
}

export function canActAsSalesRep(role: AuthRole) {
  return role === "sales_rep" || role === "department_admin_sales_rep";
}
