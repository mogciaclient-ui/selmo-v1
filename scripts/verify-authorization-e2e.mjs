import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { createSupabaseCustomerRepository } from "../src/infrastructure/supabase/customer-repository.ts";
import { createSupabaseDashboardRepository } from "../src/infrastructure/supabase/dashboard-repository.ts";
import { createSupabaseSalesActivityRepository } from "../src/infrastructure/supabase/sales-activity-repository.ts";

const required = ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "NEXT_PUBLIC_FIREBASE_API_KEY", "FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY", "BOOTSTRAP_ADMIN_EMAIL"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`未設定の環境変数: ${missing.join(", ")}`);

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const firebase = getAuth(initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) }));
const suffix = randomBytes(6).toString("hex");
const ids = { organizationB: randomUUID(), departmentB: randomUUID(), employeeB: randomUUID(), customerB: randomUUID(), activityB: randomUUID(), testEmployee: randomUUID(), testAppUser: randomUUID(), testCustomer: randomUUID(), testActivity: randomUUID() };
const testEmail = `selmo-e2e-${suffix}@example.com`;
const testPassword = `E2e!${randomBytes(12).toString("base64url")}`;
let firebaseUid;

async function insert(table, value) {
  const { error } = await db.from(table).insert(value);
  if (error) throw new Error(`${table}への一時データ作成に失敗: ${error.message}`);
}

