import assert from "node:assert/strict";
import test from "node:test";
import { canAccessDepartment, canManageActivity } from "../src/lib/auth/permissions.ts";
import { createSalesActivity } from "../src/application/activities/create-sales-activity.ts";

function context(overrides = {}) {
  return {
    userId: "user-a",
    firebaseUid: "firebase-a",
    organizationId: "organization-a",
    employeeId: "employee-a",
    email: "a@example.com",
    displayName: "A",
    role: "sales_rep",
    status: "active",
    departmentIds: ["department-a"],
    db: {},
    ...overrides,
  };
}

test("一般ユーザーは所属部門だけにアクセスできる", () => {
  const current = context();
  assert.equal(canAccessDepartment(current, "department-a"), true);
  assert.equal(canAccessDepartment(current, "department-b"), false);
});

test("全体管理者は全部門にアクセスできる", () => {
  assert.equal(canAccessDepartment(context({ role: "organization_admin", departmentIds: [] }), "department-b"), true);
});

test("予定を管理できるのは営業本人だけ", () => {
  assert.equal(canManageActivity(context(), "employee-a", "department-b"), true);
  assert.equal(canManageActivity(context(), "employee-b", "department-a"), false);
  assert.equal(canManageActivity(context({ role: "department_admin" }), "employee-b", "department-a"), false);
  assert.equal(canManageActivity(context({ role: "department_admin" }), "employee-b", "department-b"), false);
  assert.equal(canManageActivity(context({ role: "organization_admin" }), "employee-b", "department-b"), false);
});

test("終了が開始以前の予定はRepositoryへ渡さない", async () => {
  let called = false;
  const repository = { createWithCustomer: async () => { called = true; return "activity-a"; } };
  await assert.rejects(
    createSalesActivity(repository, { departmentId: "department-a", customerId: "customer-a", newCustomerName: "", title: "訪問", activityType: "visit", startsAt: "2026-09-17T10:00:00+09:00", endsAt: "2026-09-17T09:00:00+09:00" }),
    /終了時刻は開始時刻より後/,
  );
  assert.equal(called, false);
});

test("正しい予定はRepositoryへ一度だけ渡す", async () => {
  let calls = 0;
  const repository = { createWithCustomer: async () => { calls += 1; return "activity-a"; } };
  const result = await createSalesActivity(repository, { departmentId: "department-a", customerId: "customer-a", newCustomerName: "", title: "訪問", activityType: "visit", startsAt: "2026-09-17T09:00:00+09:00", endsAt: "2026-09-17T10:00:00+09:00" });
  assert.equal(result, "activity-a");
  assert.equal(calls, 1);
});
