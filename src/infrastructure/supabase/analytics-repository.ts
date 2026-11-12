import type { AuthContext } from "../../lib/auth/types.ts";
import type { DailyReport, SalesGoal, MetricActivity } from "../../domain/analytics/metrics.ts";
import { closingPeriod } from "../../domain/analytics/metrics.ts";
import { SALES_ROLES } from '../../lib/auth/sales-roles.ts';
export type AnalyticsMember = { id: string; name: string; departmentId: string };
export async function analyticsMembers(context: AuthContext): Promise<AnalyticsMember[]> {
  const { data, error } = await context.db.from('app_users').select('employee_id,employees(name),app_user_departments(department_id,is_primary)').eq('organization_id', context.organizationId).eq('status','active').in("role", SALES_ROLES).order('created_at');
  if (error) throw new Error('担当者を取得できませんでした。');
  return (data ?? []).flatMap(u => {
    if (context.role === 'sales_rep' && u.employee_id !== context.employeeId) return [];
    const deps = u.app_user_departments.filter(d => context.role === 'organization_admin' || context.departmentIds.includes(d.department_id)).toSorted((a,b) => Number(b.is_primary) - Number(a.is_primary));
    if (!deps.length) return [];
    const employee = Array.isArray(u.employees) ? u.employees[0] : u.employees;
    return [{ id: u.employee_id, name: employee?.name ?? '—', departmentId: deps[0].department_id }];
  });
}
export function selectAnalyticsMembers(context: Pick<AuthContext,'role'|'employeeId'>, members: AnalyticsMember[], requested: string[], selectionProvided: boolean) {
  return members.filter(m => context.role === 'sales_rep' ? m.id === context.employeeId : !selectionProvided || requested.includes(m.id));
}
export async function analyticsData(context: AuthContext, month: string, ids: string[], options: { allActivities?: boolean } = {}) {
  const period = closingPeriod(month);
  const activities: MetricActivity[] = [], reports: DailyReport[] = [], goals: SalesGoal[] = [];
  if (!ids.length) return { activities, reports, goals };
  const selections = [
    ['activities','id,employee_id,customer_id,starts_at,activity_type,status,schedule_details,common_report,customers(name),activity_individual_reports(employee_id,report)',activities],
    ['personal_daily_reports','id,employee_id,report_date,calls,appointments,new_count,user_count,new_calls,new_appointments,user_calls,user_appointments,outside_minutes,notes,updated_at',reports],
    ['monthly_sales_goals','employee_id,target_count,target_gross_profit',goals],
  ] as const;
  await Promise.all(selections.map(async ([table, selection, output]) => {
    for (let start = 0; ; start += 1000) {
      let q = context.db.from(table).select(selection).eq('organization_id',context.organizationId).in('employee_id',ids);
      if (context.role !== 'organization_admin') q = q.in('department_id',context.departmentIds);
      if (context.role === 'sales_rep') q = q.eq('employee_id',context.employeeId);
      if (table === 'activities') { q = options.allActivities ? q.neq('status','cancelled') : q.eq('status','completed').in('activity_type',['visit','online']); q = q.lt('starts_at',`${period.endExclusive}T00:00:00+09:00`).order('starts_at'); }
      else if (table === 'personal_daily_reports') q = q.gte('report_date',period.start).lte('report_date',period.end).order('report_date');
      else q = q.eq('closing_month',`${month}-01`).order('employee_id');
      const { data, error } = await q.order('id').range(start,start+999);
      if (error) throw new Error('日報・分析データを取得できませんでした。');
      // Each selection above defines the exact row shape of its destination.
      (output as unknown[]).push(...(data ?? []));
      if ((data ?? []).length < 1000) break;
    }
  }));
  return { activities, reports, goals };
}
