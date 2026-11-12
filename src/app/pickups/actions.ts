"use server";

import { canActAsSalesRep } from "@/lib/auth/roles";

import { refresh, revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/get-current-user";

const addSchema = z.object({
  customerId: z.uuid(),
  targetMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  reason: z.string().trim().max(500),
});

export async function addMonthlyPickup(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !canActAsSalesRep(user.role)) return;
  const parsed = addSchema.safeParse({ customerId: formData.get("customerId"), targetMonth: formData.get("targetMonth"), reason: formData.get("reason") ?? "" });
  if (!parsed.success) return;
  const { data: customer } = await user.db.from("customers").select("id,department_id").eq("id", parsed.data.customerId).eq("organization_id", user.organizationId).in("department_id", user.departmentIds).maybeSingle();
  if (!customer?.department_id) return;
  await user.db.from("monthly_customer_pickups").upsert({ organization_id: user.organizationId, department_id: customer.department_id, employee_id: user.employeeId, customer_id: customer.id, target_month: `${parsed.data.targetMonth}-01`, reason: parsed.data.reason || null, customer_type: "新規", product: "", updated_by: user.userId, updated_at: new Date().toISOString() }, { onConflict: "employee_id,customer_id,target_month,customer_type,product" });
  revalidatePath("/targets");
  revalidatePath("/");
  refresh();
}

export async function removeMonthlyPickup(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !canActAsSalesRep(user.role)) return;
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  await user.db.from("monthly_customer_pickups").delete().eq("id", id.data).eq("organization_id", user.organizationId).eq("employee_id", user.employeeId);
  revalidatePath("/targets");
  revalidatePath("/");
  refresh();
}

export async function cancelPickupAppointment(_: { message?: string }, formData: FormData): Promise<{ message?: string }> {
  const user = await getCurrentUser();
  if (!user || !canActAsSalesRep(user.role)) return { message: "予定を解除する権限がありません。" };
  const parsed = z.object({ id: z.uuid(), pickupId: z.uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: "対象の予定が正しくありません。" };
  const { data, error } = await user.db.from("activities").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", parsed.data.id).eq("organization_id", user.organizationId).eq("employee_id", user.employeeId).eq("status", "scheduled").contains("schedule_details", { pickupId: parsed.data.pickupId }).select("id").maybeSingle();
  if (error || !data) return { message: "解除できませんでした。登録済みの結果がないか確認してください。" };
  revalidatePath("/targets");
  revalidatePath("/"); revalidatePath("/results");
  return { message: "アポのカレンダー登録を解除しました。" };
}
