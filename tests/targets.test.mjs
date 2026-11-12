import test from "node:test";
import assert from "node:assert/strict";
import { canManageProducts, targetExecuted, executionRate } from "../src/domain/targets/rules.ts";
import { findTargets } from "../src/infrastructure/supabase/target-repository.ts";

test("商材管理は部門・兼務・本部管理者だけ", () => {
  assert.equal(canManageProducts("sales_rep"), false);
  for (const role of ["department_admin", "department_admin_sales_rep", "organization_admin"]) assert.equal(canManageProducts(role), true);
});
test("実行率は対象案件・本人・日本時間の対象月の訪問/オンラインの結果だけ", () => {
  const activity = { employee_id: "self", starts_at: "2026-10-31T15:00:00Z", status: "completed", activity_type: "visit", schedule_details: { pickupId: "one" } };
  assert.equal(targetExecuted("one", "self", "2026-11", [activity]), true);
  for (const other of [{ status: "scheduled" }, { status: "cancelled" }, { activity_type: "documents" }, { employee_id: "other" }, { schedule_details: { pickupId: "two" } }, { starts_at: "2026-11-30T15:00:00Z" }]) assert.equal(targetExecuted("one", "self", "2026-11", [{ ...activity, ...other }]), false);
  assert.equal(executionRate(1, 3), 33); assert.equal(executionRate(0, 0), 0);
});
function client(rows) {
  return { from(table) {
    let result = table === "monthly_customer_pickups" ? rows : [];
    const q = { select() { return q; }, order() { return q; }, neq(key, value) { result = result.filter(row => row[key] !== value); return q; },
      eq(key, value) { result = result.filter(row => row[key] === value); return q; }, in(key, values) { result = result.filter(row => values.includes(row[key])); return q; },
      range(start, end) { return Promise.resolve({ data: result.slice(start, end + 1), error: null }); } };
    return q;
  } };
}
const rows = [
  { id: "own", organization_id: "org", employee_id: "self", department_id: "sales", target_month: "2026-11-01" },
  { id: "colleague", organization_id: "org", employee_id: "other", department_id: "sales", target_month: "2026-11-01" },
  { id: "other-dept", organization_id: "org", employee_id: "axcel", department_id: "axcel", target_month: "2026-11-01" },
  { id: "other-org", organization_id: "other-org", employee_id: "self", department_id: "sales", target_month: "2026-11-01" },
];
const context = { db: client(rows), organizationId: "org", employeeId: "self", departmentIds: ["sales"] };
test("営業は自分だけ、部門管理者は所属内、本部管理者は組織内に限定", async () => {
  for (const [role, expected] of [["sales_rep", ["own"]], ["department_admin", ["own", "colleague"]], ["department_admin_sales_rep", ["own", "colleague"]], ["organization_admin", ["own", "colleague", "other-dept"]]]) {
    assert.deepEqual((await findTargets({ ...context, role }, "2026-11")).map(row => row.id), expected);
  }
  assert.deepEqual((await findTargets({ ...context, role: "sales_rep" }, "2026-11", "other")).map(row => row.id), ["own"]);
  assert.deepEqual((await findTargets({ ...context, role: "department_admin" }, "2026-11", "other")).map(row => row.id), ["colleague"]);
  assert.deepEqual(await findTargets({ ...context, role: "department_admin", departmentIds: [] }, "2026-11"), []);
});
test("1000件を超えるターゲットを省略しない", async () => {
  const many = Array.from({ length: 1002 }, (_, i) => ({ ...rows[0], id: String(i) }));
  assert.equal((await findTargets({ ...context, db: client(many), role: "sales_rep" }, "2026-11")).length, 1002);
});
