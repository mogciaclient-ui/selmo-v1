import type { AuthContext } from "../../lib/auth/types.ts";
import { CONSIDERATION_STATUS } from "../../domain/tasks/rules.ts";
export type ConsiderationItem = { id: string; name: string; product_name: string | null; updated_at: string; customers: { name: string } | { name: string }[] | null; employees: { name: string } | { name: string }[] | null };
export async function findConsiderationItems(context: AuthContext): Promise<ConsiderationItem[]> {
  const rows: ConsiderationItem[] = [];
  for (let start = 0; ; start += 1000) {
    let query = context.db.from("opportunities").select("id,name,product_name,updated_at,customers(name),employees(name)").is("merged_into_id", null).eq("organization_id", context.organizationId).eq("status", CONSIDERATION_STATUS).order("updated_at", { ascending: false }).order("id");
    if (context.role === "sales_rep") query = query.eq("employee_id", context.employeeId);
    else if (context.role !== "organization_admin") query = query.in("department_id", context.departmentIds);
    const { data, error } = await query.range(start, start + 999);
    if (error) throw new Error("検討リストを取得できませんでした。");
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}
