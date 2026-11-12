import { z } from "zod";
import { validScheduleType } from "./rules.ts";
export const scheduleSchema = z.object({
  departmentId: z.uuid(), customerId: z.union([z.uuid(), z.literal("")]),
  date: z.iso.date(), startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  category: z.enum(["sales", "non_sales", "accompaniment"]), activityType: z.string(),
  customerType: z.enum(["", "新規", "GUP", "他商材"]), product: z.string().trim().max(200), area: z.string().trim().max(200),
  opportunityId: z.union([z.uuid(), z.literal("")]).default(""), pickupId: z.union([z.uuid(), z.literal("")]).default(""),
}).superRefine((input, ctx) => {
  if (!validScheduleType(input.category, input.activityType)) ctx.addIssue({ code: "custom", path: ["activityType"], message: "カテゴリーに対応する活動種別を選んでください。" });
  if (input.endTime <= input.startTime) ctx.addIssue({ code: "custom", path: ["endTime"], message: "終了時刻は開始時刻より後にしてください。" });
});
