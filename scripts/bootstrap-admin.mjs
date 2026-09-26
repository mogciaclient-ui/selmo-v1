import { createClient } from "@supabase/supabase-js";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const required = ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "FIREBASE_PROJECT_ID", "BOOTSTRAP_ADMIN_EMAIL", "BOOTSTRAP_ADMIN_PASSWORD"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`未設定の環境変数: ${missing.join(", ")}`);
if (process.env.BOOTSTRAP_ADMIN_PASSWORD.length < 8) throw new Error("BOOTSTRAP_ADMIN_PASSWORDは8文字以上にしてください。");
if (/replace-with|placeholder|changeme|your-password/i.test(process.env.BOOTSTRAP_ADMIN_PASSWORD)) {
  throw new Error("BOOTSTRAP_ADMIN_PASSWORDが雛形のままです。実際に使用する8文字以上のパスワードへ変更してください。");
}

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
const app = getApps()[0] ?? initializeApp({
  projectId,
  credential: clientEmail && privateKey ? cert({ projectId, clientEmail, privateKey }) : applicationDefault(),
});
const auth = getAuth(app);
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const email = process.env.BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase();

const { data: appUser, error: findError } = await db.from("app_users").select("id,role,status").eq("email", email).maybeSingle();
if (findError) throw findError;
if (!appUser) throw new Error("app_usersに同じメールの管理者がありません。先にマイグレーションとsupabase/seed.sqlを実行してください。");

let firebaseUser;
let firebaseUserCreated = false;
try {
  firebaseUser = await auth.getUserByEmail(email);
  firebaseUser = await auth.updateUser(firebaseUser.uid, { password: process.env.BOOTSTRAP_ADMIN_PASSWORD, emailVerified: true, disabled: false });
} catch (error) {
  if (error?.code !== "auth/user-not-found") throw error;
  firebaseUser = await auth.createUser({ email, password: process.env.BOOTSTRAP_ADMIN_PASSWORD, emailVerified: true, disabled: false });
  firebaseUserCreated = true;
}

const { error: updateError } = await db.from("app_users").update({ firebase_uid: firebaseUser.uid, role: "organization_admin", status: "active", updated_at: new Date().toISOString() }).eq("id", appUser.id);
if (updateError) {
  if (firebaseUserCreated) await auth.deleteUser(firebaseUser.uid).catch(() => undefined);
  throw updateError;
}

console.log(`初期管理者を作成しました: ${email}`);
console.log("安全のため.env.localからBOOTSTRAP_ADMIN_PASSWORDを削除してください。");
