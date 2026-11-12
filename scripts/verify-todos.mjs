import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { findPersonalTodos } from "../src/infrastructure/supabase/todo-repository.ts";
const require = createRequire(import.meta.url);
const { encodeReply } = require("next/dist/compiled/react-server-dom-webpack/client.node");
const base = process.env.VERIFY_BASE_URL || "http://localhost:3000";
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const auth = getAuth(initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) }));
const suffix = randomBytes(5).toString("hex");
const employeeId = randomUUID(), otherEmployeeId = randomUUID(), userId = randomUUID(), otherUserId = randomUUID();
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
  const path = "/?infoTab=todo";
  assert((await action("saveTodo", path, { operation: "add", title: " ", dueDate: "" })).includes("ToDoを入力"));
  assert((await action("saveTodo", path, { operation: "add", title: `検証タスク-${suffix}`, dueDate: "2026-11-01" })).includes("ToDoを保存"));
  const own = await check(db.from("personal_todos").select("id,title").eq("app_user_id", userId).single());
  const other = await check(db.from("personal_todos").insert({ app_user_id: otherUserId, organization_id: org, title: `他人のタスク-${suffix}` }).select("id").single());
  const html = await (await request(path)).text(); assert(html.includes(own.title)); assert(!html.includes(`他人のタスク-${suffix}`));
  assert((await action("saveTodo", path, { operation: "edit", id: own.id, title: "編集済み", dueDate: "" })).includes("ToDoを保存"));
  let item = await check(db.from("personal_todos").select("title,due_date,completed_at").eq("id", own.id).single()); assert.equal(item.title, "編集済み"); assert.equal(item.due_date, null);
  await action("saveTodo", path, { operation: "toggle", id: own.id, completed: "true" });
  item = await check(db.from("personal_todos").select("completed_at").eq("id", own.id).single()); assert(item.completed_at);
  await action("saveTodo", path, { operation: "toggle", id: own.id, completed: "false" });
  item = await check(db.from("personal_todos").select("completed_at").eq("id", own.id).single()); assert.equal(item.completed_at, null);
  for (const role of ["sales_rep", "organization_admin"]) {
    await check(db.from("app_users").update({ role }).eq("id", userId));
    for (const operation of ["edit", "toggle", "delete"]) assert((await action("saveTodo", path, { operation, id: other.id, title: "不正更新", dueDate: "", completed: "true" })).includes("自分のToDoを更新できません"));
    assert.deepEqual((await findPersonalTodos({ db, organizationId: org, userId, role })).map(t => t.id), [own.id]);
  }
  assert((await action("saveTodo", path, { operation: "delete", id: own.id })).includes("ToDoを削除"));
  assert.equal((await check(db.from("personal_todos").select("id").eq("app_user_id", userId))).length, 0);
  console.log("ToDo creation, validation, editing, completion, reopening, deletion, and owner-only permissions verified");
} finally {
  await check(db.from("personal_todos").delete().in("app_user_id", [userId, otherUserId]));
  await check(db.from("app_users").delete().in("id", [userId, otherUserId]));
  await check(db.from("employees").delete().in("id", [employeeId, otherEmployeeId]));
  if (uid) await auth.deleteUser(uid);
  console.log("temporary ToDo test records removed");
}
