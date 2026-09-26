"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSalesActivity } from "@/application/activities/create-sales-activity";
import { deleteSalesActivity } from "@/application/activities/delete-sales-activity";
import { updateSalesActivity } from "@/application/activities/update-sales-activity";
import { createSupabaseSalesActivityRepository } from "@/infrastructure/supabase/sales-activity-repository";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { syncOpportunityFromActivity } from "@/lib/activities/sync-opportunity-from-activity";

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

const activitySchema = z.object(activityFields);

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

  const parsed = activitySchema.safeParse({
    departmentId: formData.get("departmentId"),
    customerId: formData.get("customerId") ?? "",
    newCustomerName: formData.get("newCustomerName") ?? "",
    title: formData.get("title"),
    activityType: formData.get("activityType"),
    date: formData.get("date"),
    endDate: formData.get("endDate") || undefined,
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
  });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };

  try {
    const activityId = await createSalesActivity(createSupabaseSalesActivityRepository(context.db, context), {
      departmentId: parsed.data.departmentId,
      customerId: parsed.data.customerId,
      newCustomerName: parsed.data.newCustomerName,
      title: parsed.data.title,
      activityType: parsed.data.activityType,
      startsAt: new Date(`${parsed.data.date}T${parsed.data.startTime}:00+09:00`).toISOString(),
      endsAt: new Date(`${parsed.data.endDate ?? parsed.data.date}T${parsed.data.endTime}:00+09:00`).toISOString(),
      scheduleDetails: {
        category: String(formData.get("category") ?? "sales"),
        color: String(formData.get("color") ?? "#a85600"),
        locationType: String(formData.get("locationType") ?? "external"),
        location: String(formData.get("location") ?? "").trim(),
        opportunityId: String(formData.get("opportunityId") ?? "").trim(),
        opportunityName: String(formData.get("opportunityName") ?? "").trim(),
        salesType: String(formData.get("salesType") ?? "").trim(),
        salesProcess: String(formData.get("salesProcess") ?? "").trim(),
        progressStep: String(formData.get("progressStep") ?? "").trim(),
        notes: String(formData.get("notes") ?? "").trim(),
        visibility: String(formData.get("visibility") ?? "public"),
        mailNotification: formData.get("mailNotification") === "yes",
      },
    });
    const { data: activity } = await context.db.from("activities").select("customer_id").eq("id", activityId).eq("organization_id", context.organizationId).single();
    await syncOpportunityFromActivity(context.db, {
      organizationId: context.organizationId,
      activityId,
      departmentId: parsed.data.departmentId,
      customerId: activity?.customer_id ?? null,
      employeeId: context.employeeId,
      title: parsed.data.title,
      activityDate: parsed.data.date,
      opportunityId: String(formData.get("opportunityId") ?? ""),
      opportunityName: String(formData.get("opportunityName") ?? ""),
      salesType: String(formData.get("salesType") ?? ""),
      salesProcess: String(formData.get("salesProcess") ?? ""),
      progressStep: String(formData.get("progressStep") ?? ""),
    });
  } catch (error) {
    return { message: error instanceof Error ? error.message : "営業予定を登録できませんでした。" };
  }

  redirect("/");
}

export async function createActivityMemo(_: CreateActivityState, formData: FormData): Promise<CreateActivityState> {
  const context = await getCurrentUser();
  if (!context) return { message: "ログインし直してください。" };
  const parsed = memoSchema.safeParse({
    departmentId: formData.get("departmentId"),
    customerName: formData.get("customerName"),
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    details: formData.get("details"),
  });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };
  if (context.role !== "organization_admin" && !context.departmentIds.includes(parsed.data.departmentId)) return { message: "この部門を操作する権限がありません。" };

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

const updateActivitySchema = z.object({
  id: z.uuid(),
  title: activityFields.title,
  activityType: activityFields.activityType,
  date: activityFields.date,
  startTime: activityFields.startTime,
  endTime: activityFields.endTime,
});

export async function updateActivity(_: MutateActivityState, formData: FormData): Promise<MutateActivityState> {
  const context = await getCurrentUser();
  if (!context) return { message: "ログインし直してください。" };

  const parsed = updateActivitySchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    activityType: formData.get("activityType"),
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
  });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };

  try {
    await updateSalesActivity(createSupabaseSalesActivityRepository(context.db, context), {
      id: parsed.data.id,
      title: parsed.data.title,
      activityType: parsed.data.activityType,
      startsAt: new Date(`${parsed.data.date}T${parsed.data.startTime}:00+09:00`).toISOString(),
      endsAt: new Date(`${parsed.data.date}T${parsed.data.endTime}:00+09:00`).toISOString(),
    });
  } catch (error) {
    return { message: error instanceof Error ? error.message : "予定を更新できませんでした。" };
  }

  revalidatePath("/");
  return { success: true };
}

const deleteActivitySchema = z.object({ id: z.uuid() });

export async function deleteActivity(_: MutateActivityState, formData: FormData): Promise<MutateActivityState> {
  const context = await getCurrentUser();
  if (!context) return { message: "ログインし直してください。" };

  const parsed = deleteActivitySchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { message: "削除対象が正しくありません。" };

  try {
    await deleteSalesActivity(createSupabaseSalesActivityRepository(context.db, context), parsed.data.id);
  } catch (error) {
    return { message: error instanceof Error ? error.message : "予定を削除できませんでした。" };
  }

  revalidatePath("/");
  return { success: true };
}
