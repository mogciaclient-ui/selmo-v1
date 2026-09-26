"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/get-current-user";

export type BasicOpportunityState = { message?: string; success?: boolean; opportunityId?: string; externalId?: string };
const schema = z.object({ customerId: z.uuid(), externalId: z.string().trim().min(1), name: z.string().trim().min(1, "案件名を入力してください。").max(200), productName: z.string().trim().min(1, "商材を選択してください。").max(200), branchName: z.string().trim().max(200), customerContact: z.string().trim().max(200), employeeId: z.uuid(), teamVisibility: z.enum(["organization", "private"]), notes: z.string().trim().max(5000), status: z.enum(["open", "won", "on_hold", "lost"]) });

export async function createBasicOpportunity(_: BasicOpportunityState, formData: FormData): Promise<BasicOpportunityState> {
  const context = await getCurrentUser();
  if (!context) return { message: "ログインし直してください。" };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };
  const value = parsed.data;
  let customerQuery = context.db.from("customers").select("id,department_id,external_id").eq("organization_id", context.organizationId).eq("id", value.customerId).eq("external_id", value.externalId);
  if (context.role !== "organization_admin") customerQuery = customerQuery.in("department_id", context.departmentIds);
  const { data: customer } = await customerQuery.maybeSingle();
  if (!customer?.department_id) return { message: "この顧客を操作する権限がありません。" };
  const { data: product } = await context.db.from("products").select("id").eq("organization_id", context.organizationId).eq("status", "active").eq("name", value.productName).maybeSingle();
  if (!product) return { message: "有効な商材を選択してください。" };
  let ownerQuery = context.db.from("app_users").select("employee_id,app_user_departments!inner(department_id)").eq("organization_id", context.organizationId).eq("employee_id", value.employeeId).eq("status", "active");
  if (context.role === "sales_rep") ownerQuery = ownerQuery.eq("employee_id", context.employeeId);
  if (context.role === "department_admin") ownerQuery = ownerQuery.eq("app_user_departments.department_id", customer.department_id);
  const { data: owner } = await ownerQuery.limit(1).maybeSingle();
  if (!owner) return { message: "主営業担当を選択できません。" };
  const { data: opportunity, error } = await context.db.from("opportunities").insert({ organization_id: context.organizationId, department_id: customer.department_id, customer_id: customer.id, employee_id: value.employeeId, name: value.name, product_name: value.productName, branch_name: value.branchName || null, customer_contact: value.customerContact || null, team_visibility: value.teamVisibility, notes: value.notes || null, status: value.status, stage: "approach", confidence: "B", priority: "medium", expected_amount: 0, order_amount: 0 }).select("id").single();
  if (error || !opportunity) return { message: "案件を登録できませんでした。" };
  revalidatePath("/opportunities"); revalidatePath(`/customers/${customer.external_id}`);
  return { success: true, opportunityId: opportunity.id, externalId: customer.external_id };
}
