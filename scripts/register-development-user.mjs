import { createClient } from "@supabase/supabase-js";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const uid = "glyYq4V5XeS1mNkAFCbfGnu3YeP2";
initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
const user = await getAuth().getUser(uid);
if (!user.email || user.disabled) throw new Error("有効なメール付きFirebaseアカウントが必要です。");
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const check = ({ data, error }) => { if (error) throw error; return data; };
const org = check(await db.from("organizations").select("id").eq("name", "Alpha Communications").single());
const department = check(await db.from("departments").select("id").eq("organization_id", org.id).eq("name", "営業").single());
let appUser = check(await db.from("app_users").select("id,employee_id,organization_id,firebase_uid").or(`firebase_uid.eq.${uid},email.eq.${user.email}`).maybeSingle());
if (appUser && (appUser.organization_id !== org.id || (appUser.firebase_uid && appUser.firebase_uid !== uid))) throw new Error("既存ユーザーの組織またはUIDが異なります。");
let employeeId = appUser?.employee_id;
if (!employeeId) {
  const existing = check(await db.from("employees").select("id").eq("organization_id", org.id).eq("email", user.email).maybeSingle());
  employeeId = existing?.id ?? check(await db.from("employees").insert({ organization_id: org.id, primary_department_id: department.id, name: user.displayName || "開発確認用", email: user.email, status: "active" }).select("id").single()).id;
}
const values = { firebase_uid: uid, organization_id: org.id, employee_id: employeeId, email: user.email, role: "organization_admin", status: "active" };
appUser = check(await (appUser ? db.from("app_users").update(values).eq("id", appUser.id) : db.from("app_users").insert(values)).select("id").single());
check(await db.from("app_user_departments").upsert({ app_user_id: appUser.id, department_id: department.id, is_primary: true }, { onConflict: "app_user_id,department_id" }));
console.log(JSON.stringify({ uid, role: values.role, department: "営業", employeeId }));
