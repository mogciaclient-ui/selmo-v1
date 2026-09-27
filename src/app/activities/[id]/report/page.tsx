import { ArrowLeft, CalendarDays, Clock3, UserRound } from "lucide-react";

export const maxDuration = 300;
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityReportForm } from "@/components/activities/activity-report-form";
import { AppShell } from "@/components/layout/app-shell";
import { requireAuth } from "@/lib/auth/require-auth";

type Row = { id: string; title: string; starts_at: string; ends_at: string; result: string | null; customer_id: string | null; employee_id: string; schedule_details?: { progressStep?: string } | null; common_report?: { progressStep?: string } | null; customers: { name: string } | { name: string }[] | null };
export default async function ActivityReportPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, context] = await Promise.all([params, requireAuth()]);
  let request = context.db.from("activities").select("id,title,starts_at,ends_at,result,customer_id,department_id,employee_id,schedule_details,common_report,customers(name)").eq("organization_id", context.organizationId).eq("id", id);
  if (context.role === "sales_rep") request = request.eq("employee_id", context.employeeId);
  if (context.role === "department_admin") request = request.in("department_id", context.departmentIds);
  const { data } = await request.maybeSingle(); if (!data) notFound();
  const activity = data as unknown as Row; const relation = activity.customers; const customerName = Array.isArray(relation) ? relation[0]?.name : relation?.name;
  const [{ data: opportunity }, { data: employeeRows }, { data: individualRows }] = await Promise.all([
    activity.customer_id ? context.db.from("opportunities").select("product_name,branch_name").eq("organization_id", context.organizationId).eq("customer_id", activity.customer_id).order("updated_at", { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
    context.db.from("employees").select("id,name").eq("organization_id", context.organizationId).eq("status", "active").order("name"),
    context.db.from("activity_individual_reports").select("employee_id,report,updated_at,employees(name)").eq("organization_id", context.organizationId).eq("activity_id", activity.id).order("updated_at", { ascending: false }),
  ]);
  const members = (employeeRows ?? []) as { id: string; name: string }[];
  const reports = (individualRows ?? []) as unknown as { employee_id: string; report: { details?: string; visitCount?: string }; updated_at: string; employees: { name: string } | { name: string }[] | null }[];
  return <AppShell active="/results" displayName={context.displayName} department={context.departmentName}><div className="mx-auto w-full max-w-[1600px] p-4 pb-24 md:p-6 lg:p-8"><Link href="/" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-500"><ArrowLeft size={17} />カレンダーへ戻る</Link><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-8"><p className="text-xs font-bold text-amber-800">活動：新規登録</p><h1 className="mt-1 text-2xl font-bold">活動新規登録</h1><p className="mt-2 text-sm text-slate-500">項目を入力して、そのまま活動を登録できます。</p><div className="mb-6 mt-6 grid gap-3 sm:grid-cols-3"><Meta icon={UserRound} label="顧客・予定" value={customerName ?? activity.title} /><Meta icon={CalendarDays} label="活動日" value={formatDate(activity.starts_at)} /><Meta icon={Clock3} label="時間" value={`${formatTime(activity.starts_at)}–${formatTime(activity.ends_at)}`} /></div><ActivityReportForm activityId={activity.id} defaults={{ date: isoDate(activity.starts_at), startTime: formatTime(activity.starts_at), endTime: formatTime(activity.ends_at), product: opportunity?.product_name ?? activity.title, ownerId: context.employeeId, progressStep: activity.common_report?.progressStep ?? activity.schedule_details?.progressStep ?? "" }} members={members}/>{reports.length > 0 && <div className="mt-8 border-t border-slate-200 pt-6"><h2 className="text-lg font-bold">登録済みの個別活動報告</h2><div className="mt-3 space-y-3">{reports.map((report) => <article key={report.employee_id} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex justify-between text-xs text-slate-500"><span className="font-bold text-slate-700">{Array.isArray(report.employees) ? report.employees[0]?.name : report.employees?.name}</span><span>{formatDate(report.updated_at)}</span></div><p className="mt-2 whitespace-pre-wrap text-sm">{report.report.details || "活動詳細の記載なし"}</p></article>)}</div></div>}</section></div></AppShell>;
}
function Meta({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-4"><Icon size={18} className="text-amber-700" /><p className="mt-2 text-xs text-slate-400">{label}</p><p className="mt-1 text-sm font-bold">{value}</p></div>; }
function formatDate(value: string) { return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric" }).format(new Date(value)); }
function formatTime(value: string) { return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)); }
function isoDate(value: string) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)); }
