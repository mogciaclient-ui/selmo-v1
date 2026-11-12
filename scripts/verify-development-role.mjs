import assert from "node:assert/strict";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
const base = "http://localhost:3000";
const uid = "glyYq4V5XeS1mNkAFCbfGnu3YeP2";
const auth = getAuth(initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) }));
const customToken = await auth.createCustomToken(uid);
const identity = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) });
const { idToken } = await identity.json(); assert(idToken);
const login = await fetch(`${base}/api/auth/session`, { method: "POST", headers: { origin: base, "content-type": "application/json" }, body: JSON.stringify({ idToken }) });
assert.equal(login.status, 200);
const session = login.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
let cookie = session;
const page = await fetch(base, { headers: { cookie } }); assert.equal(page.status, 200); assert((await page.text()).includes("開発用ロール切り替え"));
for (const [role, label, usersStatus] of [["sales_rep", "営業担当", 307], ["department_admin", "部門管理者", 307], ["department_admin_sales_rep", "部門管理者兼営業担当", 307], ["organization_admin", "本部管理者", 200]]) {
  const form = new FormData(); form.set("role", role);
  const response = await fetch(`${base}/api/auth/development-role`, { method: "POST", redirect: "manual", headers: { cookie, origin: base }, body: form });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/");
  const switched = response.headers.getSetCookie().find(value => value.startsWith("selmo_development_role=")); assert(switched);
  cookie = `${session}; ${switched.split(";")[0]}`;
  const html = await (await fetch(base, { headers: { cookie } })).text(); assert(html.includes(`現在：<!-- -->${label}`) || html.includes(`現在：${label}`));
  const users = await fetch(`${base}/users`, { redirect: "manual", headers: { cookie } }); const usersHtml = await users.text();
  if (usersStatus === 200) { assert.equal(users.status, 200); assert(usersHtml.includes("ユーザー管理")); }
  else { assert(!usersHtml.includes("ユーザー管理")); assert(users.status === 307 || usersHtml.includes("NEXT_REDIRECT") || usersHtml.includes('http-equiv="refresh"')); }
  console.log(`${role}: switch and server permission verified`);
}
