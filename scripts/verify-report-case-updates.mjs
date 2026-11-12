import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { findConsiderationItems } from "../src/infrastructure/supabase/consideration-repository.ts";
import { syncOpportunityFromActivity } from "../src/lib/activities/sync-opportunity-from-activity.ts";
const require = createRequire(import.meta.url);
const { encodeReply } = require("next/dist/compiled/react-server-dom-webpack/client.node");
const base = process.env.VERIFY_BASE_URL || "http://localhost:3000";
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const auth = getAuth(initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) }));
const suffix = randomBytes(5).toString("hex");
const employeeId = randomUUID(), otherEmployeeId = randomUUID(), userId = randomUUID(), otherUserId = randomUUID();
let uid, cookie, org, dept;
const customerId = randomUUID(), productId = randomUUID(), otherProductId = randomUUID();
const check = async (q) => { const r = await q; assert.ifError(r.error); return r.data; };
const request = (path, options = {}) => fetch(`${base}${path}`, { ...options, headers: { cookie: cookie || "", ...options.headers } });
async function action(name, path, fields, stateful = true) {
  await (await request(path)).text();
  const manifest = JSON.parse(await readFile(new URL("../.next/dev/server/server-reference-manifest.json", import.meta.url), "utf8"));
  const entry = Object.entries(manifest.node).find(([, value]) => value.exportedName === name); assert(entry, name);
  const form = new FormData(); for (const [key, value] of Object.entries(fields)) form.set(key, value instanceof File ? value : String(value));
  const response = await request(path, { method: "POST", redirect: "manual", headers: { origin: base, "next-action": entry[0], accept: "text/x-component" }, body: await encodeReply(stateful ? [{}, form] : [form]) });
  const text = await response.text(); assert(response.status < 400, `${name}: ${response.status} ${text.slice(0, 300)}`);
  console.log(`action verified: ${name}`, [...text.matchAll(/"message":"([^"\n]+)"/g)].map(match => match[1]).slice(-1).join(""));
  return text;
}
try {
  org = (await check(db.from("organizations").select("id").eq("name", "Alpha Communications").single())).id;
  dept = (await check(db.from("departments").select("id").eq("organization_id", org).eq("name", "営業").single())).id;
  uid = (await auth.createUser({ email: `todo-${suffix}@example.com` })).uid;
  await check(db.from("employees").insert({ id: employeeId, organization_id: org, primary_department_id: dept, name: `ToDo検証-${suffix}`, status: "active" }));
  await check(db.from("employees").insert({ id: otherEmployeeId, organization_id: org, primary_department_id: dept, name: `ToDo別担当検証-${suffix}`, status: "inactive" }));
  await check(db.from("app_users").insert([{ id: userId, firebase_uid: uid, employee_id: employeeId, organization_id: org, email: `todo-${suffix}@example.com`, role: "sales_rep", status: "active" }, { id: otherUserId, employee_id: otherEmployeeId, organization_id: org, email: `todo-other-${suffix}@example.com`, role: "sales_rep", status: "inactive" }]));
  await check(db.from("app_user_departments").insert({ app_user_id: userId, department_id: dept, is_primary: true }));
  const customToken = await auth.createCustomToken(uid);
  const identity = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) });
  const { idToken } = await identity.json(); assert(idToken);
  const login = await fetch(`${base}/api/auth/session`, { method: "POST", headers: { origin: base, "content-type": "application/json" }, body: JSON.stringify({ idToken }) }); assert.equal(login.status, 200);
  cookie = login.headers.getSetCookie().map(c => c.split(";")[0]).join("; ");
  const product = `活動商材検証-${suffix}`, otherProduct = `別商材検証-${suffix}`;
  await check(db.from("products").insert([{ id: productId, organization_id: org, name: product, status: "active" }, { id: otherProductId, organization_id: org, name: otherProduct, status: "active" }]));
  await check(db.from("customers").insert({ id: customerId, organization_id: org, department_id: dept, name: `活動客先検証-${suffix}` }));
  const manual = await action("createOpportunity", "/opportunities", {
    customerId, productName: product, stage: "approach", status: "open", confidence: "B", priority: "medium",
  });
  assert(manual.includes("案件を登録しました"));
  const createdCase = await check(db.from("opportunities").select("id,name,product_name").eq("customer_id", customerId).single());
  assert.equal(createdCase.name, product);
  assert.equal(createdCase.product_name, product);
  await check(db.from("opportunities").delete().eq("id", createdCase.id));
  const csv = new File([`顧客名,商材\n活動客先検証-${suffix},${product}\n`], "case.csv", { type: "text/csv" });
  assert((await action("importOpportunitiesCsv", "/opportunities", { file: csv })).includes("1件の案件を登録"));
  const imported = await check(db.from("opportunities").select("id,name,product_name").eq("customer_id", customerId).single());
  assert.equal(imported.name, product);
  assert.equal(imported.product_name, product);
  await check(db.from("opportunities").delete().eq("id", imported.id));
  async function create(date, selectedProduct = product) {
    await action("createActivity", "/", { customerId, departmentId: dept, date, startTime: "10:00", endTime: "11:00", category: "accompaniment", activityType: "visit", customerType: "新規", product: selectedProduct, area: "検証エリア", opportunityId: "", pickupId: "" });
    const rows = await check(db.from("activities").select("id,schedule_details").eq("customer_id", customerId).eq("starts_at", `${date}T10:00:00+09:00`)); assert.equal(rows.length, 1); return rows[0];
  }
  const first = await create("2026-11-10"); assert.equal(first.schedule_details.salesType, "IT同行活動"); assert.equal(first.schedule_details.salesProcess, "IT同行活動");
  const firstPath = `/activities/${first.id}/report`;
  const html = await (await request(firstPath)).text(); assert(html.includes(product)); assert(html.includes("△ 提案")); assert(!html.includes('name="customerContact"')); assert(!html.includes('name="attendeeEmployeeIds"')); assert(!html.includes('value="保留中"'));
  const baseFields = { id: first.id, activityOwnerId: employeeId, registrationType: "actual", salesType: "IT同行活動", salesProcess: "IT同行活動", activityStatus: "提案中", activityDate: "2026-11-10", product, confidence: "Ｂ：普通", startTime: "10:00", endTime: "11:00", activityLocation: "本社", priority: "Ｃ 普通", commonNotes: "検証の備考", stayMinutes: "60", details: "初回の訪問結果", productsJson: JSON.stringify([{ name: product, amount: "", quantity: "", main: true }]) };
  assert((await action("saveDetailedActivityReport", firstPath, { ...baseFields, activityStatus: "保留中" })).includes("ステータスを確認"));
  assert((await action("saveDetailedActivityReport", firstPath, { ...baseFields, product: "未登録の商材", productsJson: JSON.stringify([{ name: "未登録の商材", amount: "", quantity: "", main: true }]) })).includes("商材マスタから"));
  await check(db.from("activities").update({ common_report: { customerContact: "以前の面談者", attendeeEmployeeIds: [employeeId], attendees: ["以前の同席者"], contactRole: "担当者" } }).eq("id", first.id));
  assert((await action("saveDetailedActivityReport", firstPath, baseFields)).includes("活動内容を保存"));
  const saved = await check(db.from("activities").select("common_report,schedule_details").eq("id", first.id).single()); assert.equal(saved.common_report.customerContact, "以前の面談者"); assert.deepEqual(saved.common_report.attendeeEmployeeIds, [employeeId]); assert(saved.schedule_details.opportunityId);
  const second = await create("2026-11-11");
  const secondFields = { ...baseFields, id: second.id, activityDate: "2026-11-11", activityStatus: "受注", orderAmount: "100000", orderQuantity: "1", orderDate: "2026-11-11", details: "再訪で受注" };
  assert((await action("saveDetailedActivityReport", `/activities/${second.id}/report`, secondFields)).includes("活動内容を保存"));
  let cases = await check(db.from("opportunities").select("id,status,activity_from,activity_to").eq("customer_id", customerId).is("merged_into_id", null)); assert.equal(cases.length, 1); assert.equal(cases[0].status, "won");
  const scope = { db, organizationId: org, employeeId, departmentIds: [dept], role: "sales_rep" }; assert.equal((await findConsiderationItems(scope)).filter(t => t.id === cases[0].id).length, 0);
  assert((await action("saveDetailedActivityReport", firstPath, { ...baseFields, details: "古い訪問の追記" })).includes("活動内容を保存"));
  cases = await check(db.from("opportunities").select("id,status,activity_from,activity_to").eq("customer_id", customerId).is("merged_into_id", null)); assert.equal(cases[0].status, "won"); assert.equal(cases[0].activity_from, "2026-11-10"); assert.equal(cases[0].activity_to, "2026-11-11");
  const links = await check(db.from("activities").select("schedule_details").eq("customer_id", customerId)); assert(links.every(a => a.schedule_details.opportunityId === cases[0].id));
  const third = await create("2026-11-12", otherProduct);
  assert((await action("saveDetailedActivityReport", `/activities/${third.id}/report`, { ...baseFields, id: third.id, activityDate: "2026-11-12", product: otherProduct, productsJson: JSON.stringify([{ name: otherProduct, amount: "", quantity: "", main: true }]) })).includes("活動内容を保存"));
  assert.equal((await check(db.from("opportunities").select("id").eq("customer_id", customerId).is("merged_into_id", null))).length, 2);
  console.log("report: inherited defaults, three statuses, removed fields, product master, revisits and historical preservation verified");
  const makeActivity = async (owner, day) => check(db.from("activities").insert({ organization_id: org, department_id: dept, employee_id: owner, customer_id: customerId, title: "同時更新検証", activity_type: "visit", starts_at: `${day}T10:00:00+09:00`, ends_at: `${day}T11:00:00+09:00`, status: "completed" }).select("id").single());
  const [older, later] = await Promise.all([makeActivity(employeeId, "2026-11-13"), makeActivity(employeeId, "2026-11-14")]);
  const input = { organizationId: org, departmentId: dept, customerId, employeeId, title: "同じ案件", product, activityDate: "2026-11-13", activityId: older.id, activityStatus: "提案中" };
  const ids = await Promise.all([syncOpportunityFromActivity(db, input), syncOpportunityFromActivity(db, { ...input, activityId: later.id, activityDate: "2026-11-14", activityStatus: "失注" })]); assert.equal(ids[0], ids[1]);
  const latest = await check(db.from("opportunities").select("status,activity_to").eq("id", ids[0]).single()); assert.equal(latest.status, "lost"); assert.equal(latest.activity_to, "2026-11-14");
  const anotherOwner = await makeActivity(otherEmployeeId, "2026-11-14");
  const otherCase = await syncOpportunityFromActivity(db, { ...input, employeeId: otherEmployeeId, activityId: anotherOwner.id, activityDate: "2026-11-14" }); assert.notEqual(otherCase, ids[0]);
  console.log("cases: concurrent saves, latest-date outcome, and distinct owners verified");
  await check(db.from("activities").update({ result: "他担当者の活動結果（検証用）", common_report: { activityStatus: "提案中", confidence: "確度の検証値" } }).eq("id", anotherOwner.id));
  await check(db.from("app_users").update({ role: "department_admin" }).eq("id", userId));
  const readOnly = await request(`/activities/${anotherOwner.id}/report`);
  assert.equal(readOnly.status, 200);
  const readOnlyHtml = await readOnly.text();
  assert(readOnlyHtml.includes("閲覧専用"));
  assert(readOnlyHtml.includes("他担当者の活動結果（検証用）"));
  assert(!readOnlyHtml.includes("活動を登録する"));
  assert(!readOnlyHtml.includes("確度の検証値"));
  console.log("report: department manager sees the other employee's result without an edit form");

  const exportResponse = await request("/api/customers/export");
  assert.equal(exportResponse.status, 200);
  const csvBody = await exportResponse.text();
  let inQuotes = false, rowCount = 0;
  for (const character of csvBody) {
    if (character === '"') inQuotes = !inQuotes;
    else if (character === "\n" && !inQuotes) rowCount++;
  }
  const { count, error } = await db.from("customers").select("id", { count: "exact", head: true }).eq("organization_id", org);
  assert.ifError(error);
  assert.equal(rowCount, count);
  assert(csvBody.includes(`活動客先検証-${suffix}`));
  console.log(`customer CSV: ${rowCount} rows, matches organization customer count`);

} finally {
  await check(db.from("opportunities").delete().eq("customer_id", customerId));
  await check(db.from("activities").delete().eq("customer_id", customerId));
  await check(db.from("customers").delete().eq("id", customerId));
  await check(db.from("products").delete().in("id", [productId, otherProductId]));
  await check(db.from("app_users").delete().in("id", [userId, otherUserId]));
  await check(db.from("employees").delete().in("id", [employeeId, otherEmployeeId]));
  if (uid) await auth.deleteUser(uid);
  console.log("temporary report/case test records removed");
}
