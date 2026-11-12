import assert from "node:assert/strict";
import test from "node:test";
import { salesCalendarSelection } from "../src/domain/calendar/sales-scope.ts";
const members = [{ id: "self" }, { id: "teammate" }];
test("営業カレンダーは自分を初期表示し、所属内メンバーと全員を選択できる", () => {
  assert.equal(salesCalendarSelection("self", members, {}), "self");
  assert.equal(salesCalendarSelection("self", members, { employeeId: "teammate" }), "teammate");
  assert.equal(salesCalendarSelection("self", members, { employeeId: "all" }), "all");
  assert.equal(salesCalendarSelection("self", members, { employeeId: "other-dept" }), "self");
  assert.equal(salesCalendarSelection("self", members, { employeeId: "teammate", scope: "all" }), "teammate");
  assert.equal(salesCalendarSelection("self", members, { scope: "department" }), "all");
});
