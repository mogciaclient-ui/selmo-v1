"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { FIREBASE_SESSION_COOKIE } from "@/lib/firebase/auth";

export async function signOut() {
  (await cookies()).delete(FIREBASE_SESSION_COOKIE);
  redirect("/login");
}
