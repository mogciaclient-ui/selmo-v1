"use server";

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
  if (!user || user.role !== "sales_rep") return;
  const parsed = addSchema.safeParse({ customerId: formData.get("customerId"), targetMonth: formData.get("targetMonth"), reason: formData.get("reason") ?? "" });
  if (!parsed.success) return;
  const { data: customer } = await user.db.from("customers").select("id,department_id").eq("id", parsed.data.customerId).eq("organization_id", user.organizationId).in("department_id", user.departmentIds).maybeSingle();
  if (!customer?.department_id) return;
  await user.db.from("monthly_customer_pickups").upsert({ organization_id: user.organizationId, department_id: customer.department_id, employee_id: user.employeeId, customer_id: customer.id, target_month: `${parsed.data.targetMonth}-01`, reason: parsed.data.reason || null, updated_at: new Date().toISOString() }, { onConflict: "employee_id,customer_id,target_month" });
  revalidatePath("/");
  refresh();
}

export async function removeMonthlyPickup(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "sales_rep") return;
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  await user.db.from("monthly_customer_pickups").delete().eq("id", id.data).eq("organization_id", user.organizationId).eq("employee_id", user.employeeId);
  revalidatePath("/");
  refresh();
}
