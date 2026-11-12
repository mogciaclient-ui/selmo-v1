import { commonLabels, individualLabels, reportRowsFor, hasValue, valueLabels } from "@/domain/activities/report-display";
import { ReportDefinitionGrid as DefinitionGrid } from "@/components/activities/report-definition-grid";
import { redirect } from "next/navigation";
import { isDepartmentAdmin } from "@/lib/auth/roles";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bot, Clock3 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { requireAuth } from "@/lib/auth/require-auth";
import { activityStatusLabel, activityTypeLabel } from "@/domain/activities/labels";

type Relation = { name: string } | { name: string }[] | null;
type Row = Record<string, unknown> & { id: string; source_activity_id: string | null; customer_id: string; department_id: string; employee_id: string; name: string; customers: Relation; employees: Relation };
type Activity = { id: string; title: string; activity_type: string; starts_at: string; ends_at: string; status: string; result: string | null; employee_id: string; schedule_details: Record<string, unknown> | null; common_report: Record<string, unknown> | null; employees: Relation };
type IndividualReport = { activity_id: string; employee_id: string; report: Record<string, unknown>; employees: Relation };
type Analysis = { activity_id: string; analysis: { summary?: unknown } | null };

const opportunityLabels: Record<string, string> = { product_name: "商材", stage: "商談ステージ", status: "案件状態", priority: "優先順位", expected_amount: "見込金額", expected_close_date: "受注予定日", branch_name: "拠点名", customer_contact: "顧客担当者", prefecture: "都道府県", address: "住所", sales_type: "営業タイプ", sales_process: "営業プロセス", progress_step: "進行工程", activity_location: "活動拠点", activity_contact: "顧客面談者", activity_attendees: "活動同席者", activity_from: "活動開始日", activity_to: "活動終了日", quote_amount: "見積額", order_amount: "受注額", vendor: "販社", proposed_lease_fee: "提案リース料金", lease_start_date: "リース開始日", lease_end_date: "リース終了日", notes: "備考" };

