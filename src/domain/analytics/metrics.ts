export function closingPeriod(month: string) {
  const [year, m] = month.split('-').map(Number);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || year < 2000 || year > 2100) throw new Error("集計月が正しくありません。");
  const previous = new Date(Date.UTC(year, m - 2, 21)).toISOString().slice(0, 10);
  return { month, start: previous, end: `${month}-20`, endExclusive: `${month}-21` };
}
export function defaultClosingMonth(today: string) {
  const [year, month, day] = today.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1 + (day >= 21 ? 1 : 0), 1)).toISOString().slice(0,7);
}
export type MetricActivity = { id: string; employee_id: string; customer_id: string | null; starts_at: string; activity_type: string; status: string; schedule_details: Record<string, unknown> | null; common_report: Record<string, unknown> | null; activity_individual_reports?: { employee_id: string; report: Record<string, unknown> }[]; customers?: { name: string } | { name: string }[] | null };
export type DailyReport = { id: string; employee_id: string; report_date: string; calls: number; appointments: number; new_count: number; user_count: number; outside_minutes: number; notes: string; new_calls?: number | null; new_appointments?: number | null; user_calls?: number | null; user_appointments?: number | null; updated_at?: string };
export type SalesGoal = { employee_id: string; target_count: number; target_gross_profit: number };
export type Metrics = { visits: number; online: number; wins: number; orderAmount: number; grossProfit: number; unknownGrossProfit: number; proposalWon: number; proposalLost: number; daysTotal: number; daysCount: number; calls: number; appointments: number; newCount: number; userCount: number; outsideMinutes: number; reportDays: number; targetCount: number; targetGrossProfit: number; newCalls: number; newAppointments: number; userCalls: number; userAppointments: number; unsplitReportDays: number };
export function emptyMetrics(): Metrics { return { visits: 0, online: 0, wins: 0, orderAmount: 0, grossProfit: 0, unknownGrossProfit: 0, proposalWon: 0, proposalLost: 0, daysTotal: 0, daysCount: 0, calls: 0, appointments: 0, newCount: 0, userCount: 0, outsideMinutes: 0, reportDays: 0, targetCount: 0, targetGrossProfit: 0, newCalls: 0, newAppointments: 0, userCalls: 0, userAppointments: 0, unsplitReportDays: 0 }; }
function day(value: string) { return new Date(value).toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }); }
function number(value: unknown) { const n = Number(String(value ?? '').replaceAll(',', '')); return Number.isFinite(n) && n >= 0 ? n : 0; }
function status(a: MetricActivity) { const s = String(a.common_report?.activityStatus ?? ''); return ['提案','提案中'].includes(s) ? 'open' : s === '受注' ? 'won' : s === '失注' ? 'lost' : ''; }
export function summarizeMetrics(activities: MetricActivity[], reports: DailyReport[], goals: SalesGoal[], month: string): Metrics {
  const period = closingPeriod(month), out = emptyMetrics(); const inside = (d: string) => d >= period.start && d <= period.end;
  const actual = activities.filter(a => a.status === 'completed' && ['visit','online'].includes(a.activity_type) && a.common_report?.registrationType !== 'planned' && day(a.starts_at) <= period.end).toSorted((a,b) => a.starts_at.localeCompare(b.starts_at) || a.id.localeCompare(b.id));
  const cases = new Map<string, MetricActivity[]>();
  for (const a of actual) {
    if (inside(day(a.starts_at))) { if (a.activity_type === 'visit') out.visits++; else out.online++; }
    const key = `${a.employee_id}:${String(a.schedule_details?.opportunityId || (a.customer_id && a.common_report?.product ? `${a.customer_id}:${a.common_report.product}` : a.id))}`;
    cases.set(key, [...(cases.get(key) ?? []), a]);
  }
  for (const history of cases.values()) {
    const decided = history.filter(a => status(a)); const latest = decided.at(-1); if (!latest) continue;
    if (status(latest) === 'won') {
      const orderDate = String(latest.common_report?.orderDate || day(latest.starts_at));
      if (inside(orderDate)) {
        out.wins++; out.orderAmount += number(latest.common_report?.orderAmount);
        const gross = latest.common_report?.orderGrossProfit;
        if (gross === undefined || gross === null || String(gross).trim() === '') out.unknownGrossProfit++; else out.grossProfit += number(gross);
        const first = day(history[0].starts_at); const days = (Date.parse(`${orderDate}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86400000;
        if (days >= 0) { out.daysTotal += days; out.daysCount++; }
      }
    }
    // Count each case once, using its last proposal-to-decision transition.
    let proposed = false; let transition: { outcome: string; date: string } | undefined;
    for (const a of decided) {
      if (status(a) === 'open') proposed = true;
      else if (proposed) { transition = { outcome: status(a), date: String(status(a) === 'won' ? a.common_report?.orderDate || day(a.starts_at) : day(a.starts_at)) }; proposed = false; }
    }
    if (transition && !proposed && inside(transition.date)) { if (transition.outcome === 'won') out.proposalWon++; else out.proposalLost++; }
  }
  for (const r of reports.filter(r => inside(r.report_date))) { out.calls += r.calls; out.appointments += r.appointments; out.newCount += r.new_count; out.userCount += r.user_count; out.outsideMinutes += r.outside_minutes; out.reportDays++; if ([r.new_calls,r.new_appointments,r.user_calls,r.user_appointments].some(v=>v==null)) out.unsplitReportDays++; else { out.newCalls+=r.new_calls!; out.newAppointments+=r.new_appointments!; out.userCalls+=r.user_calls!; out.userAppointments+=r.user_appointments!; } }
  for (const g of goals) { out.targetCount += Number(g.target_count); out.targetGrossProfit += Number(g.target_gross_profit); }
  return out;
}
export function rate(numerator: number, denominator: number) { return denominator ? Math.round(numerator / denominator * 1000) / 10 : null; }

export function conversionDetails(activities: MetricActivity[], month: string) {
  const period = closingPeriod(month), groups = new Map<string, MetricActivity[]>();
  for (const a of activities.filter(a => a.status === 'completed' && ['visit','online'].includes(a.activity_type) && a.common_report?.registrationType !== 'planned' && day(a.starts_at) <= period.end).toSorted((a,b) => a.starts_at.localeCompare(b.starts_at) || a.id.localeCompare(b.id))) {
    const key = `${a.employee_id}:${String(a.schedule_details?.opportunityId || (a.customer_id && a.common_report?.product ? `${a.customer_id}:${a.common_report.product}` : a.id))}`;
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  return [...groups.entries()].flatMap(([id, rows]) => {
    const latest = rows.filter(a => status(a)).at(-1); if (!latest || status(latest) !== 'won') return [];
    const orderDate = String(latest.common_report?.orderDate || day(latest.starts_at));
    if (orderDate < period.start || orderDate > period.end) return [];
    const firstVisit = day(rows[0].starts_at), days = (Date.parse(`${orderDate}T00:00:00Z`) - Date.parse(`${firstVisit}T00:00:00Z`)) / 86400000;
    const customer = Array.isArray(latest.customers) ? latest.customers[0] : latest.customers;
    return [{ id, employeeId: latest.employee_id, customerName: customer?.name ?? '顧客未設定', product: String(latest.common_report?.product ?? ''), firstVisit, orderDate, days: days >= 0 ? days : null }];
  });
}
