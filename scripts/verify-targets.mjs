import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { findTargets } from "../src/infrastructure/supabase/target-repository.ts";
const require = createRequire(import.meta.url);
const { encodeReply } = require("next/dist/compiled/react-server-dom-webpack/client.node");
const base = process.env.VERIFY_BASE_URL || "http://localhost:3000";
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const auth = getAuth(initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) }));
const suffix = randomBytes(5).toString("hex");
const employeeId = randomUUID(), otherEmployeeId = randomUUID(), userId = randomUUID(), customerId = randomUUID(), productId = randomUUID();
let uid, cookie, org, dept;
const check = async (q) => { const r = await q; assert.ifError(r.error); return r.data; };
const request = (path, options = {}) => fetch(`${base}${path}`, { ...options, headers: { cookie: cookie || "", ...options.headers } });
async function action(name, path, fields, stateful = true) {
  await (await request(path)).text();
  const manifest = JSON.parse(await readFile(new URL("../.next/dev/server/server-reference-manifest.json", import.meta.url), "utf8"));
  const entry = Object.entries(manifest.node).find(([, value]) => value.exportedName === name); assert(entry, name);
  const form = new FormData(); for (const [key, value] of Object.entries(fields)) form.set(key, String(value));
  const response = await request(path, { method: "POST", redirect: "manual", headers: { origin: base, "next-action": entry[0], accept: "text/x-component" }, body: await encodeReply(stateful ? [{}, form] : [form]) });
  const text = await response.text(); assert(response.status < 400, `${name}: ${response.status} ${text.slice(0, 300)}`);
  console.log(`action verified: ${name}`);
  return text;
}
try {
  org = (await check(db.from("organizations").select("id").eq("name", "Alpha Communications").single())).id;
  dept = (await check(db.from("departments").select("id").eq("organization_id", org).eq("name", "営業").single())).id;
  const axcel = (await check(db.from("departments").select("id").eq("organization_id", org).eq("name", "AXCEL").single())).id;
  uid = (await auth.createUser({ email: `targets-${suffix}@example.com` })).uid;
  await check(db.from("employees").insert([{ id: employeeId, organization_id: org, primary_department_id: dept, name: `ターゲット検証-${suffix}`, status: "active" }, { id: otherEmployeeId, organization_id: org, primary_department_id: axcel, name: `別部門検証-${suffix}`, status: "active" }]));
  await check(db.from("app_users").insert({ id: userId, firebase_uid: uid, employee_id: employeeId, organization_id: org, email: `targets-${suffix}@example.com`, role: "sales_rep", status: "active" }));
  await check(db.from("app_user_departments").insert({ app_user_id: userId, department_id: dept, is_primary: true }));
  await check(db.from("customers").insert({ id: customerId, organization_id: org, department_id: dept, name: `顧客検証-${suffix}` }));
  await check(db.from("products").insert({ id: productId, organization_id: org, name: `商材検証-${suffix}`, status: "active" }));
  const customToken = await auth.createCustomToken(uid);
  const identity = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) });
  const { idToken } = await identity.json(); assert(idToken);
  const login = await fetch(`${base}/api/auth/session`, { method: "POST", headers: { origin: base, "content-type": "application/json" }, body: JSON.stringify({ idToken }) }); assert.equal(login.status, 200);
  cookie = login.headers.getSetCookie().map(c => c.split(";")[0]).join("; ");
  const productFields = { id: productId, name: `商材検証-${suffix}`, nameKana: "", modelNumber: "", price: "", size: "", weight: "", capacity: "", color: "", manufacturerName: "", manufacturerUrl: "", description: "", notes: "権限確認", actionProcess: "", status: "active" };
  const blocked = await request("/products", { redirect: "manual" }); const blockedHtml = await blocked.text();
  assert(!blockedHtml.includes('PRODUCTS')); assert(blocked.status === 307 || blockedHtml.includes('NEXT_REDIRECT') || blockedHtml.includes('http-equiv="refresh"'));
  const month = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }).slice(0, 7);
  const fields = { id: "", customerId, targetMonth: month, customerType: "新規", product: productFields.name, estimatedProfit: "150000", note: "初回メモ" };
  assert((await action("saveTarget", "/targets", fields)).includes("ターゲットを保存しました"));
  const first = (await check(db.from("monthly_customer_pickups").select("id,created_at").eq("employee_id", employeeId).single()));
  const other = await check(db.from("monthly_customer_pickups").insert({ organization_id: org, department_id: axcel, employee_id: otherEmployeeId, customer_id: customerId, target_month: `${month}-01`, customer_type: "他商材", product: productFields.name, reason: "他部署専用メモ" }).select("id").single());
  const edit = { ...fields, id: first.id, note: "変更後メモ" };
  assert((await action("saveTarget", "/targets", edit)).includes("ターゲットを保存しました"));
  const changed = await check(db.from("monthly_customer_pickups").select("created_at,reason").eq("id", first.id).single()); assert.equal(changed.created_at, first.created_at); assert.equal(changed.reason, edit.note);
  const history = await check(db.from("target_note_history").select("previous_note,note").eq("pickup_id", first.id).order("changed_at")); assert.equal(history.length, 2); assert.equal(history[1].previous_note, fields.note); assert.equal(history[1].note, edit.note);
  assert((await action("saveTarget", "/targets", fields)).includes("登録済み"));
  const secondCase = await action("saveTarget", "/targets", { ...fields, customerType: "GUP" }); assert(secondCase.includes("ターゲットを保存しました"), secondCase.slice(0, 1500));
  assert((await action("saveTarget", "/targets", { ...edit, id: other.id })).includes("編集できるターゲットがありません"));
  const salesHtml = await (await request(`/targets?month=${month}&employeeId=${otherEmployeeId}`)).text(); assert(salesHtml.includes(edit.note)); assert(!salesHtml.includes("他部署専用メモ")); assert(!salesHtml.includes('name="employeeId"')); assert(!salesHtml.includes("商材リスト"));
  console.log("sales: own-only list, forged-owner rejection, duplicate cases, notes/history verified");
  const schedule = { departmentId: dept, customerId, date: `${month}-01`, startTime: "10:00", endTime: "11:00", category: "sales", activityType: "online", customerType: "新規", product: fields.product, area: "検証エリア", opportunityId: "", pickupId: first.id };
  await action("createActivity", "/", schedule);
  const activity = await check(db.from("activities").select("id,schedule_details").eq("employee_id", employeeId).single()); assert.equal(activity.schedule_details.pickupId, first.id); assert.equal(activity.schedule_details.product, fields.product);
  const scope = { db, organizationId: org, employeeId, departmentIds: [dept], role: "sales_rep" };
  let target = (await findTargets(scope, month)).find(t => t.id === first.id); assert.equal(target.executed, false); assert.deepEqual(target.appointmentIds, [activity.id]);
  assert((await action("cancelPickupAppointment", "/targets", { id: activity.id, pickupId: first.id })).includes("解除しました"));
  target = (await findTargets(scope, month)).find(t => t.id === first.id); assert.equal(target.appointmentIds.length, 0);
  await check(db.from("activities").update({ status: "completed", result: "検証結果" }).eq("id", activity.id));
  target = (await findTargets(scope, month)).find(t => t.id === first.id); assert.equal(target.executed, true);
  console.log("calendar: product/type inheritance, appointment cancellation, execution counting verified");
  for (const role of ["department_admin", "department_admin_sales_rep", "organization_admin"]) {
    await check(db.from("app_users").update({ role }).eq("id", userId));
    const html = await (await request(`/targets?month=${month}`)).text(); assert(html.includes('name="employeeId"')); assert.equal(html.includes("他部署専用メモ"), role === "organization_admin");
    const productHtml = await (await request("/products")).text(); assert(productHtml.includes("商材リスト"));
    assert((await action("saveProduct", "/products", productFields)).includes("商材を保存しました"));
    console.log(`${role}: target scope and product editing verified`);
  }
  // Compile the admin-only action through the product page before testing a forged sales request.
  await check(db.from("app_users").update({ role: "sales_rep" }).eq("id", userId));
  assert((await action("saveProduct", "/targets", productFields)).includes("商材を登録・編集できるのは"));
} finally {
  // Every cleanup is restricted to IDs created by this run.
  await check(db.from("activities").delete().eq("employee_id", employeeId));
  await check(db.from("monthly_customer_pickups").delete().in("employee_id", [employeeId, otherEmployeeId]));
  await check(db.from("customers").delete().eq("id", customerId));
  await check(db.from("products").delete().eq("id", productId));
  await check(db.from("app_users").delete().eq("id", userId));
  await check(db.from("employees").delete().in("id", [employeeId, otherEmployeeId]));
  if (uid) await auth.deleteUser(uid);
  console.log("temporary test records removed");
}
