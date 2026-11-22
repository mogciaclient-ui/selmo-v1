import type { Instrumentation } from "next";
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") (await import("@/lib/seqmo/server")).startMonitoring();
}
export const onRequestError: Instrumentation.onRequestError = async (_error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { FIREBASE_SESSION_COOKIE, verifyFirebaseSession } = await import("@/lib/firebase/auth");
    const raw = request.headers.cookie;
    const cookies = (Array.isArray(raw) ? raw.join(";") : raw ?? "").split(";");
    const value = cookies.find(value => value.trim().startsWith(FIREBASE_SESSION_COOKIE + "="))?.trim().slice(FIREBASE_SESSION_COOKIE.length + 1);
    if (!value) return;
    const token = await verifyFirebaseSession(decodeURIComponent(value));
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { data } = await createAdminClient().from("app_users").select("organization_id").eq("firebase_uid", token.uid).eq("status", "active").maybeSingle();
    if (data) await (await import("@/lib/seqmo/server")).captureAuthenticatedServerError(token.uid, data.organization_id, value, context.routePath);
  } catch { /* No authenticated tenant means no customer event is fabricated. */ }
};
