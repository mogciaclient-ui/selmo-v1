import test from "node:test";
import assert from "node:assert/strict";
import { requiredReportFields } from "../src/domain/schedules/report-requirements.ts";
import { scheduleReportDefaults } from "../src/domain/schedules/rules.ts";
test("削除した面談者・同席者・面談者区分は結果入力の必須項目にしない", () => {
  for (const type of ["IT営業活動", "IT同行活動", "IT営業外活動", "CS営業活動", "CS営業外活動", "アルファサポート"]) {
    for (const status of ["提案中", "受注", "失注"]) {
      const fields = requiredReportFields(type, status);
      for (const field of ["customerContact", "attendeeEmployeeIds", "contactRole", "holdReason"]) assert(!fields.includes(field));
    }
  }
});
test("スケジュールのカテゴリー・活動種別から営業タイプとプロセスを引き継ぐ", () => {
  assert.deepEqual(scheduleReportDefaults("sales", "visit"), { salesType: "IT営業活動", salesProcess: "IT営業活動" });
  assert.deepEqual(scheduleReportDefaults("accompaniment", "online"), { salesType: "IT同行活動", salesProcess: "IT同行活動" });
  assert.deepEqual(scheduleReportDefaults("non_sales", "construction"), { salesType: "IT営業外活動", salesProcess: "工事立ち会い" });
});
