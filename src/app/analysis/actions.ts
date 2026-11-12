"use server";
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { canActAsSalesRep } from '@/lib/auth/roles';
import { analyticsMembers } from '@/infrastructure/supabase/analytics-repository';
export type AnalysisState = { success?: boolean; message?: string; report?: import('@/domain/analytics/metrics').DailyReport };
const count = z.coerce.number().int().min(0).max(100000);
export async function saveDailyReport(_: AnalysisState, form: FormData): Promise<AnalysisState> {
  const user = await getCurrentUser(); if (!user || !canActAsSalesRep(user.role)) return { message: '個人日報は営業担当本人が入力してください。' };
  const parsed = z.object({ reportDate: z.iso.date(), newCalls: count, newAppointments: count, userCalls: count, userAppointments: count, outsideMinutes: z.coerce.number().int().min(0).max(1440) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { message: '日付、新規・ユーザー別のコール・アポ数、外出時間を確認してください。' };
  const member = (await analyticsMembers(user)).find(m => m.id === user.employeeId); if (!member) return { message: '所属部署を確認してください。' };
  const v = parsed.data;
  const { data: previous } = await user.db.from('personal_daily_reports').select('new_count,user_count,notes').eq('organization_id',user.organizationId).eq('employee_id',user.employeeId).eq('report_date',v.reportDate).maybeSingle();
  const { data, error } = await user.db.from('personal_daily_reports').upsert({ organization_id: user.organizationId, department_id: member.departmentId, employee_id: user.employeeId, report_date: v.reportDate, calls: v.newCalls + v.userCalls, appointments: v.newAppointments + v.userAppointments, new_count: previous?.new_count ?? 0, user_count: previous?.user_count ?? 0, new_calls: v.newCalls, new_appointments: v.newAppointments, user_calls: v.userCalls, user_appointments: v.userAppointments, outside_minutes: v.outsideMinutes, notes: previous?.notes ?? '', updated_at: new Date().toISOString() }, { onConflict: 'employee_id,report_date' }).select('id,employee_id,report_date,calls,appointments,new_count,user_count,new_calls,new_appointments,user_calls,user_appointments,outside_minutes,notes,updated_at').single();
  if (error || !data) return { message: '個人日報を保存できませんでした。' };
  revalidatePath('/'); revalidatePath('/analysis'); return { success: true, message: '個人日報を保存しました。', report: data };
}
export async function saveSalesGoal(_: AnalysisState, form: FormData): Promise<AnalysisState> {
  const user = await getCurrentUser(); if (!user) return { message: 'ログインし直してください。' };
  if (user.role === 'sales_rep') return { message: '目標を設定する権限がありません。' };
  const parsed = z.object({ employeeId: z.uuid(), month: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/), targetCount: count, targetGrossProfit: z.coerce.number().int().min(0).max(999999999999) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { message: '担当者・集計月・目標を確認してください。' };
  const member = (await analyticsMembers(user)).find(m => m.id === parsed.data.employeeId); if (!member) return { message: '目標を設定する権限がありません。' };
  const v = parsed.data;
  const { error } = await user.db.from('monthly_sales_goals').upsert({ organization_id: user.organizationId, department_id: member.departmentId, employee_id: member.id, closing_month: `${v.month}-01`, target_count: v.targetCount, target_gross_profit: v.targetGrossProfit, updated_at: new Date().toISOString() },{ onConflict:'employee_id,closing_month' });
  if (error) return { message: '受注目標を保存できませんでした。' };
  revalidatePath('/'); revalidatePath('/analysis'); return { success: true, message: '受注目標を保存しました。' };
}
