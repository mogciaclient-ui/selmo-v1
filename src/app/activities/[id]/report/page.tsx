import { commonLabels, individualLabels, reportRowsFor } from "@/domain/activities/report-display";
import { ReportDefinitionGrid } from "@/components/activities/report-definition-grid";
import { findProductOptions } from "@/infrastructure/supabase/product-options-repository";
import { scheduleReportDefaults, categoryOptions, scheduleTypeLabels, type ScheduleCategory } from "@/domain/schedules/rules";
import { canActAsSalesRep, isDepartmentAdmin } from "@/lib/auth/roles";
import { ArrowLeft, CalendarDays, Clock3, UserRound } from "lucide-react";

export const maxDuration = 300;
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityAnalysisDialog } from "@/components/activities/activity-analysis-dialog";
import { ActivityReportForm } from "@/components/activities/activity-report-form";
import { AppShell } from "@/components/layout/app-shell";
import { requireAuth } from "@/lib/auth/require-auth";

type CommonReport = { orderGrossProfit?: string; salesProcess?: string; progressStep?: string; salesType?: string; activityStatus?: string; product?: string; nextVisitDate?: string; followUpVisitDate?: string; nextActionDetails?: string };
type Row = { id: string; title: string; starts_at: string; ends_at: string; result: string | null; customer_id: string | null; employee_id: string; activity_type: string; schedule_details?: { progressStep?: string; salesType?: string; salesProcess?: string; category?: string; product?: string; customerType?: string } | null; common_report?: CommonReport | null; customers: { name: string } | { name: string }[] | null };
export default async function ActivityReportPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, context] = await Promise.all([params, requireAuth()]);
  let request = context.db.from("activities").select("id,title,activity_type,starts_at,ends_at,result,customer_id,department_id,employee_id,schedule_details,common_report,customers(name)").eq("organization_id", context.organizationId).eq("id", id);
  if (context.role === "sales_rep") request = request.eq("employee_id", context.employeeId);
  if (isDepartmentAdmin(context.role)) request = request.in("department_id", context.departmentIds);
  const { data } = await request.maybeSingle(); if (!data) notFound();
  const activity = data as unknown as Row; const relation = activity.customers; const customerName = Array.isArray(relation) ? relation[0]?.name : relation?.name;
  const canEdit = canActAsSalesRep(context.role) && activity.employee_id === context.employeeId;
  const [{ data: opportunity }, { data: employeeRows }, { data: individualRows }, { data: analysisRow }, productOptions] = await Promise.all([
    canEdit && activity.customer_id ? context.db.from("opportunities").select("product_name,branch_name").is("merged_into_id", null).eq("organization_id", context.organizationId).eq("customer_id", activity.customer_id).eq("employee_id", activity.employee_id).order("updated_at", { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
    canEdit ? context.db.from("employees").select("id,name").eq("organization_id", context.organizationId).eq("status", "active").order("name") : Promise.resolve({ data: [] }),
    context.db.from("activity_individual_reports").select("employee_id,report,updated_at,employees(name)").eq("organization_id", context.organizationId).eq("activity_id", activity.id).order("updated_at", { ascending: false }),
    context.db.from("activity_ai_analyses").select("status,analysis").eq("organization_id", context.organizationId).eq("activity_id", activity.id).maybeSingle(),
    canEdit ? findProductOptions(context.db, context.organizationId) : Promise.resolve([]),
  ]);
  const members = employeeRows ?? [];
  const activityOwners = members.filter(employee => employee.id === context.employeeId);
  const reports = (individualRows ?? []) as unknown as { employee_id: string; report: { details?: string; visitCount?: string }; updated_at: string; employees: { name: string } | { name: string }[] | null }[];
  const savedReport = reports.find((report) => report.employee_id === activity.employee_id)?.report;
  const isEditing = Boolean(activity.common_report || savedReport || activity.result);
  const category = activity.schedule_details?.category as ScheduleCategory;
  const inherited = scheduleReportDefaults(category, activity.activity_type);
  const aiSummary = analysisRow?.status === "completed" && typeof (analysisRow?.analysis as { summary?: unknown } | null)?.summary === "string" ? String((analysisRow?.analysis as { summary: string }).summary) : "";
  return <AppShell active="/results" displayName={context.displayName} department={context.departmentName}><div className="mx-auto w-full max-w-[1600px] p-4 pb-24 md:p-6 lg:p-8"><Link href={`/?view=week&week=${isoDate(activity.starts_at)}`} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-500"><ArrowLeft size={17} />カレンダーへ戻る</Link><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-8"><p className="text-xs font-bold text-amber-800">活動：{canEdit ? isEditing ? "編集" : "新規登録" : "閲覧専用"}</p><h1 className="mt-1 text-2xl font-bold">{canEdit ? isEditing ? "活動編集" : "活動新規登録" : "活動詳細"}</h1><p className="mt-2 text-sm text-slate-500">{canEdit ? isEditing ? "登録済みの内容を確認・更新できます。" : "項目を入力して、そのまま活動を登録できます。" : "登録された活動結果を確認できます。"}</p><div className="mb-6 mt-6 grid gap-3 sm:grid-cols-3"><Meta icon={UserRound} label="顧客・予定" value={customerName ?? activity.title} /><Meta icon={CalendarDays} label="活動日" value={formatDate(activity.starts_at)} /><Meta icon={Clock3} label="時間" value={`${formatTime(activity.starts_at)}–${formatTime(activity.ends_at)}`} /></div><div className="mb-6 grid gap-3 rounded-xl bg-amber-50 p-4 text-sm sm:grid-cols-3"><p>カテゴリー：<strong>{categoryOptions[category]?.label ?? "営業活動"}</strong></p><p>活動種別：<strong>{scheduleTypeLabels[activity.activity_type] ?? activity.title}</strong></p><p>商材：<strong>{activity.schedule_details?.product || activity.common_report?.product || "未選択"}</strong></p></div>{activity.result && ['visit','online'].includes(activity.activity_type) && (!activity.schedule_details?.customerType || activity.schedule_details.customerType === '新規') && <div className="mb-5"><Link href={`/activities/${activity.id}/checksheet`} className="inline-block rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-bold">{canEdit ? "訪問後チェックシートを入力・確認" : "訪問後チェックシートを確認"}</Link></div>}{analysisRow && <div className="mb-5"><ActivityAnalysisDialog activityId={activity.id} canReanalyze={canEdit}/></div>}{canEdit ? <ActivityReportForm productOptions={productOptions} activityId={activity.id} defaults={{ orderGrossProfit: String(activity.common_report?.orderGrossProfit ?? ""), date: isoDate(activity.starts_at), startTime: formatTime(activity.starts_at), endTime: formatTime(activity.ends_at), product: activity.common_report?.product ?? activity.schedule_details?.product ?? opportunity?.product_name ?? "", ownerId: activity.employee_id, progressStep: activity.common_report?.progressStep ?? activity.schedule_details?.progressStep ?? "", salesType: activity.common_report?.salesType ?? activity.schedule_details?.salesType ?? inherited.salesType, salesProcess: activity.common_report?.salesProcess ?? activity.schedule_details?.salesProcess ?? inherited.salesProcess, activityStatus: activity.common_report?.activityStatus ?? "提案中", nextVisitDate: activity.common_report?.nextVisitDate ?? activity.common_report?.followUpVisitDate ?? "", nextActionDetails: activity.common_report?.nextActionDetails ?? "", details: savedReport?.details ?? "", aiSummary }} members={members} activityOwners={activityOwners}/> : (
    <div className="space-y-5">
      <section>
        <h2 className="mb-3 text-lg font-bold">共通活動</h2>
        <ReportDefinitionGrid rows={reportRowsFor(activity.common_report ?? {}, commonLabels)}/>
      </section>
      {activity.result && !savedReport?.details && <section>
        <h2 className="mb-3 text-lg font-bold">活動結果</h2>
        <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm">{activity.result}</p>
      </section>}
    </div>
  )}{reports.length > 0 && <div className="mt-8 border-t border-slate-200 pt-6"><h2 className="text-lg font-bold">登録済みの個別活動報告</h2><div className="mt-3 space-y-3">{reports.map((report) => <article key={report.employee_id} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex justify-between text-xs text-slate-500"><span className="font-bold text-slate-700">{Array.isArray(report.employees) ? report.employees[0]?.name : report.employees?.name}</span><span>{formatDate(report.updated_at)}</span></div>{canEdit ? <p className="mt-2 whitespace-pre-wrap text-sm">{report.report.details || "活動詳細の記載なし"}</p> : <div className="mt-2"><ReportDefinitionGrid rows={reportRowsFor(report.report, individualLabels)}/></div>}</article>)}</div></div>}</section></div></AppShell>;
}
function Meta({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-4"><Icon size={18} className="text-amber-700" /><p className="mt-2 text-xs text-slate-400">{label}</p><p className="mt-1 text-sm font-bold">{value}</p></div>; }
function formatDate(value: string) { return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric" }).format(new Date(value)); }
function formatTime(value: string) { return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)); }
function isoDate(value: string) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)); }
