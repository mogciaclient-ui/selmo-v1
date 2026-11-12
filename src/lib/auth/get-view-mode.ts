import { cookies } from "next/headers";
import type { AuthContext } from "./types.ts";
import { HYBRID_MANAGER_VIEW_COOKIE, LEGACY_UI_COOKIE, resolveViewMode, type ViewMode } from "./view-mode.ts";

export async function getViewMode(context: Pick<AuthContext, "canSwitchRole" | "firebaseUid" | "role">): Promise<ViewMode> {
  const cookieStore = await cookies();
  if (context.role === "department_admin_sales_rep") {
    return cookieStore.get(HYBRID_MANAGER_VIEW_COOKIE)?.value === context.firebaseUid ? "manager" : "sales";
  }
  return resolveViewMode(context.canSwitchRole, context.firebaseUid, cookieStore.get(LEGACY_UI_COOKIE)?.value);
}
