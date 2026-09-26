import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";
import { FIREBASE_SESSION_COOKIE, verifyFirebaseSession } from "@/lib/firebase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AuthContext, AuthRole } from "@/lib/auth/types";

type AppUserRow = {
  id: string; firebase_uid: string; organization_id: string; employee_id: string; email: string;
  role: AuthRole; status: "active" | "inactive";
  employees: { name: string } | { name: string }[] | null;
  app_user_departments: { department_id: string; is_primary: boolean; departments: { name: string } | { name: string }[] | null }[];
};

export const getCurrentUser = cache(async (): Promise<AuthContext | null> => {
  const session = (await cookies()).get(FIREBASE_SESSION_COOKIE)?.value;
  if (!session) return null;
  let token;
  try { token = await verifyFirebaseSession(session); } catch { return null; }
  const db = createAdminClient();
  const { data, error } = await db.from("app_users").select("id,firebase_uid,organization_id,employee_id,email,role,status,employees(name),app_user_departments(department_id,is_primary,departments(name))").eq("firebase_uid", token.uid).maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as AppUserRow;
  if (row.status !== "active") return null;
  const employee = Array.isArray(row.employees) ? row.employees[0] : row.employees;
  const primary = row.app_user_departments.toSorted((a, b) => Number(b.is_primary) - Number(a.is_primary))[0];
  const departmentRelation = primary?.departments;
  const department = Array.isArray(departmentRelation) ? departmentRelation[0] : departmentRelation;
  const roleLabel = row.role === "organization_admin"
    ? "本部"
    : row.role === "department_admin"
      ? `${department?.name ?? "部門"}管理`
      : department?.name ?? "営業";
  return { userId: row.id, firebaseUid: row.firebase_uid, organizationId: row.organization_id, employeeId: row.employee_id, email: row.email, displayName: employee?.name ?? row.email, role: row.role, status: row.status, departmentIds: row.app_user_departments.map((item) => item.department_id), departmentName: roleLabel, db };
});