async function signIn(email, password) {
  return fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(process.env.NEXT_PUBLIC_FIREBASE_API_KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
}

try {
  const { data: admin, error: adminError } = await db.from("app_users").select("organization_id,employee_id,role,app_user_departments(department_id)").eq("email", process.env.BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase()).single();
  if (adminError) throw adminError;
  const departmentA = admin.app_user_departments[0]?.department_id;
  if (!departmentA) throw new Error("管理者の所属部門がありません。");
  const scopeA = { organizationId: admin.organization_id, employeeId: admin.employee_id, role: admin.role, departmentIds: admin.app_user_departments.map((item) => item.department_id) };

  await insert("organizations", { id: ids.organizationB, name: `E2E別組織-${suffix}` });
  await insert("departments", { id: ids.departmentB, organization_id: ids.organizationB, name: "E2E別部門" });
  await insert("employees", { id: ids.employeeB, organization_id: ids.organizationB, name: "E2E別組織社員", status: "active", primary_department_id: ids.departmentB });
  await insert("customers", { id: ids.customerB, organization_id: ids.organizationB, department_id: ids.departmentB, name: "E2E別組織顧客", assigned_employee_id: ids.employeeB });
  await insert("activities", { id: ids.activityB, organization_id: ids.organizationB, department_id: ids.departmentB, customer_id: ids.customerB, employee_id: ids.employeeB, title: "E2E別組織活動", activity_type: "visit", starts_at: new Date(Date.now() + 3_600_000).toISOString(), ends_at: new Date(Date.now() + 7_200_000).toISOString() });

  const customers = createSupabaseCustomerRepository(db, scopeA);
  const activities = createSupabaseSalesActivityRepository(db, scopeA);
  const dashboard = createSupabaseDashboardRepository(db, scopeA);
  if ((await customers.findAll("E2E別組織顧客")).some((item) => item.id === ids.customerB)) throw new Error("別organizationのcustomerを取得できてしまいました。");
  if ((await dashboard.findActivitiesBetween(new Date(0).toISOString(), new Date(Date.now() + 86_400_000).toISOString())).some((item) => item.id === ids.activityB)) throw new Error("別organizationのactivityを取得できてしまいました。");
  await assertRejected(() => customers.update({ id: ids.customerB, departmentId: departmentA, name: "改変", phone: null, address: null, notes: null }), "別organizationのcustomer更新");
  await assertRejected(() => customers.delete(ids.customerB), "別organizationのcustomer削除");
  await assertRejected(() => activities.update({ id: ids.activityB, title: "改変", activityType: "visit", startsAt: new Date(Date.now() + 3_600_000).toISOString(), endsAt: new Date(Date.now() + 7_200_000).toISOString() }), "別organizationのactivity更新");
  await assertRejected(() => activities.delete(ids.activityB), "別organizationのactivity削除");

  const firebaseUser = await firebase.createUser({ email: testEmail, password: testPassword, emailVerified: true });
  firebaseUid = firebaseUser.uid;
  await insert("employees", { id: ids.testEmployee, organization_id: admin.organization_id, name: "E2E停止確認社員", email: testEmail, primary_department_id: departmentA, status: "active" });
  await insert("app_users", { id: ids.testAppUser, firebase_uid: firebaseUid, organization_id: admin.organization_id, employee_id: ids.testEmployee, email: testEmail, role: "sales_rep", status: "active" });
  await insert("app_user_departments", { app_user_id: ids.testAppUser, department_id: departmentA, is_primary: true });
  await insert("customers", { id: ids.testCustomer, organization_id: admin.organization_id, department_id: departmentA, name: "E2E停止確認顧客", assigned_employee_id: ids.testEmployee });
  await insert("activities", { id: ids.testActivity, organization_id: admin.organization_id, department_id: departmentA, customer_id: ids.testCustomer, employee_id: ids.testEmployee, title: "E2E停止後保持活動", activity_type: "visit", starts_at: new Date(Date.now() + 3_600_000).toISOString(), ends_at: new Date(Date.now() + 7_200_000).toISOString() });
  const activeSignIn = await signIn(testEmail, testPassword);
  if (!activeSignIn.ok) throw new Error("activeユーザーがFirebaseへログインできませんでした。");
  const { idToken } = await activeSignIn.json();
  const sessionResponse = await fetch("http://localhost:3000/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
    body: JSON.stringify({ idToken }),
  });
  if (!sessionResponse.ok) throw new Error(`一般ユーザーのSession Cookieを発行できませんでした: ${sessionResponse.status}`);
  const sessionCookie = sessionResponse.headers.get("set-cookie")?.split(";", 1)[0];
  if (!sessionCookie) throw new Error("Session Cookieが応答にありません。");
  const homeResponse = await fetch("http://localhost:3000/", { headers: { Cookie: sessionCookie }, redirect: "manual" });
  if (homeResponse.status !== 200) throw new Error(`一般ユーザーが営業ホームを表示できませんでした: ${homeResponse.status}`);
  const usersResponse = await fetch("http://localhost:3000/users", { headers: { Cookie: sessionCookie }, redirect: "manual" });
  if (![303, 307, 308].includes(usersResponse.status) || new URL(usersResponse.headers.get("location"), "http://localhost:3000").pathname !== "/") {
    throw new Error("一般ユーザーが/usersから拒否されませんでした。");
  }

  await firebase.updateUser(firebaseUid, { disabled: true });
  await firebase.revokeRefreshTokens(firebaseUid);
  const { error: inactiveUserError } = await db.from("app_users").update({ status: "inactive" }).eq("id", ids.testAppUser);
  if (inactiveUserError) throw inactiveUserError;
  const { error: inactiveEmployeeError } = await db.from("employees").update({ status: "inactive" }).eq("id", ids.testEmployee);
  if (inactiveEmployeeError) throw inactiveEmployeeError;
  if ((await signIn(testEmail, testPassword)).ok) throw new Error("inactiveユーザーがFirebaseへログインできてしまいました。");
  const inactiveSessionResponse = await fetch("http://localhost:3000/", { headers: { Cookie: sessionCookie }, redirect: "manual" });
  if (![303, 307, 308].includes(inactiveSessionResponse.status) || new URL(inactiveSessionResponse.headers.get("location"), "http://localhost:3000").pathname !== "/login") {
    throw new Error("利用停止後も既存Session Cookieで業務画面へアクセスできました。");
  }
  const [{ count: employeeCount }, { count: activityCount }] = await Promise.all([
    db.from("employees").select("*", { head: true, count: "exact" }).eq("id", ids.testEmployee),
    db.from("activities").select("*", { head: true, count: "exact" }).eq("id", ids.testActivity).eq("employee_id", ids.testEmployee),
  ]);
  if (employeeCount !== 1 || activityCount !== 1) throw new Error("利用停止後にEmployeeまたはactivityが失われました。");

  console.log("OK: 別organizationの取得・更新・削除を拒否しました。");
  console.log("OK: activeユーザーはログインでき、inactive化後はログインできません。");
  console.log("OK: 一般ユーザーは営業ホームを表示でき、/usersへアクセスできません。");
  console.log("OK: 利用停止後は既存Session Cookieも業務画面で拒否されました。");
  console.log("OK: 利用停止後もEmployeeとactivityが保持されました。");
} finally {
  await db.from("activities").delete().in("id", [ids.activityB, ids.testActivity]);
  await db.from("customers").delete().in("id", [ids.customerB, ids.testCustomer]);
  await db.from("app_user_departments").delete().eq("app_user_id", ids.testAppUser);
  await db.from("app_users").delete().eq("id", ids.testAppUser);
  await db.from("employees").delete().in("id", [ids.employeeB, ids.testEmployee]);
  await db.from("departments").delete().eq("id", ids.departmentB);
  await db.from("organizations").delete().eq("id", ids.organizationB);
  if (firebaseUid) await firebase.deleteUser(firebaseUid).catch(() => undefined);
}

async function assertRejected(operation, label) {
  try {
    await operation();
  } catch {
    return;
  }
  throw new Error(`${label}が拒否されませんでした。`);
}
