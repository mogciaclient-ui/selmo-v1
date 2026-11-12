"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/require-auth";
import { HYBRID_MANAGER_VIEW_COOKIE } from "@/lib/auth/view-mode";

export async function switchHybridView(formData: FormData) {
  const context = await requireAuth();
  if (context.role !== "department_admin_sales_rep") {
    throw new Error("このアカウントでは画面を切り替えられません。");
  }

  const mode = formData.get("mode");
  if (mode !== "sales" && mode !== "manager") {
    throw new Error("表示する画面を選択してください。");
  }

  const cookieStore = await cookies();
  if (mode === "manager") {
    cookieStore.set(HYBRID_MANAGER_VIEW_COOKIE, context.firebaseUid, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  } else {
    cookieStore.delete(HYBRID_MANAGER_VIEW_COOKIE);
  }
  redirect(mode === "manager" ? "/dashboard" : "/");
}
