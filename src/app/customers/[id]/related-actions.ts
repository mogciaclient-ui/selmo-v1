"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/get-current-user";

const base = z.object({ customerId: z.uuid(), externalId: z.string().trim().min(1).max(100) });
const branchSchema = base.extend({ name: z.string().trim().min(1).max(200), kana: z.string().trim().max(200), postalCode: z.string().trim().max(20), prefecture: z.string().trim().max(50), address: z.string().trim().max(500), phone: z.string().trim().max(50), fax: z.string().trim().max(50), notes: z.string().trim().max(2000) });
const kana = z.string().trim().min(1, "担当者名［カナ］を入力してください。").max(100).regex(/^[ァ-ヶー\s]+$/, "カナは全角カタカナで入力してください。");
const contactSchema = base.extend({
  lastName: z.string().trim().min(1, "姓を入力してください。").max(100), firstName: z.string().trim().min(1, "名を入力してください。").max(100),
  lastNameKana: kana, firstNameKana: kana, department: z.string().trim().max(200), title: z.string().trim().max(200),
  gender: z.enum(["male", "female", "unknown"]), role: z.enum(["contact", "decision_maker", "key_person", "other", "unknown"]),
  phone: z.string().trim().max(50), mobilePhone: z.string().trim().max(50), pcEmail: z.union([z.literal(""), z.email()]), mobileEmail: z.union([z.literal(""), z.email()]),
  firstCardDate: z.union([z.literal(""), z.iso.date()]), firstCardOwner: z.string().trim().max(200), birthDate: z.union([z.literal(""), z.iso.date()]),
  birthplace: z.string().trim().max(200), previousJob: z.string().trim().max(200), familyCount: z.union([z.literal(""), z.coerce.number().int().min(0).max(100)]), hobby: z.string().trim().max(500), notes: z.string().trim().max(2000), employmentStatus: z.enum(["active", "retired"]),
});

export type RelatedCustomerState = { message?: string; success?: boolean; externalId?: string };

export async function createCustomerBranch(_: RelatedCustomerState, formData: FormData): Promise<RelatedCustomerState> {
  const parsed = branchSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };
  return saveRelated("branches", parsed.data, "拠点を登録できませんでした。");
}

export async function createCustomerContact(_: RelatedCustomerState, formData: FormData): Promise<RelatedCustomerState> {
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };
  const value = parsed.data;
  return saveRelated("contacts", { ...value, name: `${value.lastName} ${value.firstName}`, kana: `${value.lastNameKana} ${value.firstNameKana}` }, "担当者を登録できませんでした。");
}

async function saveRelated(kind: "branches" | "contacts", input: { customerId: string; externalId: string } & Record<string, unknown>, errorMessage: string): Promise<RelatedCustomerState> {
  const context = await getCurrentUser();
  if (!context) return { message: "ログインし直してください。" };
  let query = context.db.from("customers").select("id,department_id,registration_details").eq("organization_id", context.organizationId).eq("id", input.customerId).eq("external_id", input.externalId);
  if (context.role !== "organization_admin") query = query.in("department_id", context.departmentIds);
  const { data: customer } = await query.maybeSingle();
  if (!customer) return { message: "この顧客を操作する権限がありません。" };
  const details = (customer.registration_details ?? {}) as Record<string, unknown>;
  const existing = Array.isArray(details[kind]) ? details[kind] as Record<string, unknown>[] : [];
  const entry = Object.fromEntries(Object.entries(input).filter(([key]) => key !== "customerId" && key !== "externalId"));
  const { error } = await context.db.from("customers").update({ registration_details: { ...details, [kind]: [...existing, { ...entry, createdAt: new Date().toISOString() }] } }).eq("organization_id", context.organizationId).eq("id", input.customerId);
  if (error) return { message: errorMessage };
  revalidatePath(`/customers/${input.externalId}`);
  revalidatePath("/customers");
  return { success: true, externalId: input.externalId };
}
