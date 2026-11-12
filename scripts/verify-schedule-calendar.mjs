import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { requiredReportFields } from "../src/domain/schedules/report-requirements.ts";
import { createSupabaseDashboardRepository } from "../src/infrastructure/supabase/dashboard-repository.ts";

const require = createRequire(import.meta.url);
const { encodeReply } = require("next/dist/compiled/react-server-dom-webpack/client.node");
const baseUrl = process.env.VERIFY_BASE_URL || "http://localhost:3000";
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const auth = getAuth(initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) }));
const suffix = randomBytes(6).toString("hex");
const employeeId = randomUUID(), appUserId = randomUUID();
let uid, cookie, customerId, departmentId, organizationId, pickupId;
const activityIds = [];
const productId = randomUUID();

async function checked(query) { const result = await query; assert.ifError(result.error); return result.data; }
async function request(path, options = {}) { return fetch(`${baseUrl}${path}`, { ...options, headers: { cookie: cookie || "", ...options.headers } }); }
async function action(name, path, fields) {
  await (await request(path)).text(); // ensure the route's actions are compiled
  const manifest = JSON.parse(await readFile(new URL("../.next/dev/server/server-reference-manifest.json", import.meta.url), "utf8"));
  const entry = Object.entries(manifest.node).find(([, value]) => value.exportedName === name);
  assert(entry, `Action missing: ${name}`);
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.set(key, String(value)));
  const response = await request(path, { method: "POST", headers: { "next-action": entry[0], origin: baseUrl, accept: "text/x-component" }, body: await encodeReply([{}, form]) });
  const text = await response.text();
  assert(response.status < 400, `${name}: HTTP ${response.status}`);
  console.log(`checked: ${name}`);
  return { response, text };
}
try {
  const organization = await checked(db.from("organizations").select("id").eq("name", "Alpha Communications").single());
  organizationId = organization.id;
  const department = await checked(db.from("departments").select("id").eq("organization_id", organizationId).eq("name", "営業").single());
  departmentId = department.id;
  uid = (await auth.createUser({ email: `schedule-e2e-${suffix}@example.com` })).uid;
  await checked(db.from("employees").insert({ id: employeeId, organization_id: organizationId, primary_department_id: departmentId, name: `予定検証-${suffix}`, status: "active" }));
  await checked(db.from("app_users").insert({ id: appUserId, firebase_uid: uid, employee_id: employeeId, organization_id: organizationId, email: `schedule-e2e-${suffix}@example.com`, role: "sales_rep", status: "active" }));
  await checked(db.from("app_user_departments").insert({ app_user_id: appUserId, department_id: departmentId, is_primary: true }));
  const customToken = await auth.createCustomToken(uid);
  const signedIn = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(process.env.NEXT_PUBLIC_FIREBASE_API_KEY)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) });
  const signInBody = await signedIn.json(); assert(signedIn.ok, "Firebase test sign-in failed");
  const session = await request("/api/auth/session", { method: "POST", headers: { "Content-Type": "application/json", origin: baseUrl }, body: JSON.stringify({ idToken: signInBody.idToken }) });
  assert.equal(session.status, 200); cookie = session.headers.get("set-cookie").split(";")[0];
  const customerName = `予定顧客-${suffix}`;
  await action("registerCustomer", "/customers", { departmentId, name: customerName, nameKana: "", branchName: "本社", branchKana: "", postalCode: "", prefecture: "", address1: "" });
  const customer = await checked(db.from("customers").select("id,external_id").eq("organization_id", organizationId).eq("name", customerName).single()); customerId = customer.id;
  const search = await request(`/api/customers/search?q=${encodeURIComponent(customerName)}`);
  assert((await search.json()).customers.some(row => row.id === customerId));
  const product = `予定商材-${suffix}`;
  await checked(db.from("products").insert({ id: productId, organization_id: organizationId, name: product, status: "active" }));
  const master = await request("/api/products/options"); assert.equal(master.status, 200);
  assert((await master.json()).products.includes(product));
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  const input = { departmentId, customerId, date: yesterday, startTime: "10:00", endTime: "11:00", category: "accompaniment", activityType: "visit", customerType: "GUP", product, area: `エリア-${suffix}`, opportunityId: "", pickupId: "" };
  await action("createActivity", "/", input);
  const created = await checked(db.from("activities").select("id,title,schedule_details").eq("organization_id", organizationId).eq("employee_id", employeeId).single()); activityIds.push(created.id);
  assert.equal(created.title, "訪問"); assert.equal(created.schedule_details.product, product); assert.equal(created.schedule_details.area, input.area);
  const invalid = await action("createActivity", "/", { ...input, category: "non_sales", activityType: "other" });
  assert(invalid.text.includes("カテゴリーに対応する活動種別"));
  const backlog = await request("/results"); const backlogText = await backlog.text(); assert(backlogText.includes(customerName));
  const exportResult = await request(`/api/schedule/export?start=${yesterday}&end=${yesterday}&selectionProvided=1&employeeIds=${employeeId}`);
  assert.equal(exportResult.status, 200); assert((await exportResult.text()).includes(input.area));
  const selfScope = { organizationId, employeeId, departmentIds: [departmentId], role: "sales_rep" };
  const teamRows = await createSupabaseDashboardRepository(db, selfScope, { teamCalendar: true }).findActivitiesBetween(`${yesterday}T00:00:00+09:00`, `${yesterday}T23:59:59+09:00`);
  assert(teamRows.every(row => row.departmentId === departmentId));
  const reportPath = `/activities/${created.id}/report`;
  const defaultsPage = await (await request(reportPath)).text(); assert(defaultsPage.includes("同行活動")); if (product) assert(defaultsPage.includes(product));
  const incomplete = await action("saveDetailedActivityReport", reportPath, { id: created.id, activityOwnerId: employeeId, registrationType: "actual", salesType: "IT同行活動", salesProcess: "IT同行活動", activityStatus: "提案中", activityDate: yesterday, product: product || "商材未定", confidence: "Ｂ：普通", startTime: "10:00", endTime: "11:00" });
  assert(incomplete.text.includes("すべて必須"));
  const report = Object.fromEntries(requiredReportFields("IT同行活動", "提案中").map(name => [name, "該当なし"]));
  Object.assign(report, { id: created.id, activityOwnerId: employeeId, registrationType: "actual", salesType: "IT同行活動", salesProcess: "IT同行活動", activityStatus: "提案中", activityDate: yesterday, product: product || "商材未定", confidence: "Ｂ：普通", startTime: "10:00", endTime: "11:00", attendeeEmployeeIds: "none", details: `検証結果-${suffix}`, contactRole: "担当者", stayMinutes: "60" });
  report.productsJson = JSON.stringify([{ name: report.product, amount: "", quantity: "", main: true }]);
  const saved = await action("saveDetailedActivityReport", reportPath, report);
  assert(saved.text.includes('success'), `Report did not return success: ${saved.text.split("\n").filter(line => line.startsWith("1:")).join("\n").slice(0,1000)}`);
  const completed = await checked(db.from("activities").select("status,completed_at,was_overdue,result").eq("id", created.id).single());
  assert.equal(completed.status, "completed"); assert.equal(completed.was_overdue, true); assert(completed.completed_at);
  const completedAt = completed.completed_at;
  await checked(db.from("activities").update({ result: completed.result + " 更新" }).eq("id", created.id));
  const updated = await checked(db.from("activities").select("completed_at,was_overdue").eq("id", created.id).single());
  assert.equal(updated.completed_at, completedAt); assert.equal(updated.was_overdue, true);
  assert(!(await (await request("/results")).text()).includes(customerName), "Completed report remains in backlog");
  const pickup = await checked(db.from("monthly_customer_pickups").insert({ organization_id: organizationId, department_id: departmentId, employee_id: employeeId, customer_id: customerId, target_month: yesterday.slice(0, 7) + "-01" }).select("id").single()); pickupId = pickup.id;
  await action("createActivity", "/", { ...input, pickupId });
  const appointment = await checked(db.from("activities").select("id").eq("employee_id", employeeId).eq("status", "scheduled").contains("schedule_details", { pickupId }).single()); activityIds.push(appointment.id);
  await action("cancelPickupAppointment", "/", { id: appointment.id, pickupId });
  const cancelled = await checked(db.from("activities").select("status").eq("id", appointment.id).single()); assert.equal(cancelled.status, "cancelled");
  assert(!(await (await request("/results")).text()).includes(customerName));
  console.log("OK: 顧客登録→検索→予定登録、カテゴリー検証、商材引き継ぎ、CSV、部署内参照、必須結果入力、期限後完了、打ち漏れ解消、ターゲットのアポ登録・解除");
} finally {
  if (organizationId) {
    // Only rows created for the unique test employee/customer are removed.
    if (customerId) await db.from("opportunities").delete().eq("organization_id", organizationId).eq("customer_id", customerId);
    await db.from("activities").delete().eq("organization_id", organizationId).eq("employee_id", employeeId);
    if (pickupId) await db.from("monthly_customer_pickups").delete().eq("id", pickupId);
    if (customerId) await db.from("customers").delete().eq("id", customerId);
    await db.from("products").delete().eq("id", productId);
    await db.from("app_users").delete().eq("id", appUserId);
    await db.from("employees").delete().eq("id", employeeId);
  }
  if (uid) await auth.deleteUser(uid);
}