export default async function OpportunityDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ activityId?: string }> }) {
  const [{ id }, query, context] = await Promise.all([params, searchParams, requireAuth()]);
  let request = context.db.from("opportunities").select("*,customers(name),employees(name)").eq("organization_id", context.organizationId).eq("id", id);
  if (context.role === "sales_rep") request = request.eq("employee_id", context.employeeId);
  if (isDepartmentAdmin(context.role)) request = request.in("department_id", context.departmentIds);
  const { data } = await request.maybeSingle();
  if (!data) notFound();
  if (data.merged_into_id) redirect(`/opportunities/${data.merged_into_id}`);
  const row = data as unknown as Row;
  const customer = first(row.customers);
  const employee = first(row.employees);
  let activityRequest = context.db.from("activities").select("id,title,activity_type,starts_at,ends_at,status,result,employee_id,schedule_details,common_report,employees(name)").eq("organization_id", context.organizationId).eq("customer_id", row.customer_id).order("starts_at", { ascending: false }).limit(100);
  if (context.role === "sales_rep") activityRequest = activityRequest.eq("employee_id", context.employeeId);
  if (isDepartmentAdmin(context.role)) activityRequest = activityRequest.in("department_id", context.departmentIds);
  const { data: activityRows } = await activityRequest;
  const activities = ((activityRows ?? []) as unknown as Activity[]).filter((activity) => activity.id === row.source_activity_id || activity.schedule_details?.opportunityId === row.id);
  const selectedActivity = activities.find((activity) => activity.id === query.activityId) ?? activities[0];
  const activityIds = selectedActivity ? [selectedActivity.id] : [];
  const [{ data: reportRows }, { data: analysisRows }] = activityIds.length ? await Promise.all([
    context.db.from("activity_individual_reports").select("activity_id,employee_id,report,employees(name)").eq("organization_id", context.organizationId).in("activity_id", activityIds),
    context.db.from("activity_ai_analyses").select("activity_id,analysis").eq("organization_id", context.organizationId).eq("status", "completed").in("activity_id", activityIds),
  ]) : [{ data: [] }, { data: [] }];
  const reportsByActivity = new Map<string, IndividualReport[]>();
  for (const report of (reportRows ?? []) as unknown as IndividualReport[]) reportsByActivity.set(report.activity_id, [...(reportsByActivity.get(report.activity_id) ?? []), report]);
  const summaries = new Map(((analysisRows ?? []) as Analysis[]).flatMap((analysis) => typeof analysis.analysis?.summary === "string" && analysis.analysis.summary.trim() ? [[analysis.activity_id, analysis.analysis.summary] as const] : []));
  const selectedReports = selectedActivity ? reportsByActivity.get(selectedActivity.id) ?? [] : [];
  const selectedSummary = selectedActivity ? summaries.get(selectedActivity.id) : undefined;
  const activityRowsForDisplay: Array<[string, string]> = selectedActivity ? [
    ["活動日時", `${formatDate(selectedActivity.starts_at)} ${formatTime(selectedActivity.starts_at)}–${formatTime(selectedActivity.ends_at)}`],
    ["活動担当者", first(selectedActivity.employees)?.name ?? "担当者未設定"],
    ["活動種別", activityTypeLabel(selectedActivity.activity_type)],
    ["活動ステータス", String(selectedActivity.common_report?.activityStatus || activityStatusLabel(selectedActivity.status))],
    ...reportRowsFor(selectedActivity.common_report ?? {}, commonLabels),
    ...selectedReports.flatMap((report) => [["個別活動担当者", first(report.employees)?.name ?? "活動担当者"] as [string, string], ...reportRowsFor(report.report, individualLabels)]),
  ] : [];

  return <AppShell active="/opportunities" displayName={context.displayName} department={context.departmentName}><main className="mx-auto max-w-6xl p-4 pb-24 md:p-8">
    <Link href="/opportunities" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-500"><ArrowLeft size={17}/>検討リストへ戻る</Link>
    <section id="activity-detail" className="scroll-mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b p-6"><p className="text-xs font-bold text-amber-800">案件・活動詳細</p><h1 className="mt-1 text-2xl font-bold">{row.name}</h1><p className="mt-2 text-sm text-slate-500">{customer?.name ?? "—"} ・ 営業担当 {employee?.name ?? "—"}</p></header>
      <div className="space-y-7 p-5 md:p-6">
        {selectedSummary && <div className="rounded-xl border border-amber-200 bg-amber-50 p-5"><p className="flex items-center gap-2 text-sm font-bold text-amber-900"><Bot size={18}/>AI分析の要約</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{selectedSummary}</p></div>}
        <div><h2 className="mb-3 text-sm font-bold">案件情報</h2><DefinitionGrid rows={Object.keys(opportunityLabels).map((key) => [opportunityLabels[key], formatOpportunityValue(key, row[key])])}/></div>
        {selectedActivity ? <div><h2 className="mb-3 text-sm font-bold">活動登録内容</h2><DefinitionGrid rows={activityRowsForDisplay}/>{selectedActivity.result && !selectedReports.length && <div className="mt-4 rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">活動結果</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{selectedActivity.result}</p></div>}</div> : <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center"><Clock3 className="mx-auto text-slate-300"/><p className="mt-3 text-sm text-slate-500">活動登録はありません。</p></div>}
      </div>
    </section>
  </main></AppShell>;
}

function first<T>(value: T | T[] | null) { return Array.isArray(value) ? value[0] : value; }
function formatDate(value: string) { return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric" }).format(new Date(value)); }
function formatTime(value: string) { return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)); }
function formatOpportunityValue(key: string, value: unknown) { if (!hasValue(value)) return "—"; if (Array.isArray(value)) return value.join("、") || "—"; if (typeof value === "boolean") return value ? "あり" : "なし"; if (["expected_amount", "quote_amount", "order_amount", "proposed_lease_fee"].includes(key)) return `${Number(value).toLocaleString("ja-JP")}円`; const text = String(value); return valueLabels[key]?.[text] ?? text; }
