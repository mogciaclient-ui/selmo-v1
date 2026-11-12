export const categoryOptions = {
  sales: { label: "営業活動", types: ["visit", "online"] },
  non_sales: { label: "営業外活動", types: ["documents", "construction", "survey", "follow_up"] },
  accompaniment: { label: "同行活動", types: ["visit", "online"] },
} as const;
export type ScheduleCategory = keyof typeof categoryOptions;
export const scheduleTypeLabels: Record<string, string> = {
  visit: "訪問", online: "オンライン", documents: "書類不備", construction: "工事立ち会い", survey: "下見", follow_up: "フォロー",
};
export const customerTypes = ["新規", "GUP", "他商材"] as const;
export function validScheduleType(category: string, type: string) {
  return category in categoryOptions && (categoryOptions[category as ScheduleCategory].types as readonly string[]).includes(type);
}
export function defaultScheduleType(category: ScheduleCategory) { return category === "non_sales" ? "" : "visit"; }
export function tokyoDate(value: string | Date) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)); }
export function tokyoDayStart(value = new Date()) { return new Date(`${tokyoDate(value)}T00:00:00+09:00`).toISOString(); }
export type CompletionActivity = { activityType: string; startsAt: string; status: string; result: string | null; completedAt?: string | null; wasOverdue?: boolean };
export function isMissingResult(activity: CompletionActivity, now = new Date()) {
  return ["visit", "online"].includes(activity.activityType) && !["cancelled", "canceled", "completed"].includes(activity.status) && !activity.result?.trim() && tokyoDate(activity.startsAt) < tokyoDate(now);
}
export function completionLabel(activity: CompletionActivity) {
  if (activity.status === "cancelled" || activity.status === "canceled") return "中止";
  if (activity.status !== "completed" && !activity.result?.trim()) return "未完了";
  const late = activity.wasOverdue ?? Boolean(activity.completedAt && tokyoDate(activity.completedAt) > tokyoDate(activity.startsAt));
  return late ? "未完了→完了" : "完了";
}

export function scheduleReportDefaults(category: string, activityType: string) {
  const salesType = category === "non_sales" ? "IT営業外活動" : category === "accompaniment" ? "IT同行活動" : "IT営業活動";
  return { salesType, salesProcess: category === "non_sales" ? scheduleTypeLabels[activityType] ?? "" : salesType };
}
