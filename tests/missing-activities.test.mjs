import assert from "node:assert/strict";
import test from "node:test";
import { getMissingActivities, missingCounts } from "../src/infrastructure/supabase/missing-activity-repository.ts";

const scope = { organizationId: "org-a", employeeId: "self", role: "sales_rep", departmentIds: ["sales"] };
const now = new Date("2026-11-05T00:00:00+09:00");
const row = (id, patch = {}) => ({ id, organization_id: "org-a", department_id: "sales", employee_id: "self", activity_type: "visit", starts_at: "2026-10-01T10:00:00+09:00", status: "scheduled", result: null, ...patch });
function database(rows) {
  let calls = 0;
  return { get calls() { return calls; }, from() {
    calls++;
    const filters = []; let start = 0, end = 999;
    const query = {
      select() { return query; },
      eq(key, value) { filters.push(row => row[key] === value); return query; },
      in(key, values) { filters.push(row => values.includes(row[key])); return query; },
      lt(key, value) { filters.push(row => new Date(row[key]) < new Date(value)); return query; },
      not(key, operator, values) { assert.equal(operator, "in"); const excluded = values.slice(1, -1).split(","); filters.push(row => !excluded.includes(row[key])); return query; },
      or() { filters.push(row => row.result === null || row.result === ""); return query; },
      order() { return query; },
      range(from, to) { start = from; end = to; return query; },
      then(resolve, reject) { return Promise.resolve({ data: rows.filter(row => filters.every(filter => filter(row))).sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.id.localeCompare(b.id)).slice(start, end + 1), error: null }).then(resolve, reject); },
    }; return query;
  }};
}
const rows = [row("old"), row("teammate", {employee_id:"other", activity_type:"online"}), row("future", {starts_at:"2026-11-06T10:00:00+09:00"}), row("today", {starts_at:"2026-11-05T10:00:00+09:00"}), row("done", {status:"completed",result:"入力済"}), row("cancelled", {status:"cancelled"}), row("non-sales", {activity_type:"survey"}), row("outside", {department_id:"axcel",employee_id:"other"}), row("other-org", {organization_id:"org-b"})];
test("営業の件数・一覧は本人だけ。別担当者への直接アクセスも拒否", async () => {
  const db = database(rows);
  assert.deepEqual((await getMissingActivities(db, scope, undefined, now)).map(row=>row.id), ["old"]);
  const calls = db.calls;
  await assert.rejects(getMissingActivities(db, scope, "other", now), /権限/);
  assert.equal(db.calls, calls);
});
test("部門管理者と兼務管理者は部門内、本部管理者は組織内だけ参照", async () => {
  for (const role of ["department_admin", "department_admin_sales_rep"]) {
    const found = await getMissingActivities(database(rows), {...scope,role}, undefined, now);
    assert.deepEqual(found.map(row=>row.id), ["old", "teammate"]);
    assert.deepEqual(missingCounts(found), {self:1,other:1});
    assert.deepEqual((await getMissingActivities(database(rows), {...scope,role}, "other", now)).map(row=>row.id), ["teammate"]);
    assert.deepEqual(await getMissingActivities(database(rows), {...scope,role,departmentIds:[]}, undefined, now), []);
  }
  const found = await getMissingActivities(database(rows), {...scope,role:"organization_admin"}, undefined, now);
  assert.deepEqual(found.map(row=>row.id), ["old", "outside", "teammate"]);
});
test("表示週と無関係に過去の未完了を1000件より先も合計する", async () => {
  const many = Array.from({length:1005}, (_, index) => row(`old-${String(index).padStart(4,"0")}`));
  const db = database(many);
  const found = await getMissingActivities(db, {...scope,role:"department_admin"}, undefined, now);
  assert.equal(db.calls, 2);
  assert.equal(found.length, 1005);
  assert.deepEqual(missingCounts(found), {self:1005});
});
