import { ChevronLeft, ChevronRight } from "lucide-react";
import holidayJp from "@holiday-jp/holiday_jp";
import Link from "next/link";
import { getDashboardSnapshot } from "@/application/dashboard/get-dashboard-snapshot";
import { createMonthGrid, toTokyoDateKey } from "@/domain/calendar/month-grid";
import { createSupabaseDashboardRepository } from "@/infrastructure/supabase/dashboard-repository";
import { requireAuth } from "@/lib/auth/require-auth";
import { AddScheduleDialog } from "@/components/activities/add-schedule-dialog";
import { ActivityDetailsDialog } from "@/components/activities/activity-details-dialog";
import { DayActivityList } from "@/components/activities/day-activity-list";
import { AppShell } from "@/components/layout/app-shell";
import { CellCreateMenu } from "@/components/activities/cell-create-menu";
import { CalendarCsvExport } from "@/components/activities/calendar-csv-export";
import { MonthlyPickupPanel, type MonthlyPickupItem } from "@/components/dashboard/monthly-pickup-panel";
import { InformationTabs } from "@/components/dashboard/information-tabs";
import { activityStatusLabel } from "@/domain/activities/labels";
import type { CustomerSearchResult } from "@/domain/customers/types";

const monthWeekdays = ["月", "火", "水", "木", "金", "土", "日"];
const weekWeekdays = ["日", "月", "火", "水", "木", "金", "土"];
type MemberRow = { employee_id: string; employees: { name: string } | { name: string }[] | null; app_user_departments: { department_id: string }[] };
type OpportunityRow = { id: string; source_activity_id: string | null; customer_id: string; name: string; branch_name: string | null; sales_process: string | null; customer_type: string; status: string; confidence: string; expected_amount: number; order_amount: number; expected_close_date: string | null; customers: { name: string } | { name: string }[] | null; employees: { name: string } | { name: string }[] | null };
type RecentActivityRow = { id: string; customer_id: string | null; title: string; starts_at: string; status: string; employee_id: string; common_report?: { product?: string; salesProcess?: string; progressStep?: string; activityStatus?: string; confidence?: string; registrationType?: string } | null; schedule_details?: { opportunityId?: string; opportunityName?: string; progressStep?: string } | null; customers: { name: string } | { name: string }[] | null };
type OrderActivityRow = { id: string; customer_id: string | null; employee_id: string; common_report: { activityStatus?: string; confidence?: string; salesProcess?: string; orderDate?: string; orderAmount?: string | number; products?: Array<{ name?: string; amount?: string | number; quantity?: string | number; main?: boolean }> } | null; schedule_details: { opportunityId?: string; opportunityName?: string } | null; customers: { name: string } | { name: string }[] | null; employees: { name: string } | { name: string }[] | null };
type PickupRow = { id: string; department_id: string; employee_id: string; customer_id: string; reason: string | null; departments: { name: string } | { name: string }[] | null; employees: { name: string } | { name: string }[] | null; customers: { name: string; external_id: string | null; phone: string | null; address: string | null; department_id: string } | { name: string; external_id: string | null; phone: string | null; address: string | null; department_id: string }[] | null };
type PickupActivityRow = { customer_id: string | null; employee_id: string; starts_at: string; status: string; common_report: Record<string, unknown> | null };
export default async function HomePage({ searchParams }: { searchParams: Promise<{ month?: string; week?: string; view?: string; scope?: string; departmentId?: string; employeeId?: string; infoTab?: string; infoView?: string; infoType?: string; pickupYear?: string; pickupMonth?: string; pickupDepartmentId?: string; pickupEmployeeId?: string; orderType?: string; confidence?: string; orderYear?: string; orderMonth?: string; orderDepartmentId?: string; orderEmployeeId?: string; customerId?: string; opportunityId?: string }> }) {
  const query = await searchParams;
  const requestedMonth = query.month;
  const context = await requireAuth();
  let departmentQuery = context.db.from("departments").select("id,name").eq("organization_id", context.organizationId).order("name");
  if (context.role !== "organization_admin") departmentQuery = departmentQuery.in("id", context.departmentIds);
  const [{ data: departmentRows }, { data: memberRows }] = await Promise.all([departmentQuery, context.db.from("app_users").select("employee_id,employees(name),app_user_departments(department_id)").eq("organization_id", context.organizationId).eq("status", "active")]);
  const displayName = context.displayName;
  const departments = (departmentRows ?? []) as { id: string; name: string }[];
  let defaultScheduleCustomer: CustomerSearchResult | undefined;
  let defaultScheduleOpportunity: { id: string; name: string; salesType: string | null; salesProcess: string | null; progressStep: string | null } | undefined;
  if (query.customerId) {
    let customerLookup = context.db.from("customers").select("id,name,phone,address,department_id").eq("organization_id", context.organizationId).eq("id", query.customerId);
    if (context.role !== "organization_admin") customerLookup = customerLookup.in("department_id", context.departmentIds);
    const { data: customerRow } = await customerLookup.maybeSingle();
    if (customerRow?.department_id) {
      defaultScheduleCustomer = { id: customerRow.id, name: customerRow.name, phone: customerRow.phone, address: customerRow.address, departmentId: customerRow.department_id };
      if (query.opportunityId) {
        let opportunityLookup = context.db.from("opportunities").select("id,name,sales_type,sales_process,progress_step").eq("organization_id", context.organizationId).eq("customer_id", customerRow.id).eq("id", query.opportunityId);
        if (context.role === "sales_rep") opportunityLookup = opportunityLookup.eq("employee_id", context.employeeId);
        if (context.role === "department_admin") opportunityLookup = opportunityLookup.in("department_id", context.departmentIds);
        const { data: opportunityRow } = await opportunityLookup.maybeSingle();
        if (opportunityRow) defaultScheduleOpportunity = { id: opportunityRow.id, name: opportunityRow.name, salesType: opportunityRow.sales_type, salesProcess: opportunityRow.sales_process, progressStep: opportunityRow.progress_step };
      }
    }
  }
  const department = context.departmentName;
  const members = ((memberRows ?? []) as unknown as MemberRow[]).filter((member) => context.role === "organization_admin" || (context.role === "sales_rep" ? member.employee_id === context.employeeId : member.app_user_departments.some((item) => context.departmentIds.includes(item.department_id)))).map((member) => ({ id: member.employee_id, name: Array.isArray(member.employees) ? member.employees[0]?.name ?? "名称未設定" : member.employees?.name ?? "名称未設定", departmentIds: member.app_user_departments.map((item) => item.department_id) }));
  const selectedDepartmentId = query.departmentId && departments.some((item) => item.id === query.departmentId) ? query.departmentId : "";
  const selectedEmployeeId = query.employeeId && members.some((item) => item.id === query.employeeId)
    ? query.employeeId
    : context.role === "sales_rep" ? context.employeeId : "";
  const todayKey = toTokyoDateKey(new Date());
  const [todayYear, todayMonth] = todayKey.split("-").map(Number);
  const match = requestedMonth?.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  const year = match ? Number(match[1]) : todayYear;
  const month = match ? Number(match[2]) : todayMonth;
  const orderYear = /^20(?:0[9]|[12]\d|3[0-6])$/.test(query.orderYear ?? "") ? Number(query.orderYear) : year;
  const orderMonth = /^(?:0?[1-9]|1[0-2])$/.test(query.orderMonth ?? "") ? Number(query.orderMonth) : month;
  const selectedOrderDepartmentId = query.orderDepartmentId && departments.some((item) => item.id === query.orderDepartmentId) ? query.orderDepartmentId : "";
  const orderMembers = members.filter((member) => !selectedOrderDepartmentId || member.departmentIds.includes(selectedOrderDepartmentId));
  const selectedOrderEmployeeId = query.orderEmployeeId && orderMembers.some((member) => member.id === query.orderEmployeeId)
    ? query.orderEmployeeId
    : context.role === "sales_rep" ? context.employeeId : "";
  const isWeekView = query.view !== "month";
  const previousMonth = shiftMonth(year, month, -1);
  const nextMonth = shiftMonth(year, month, 1);
  const weekAnchor = /^\d{4}-\d{2}-\d{2}$/.test(query.week ?? "") ? query.week! : (year === todayYear && month === todayMonth ? todayKey : `${year}-${String(month).padStart(2, "0")}-01`);
  const calendarDays = isWeekView ? createWeekGrid(weekAnchor, todayKey) : createMonthGrid(year, month - 1, todayKey);
  const lastCell = calendarDays.at(-1)!;
  const calendarEndDate = new Date(`${lastCell.dateKey}T00:00:00+09:00`);
  calendarEndDate.setUTCDate(calendarEndDate.getUTCDate() + 1);
  const snapshotPromise = getDashboardSnapshot(createSupabaseDashboardRepository(context.db, context), {
    calendarStart: new Date(`${calendarDays[0].dateKey}T00:00:00+09:00`).toISOString(),
    calendarEnd: calendarEndDate.toISOString(),
    todayStart: new Date(`${todayKey}T00:00:00+09:00`).toISOString(),
    todayEnd: new Date(`${todayKey}T24:00:00+09:00`).toISOString(),
  });
  const memberNames = new Map(((memberRows ?? []) as unknown as MemberRow[]).map((member) => [member.employee_id, Array.isArray(member.employees) ? member.employees[0]?.name ?? "—" : member.employees?.name ?? "—"]));
  const infoStart = new Date(`${todayKey}T00:00:00+09:00`);
  infoStart.setUTCDate(infoStart.getUTCDate() - 14);
  let recentQuery = context.db.from("activities").select("id,customer_id,title,starts_at,status,employee_id,common_report,schedule_details,customers(name)").eq("organization_id", context.organizationId).gte("starts_at", infoStart.toISOString()).order("starts_at", { ascending: false }).limit(500);
  if (context.role !== "organization_admin") recentQuery = recentQuery.in("department_id", context.departmentIds);
  if (selectedDepartmentId) recentQuery = recentQuery.eq("department_id", selectedDepartmentId);
  let opportunityQuery = context.db.from("opportunities").select("id,source_activity_id,customer_id,name,branch_name,sales_process,customer_type,status,confidence,expected_amount,order_amount,expected_close_date,employee_id,department_id,customers(name),employees(name)").eq("organization_id", context.organizationId).order("updated_at", { ascending: false }).limit(5000);
  if (context.role === "sales_rep") opportunityQuery = opportunityQuery.eq("employee_id", context.employeeId);
  if (context.role === "department_admin") opportunityQuery = opportunityQuery.in("department_id", context.departmentIds);
  let orderActivityQuery = context.db.from("activities").select("id,customer_id,employee_id,department_id,common_report,schedule_details,customers(name),employees(name)").eq("organization_id", context.organizationId).not("common_report", "is", null).limit(5000);
  if (context.role === "sales_rep") orderActivityQuery = orderActivityQuery.eq("employee_id", context.employeeId);
  if (context.role === "department_admin") orderActivityQuery = orderActivityQuery.in("department_id", context.departmentIds);
  if (selectedOrderDepartmentId) orderActivityQuery = orderActivityQuery.eq("department_id", selectedOrderDepartmentId);
  if (selectedOrderEmployeeId) orderActivityQuery = orderActivityQuery.eq("employee_id", selectedOrderEmployeeId);
  const infoTab = query.infoTab === "pickups" ? "pickups" : "recent";
  const pickupYear = /^20(?:0[9]|[12]\d|3[0-6])$/.test(query.pickupYear ?? "") ? Number(query.pickupYear) : year;
  const pickupMonthNumber = /^(?:0?[1-9]|1[0-2])$/.test(query.pickupMonth ?? "") ? Number(query.pickupMonth) : month;
  const selectedPickupDepartmentId = query.pickupDepartmentId && departments.some((item) => item.id === query.pickupDepartmentId) ? query.pickupDepartmentId : "";
  const pickupMembers = members.filter((member) => !selectedPickupDepartmentId || member.departmentIds.includes(selectedPickupDepartmentId));
  const selectedPickupEmployeeId = query.pickupEmployeeId && pickupMembers.some((member) => member.id === query.pickupEmployeeId) ? query.pickupEmployeeId : "";
  const pickupMonth = `${pickupYear}-${String(pickupMonthNumber).padStart(2, "0")}`;
  const pickupMonthStart = `${pickupMonth}-01`;
  const pickupMonthEnd = `${shiftMonth(pickupYear, pickupMonthNumber, 1)}-01`;
  let pickupQuery = context.db.from("monthly_customer_pickups").select("id,department_id,employee_id,customer_id,reason,departments(name),employees(name),customers(name,external_id,phone,address,department_id)").eq("organization_id", context.organizationId).eq("target_month", pickupMonthStart).order("created_at");
  if (context.role === "sales_rep") pickupQuery = pickupQuery.eq("employee_id", context.employeeId);
  if (context.role === "department_admin") pickupQuery = pickupQuery.in("department_id", context.departmentIds);
  if (selectedPickupDepartmentId) pickupQuery = pickupQuery.eq("department_id", selectedPickupDepartmentId);
  if (selectedPickupEmployeeId) pickupQuery = pickupQuery.eq("employee_id", selectedPickupEmployeeId);
  const pickupCustomersPromise = context.role === "sales_rep"
    ? context.db.from("customers").select("id,name").eq("organization_id", context.organizationId).in("department_id", context.departmentIds).order("name").limit(5000)
    : Promise.resolve({ data: [] as { id: string; name: string }[] });
  const [snapshot, recentResult, { data: opportunityRows }, { data: orderActivityRows }, { data: pickupRows }, { data: pickupCustomerRows }] = await Promise.all([
    snapshotPromise,
    recentQuery,
    opportunityQuery,
    orderActivityQuery,
    pickupQuery,
    pickupCustomersPromise,
  ]);
  const filteredActivities = snapshot.activities.filter((activity) => (!selectedDepartmentId || activity.departmentId === selectedDepartmentId) && (!selectedEmployeeId || activity.employeeId === selectedEmployeeId));
  const activitiesByDay = Object.groupBy(filteredActivities, (activity) => toTokyoDateKey(activity.startsAt));
  let { data: recentRows, error: recentError } = recentResult;
  if (recentError?.code === "42703") {
    let fallback = context.db.from("activities").select("id,customer_id,title,starts_at,status,employee_id,customers(name)").eq("organization_id", context.organizationId).gte("starts_at", infoStart.toISOString()).order("starts_at", { ascending: false }).limit(500);
    if (context.role !== "organization_admin") fallback = fallback.in("department_id", context.departmentIds);
    if (selectedDepartmentId) fallback = fallback.eq("department_id", selectedDepartmentId);
    const legacy = await fallback;
    recentRows = legacy.data as typeof recentRows;
    recentError = legacy.error;
  }
  if (recentError) throw new Error("新着活動を取得できませんでした。", { cause: recentError });
  const recentActivities = (recentRows ?? []) as unknown as RecentActivityRow[];
  const opportunities = (opportunityRows ?? []) as unknown as OpportunityRow[];
  const opportunitiesByCustomer = new Map<string, OpportunityRow[]>();
  for (const row of opportunities) opportunitiesByCustomer.set(row.customer_id, [...(opportunitiesByCustomer.get(row.customer_id) ?? []), row]);
  const visibleRecent = recentActivities.filter((row) => (query.infoView === "scheduled" ? row.status === "scheduled" : row.status !== "scheduled") && (!query.infoType || query.infoType === "all" || opportunitiesByCustomer.get(row.customer_id ?? "")?.some((item) => item.customer_type === query.infoType)));
  const orderMonthKey = `${orderYear}-${String(orderMonth).padStart(2, "0")}`;
  const orderActual = ((orderActivityRows ?? []) as unknown as OrderActivityRow[]).flatMap((activity) => {
    const report = activity.common_report;
    const opportunityId = activity.schedule_details?.opportunityId;
    const opportunity = opportunities.find((row) => row.id === opportunityId || row.source_activity_id === activity.id);
    if (report?.activityStatus !== "受注" || !report.orderDate?.startsWith(`${orderMonthKey}-`)) return [];
    if (query.orderType && query.orderType !== "all" && opportunity?.customer_type !== query.orderType) return [];
    if (query.confidence && normalizeConfidence(report.confidence) !== query.confidence) return [];
    return [{ activity, report, opportunity, amount: reportOrderAmount(report) }];
  }).sort((left, right) => String(right.report.orderDate).localeCompare(String(left.report.orderDate)));
  const actualTotal = orderActual.reduce((sum, row) => sum + row.amount, 0);
  const projectedTotal = 0;
  const pickups = (pickupRows ?? []) as unknown as PickupRow[];
  const pickupCustomerIds = [...new Set(pickups.map((item) => item.customer_id))];
  let pickupActivities: PickupActivityRow[] = [];
  if (pickupCustomerIds.length) {
    let pickupActivityQuery = context.db.from("activities").select("customer_id,employee_id,starts_at,status,common_report").eq("organization_id", context.organizationId).in("customer_id", pickupCustomerIds).gte("starts_at", `${pickupMonthStart}T00:00:00+09:00`).lt("starts_at", `${pickupMonthEnd}T00:00:00+09:00`);
    if (context.role === "sales_rep") pickupActivityQuery = pickupActivityQuery.eq("employee_id", context.employeeId);
    if (context.role === "department_admin") pickupActivityQuery = pickupActivityQuery.in("department_id", context.departmentIds);
    const { data } = await pickupActivityQuery;
    pickupActivities = (data ?? []) as PickupActivityRow[];
  }
  const pickupItems: MonthlyPickupItem[] = pickups.map((pickup) => {
    const customer = relation(pickup.customers); const employee = relation(pickup.employees); const pickupDepartment = relation(pickup.departments);
    const activities = pickupActivities.filter((activity) => activity.customer_id === pickup.customer_id && activity.employee_id === pickup.employee_id);
    const plannedDates = activities.filter((activity) => activity.status === "scheduled").map((activity) => formatShortDate(activity.starts_at));
    const visitedDates = activities.filter((activity) => activity.status !== "scheduled").map((activity) => formatShortDate(activity.starts_at));
    return { id: pickup.id, departmentId: customer?.department_id ?? pickup.department_id, departmentName: pickupDepartment?.name ?? "—", employeeName: employee?.name ?? memberNames.get(pickup.employee_id) ?? "—", customerId: pickup.customer_id, customerExternalId: customer?.external_id, customerName: customer?.name ?? "—", customerPhone: customer?.phone ?? null, customerAddress: customer?.address ?? null, reason: pickup.reason, plannedDates: [...new Set(plannedDates)], visitedDates: [...new Set(visitedDates)], hasReport: activities.some((activity) => activity.common_report != null) };
  });
  const pickupCustomers = pickupCustomerRows ?? [];

  return (
    <AppShell active="/" displayName={displayName} department={department}>
      <main>
        <header className="flex h-20 items-center border-b border-slate-200 bg-white px-5 md:px-8">
          <div><p className="text-sm text-slate-400">営業ホーム</p><h1 className="mt-0.5 text-xl font-bold tracking-tight">おはようございます、{displayName}さん</h1></div>
          {context.role === "sales_rep" && <AddScheduleDialog departments={departments} defaultDate={todayKey} trigger="hidden" defaultCustomer={defaultScheduleCustomer} defaultOpportunity={defaultScheduleOpportunity} openOnMount={Boolean(defaultScheduleCustomer && defaultScheduleOpportunity)} />}
        </header>

        <div className="mx-auto max-w-[1600px] p-4 pb-24 md:p-6 lg:p-8">
          <div>
            <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-5 md:px-6">
                <div className="flex items-center gap-3"><Link aria-label={isWeekView ? "前週" : "前月"} href={isWeekView ? weekHref(shiftDate(calendarDays[0].dateKey, -7), query) : calendarHref(previousMonth, query)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><ChevronLeft size={18} /></Link>{!isWeekView && <h2 className="min-w-48 text-center text-lg font-bold">{year}年 {month}月</h2>}<Link aria-label={isWeekView ? "翌週" : "翌月"} href={isWeekView ? weekHref(shiftDate(calendarDays[0].dateKey, 7), query) : calendarHref(nextMonth, query)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><ChevronRight size={18} /></Link>{!isWeekView && <Link href={calendarHref(`${todayYear}-${String(todayMonth).padStart(2, "0")}`, query)} className="ml-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">今月</Link>}</div>
                <div className="flex rounded-lg bg-slate-100 p-1 text-xs font-semibold"><Link href={calendarHref(`${year}-${String(month).padStart(2, "0")}`, query)} className={`rounded-md px-3 py-1.5 ${!isWeekView ? "bg-white text-[#8a6500] shadow-sm" : "text-slate-500"}`}>月</Link><Link href={weekHref(weekAnchor, query)} className={`rounded-md px-3 py-1.5 ${isWeekView ? "bg-white text-[#8a6500] shadow-sm" : "text-slate-500"}`}>週</Link></div>
              </div>
              {context.role !== "sales_rep" && <form className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-slate-200 bg-amber-50/50 px-5 py-3 md:px-6">
                <input type="hidden" name="month" value={`${year}-${String(month).padStart(2, "0")}`} />
                {isWeekView && <><input type="hidden" name="view" value="week"/><input type="hidden" name="week" value={weekAnchor}/></>}
                <fieldset className="flex items-center gap-3 text-sm font-semibold"><legend className="sr-only">表示対象</legend><label className="flex items-center gap-1.5"><input type="radio" name="scope" value="department" defaultChecked={!query.scope || query.scope === "department"} className="accent-[#e5ad00]" />部署</label><label className="flex items-center gap-1.5"><input type="radio" name="scope" value="team" defaultChecked={query.scope === "team"} className="accent-[#e5ad00]" />チーム</label><label className="flex items-center gap-1.5"><input type="radio" name="scope" value="custom" defaultChecked={query.scope === "custom"} className="accent-[#e5ad00]" />任意選択</label></fieldset>
                <label className="flex items-center gap-1.5 text-sm font-semibold"><input type="checkbox" defaultChecked className="accent-[#e5ad00]" />部署名前方一致</label>
                {context.role === "organization_admin" ? <>
                  <nav aria-label="表示する部署" className="flex max-w-full overflow-x-auto rounded-lg bg-slate-100 p-1 text-sm font-semibold">
                    <Link href={departmentHref(query, "")} aria-current={!selectedDepartmentId ? "page" : undefined} className={`whitespace-nowrap rounded-md px-4 py-2 ${!selectedDepartmentId ? "bg-white text-[#8a6500] shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>すべて</Link>
                    {departments.map((item) => <Link key={item.id} href={departmentHref(query, item.id)} aria-current={selectedDepartmentId === item.id ? "page" : undefined} className={`whitespace-nowrap rounded-md px-4 py-2 ${selectedDepartmentId === item.id ? "bg-white text-[#8a6500] shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{item.name}</Link>)}
                  </nav>
                  <input type="hidden" name="departmentId" value={selectedDepartmentId} />
                </> : <select name="departmentId" defaultValue={selectedDepartmentId} aria-label="部署" className="h-10 min-w-40 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold"><option value="">全部署</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}
                <select name="employeeId" defaultValue={selectedEmployeeId} aria-label="担当者" className="h-10 min-w-40 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold"><option value="">全メンバー</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select>
                <button className="rounded-lg bg-[#f2c94c] px-4 py-2.5 text-sm font-bold text-slate-900">表示</button>
              </form>}
              {isWeekView ? <div className="divide-y divide-slate-200">
                {calendarDays.map((cell, index) => { const dayActivities = activitiesByDay[cell.dateKey] ?? []; return <section key={cell.key} className={`grid md:grid-cols-[170px_minmax(0,1fr)] ${calendarCellTone(cell.dateKey, cell.isToday, true)}`}>
                  <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 md:block md:border-b-0 md:border-r md:px-5 md:py-5"><div><p className={`text-sm font-bold ${weekdayTone(index, true)}`}>{formatWeekDate(cell.dateKey)}（{weekWeekdays[index]}）</p>{holidayName(cell.dateKey) && <p className="mt-1 text-xs font-bold text-red-600">{holidayName(cell.dateKey)}</p>}</div>{context.role === "sales_rep" && <div className="flex items-center gap-1 md:mt-3"><DayActivityList date={cell.dateKey} activities={dayActivities} compact/><CellCreateMenu departments={departments} date={cell.dateKey}/></div>}</header>
                  <div className="min-h-20 px-4 py-2 md:px-5">{dayActivities.length ? <div>{dayActivities.map((activity) => <ActivityDetailsDialog key={activity.id} activity={activity} calendarView="week" canManage={context.role === "sales_rep" && activity.employeeId === context.employeeId}/>)}</div> : <p className="py-4 text-sm text-slate-400">予定はありません</p>}</div>
                </section>; })}
              </div> : <>
                <div className="divide-y divide-slate-200 md:hidden">{calendarDays.filter((cell) => cell.isCurrentMonth).map((cell) => { const dayActivities = activitiesByDay[cell.dateKey] ?? []; const weekdayIndex = new Date(`${cell.dateKey}T12:00:00+09:00`).getUTCDay(); return <section key={cell.key} className={calendarCellTone(cell.dateKey, cell.isToday, true)}><header className="flex items-center justify-between gap-3 px-4 py-3"><div><p className={`text-sm font-bold ${weekdayTone(weekdayIndex, true)}`}>{formatWeekDate(cell.dateKey)}（{weekWeekdays[weekdayIndex]}）</p>{holidayName(cell.dateKey) && <p className="mt-1 text-xs font-bold text-red-600">{holidayName(cell.dateKey)}</p>}</div>{context.role === "sales_rep" && <div className="flex items-center gap-1"><DayActivityList date={cell.dateKey} activities={dayActivities} compact/><CellCreateMenu departments={departments} date={cell.dateKey}/></div>}</header>{dayActivities.length > 0 && <div className="border-t border-slate-100 px-4 py-2">{dayActivities.map((activity) => <ActivityDetailsDialog key={activity.id} activity={activity} calendarView="week" canManage={context.role === "sales_rep" && activity.employeeId === context.employeeId}/>)}</div>}</section>; })}</div>
                <div className="hidden md:block"><div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/70">{monthWeekdays.map((day, index) => <div key={day} className={`py-3 text-center text-xs font-semibold ${weekdayTone(index, false)}`}>{day}</div>)}</div><div className="grid grid-cols-7">{calendarDays.map((cell) => { const dayActivities = activitiesByDay[cell.dateKey] ?? []; return <div key={cell.key} className={`min-h-44 border-b border-r border-slate-100 p-3 ${calendarCellTone(cell.dateKey, cell.isToday, cell.isCurrentMonth)}`}><div className="mb-2 flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-1.5"><div className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${cell.isToday ? "bg-[#f2c94c] text-slate-900" : calendarDateTone(cell.dateKey, cell.isCurrentMonth)}`}>{cell.day}</div>{holidayName(cell.dateKey) && <span className="truncate text-[10px] font-bold text-red-600" title={holidayName(cell.dateKey) ?? undefined}>{holidayName(cell.dateKey)}</span>}</div>{context.role === "sales_rep" && <div className="flex shrink-0 items-center gap-1"><DayActivityList date={cell.dateKey} activities={dayActivities} compact/><CellCreateMenu departments={departments} date={cell.dateKey}/></div>}</div><div className="space-y-0.5">{dayActivities.map((activity) => <ActivityDetailsDialog key={activity.id} activity={activity} calendarView="month" canManage={context.role === "sales_rep" && activity.employeeId === context.employeeId}/>)}</div></div>; })}</div></div>
              </>}
              <CalendarCsvExport defaultStart={calendarDays[0].dateKey} defaultEnd={lastCell.dateKey} departmentId={selectedDepartmentId} employeeId={selectedEmployeeId} />
            </section>

            <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4"><p className="text-xs font-bold text-amber-800">インフォメーション</p><h2 className="mt-0.5 text-lg font-bold">営業活動の新着情報</h2></div>
              <InformationTabs initialTab={infoTab} recentCount={visibleRecent.length} pickupCount={pickupItems.length} recentScope={context.role === "organization_admin" ? "全社" : "同じ所属部門"} recentContent={<><form className="flex flex-wrap items-end gap-3 border-b border-slate-100 px-5 py-3 text-xs"><input type="hidden" name="month" value={`${year}-${String(month).padStart(2, "0")}`}/><label>表示する顧客<select name="infoType" defaultValue={query.infoType ?? "all"} className="ml-2 rounded-lg border px-2 py-1.5"><option value="all">すべて</option><option value="corporate">法人・団体顧客</option><option value="individual">個人顧客</option></select></label><label>活動<select name="infoView" defaultValue={query.infoView ?? "completed"} className="ml-2 rounded-lg border px-2 py-1.5"><option value="scheduled">予定</option><option value="completed">実績</option></select></label><span className="text-slate-500">活動期間：過去14日</span><button className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 font-bold">表示する</button></form>
              <div className="max-h-[520px] overflow-auto"><table className="w-full min-w-[1200px] text-left text-sm"><thead className="sticky top-0 z-[1] bg-slate-50 text-xs text-slate-500"><tr><th className="px-3 py-3">No.</th><th className="px-3 py-3">活動日</th><th className="px-3 py-3">顧客名</th><th className="px-3 py-3">拠点名</th><th className="px-3 py-3">案件名</th><th className="px-3 py-3">営業プロセス</th><th className="px-3 py-3">進行工程</th><th className="px-3 py-3">ステータス</th><th className="px-3 py-3">確度</th><th className="px-3 py-3">活動者</th><th className="px-3 py-3 text-right">操作</th></tr></thead><tbody>{visibleRecent.map((activity, index) => <tr key={activity.id} className="border-t border-slate-100"><td className="px-3 py-3 text-slate-400">{index + 1}</td><td className="whitespace-nowrap px-3 py-3 text-xs">{formatDate(activity.starts_at)}</td><td className="px-3 py-3 font-semibold">{relation(activity.customers)?.name ?? "顧客未設定"}</td><td className="px-3 py-3">—</td><td className="px-3 py-3">{activity.schedule_details?.opportunityName || activity.common_report?.product || activity.title}</td><td className="px-3 py-3">{activity.common_report?.salesProcess || "—"}</td><td className="px-3 py-3 font-semibold">{activity.common_report?.progressStep || activity.schedule_details?.progressStep || "—"}</td><td className="px-3 py-3">{activity.common_report?.activityStatus || activityStatusLabel(activity.status)}</td><td className="px-3 py-3">{activity.common_report?.confidence || "—"}</td><td className="px-3 py-3">{memberNames.get(activity.employee_id) ?? "—"}</td><td className="px-3 py-3 text-right"><Link href={recentActivityHref(activity, opportunities)} className="text-xs font-bold text-amber-800">詳細情報</Link></td></tr>)}{!visibleRecent.length && <tr><td colSpan={11} className="px-5 py-12 text-center text-sm text-slate-400">表示対象の活動はありません</td></tr>}</tbody></table></div><div className="border-t px-5 py-3 text-xs text-slate-500">{visibleRecent.length}件中 {visibleRecent.length ? 1 : 0}～{visibleRecent.length}件</div></>} pickupContent={<MonthlyPickupPanel month={pickupMonth} items={pickupItems} customers={pickupCustomers} departments={departments} canEdit={context.role === "sales_rep"} filters={context.role === "sales_rep" ? undefined : { year: pickupYear, month: pickupMonthNumber, departments, members: pickupMembers, departmentId: selectedPickupDepartmentId, employeeId: selectedPickupEmployeeId }}/>}/>
            </section>

            <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4"><h2 className="text-lg font-bold">受注予定リスト</h2></div>
              <form className="flex flex-wrap items-end gap-x-6 gap-y-3 border-b border-slate-100 bg-slate-50/70 px-5 py-4 text-xs">
                <input type="hidden" name="month" value={`${year}-${String(month).padStart(2, "0")}`}/>
                <input type="hidden" name="confidence" value={query.confidence ?? ""}/>
                <input type="hidden" name="orderType" value={query.orderType ?? "all"}/>
                <label className="flex items-center gap-2 font-semibold">表示範囲
                  <select name="orderYear" defaultValue={String(orderYear)} className="rounded-lg border border-slate-200 bg-white px-2 py-2 font-normal">
                    {Array.from({ length: 28 }, (_, index) => 2009 + index).map((value) => <option key={value} value={value}>{value}</option>)}
                  </select><span>年</span>
                  <select name="orderMonth" defaultValue={String(orderMonth)} className="rounded-lg border border-slate-200 bg-white px-2 py-2 font-normal">
                    {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{String(value).padStart(2, "0")}</option>)}
                  </select><span>月</span>
                </label>
                <label className="flex items-center gap-2 font-semibold">集計対象
                  <select name="orderDepartmentId" defaultValue={selectedOrderDepartmentId} className="min-w-36 rounded-lg border border-slate-200 bg-white px-2 py-2 font-normal"><option value="">全部署</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
                  <select name="orderEmployeeId" defaultValue={selectedOrderEmployeeId} className="min-w-36 rounded-lg border border-slate-200 bg-white px-2 py-2 font-normal"><option value="">全メンバー</option>{orderMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select>
                </label>
                <button className="rounded-lg bg-[#f2c94c] px-4 py-2 font-bold text-slate-900">表示する</button>
              </form>
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3 text-sm font-bold"><span>受注予定 {actualTotal.toLocaleString("ja-JP")}円［{orderActual.length}］</span><span className="text-slate-400">＝</span><span className="text-emerald-700">受注実績 {actualTotal.toLocaleString("ja-JP")}円［{orderActual.length}］</span><span className="text-slate-400">＋</span><span className="text-amber-800">受注見込 {projectedTotal.toLocaleString("ja-JP")}円［0］</span><span className="text-xs font-normal text-slate-400">確度基準未設定のため、受注見込は集計対象外</span></div>
              <form className="flex flex-wrap items-end gap-3 border-b border-slate-100 px-5 py-3 text-xs"><input type="hidden" name="month" value={`${year}-${String(month).padStart(2, "0")}`}/><input type="hidden" name="orderYear" value={orderYear}/><input type="hidden" name="orderMonth" value={orderMonth}/><input type="hidden" name="orderDepartmentId" value={selectedOrderDepartmentId}/><input type="hidden" name="orderEmployeeId" value={selectedOrderEmployeeId}/><label>確度<select name="confidence" defaultValue={query.confidence ?? ""} className="ml-2 rounded-lg border px-2 py-1.5"><option value="">すべて［{orderActual.length}］</option>{["A", "B", "C", "D"].map((value) => <option key={value} value={value}>{confidenceLabel(value)}</option>)}</select></label><label>表示する顧客<select name="orderType" defaultValue={query.orderType ?? "all"} className="ml-2 rounded-lg border px-2 py-1.5"><option value="all">すべて</option><option value="corporate">法人・団体顧客</option><option value="individual">個人顧客</option></select></label><button className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 font-bold">表示する</button></form>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1180px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-3 py-3">No.</th><th className="px-3 py-3">ステータス</th><th className="px-3 py-3">確度</th><th className="px-3 py-3">顧客名</th><th className="px-3 py-3">拠点名</th><th className="px-3 py-3">案件名</th><th className="px-3 py-3">営業プロセス</th><th className="px-3 py-3">活動担当者</th><th className="px-3 py-3">受注日</th><th className="px-3 py-3 text-right">受注額</th><th className="px-3 py-3 text-right">操作</th></tr></thead>
                  <tbody>{orderActual.slice(0, 5).map(({ activity, report, opportunity, amount }, index) => { const customer = relation(activity.customers); const employee = relation(activity.employees); const detailHref = opportunity ? `/opportunities/${opportunity.id}?activityId=${activity.id}#activity-detail` : `/activities/${activity.id}/report`; return <tr key={activity.id} className="border-t"><td className="px-3 py-3 text-slate-400">{index + 1}</td><td className="px-3 py-3">受注</td><td className="px-3 py-3 font-bold">{confidenceLabel(normalizeConfidence(report.confidence))}</td><td className="px-3 py-3 font-semibold">{customer?.name ?? "—"}</td><td className="px-3 py-3">{opportunity?.branch_name ?? "—"}</td><td className="px-3 py-3">{opportunity?.name ?? activity.schedule_details?.opportunityName ?? "—"}</td><td className="px-3 py-3">{report.salesProcess ?? opportunity?.sales_process ?? "—"}</td><td className="px-3 py-3">{employee?.name ?? memberNames.get(activity.employee_id) ?? "—"}</td><td className="px-3 py-3">{report.orderDate ?? "—"}</td><td className="px-3 py-3 text-right font-semibold">{amount.toLocaleString("ja-JP")}円</td><td className="px-3 py-3 text-right"><Link href={detailHref} className="text-xs font-bold text-amber-800">詳細情報</Link></td></tr>; })}{!orderActual.length && <tr><td colSpan={11} className="py-12 text-center text-slate-400">表示対象月の受注実績はありません</td></tr>}</tbody>
                </table>
              </div>
              <div className="border-t px-5 py-3 text-xs text-slate-500">{orderActual.length}件中 {orderActual.length ? 1 : 0}～{Math.min(5, orderActual.length)}件</div>
            </section>
          </div>
        </div>
      </main>
    </AppShell>
  );
}

function formatDate(value: string) { return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)); }
function formatShortDate(value: string) { return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" }).format(new Date(value)); }
function formatWeekDate(value: string) { return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" }).format(new Date(`${value}T12:00:00+09:00`)); }

function shiftMonth(year: number, month: number, amount: number) {
  const value = new Date(Date.UTC(year, month - 1 + amount, 1));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

function calendarHref(month: string, query: { scope?: string; departmentId?: string; employeeId?: string }) { const params = new URLSearchParams({ view: "month", month }); if (query.scope) params.set("scope", query.scope); if (query.departmentId) params.set("departmentId", query.departmentId); if (query.employeeId) params.set("employeeId", query.employeeId); return `/?${params}`; }
function weekHref(week: string, query: { scope?: string; departmentId?: string; employeeId?: string }) { const params = new URLSearchParams({ view: "week", week, month: week.slice(0, 7) }); if (query.scope) params.set("scope", query.scope); if (query.departmentId) params.set("departmentId", query.departmentId); if (query.employeeId) params.set("employeeId", query.employeeId); return `/?${params}`; }
function departmentHref(query: Record<string, string | undefined>, departmentId: string) { const params = new URLSearchParams(); for (const [key, value] of Object.entries(query)) { if (value && key !== "departmentId" && key !== "employeeId") params.set(key, value); } if (departmentId) params.set("departmentId", departmentId); const search = params.toString(); return search ? `/?${search}` : "/"; }
function weekdayTone(index: number, weekView: boolean) { const sunday = weekView ? index === 0 : index === 6; const saturday = weekView ? index === 6 : index === 5; return sunday ? "bg-red-50/70 text-red-600" : saturday ? "bg-blue-50/70 text-blue-600" : "text-slate-500"; }
function calendarDayKind(dateKey: string) { const day = new Date(`${dateKey}T12:00:00+09:00`).getUTCDay(); if (day === 0 || holidayJp.isHoliday(dateKey)) return "holiday"; if (day === 6) return "saturday"; return "weekday"; }
function calendarCellTone(dateKey: string, today: boolean, currentMonth: boolean) { if (today) return "bg-amber-50/60"; if (!currentMonth) return "bg-slate-50/60"; const kind = calendarDayKind(dateKey); return kind === "holiday" ? "bg-red-50/45" : kind === "saturday" ? "bg-blue-50/45" : "bg-white"; }
function calendarDateTone(dateKey: string, currentMonth: boolean) { if (!currentMonth) return "text-slate-400"; const kind = calendarDayKind(dateKey); return kind === "holiday" ? "text-red-600" : kind === "saturday" ? "text-blue-600" : "text-slate-600"; }
function holidayName(dateKey: string) { return (holidayJp.holidays as Record<string, { name: string }>)[dateKey]?.name ?? null; }
function createWeekGrid(anchor: string, todayKey: string) { const date = new Date(`${anchor}T12:00:00+09:00`); const start = shiftDate(anchor, -date.getUTCDay()); const anchorMonth = Number(anchor.slice(5, 7)); return Array.from({ length: 7 }, (_, index) => { const dateKey = shiftDate(start, index); return { key: dateKey, dateKey, day: Number(dateKey.slice(8, 10)), isCurrentMonth: Number(dateKey.slice(5, 7)) === anchorMonth, isToday: dateKey === todayKey }; }); }
function shiftDate(dateKey: string, amount: number) { const date = new Date(`${dateKey}T12:00:00+09:00`); date.setUTCDate(date.getUTCDate() + amount); return date.toISOString().slice(0, 10); }
function relation<T>(value: T | T[] | null) { return Array.isArray(value) ? value[0] : value; }
function confidenceLabel(value: string) { return ({ A: "Ａ：高い", B: "Ｂ：普通", C: "Ｃ：低い", D: "Ｄ：未確定" } as Record<string,string>)[value] ?? value; }
function recentActivityHref(activity: RecentActivityRow, opportunities: OpportunityRow[]) { const opportunity = opportunities.find((row) => row.id === activity.schedule_details?.opportunityId || row.source_activity_id === activity.id); if (opportunity) return `/opportunities/${opportunity.id}?activityId=${activity.id}#activity-detail`; return activity.customer_id ? `/customers/${activity.customer_id}?section=activities&activityId=${activity.id}#activities` : "/"; }
function normalizeConfidence(value?: string) { const match = value?.match(/[A-DＡ-Ｄ]/)?.[0] ?? ""; return ({ "Ａ": "A", "Ｂ": "B", "Ｃ": "C", "Ｄ": "D" } as Record<string, string>)[match] ?? match; }
function reportOrderAmount(report: OrderActivityRow["common_report"]) { if (!report) return 0; const productsTotal = (report.products ?? []).reduce((sum, product) => sum + Math.max(0, Number(product.amount) || 0), 0); return Math.max(0, Number(report.orderAmount) || productsTotal); }
