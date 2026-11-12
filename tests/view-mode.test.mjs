import test from "node:test";
import assert from "node:assert/strict";
import { LEGACY_UI_ROLE, resolveViewMode } from "../src/lib/auth/view-mode.ts";

const uid = "glyYq4V5XeS1mNkAFCbfGnu3YeP2";

test("旧selmo を選んだ開発用アカウントだけ admin と同じUIになる", () => {
  assert.equal(resolveViewMode(true, uid, uid), "manager");
});

test("旧selmo を選んでいなければ、どのロールも今まで通りのUI", () => {
  assert.equal(resolveViewMode(true, uid, undefined), "sales");
  assert.equal(resolveViewMode(false, "other-user", undefined), "sales");
});

test("ロール切り替えできないユーザーや別ユーザーのクッキーでは旧selmoにならない", () => {
  assert.equal(resolveViewMode(false, uid, uid), "sales");
  assert.equal(resolveViewMode(true, uid, "other-user"), "sales");
});

test("旧selmo は本部管理者の権限で動く", () => {
  assert.equal(LEGACY_UI_ROLE, "organization_admin");
});
