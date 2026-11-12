"use server";

import { findProductOptions } from "@/infrastructure/supabase/product-options-repository";
import { scheduleReportDefaults } from "@/domain/schedules/rules";

import { canActAsSalesRep } from "@/lib/auth/roles";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSalesActivity } from "@/application/activities/create-sales-activity";
import { deleteSalesActivity } from "@/application/activities/delete-sales-activity";
import { updateSalesActivity } from "@/application/activities/update-sales-activity";
import { createSupabaseSalesActivityRepository } from "@/infrastructure/supabase/sales-activity-repository";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { scheduleSchema } from "@/domain/schedules/schema";
import { scheduleTypeLabels } from "@/domain/schedules/rules";

const activityFields = {
  departmentId: z.uuid(),
  customerId: z.union([z.uuid(), z.literal("")]).transform((value) => value || null),
  newCustomerName: z.string().trim().max(200).transform((value) => value || null),
  title: z.string().trim().min(1, "予定名を入力してください。").max(200),
  activityType: z.enum(["visit", "online", "telephone", "other"]),
  date: z.iso.date(),
  endDate: z.iso.date().optional(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
} satisfies z.ZodRawShape;



export type CreateActivityState = { message?: string };
export type MutateActivityState = { message?: string; success?: boolean };

const memoSchema = z.object({
  departmentId: z.uuid(),
  customerName: z.string().trim().min(1, "顧客名を入力してください。").max(200),
  date: z.iso.date(),
  startTime: activityFields.startTime,
  endTime: activityFields.endTime,
  details: z.string().trim().min(1, "活動詳細を入力してください。").max(5000),
});

export async function createActivity(_: CreateActivityState, formData: FormData): Promise<CreateActivityState> {
  const context = await getCurrentUser();
  if (!context) return { message: "ログインし直してください。" };
  if (!canActAsSalesRep(context.role)) return { message: "管理者アカウントは閲覧専用です。" };

  const parsed = scheduleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };
  const input = parsed.data;
  if (input.product) {
    const options = await findProductOptions(context.db, context.organizationId).catch(() => null);
    if (!options) return { message: "商材マスタを取得できませんでした。" };
    if (!options.includes(input.product)) return { message: "商材マスタから有効な商材を選んでください。" };
  }
  if (input.opportunityId) {
    const { data } = await context.db.from("opportunities").select("id").eq("organization_id", context.organizationId).eq("id", input.opportunityId).eq("customer_id", input.customerId).in("department_id", context.departmentIds).maybeSingle();
    if (!data) return { message: "関連する案件を確認できませんでした。" };
  }
  if (input.pickupId) {
    const { data } = await context.db.from("monthly_customer_pickups").select("id").eq("id", input.pickupId).eq("organization_id", context.organizationId).eq("employee_id", context.employeeId).eq("customer_id", input.customerId).maybeSingle();
    if (!data) return { message: "対象のターゲットを確認できませんでした。" };
  }
  try {
    await createSalesActivity(createSupabaseSalesActivityRepository(context.db, context), {
      departmentId: input.departmentId, customerId: input.customerId || null, newCustomerName: null,
      title: scheduleTypeLabels[input.activityType], activityType: input.activityType,
      startsAt: new Date(`${input.date}T${input.startTime}:00+09:00`).toISOString(),
      endsAt: new Date(`${input.date}T${input.endTime}:00+09:00`).toISOString(),
      scheduleDetails: { schemaVersion: "2", ...scheduleReportDefaults(input.category, input.activityType), category: input.category, customerType: input.customerType, product: input.product, area: input.area, opportunityId: input.opportunityId, pickupId: input.pickupId },
    });
  } catch (error) { return { message: error instanceof Error ? error.message : "予定を登録できませんでした。" }; }

  redirect("/");
}

