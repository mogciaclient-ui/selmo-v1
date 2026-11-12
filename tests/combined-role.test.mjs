import assert from "node:assert/strict";
import test from "node:test";
import { authRoles, canActAsSalesRep, isDepartmentAdmin } from "../src/lib/auth/roles.ts";
import { canAccessDepartment, canManageActivity } from "../src/lib/auth/permissions.ts";
import { createSupabaseDashboardRepository } from "../src/infrastructure/supabase/dashboard-repository.ts";
import { createSupabaseSalesActivityRepository } from "../src/infrastructure/supabase/sales-activity-repository.ts";

const scope = { role: "department_admin_sales_rep", organizationId: "org-a", employeeId: "self", departmentIds: ["sales"] };

test("4ロールの営業機能と部門管理機能を分離する", () => {
  assert.equal(authRoles.length, 4);
  for (const [role, sales, management] of [
    ["sales_rep", true, false], ["department_admin", false, true],
    ["department_admin_sales_rep", true, true], ["organization_admin", false, false],
  ]) {
    assert.equal(canActAsSalesRep(role), sales, role);
    assert.equal(isDepartmentAdmin(role), management, role);
    assert.equal(canManageActivity({ ...scope, role }, "self", "sales"), sales, role);
    assert.equal(canManageActivity({ ...scope, role }, "other", "sales"), false, role);
  }
  assert.equal(canAccessDepartment(scope, "sales"), true);
  assert.equal(canAccessDepartment(scope, "other-department"), false);
});

// Model query execution over several owners/departments/organizations.
function fakeClient(rows) {
  return { from() {
    let selected = rows;
    const query = {
      select() { return query; }, order() { return query; }, gte() { return query; }, lt() { return query; },
      eq(key, value) { selected = selected.filter(row => row[key] === value); return query; },
      in(key, values) { selected = selected.filter(row => values.includes(row[key])); return query; },
      or(filter) { assert.equal(filter, "employee_id.eq.self"); selected = selected.filter(row => row.employee_id === "self"); return query; },
      delete() { return query; },
      maybeSingle() { return Promise.resolve({ data: selected[0] ?? null, error: null }); },
      then(resolve, reject) { return Promise.resolve({ data: selected, error: null }).then(resolve, reject); },
    };
    return query;
  }};
}
const rows = [
  { id: "own", organization_id: "org-a", department_id: "sales", employee_id: "self" },
  { id: "teammate", organization_id: "org-a", department_id: "sales", employee_id: "other" },
  { id: "other-department", organization_id: "org-a", department_id: "axcel", employee_id: "other" },
  { id: "other-org", organization_id: "org-b", department_id: "sales", employee_id: "self" },
];

test("兼務の予定一覧は所属部門だけ、空の所属はアクセスなし", async () => {
  for (const [current, expected] of [[scope, ["own", "teammate"]], [{ ...scope, departmentIds: [] }, []]]) {
    const repo = createSupabaseDashboardRepository(fakeClient(rows.map(row => ({ ...row, customers: null }))), current);
    const result = await repo.findActivitiesBetween("2026-11-01", "2026-12-01");
    assert.deepEqual(result.map(row => row.id), expected);
  }
});

test("兼務の予定削除は本人だけで、同じ部門の他人や別組織は拒否", async () => {
  const repo = createSupabaseSalesActivityRepository(fakeClient(rows), scope);
  await repo.delete("own");
  for (const id of ["teammate", "other-department", "other-org"]) {
    await assert.rejects(repo.delete(id), /権限/);
  }
});


test("営業のカレンダー共有は部署内だけに広げ、通常の一覧は本人のまま", async () => {
  const current = { ...scope, role: "sales_rep" };
  const client = fakeClient(rows.map(row => ({ ...row, customers: null })));
  const own = await createSupabaseDashboardRepository(client, current).findActivitiesBetween("2026-11-01", "2026-12-01");
  assert.deepEqual(own.map(row => row.id), ["own"]);
  const team = await createSupabaseDashboardRepository(client, current, { teamCalendar: true }).findActivitiesBetween("2026-11-01", "2026-12-01");
  assert.deepEqual(team.map(row => row.id), ["own", "teammate"]);
  const none = await createSupabaseDashboardRepository(client, { ...current, departmentIds: [] }, { teamCalendar: true }).findActivitiesBetween("2026-11-01", "2026-12-01");
  assert.deepEqual(none, []);
});
