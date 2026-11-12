import type { AuthRole } from "../../lib/auth/types.ts";
export function canAssignProcessing(role: AuthRole) { return ["organization_admin", "department_admin", "department_admin_sales_rep"].includes(role); }
export const CONSIDERATION_STATUS = "open";
