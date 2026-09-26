"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/get-current-user";

export type ProductActionState = { success?: boolean; message?: string };
const optional = (max: number) => z.string().trim().max(max).transform((value) => value || null);
const schema = z.object({
  id: z.union([z.uuid(), z.literal("")]).transform((value) => value || undefined),
  name: z.string().trim().min(1, "商材名を入力してください。").max(200),
  nameKana: optional(200), modelNumber: optional(100), price: z.union([z.coerce.number().int().min(0), z.literal("")]).transform((value) => value === "" ? null : value),
  size: optional(100), weight: optional(100), capacity: optional(100), color: optional(100), manufacturerName: optional(200),
  manufacturerUrl: z.union([z.url("メーカーURLを確認してください。"), z.literal("")]).transform((value) => value || null),
  description: optional(5000), notes: optional(5000), actionProcess: optional(200), status: z.enum(["active", "inactive"]),
});

export async function saveProduct(_: ProductActionState, formData: FormData): Promise<ProductActionState> {
  const context = await getCurrentUser();
  if (!context) return { message: "ログインし直してください。" };
  if (context.role !== "organization_admin") return { message: "商材を登録・編集できるのは全体管理者だけです。" };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };
  const value = parsed.data;
  const record = { organization_id: context.organizationId, name: value.name, name_kana: value.nameKana, model_number: value.modelNumber, price: value.price, size: value.size, weight: value.weight, capacity: value.capacity, color: value.color, manufacturer_name: value.manufacturerName, manufacturer_url: value.manufacturerUrl, description: value.description, notes: value.notes, action_process: value.actionProcess, status: value.status, updated_at: new Date().toISOString() };
  const result = value.id
    ? await context.db.from("products").update(record).eq("id", value.id).eq("organization_id", context.organizationId)
    : await context.db.from("products").insert(record);
  if (result.error) return { message: result.error.code === "42P01" ? "商材マスターのデータベース更新を適用してください。" : "商材を保存できませんでした。" };
  revalidatePath("/products");
  return { success: true, message: "商材を保存しました。" };
}
