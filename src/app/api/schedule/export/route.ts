import { NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createSupabaseDashboardRepository } from "@/infrastructure/supabase/dashboard-repository";
import { completionLabel } from "@/domain/schedules/rules";
export async function GET(request: NextRequest) {
  const context = await getCurrentUser();
  if (!context) return Response.json({ message: "ログインし直してください。" }, { status: 401 });
  const params = request.nextUrl.searchParams;
  const parsed = z.object({ start: z.iso.date(), end: z.iso.date(), employeeIds: z.array(z.uuid()), departmentId: z.union([z.uuid(), z.literal("")]), employeeId: z.union([z.uuid(), z.literal("")]) }).safeParse({ start: params.get("start"), end: params.get("end"), employeeIds: params.getAll("employeeIds"), departmentId: params.get("departmentId") ?? "", employeeId: params.get("employeeId") ?? "" });
  if (!parsed.success) return Response.json({ message: "日付または表示対象が正しくありません。" }, { status: 400 });
  const { start, end, employeeIds, employeeId, departmentId } = parsed.data;
  const startDate = new Date(`${start}T00:00:00+09:00`), endDate = new Date(`${end}T00:00:00+09:00`), limit = new Date(startDate);
  limit.setUTCMonth(limit.getUTCMonth() + 3);
  if (endDate < startDate || endDate > limit) return Response.json({ message: "日付範囲は最大3か月までです。" }, { status: 400 });
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  try {
    const all = await createSupabaseDashboardRepository(context.db, context, { teamCalendar: true }).findActivitiesBetween(startDate.toISOString(), endDate.toISOString());
    const rows = all.filter(row => (!departmentId || row.departmentId === departmentId) && (!employeeId || row.employeeId === employeeId) && (params.get("selectionProvided") !== "1" || employeeIds.includes(row.employeeId)));
    const csv = [["日付", "開始", "終了", "顧客名", "エリア", "顧客種別", "状態"], ...rows.map(row => [date(row.startsAt), time(row.startsAt), time(row.endsAt), row.customerName ?? "", String(row.scheduleDetails?.area ?? row.scheduleDetails?.location ?? ""), String(row.scheduleDetails?.customerType ?? ""), completionLabel(row)])].map(row => row.map(cell => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    return new Response(`\uFEFF${csv}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="schedule_${start}_${end}.csv"` } });
  } catch (error) { console.error("[schedule-export] failed", error); return Response.json({ message: "CSVを取得できませんでした。" }, { status: 500 }); }
}
function date(value: string) { return new Date(value).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }); }
function time(value: string) { return new Date(value).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" }); }
