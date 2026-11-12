import assert from "node:assert/strict";
import test from "node:test";
import { canSwitchDevelopmentRole, resolveDevelopmentRole } from "../src/lib/auth/development-role.ts";
import { authRoles } from "../src/lib/auth/roles.ts";
const uid = "glyYq4V5XeS1mNkAFCbfGnu3YeP2";
test("指定UIDかつ本部管理者のみ4ロールを切り替え可能", () => {
  for (const role of authRoles) assert.equal(resolveDevelopmentRole(uid, "organization_admin", `${uid}:${role}`), role);
  assert.equal(canSwitchDevelopmentRole("other", "organization_admin"), false);
  assert.equal(canSwitchDevelopmentRole(uid, "sales_rep"), false);
  assert.equal(resolveDevelopmentRole("other", "sales_rep", `${uid}:organization_admin`), "sales_rep");
  assert.equal(resolveDevelopmentRole(uid, "sales_rep", `${uid}:organization_admin`), "sales_rep");
  for (const value of [undefined, "organization_admin", `${uid}:invalid`, "other:sales_rep"]) assert.equal(resolveDevelopmentRole(uid, "organization_admin", value), "organization_admin");
});
