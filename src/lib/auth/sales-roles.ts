import type { AuthRole } from "./types.ts";

/** 営業活動をする人のロール。メンバー一覧や集計の対象はこの2つだけ（部門管理者・本部管理者は含めない）。 */
export const SALES_ROLES = ["sales_rep", "department_admin_sales_rep"] as const satisfies readonly AuthRole[];

export function isSalesRole(role: string) {
  return (SALES_ROLES as readonly string[]).includes(role);
}
