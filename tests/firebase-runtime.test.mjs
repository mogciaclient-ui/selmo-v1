import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
test("Firebase Admin loads when Vercel disables require(ESM)", () => {
  const result = spawnSync(process.execPath, ["--no-experimental-require-module", "-e", "if (typeof require('firebase-admin/auth').getAuth !== 'function') process.exit(1)"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});
