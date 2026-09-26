"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { removeCustomer, saveCustomer } from "@/application/customers/manage-customer";
import { createSupabaseCustomerRepository } from "@/infrastructure/supabase/customer-repository";
import { getCurrentUser } from "@/lib/auth/get-current-user";

export type CustomerActionState = { message?: string; success?: boolean };
const nullableText = z.string().trim().max(500).transform((value) => value || null);
const schema = z.object({ id: z.union([z.uuid(), z.literal("")]).transform((v) => v || undefined), departmentId: z.uuid(), name: z.string().trim().min(1, "顧客名を入力してください。").max(200), phone: nullableText, address: nullableText, notes: nullableText });

export async function upsertCustomer(_: CustomerActionState, formData: FormData): Promise<CustomerActionState> {
  const context = await getCurrentUser();
  if (!context) return { message: "ログインし直してください。" };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };
  try { await saveCustomer(createSupabaseCustomerRepository(context.db, context), parsed.data); }
  catch (error) { return { message: error instanceof Error ? error.message : "顧客を保存できませんでした。" }; }
  revalidatePath("/customers");
  return { success: true };
}

export async function deleteCustomer(_: CustomerActionState, formData: FormData): Promise<CustomerActionState> {
  const context = await getCurrentUser();
  if (!context) return { message: "ログインし直してください。" };
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { message: "削除対象が正しくありません。" };
  try { await removeCustomer(createSupabaseCustomerRepository(context.db, context), id.data); }
  catch (error) { return { message: error instanceof Error ? error.message : "顧客を削除できませんでした。" }; }
  revalidatePath("/customers");
  return { success: true };
}
