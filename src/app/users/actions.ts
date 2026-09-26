"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { requireOrganizationAdmin } from "@/lib/auth/require-auth";

export type UserActionState = { message?: string; success?: boolean };
const createSchema = z.object({ name: z.string().trim().min(1).max(100), email: z.email(), departmentId: z.uuid(), role: z.enum(["sales_rep", "department_admin", "organization_admin"]) });

export async function createUser(_: UserActionState, formData: FormData): Promise<UserActionState> {
  const context = await requireOrganizationAdmin();
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };
  const { data: department } = await context.db.from("departments").select("id").eq("id", parsed.data.departmentId).eq("organization_id", context.organizationId).maybeSingle();
  if (!department) return { message: "対象部門が見つかりません。" };
  let firebaseUid: string | undefined;
  let employeeId: string | undefined;
  let appUserId: string | undefined;
  try {
    const firebaseUser = await getFirebaseAdminAuth().createUser({ email: parsed.data.email, displayName: parsed.data.name, disabled: false });
    firebaseUid = firebaseUser.uid;
    const { data: employee, error: employeeError } = await context.db.from("employees").insert({ organization_id: context.organizationId, name: parsed.data.name, email: parsed.data.email, primary_department_id: parsed.data.departmentId, status: "active" }).select("id").single();
    if (employeeError) throw employeeError;
    employeeId = employee.id;
    const { data: appUser, error: userError } = await context.db.from("app_users").insert({ firebase_uid: firebaseUid, organization_id: context.organizationId, employee_id: employeeId, email: parsed.data.email, role: parsed.data.role, status: "active" }).select("id").single();
    if (userError) throw userError;
    appUserId = appUser.id;
    const { error: membershipError } = await context.db.from("app_user_departments").insert({ app_user_id: appUser.id, department_id: parsed.data.departmentId, is_primary: true });
    if (membershipError) throw membershipError;
  } catch (error) {
    if (firebaseUid) await getFirebaseAdminAuth().deleteUser(firebaseUid).catch(() => undefined);
    if (appUserId) await context.db.from("app_users").delete().eq("id", appUserId);
    if (employeeId) await context.db.from("employees").delete().eq("id", employeeId);
    return { message: error instanceof Error ? error.message : "ユーザーを作成できませんでした。" };
  }
  revalidatePath("/users");
  return { success: true };
}

const statusSchema = z.object({ id: z.uuid() });
export async function changeUserStatus(_: UserActionState, formData: FormData): Promise<UserActionState> {
  const context = await requireOrganizationAdmin();
  const parsed = statusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: "対象ユーザーが正しくありません。" };
  const { data: target } = await context.db.from("app_users").select("employee_id,firebase_uid,status").eq("id", parsed.data.id).eq("organization_id", context.organizationId).maybeSingle();
  if (!target?.firebase_uid) return { message: "対象ユーザーが見つかりません。" };
  const previousStatus = target.status as "active" | "inactive";
  const nextStatus = previousStatus === "active" ? "inactive" : "active";
  if (parsed.data.id === context.userId && nextStatus === "inactive") return { message: "自分自身を利用停止にはできません。" };
  try {
    await getFirebaseAdminAuth().updateUser(target.firebase_uid, { disabled: nextStatus === "inactive" });
    if (nextStatus === "inactive") await getFirebaseAdminAuth().revokeRefreshTokens(target.firebase_uid);
    const { error } = await context.db.from("app_users").update({ status: nextStatus, updated_at: new Date().toISOString() }).eq("id", parsed.data.id).eq("organization_id", context.organizationId);
    if (error) throw error;
    const { error: employeeError } = await context.db.from("employees").update({ status: nextStatus, updated_at: new Date().toISOString() }).eq("id", target.employee_id).eq("organization_id", context.organizationId);
    if (employeeError) {
      await context.db.from("app_users").update({ status: previousStatus, updated_at: new Date().toISOString() }).eq("id", parsed.data.id).eq("organization_id", context.organizationId);
      throw employeeError;
    }
  } catch (error) {
    await getFirebaseAdminAuth().updateUser(target.firebase_uid, { disabled: previousStatus === "inactive" }).catch(() => undefined);
    return { message: error instanceof Error ? error.message : "ステータスを変更できませんでした。" };
  }
  revalidatePath("/users");
  return { success: true };
}
