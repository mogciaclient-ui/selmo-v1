import { captureAuthentication, isSeqmoAllowed } from "@/lib/seqmo/server";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createFirebaseSession, verifyFirebaseSession, FIREBASE_SESSION_COOKIE, FIREBASE_SESSION_DURATION_MS } from "@/lib/firebase/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({ idToken: z.string().min(1) });

export async function POST(request: Request) {
  const headerStore = await headers();
  const origin = headerStore.get("origin");
  const host = headerStore.get("host");
  if (!origin || !host || new URL(origin).host !== host) return Response.json({ error: "Invalid origin" }, { status: 403 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  try {
    const { session, decoded } = await createFirebaseSession(parsed.data.idToken);
    const db = createAdminClient();
    let { data: appUser } = await db.from("app_users").select("id,status,firebase_uid,organization_id").eq("firebase_uid", decoded.uid).maybeSingle();
    if (!appUser) {
      if (!decoded.email || !decoded.email_verified) return Response.json({ error: "Verified email required" }, { status: 403 });
      const { data: pendingUser } = await db.from("app_users").select("id,status,firebase_uid,organization_id").eq("email", decoded.email).is("firebase_uid", null).maybeSingle();
      if (pendingUser) {
        const { data: linked } = await db.from("app_users").update({ firebase_uid: decoded.uid, updated_at: new Date().toISOString() }).eq("id", pendingUser.id).is("firebase_uid", null).select("id,status,firebase_uid,organization_id").single();
        appUser = linked;
      }
    }
    if (!appUser || appUser.status !== "active") return Response.json({ error: "Inactive application user" }, { status: 403 });
    if (!await isSeqmoAllowed({ firebaseUid: decoded.uid, organizationId: appUser.organization_id })) return Response.json({ error: "Account access restricted" }, { status: 403 });
    await captureAuthentication(decoded.uid, appUser.organization_id, session, "login_success");
    const cookieStore = await cookies();
    cookieStore.set(FIREBASE_SESSION_COOKIE, session, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: FIREBASE_SESSION_DURATION_MS / 1000 });
    return NextResponse.json({ success: true });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  const session = cookieStore.get(FIREBASE_SESSION_COOKIE)?.value;
  if (session) {
    try {
      const decoded = await verifyFirebaseSession(session);
      const { data } = await createAdminClient().from("app_users").select("organization_id").eq("firebase_uid", decoded.uid).maybeSingle();
      if (data) await captureAuthentication(decoded.uid, data.organization_id, session, "logout");
    } catch { /* Expired sessions can still be cleared. */ }
  }
  cookieStore.delete(FIREBASE_SESSION_COOKIE);
  return NextResponse.json({ success: true });
}
