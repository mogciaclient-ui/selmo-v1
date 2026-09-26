import "server-only";

import { getFirebaseAdminAuth } from "@/lib/firebase/admin";

export const FIREBASE_SESSION_COOKIE = "firebase_session";
export const FIREBASE_SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000;

export async function createFirebaseSession(idToken: string) {
  const decoded = await getFirebaseAdminAuth().verifyIdToken(idToken, true);
  const authTime = decoded.auth_time * 1000;
  if (Date.now() - authTime > 5 * 60 * 1000) throw new Error("Recent sign-in required");
  const session = await getFirebaseAdminAuth().createSessionCookie(idToken, { expiresIn: FIREBASE_SESSION_DURATION_MS });
  return { session, decoded };
}

export async function verifyFirebaseSession(sessionCookie: string) {
  return getFirebaseAdminAuth().verifySessionCookie(sessionCookie, true);
}
