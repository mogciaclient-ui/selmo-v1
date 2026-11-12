import assert from "node:assert/strict";
import test from "node:test";
import { defaultScheduleType, validScheduleType, isMissingResult, completionLabel } from "../src/domain/schedules/rules.ts";
import { scheduleSchema } from "../src/domain/schedules/schema.ts";
import { missingReportFields, requiredReportFields } from "../src/domain/schedules/report-requirements.ts";

const base = { departmentId: "22222222-2222-4222-8222-222222222221", customerId: "", date: "2026-11-04", startTime: "10:00", endTime: "11:00", category: "sales", activityType: "visit", customerType: "GUP", product: "UTM", area: "久留米" };
test("カテゴリー別の初期値・選択肢を検証する", () => {
  assert.equal(defaultScheduleType("sales"), "visit");
  assert.equal(defaultScheduleType("accompaniment"), "visit");
  assert.equal(defaultScheduleType("non_sales"), "");
  for (const type of ["documents", "construction", "survey", "follow_up"]) {
    assert.equal(validScheduleType("non_sales", type), true);
    assert.equal(validScheduleType("sales", type), false);
  }
  for (const type of ["telephone", "other", ""]) assert.equal(scheduleSchema.safeParse({ ...base, activityType: type }).success, false);
  assert.equal(scheduleSchema.safeParse(base).success, true);
  assert.equal(scheduleSchema.safeParse({ ...base, category: "non_sales", activityType: "survey" }).success, true);
});
test("一日内の正しい時刻と有効な日付だけを受け付ける", () => {
  for (const patch of [{ endTime: "09:59" }, { endTime: "10:00" }, { startTime: "25:00" }, { date: "2026-02-30" }]) assert.equal(scheduleSchema.safeParse({ ...base, ...patch }).success, false);
});
const activity = { startsAt: "2026-11-04T10:00:00+09:00", activityType: "visit", status: "scheduled", result: null };
test("未入力アラートは日本時間の翌日から。オンラインも対象で中止は除外", () => {
  assert.equal(isMissingResult(activity, new Date("2026-11-04T23:59:59+09:00")), false);
  assert.equal(isMissingResult(activity, new Date("2026-11-05T00:00:00+09:00")), true);
  for (const patch of [{ activityType: "documents" }, { status: "cancelled" }, { status: "canceled" }, { status: "completed" }, { result: "入力済" }]) assert.equal(isMissingResult({ ...activity, ...patch }, new Date("2026-11-05T00:00:00+09:00")), false);
  assert.equal(isMissingResult({ ...activity, activityType: "online" }, new Date("2026-11-05T00:00:00+09:00")), true);
});
test("完了・期限後完了を区別し、記録済みの期限超過状態を維持する", () => {
  assert.equal(completionLabel(activity), "未完了");
  assert.equal(completionLabel({ ...activity, status: "completed", completedAt: "2026-11-04T23:59:59+09:00" }), "完了");
  assert.equal(completionLabel({ ...activity, status: "completed", completedAt: "2026-11-05T00:00:00+09:00" }), "未完了→完了");
  assert.equal(completionLabel({ ...activity, status: "completed", wasOverdue: true }), "未完了→完了");
  assert.equal(completionLabel({ ...activity, status: "completed", wasOverdue: false, completedAt: "2026-11-05T00:00:00+09:00" }), "完了");
});
test("各結果フォームのすべての表示項目をサーバーでも必須にする", () => {
  for (const type of ["IT営業活動", "IT同行活動", "IT営業外活動", "CS営業活動", "CS営業外活動", "アルファサポート"]) {
    for (const status of ["提案中", "受注", "失注", "保留中"]) {
      const form = new FormData();
      const required = requiredReportFields(type, status);
      required.forEach(name => form.set(name, "入力済"));
      assert.deepEqual(missingReportFields(form, type, status), []);
      for (const name of required) {
        form.delete(name);
        assert(missingReportFields(form, type, status).includes(name), `${type}/${status}/${name}`);
        form.set(name, "入力済");
      }
    }
  }
});
