import type { SupabaseClient } from "@supabase/supabase-js";

export type AuthRole = "sales_rep" | "department_admin" | "organization_admin";
export type AuthContext = {
  userId: string;
  firebaseUid: string;
  organizationId: string;
  employeeId: string;
  email: string;
  displayName: string;
  role: AuthRole;
  status: "active" | "inactive";
  departmentIds: string[];
  departmentName?: string;
  db: SupabaseClient;
};
