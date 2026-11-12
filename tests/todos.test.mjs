import test from "node:test";
import assert from "node:assert/strict";
import { findPersonalTodos } from "../src/infrastructure/supabase/todo-repository.ts";
function db(rows) { return { from(table) {
  assert.equal(table, "personal_todos"); let result = rows;
  const q = { select() { return q; }, order() { return q; }, eq(key, value) { result = result.filter(row => row[key] === value); return q; }, range(start, end) { return Promise.resolve({ data: result.slice(start, end + 1), error: null }); } }; return q;
} }; }
test("管理者でも他人や別組織の個人ToDoを表示しない", async () => {
  const rows = [{ id: "own", organization_id: "org", app_user_id: "self" }, { id: "other", organization_id: "org", app_user_id: "other" }, { id: "outside", organization_id: "outside", app_user_id: "self" }];
  for (const role of ["sales_rep", "department_admin", "department_admin_sales_rep", "organization_admin"]) assert.deepEqual((await findPersonalTodos({ db: db(rows), organizationId: "org", userId: "self", role })).map(row => row.id), ["own"]);
});
test("1000件を超えるToDoも表示対象から落とさない", async () => {
  const rows = Array.from({ length: 1001 }, (_, index) => ({ id: String(index), organization_id: "org", app_user_id: "self" }));
  assert.equal((await findPersonalTodos({ db: db(rows), organizationId: "org", userId: "self" })).length, 1001);
});