export async function createActivityMemo(_: CreateActivityState, formData: FormData): Promise<CreateActivityState> {
  const context = await getCurrentUser();
  if (!context) return { message: "ログインし直してください。" };
  if (!canActAsSalesRep(context.role)) return { message: "管理者アカウントは閲覧専用です。" };
  const parsed = memoSchema.safeParse({
    departmentId: formData.get("departmentId"),
    customerName: formData.get("customerName"),
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    details: formData.get("details"),
  });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };
  if (!context.departmentIds.includes(parsed.data.departmentId)) return { message: "この部門を操作する権限がありません。" };

  const startsAt = new Date(`${parsed.data.date}T${parsed.data.startTime}:00+09:00`);
  const endsAt = new Date(`${parsed.data.date}T${parsed.data.endTime}:00+09:00`);
  if (endsAt <= startsAt) return { message: "終了時刻は開始時刻より後にしてください。" };

  let customerId: string | null = null;
  const { data: existingCustomer } = await context.db.from("customers").select("id").eq("organization_id", context.organizationId).eq("department_id", parsed.data.departmentId).ilike("name", parsed.data.customerName).limit(1).maybeSingle();
  customerId = existingCustomer?.id ?? null;
  if (!customerId) {
    const { data, error } = await context.db.from("customers").insert({ organization_id: context.organizationId, department_id: parsed.data.departmentId, name: parsed.data.customerName, assigned_employee_id: context.employeeId }).select("id").single();
    if (error) return { message: "顧客を登録できませんでした。" };
    customerId = data.id;
  }

  const { error } = await context.db.from("activities").insert({
    organization_id: context.organizationId,
    department_id: parsed.data.departmentId,
    customer_id: customerId,
    employee_id: context.employeeId,
    title: `活動メモ：${parsed.data.customerName}`,
    activity_type: "other",
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    status: "completed",
    result: parsed.data.details,
  });
  if (error) return { message: "活動メモを登録できませんでした。" };
  redirect("/");
}

export async function updateActivity(_: MutateActivityState, formData: FormData): Promise<MutateActivityState> {
  const context = await getCurrentUser();
  if (!context) return { message: "ログインし直してください。" };
  if (!canActAsSalesRep(context.role)) return { message: "管理者アカウントは閲覧専用です。" };

  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { message: "予定が正しくありません。" };
  const { data: existing, error: lookupError } = await context.db.from("activities").select("department_id,customer_id,schedule_details").eq("id", id.data).eq("organization_id", context.organizationId).eq("employee_id", context.employeeId).maybeSingle();
  if (lookupError || !existing) return { message: "この予定を変更する権限がありません。" };
  const parsed = scheduleSchema.safeParse({ ...Object.fromEntries(formData), departmentId: existing.department_id, customerId: existing.customer_id ?? "" });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message };
  const input = parsed.data;
  if (input.product && input.product !== existing.schedule_details?.product) {
    const options = await findProductOptions(context.db, context.organizationId).catch(() => null);
    if (!options) return { message: "商材マスタを取得できませんでした。" };
    if (!options.includes(input.product)) return { message: "商材マスタから有効な商材を選んでください。" };
  }
  try {
    await updateSalesActivity(createSupabaseSalesActivityRepository(context.db, context), {
      id: id.data, title: scheduleTypeLabels[input.activityType], activityType: input.activityType,
      startsAt: new Date(`${input.date}T${input.startTime}:00+09:00`).toISOString(), endsAt: new Date(`${input.date}T${input.endTime}:00+09:00`).toISOString(),
      scheduleDetails: { ...(existing.schedule_details ?? {}), ...scheduleReportDefaults(input.category, input.activityType), category: input.category, customerType: input.customerType, area: input.area, product: input.product },
    });
  } catch (error) { return { message: error instanceof Error ? error.message : "予定を更新できませんでした。" }; }

  revalidatePath("/targets");
  revalidatePath("/");
  return { success: true };
}

const deleteActivitySchema = z.object({ id: z.uuid() });

export async function deleteActivity(_: MutateActivityState, formData: FormData): Promise<MutateActivityState> {
  const context = await getCurrentUser();
  if (!context) return { message: "ログインし直してください。" };
  if (!canActAsSalesRep(context.role)) return { message: "管理者アカウントは閲覧専用です。" };

  const parsed = deleteActivitySchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { message: "削除対象が正しくありません。" };

  try {
    await deleteSalesActivity(createSupabaseSalesActivityRepository(context.db, context), parsed.data.id);
  } catch (error) {
    return { message: error instanceof Error ? error.message : "予定を削除できませんでした。" };
  }

  revalidatePath("/targets");
  revalidatePath("/");
  return { success: true };
}
