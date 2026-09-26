import "server-only";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";

export async function requireAuth() {
  const context = await getCurrentUser();
  if (!context) redirect("/login");
  return context;
}

export async function requireOrganizationAdmin() {
  const context = await requireAuth();
  if (context.role !== "organization_admin") redirect("/");
  return context;
}
