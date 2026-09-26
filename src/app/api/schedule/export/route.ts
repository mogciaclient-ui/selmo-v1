import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { activityStatusLabel, activityTypeLabel } from "@/domain/activities/labels";

type Row = { title: string; activity_type: string; starts_at: string; ends_at: string; status: string; result: string | null; customers: { name: string } | { name: string }[] | null };

export async function GET(request: NextRequest) {
  const context = await getCurrentUser();
  if (!context) return Response.json({ message: "ログインし直してください。" }, { status: 401 });
  const start = request.nextUrl.searchParams.get("start"); const end = request.nextUrl.searchParams.get("end");
  const departmentId = request.nextUrl.searchParams.get("departmentId"); const employeeId = request.nextUrl.searchParams.get("employeeId");
  if (!start?.match(/^\d{4}-\d{2}-\d{2}$/) || !end?.match(/^\d{4}-\d{2}-\d{2}$/)) return Response.json({ message: "日付範囲が正しくありません。" }, { status: 400 });
  const startDate = new Date(`${start}T00:00:00+09:00`); const endDate = new Date(`${end}T23:59:59+09:00`); const limit = new Date(startDate); limit.setMonth(limit.getMonth() + 3); limit.setDate(limit.getDate() + 1);
  if (endDate < startDate || endDate >= limit) return Response.json({ message: "日付範囲は最大3か月までです。" }, { status: 400 });
  let query = context.db.from("activities").select("title,activity_type,starts_at,ends_at,status,result,department_id,customers(name)").eq("organization_id", context.organizationId).gte("starts_at", startDate.toISOString()).lte("starts_at", endDate.toISOString()).order("starts_at");
  if (context.role === "sales_rep") query = query.eq("employee_id", context.employeeId);
  if (context.role === "department_admin") query = query.in("department_id", context.departmentIds);
  if (departmentId && (context.role === "organization_admin" || context.departmentIds.includes(departmentId))) query = query.eq("department_id", departmentId);
  if (employeeId && (context.role !== "sales_rep" || employeeId === context.employeeId)) query = query.eq("employee_id", employeeId);
  const { data, error } = await query; if (error) return Response.json({ message: "スケジュールを取得できませんでした。" }, { status: 500 });
  const rows = (data ?? []) as unknown as Row[];
  const csv = [["日付", "開始", "終了", "顧客名", "予定名", "活動種別", "ステータス", "活動結果"], ...rows.map((row) => { const relation = row.customers; const customer = Array.isArray(relation) ? relation[0]?.name : relation?.name; return [date(row.starts_at), time(row.starts_at), time(row.ends_at), customer ?? "", row.title, activityTypeLabel(row.activity_type), activityStatusLabel(row.status), row.result ?? ""]; })].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
  return new Response(`\uFEFF${csv}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="schedule_${start}_${end}.csv"` } });
}
function escapeCsv(value: string) { return `"${value.replaceAll('"', '""')}"`; }
function date(value: string) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)); }
function time(value: string) { return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)); }
