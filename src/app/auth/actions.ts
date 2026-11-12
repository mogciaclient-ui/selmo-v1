"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEVELOPMENT_ROLE_COOKIE } from "@/lib/auth/development-role";
import { FIREBASE_SESSION_COOKIE } from "@/lib/firebase/auth";

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete(FIREBASE_SESSION_COOKIE);
  cookieStore.delete(DEVELOPMENT_ROLE_COOKIE);
  redirect("/login");
}
