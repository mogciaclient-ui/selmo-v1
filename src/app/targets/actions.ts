"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { canActAsSalesRep } from "@/lib/auth/roles";
import { targetTypes } from "@/domain/targets/rules";
export type TargetActionState = { success?: boolean; message?: string };
const schema = z.object({
  id: z.union([z.uuid(), z.literal("")]), customerId: z.uuid(), targetMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  customerType: z.enum(targetTypes), product: z.string().trim().min(1, "想定商材を選択してください。").max(200),
  estimatedProfit: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER), note: z.string().trim().max(10000),
});
export async function saveTarget(_: TargetActionState, form: FormData): Promise<TargetActionState> {
  const user = await getCurrentUser();
  if (!user || !canActAsSalesRep(user.role)) return { message: "自分のターゲットを登録・編集できるのは営業担当です。" };
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };
  const v = parsed.data;
  const { data: customer } = await user.db.from("customers").select("id,department_id").eq("id", v.customerId).eq("organization_id", user.organizationId).in("department_id", user.departmentIds).maybeSingle();
  if (!customer) return { message: "所属部門の顧客を選択してください。" };
  // Inactive historic products may be retained while editing their own record.
  const { data: existing, error: lookupError } = v.id ? await user.db.from("monthly_customer_pickups").select("product").eq("id", v.id).eq("organization_id", user.organizationId).eq("employee_id", user.employeeId).in("department_id", user.departmentIds).maybeSingle() : { data: null, error: null };
  if (lookupError || (v.id && !existing)) return { message: "編集できるターゲットがありません。" };
  if (!existing || existing.product !== v.product) {
    const { data: product } = await user.db.from("products").select("id").eq("organization_id", user.organizationId).eq("name", v.product).eq("status", "active").limit(1).maybeSingle();
    if (!product) return { message: "有効な商材マスタから選択してください。" };
  }
  const record = { organization_id: user.organizationId, department_id: customer.department_id, employee_id: user.employeeId,
    customer_id: v.customerId, target_month: `${v.targetMonth}-01`, customer_type: v.customerType, product: v.product,
    estimated_profit: v.estimatedProfit, reason: v.note || null, updated_by: user.userId, updated_at: new Date().toISOString() };
  const result = v.id ? await user.db.from("monthly_customer_pickups").update(record).eq("id", v.id).eq("organization_id", user.organizationId).eq("employee_id", user.employeeId).in("department_id", user.departmentIds).select("id").maybeSingle()
    : await user.db.from("monthly_customer_pickups").insert(record).select("id").single();
  if (result.error || !result.data) return { message: result.error?.code === "23505" ? "同じ月・顧客・分類・商材のターゲットが登録済みです。" : "ターゲットを保存できませんでした。" };
  revalidatePath("/targets"); revalidatePath("/");
  return { success: true, message: "ターゲットを保存しました。" };
}
