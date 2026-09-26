"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/get-current-user";

export type RegisterCustomerState = { message?: string; success?: boolean; customerExternalId?: string };

const text = (max = 500) => z.string().trim().max(max);
const schema = z.object({
  departmentId: text(36), name: text(200), nameKana: text(200), branchName: text(200), branchKana: text(200),
  postalCode: text(20), prefecture: text(20), address1: text(500),
});

const detailKeys = [
  "corporatePosition", "shortName", "shortNameKana", "representative", "representativeKana", "url", "listing", "capital", "employeesCount", "basicNotes", "customerCategory", "alphaHikari", "alphaDenki", "axcel",
  "branchAddress2", "branchFax", "branchNotes", "bookmark",
] as const;

function optional(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function registerCustomer(_: RegisterCustomerState, formData: FormData): Promise<RegisterCustomerState> {
  const context = await getCurrentUser();
  if (!context) return { message: "ログインし直してください。" };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };
  const input = parsed.data;
  let departmentId = input.departmentId || context.departmentIds[0] || null;
  if (!departmentId) {
    const { data: firstDepartment } = await context.db.from("departments").select("id").eq("organization_id", context.organizationId).order("created_at").limit(1).maybeSingle();
    departmentId = firstDepartment?.id ?? null;
  }
  if (departmentId && context.role !== "organization_admin" && !context.departmentIds.includes(departmentId)) return { message: "この部門を操作する権限がありません。" };

  const details: Record<string, unknown> = { nameKana: input.nameKana, branchName: input.branchName, branchKana: input.branchKana, prefecture: input.prefecture, address1: input.address1 };
  for (const key of detailKeys) details[key] = optional(formData, key);
  details.products = Array.from({ length: 3 }, (_, index) => {
    const prefix = `product${index + 1}`;
    return { name: optional(formData, `${prefix}Name`), leaseFee: optional(formData, `${prefix}LeaseFee`), leaseStart: optional(formData, `${prefix}LeaseStart`) };
  });
  details.equipment = Array.from({ length: 8 }, (_, index) => {
    const prefix = `equipment${index + 1}`;
    return { type: optional(formData, `${prefix}Type`), dealer: optional(formData, `${prefix}Dealer`), manufacturer: optional(formData, `${prefix}Manufacturer`), model: optional(formData, `${prefix}Model`), leaseCompany: optional(formData, `${prefix}LeaseCompany`), remainingPayments: optional(formData, `${prefix}RemainingPayments`), leaseFee: optional(formData, `${prefix}LeaseFee`), installedAt: optional(formData, `${prefix}InstalledAt`), leaseEnd: optional(formData, `${prefix}LeaseEnd`) };
  }).filter((item) => Object.values(item).some(Boolean));

  const address = `${input.prefecture}${input.address1}${optional(formData, "branchAddress2")}`;
  const { data: customer, error } = await context.db.from("customers").insert({
    organization_id: context.organizationId,
    department_id: departmentId,
    assigned_employee_id: context.employeeId,
    name: input.name || "名称未設定",
    phone: optional(formData, "branchPhone") || null,
    postal_code: input.postalCode ? input.postalCode.replace("-", "") : null,
    address: address || null,
    notes: optional(formData, "basicNotes") || null,
    registration_details: details,
  }).select("external_id").single();
  if (error) return { message: error.code === "42703" ? "顧客登録用のデータベース更新を適用してください。" : "顧客を登録できませんでした。" };
  revalidatePath("/customers");
  revalidatePath("/");
  return { success: true, message: "顧客を登録しました。", customerExternalId: customer.external_id };
}
