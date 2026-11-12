import test from "node:test";
import assert from "node:assert/strict";
import { findConsiderationItems } from "../src/infrastructure/supabase/consideration-repository.ts";
import { findProcessingTasks } from "../src/infrastructure/supabase/processing-repository.ts";
import { canAssignProcessing } from "../src/domain/tasks/rules.ts";
function db(tables) { return { from(table) { let rows = tables[table] ?? []; const q = { select() { return q; }, order() { return q; }, is(key, value) { rows = rows.filter(row => (row[key] ?? null) === value); return q; }, eq(key, value) { rows = rows.filter(row => row[key] === value); return q; }, in(key, values) { rows = rows.filter(row => values.includes(row[key])); return q; }, range(start, end) { return Promise.resolve({ data: rows.slice(start, end + 1), error: null }); } }; return q; } }; }
const base = { organizationId: "org", departmentIds: ["sales"], employeeId: "self", userId: "self-user" };
test("検討リストはopenだけ。受注・失注・保留と他人・別組織は含めない", async () => {
 const rows = ["open", "won", "lost", "on_hold"].map(status => ({ id: status, status, organization_id: "org", employee_id: "self", department_id: "sales" }));
 rows.push({ ...rows[0], id: "other", employee_id: "other" }, { ...rows[0], id: "outside", organization_id: "outside" }, { ...rows[0], id: "axcel", department_id: "axcel", employee_id: "axcel" });
 const context = { ...base, db: db({ opportunities: rows }) };
 assert.deepEqual((await findConsiderationItems({ ...context, role: "sales_rep" })).map(x => x.id), ["open"]);
 assert.deepEqual((await findConsiderationItems({ ...context, role: "department_admin" })).map(x => x.id), ["open", "other"]);
 assert.deepEqual((await findConsiderationItems({ ...context, role: "organization_admin" })).map(x => x.id), ["open", "other", "axcel"]);
 rows[0].status = "won";
 assert.deepEqual(await findConsiderationItems({ ...context, role: "sales_rep" }), []);
});
test("処理一覧は営業本人・管理者所属部門・本部全社の範囲で表示", async () => {
 const rows = [{ id: "self", organization_id: "org", department_id: "sales", assignee_user_id: "self-user" }, { id: "other", organization_id: "org", department_id: "sales", assignee_user_id: "other-user" }, { id: "axcel", organization_id: "org", department_id: "axcel", assignee_user_id: "axcel-user" }, { id: "outside", organization_id: "outside", department_id: "sales", assignee_user_id: "self-user" }];
 for (const [role, ids] of [["sales_rep", ["self"]], ["department_admin", ["self", "other"]], ["department_admin_sales_rep", ["self", "other"]], ["organization_admin", ["self", "other", "axcel"]]]) {
  assert.equal(canAssignProcessing(role), role !== "sales_rep");
  assert.deepEqual((await findProcessingTasks({ ...base, role, db: db({ processing_tasks: rows }) })).map(x => x.id), ids);
 }
 assert.deepEqual(await findProcessingTasks({ ...base, departmentIds: [], role: "department_admin", db: db({ processing_tasks: rows }) }), []);
});
