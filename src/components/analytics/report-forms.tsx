"use client";
import { useActionState } from 'react';
import { saveSalesGoal } from '@/app/analysis/actions';
import type { SalesGoal } from '@/domain/analytics/metrics';
import type { AnalyticsMember } from '@/infrastructure/supabase/analytics-repository';
const input='mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal';
export { DailyReportForm } from './today-daily-report';
export function GoalForm({ month, members, goals, selectedId }: { month: string; members: AnalyticsMember[]; goals: SalesGoal[]; selectedId: string }) {
 const [state,action,pending]=useActionState(saveSalesGoal,{});
 return <form action={action} className="space-y-3"><input type="hidden" name="month" value={month}/><div className="grid gap-4 sm:grid-cols-3"><label className="text-xs font-bold">担当者<select name="employeeId" required defaultValue={selectedId} className={input} onChange={e=>{const g=goals.find(x=>x.employee_id===e.target.value);const f=e.currentTarget.form;if(f){(f.elements.namedItem('targetCount') as HTMLInputElement).value=String(g?.target_count??0);(f.elements.namedItem('targetGrossProfit') as HTMLInputElement).value=String(g?.target_gross_profit??0);}}}>{members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label className="text-xs font-bold">受注件数目標<input name="targetCount" type="number" min="0" step="1" required defaultValue={goals.find(g=>g.employee_id===selectedId)?.target_count??0} className={input}/></label><label className="text-xs font-bold">粗利目標（円）<input name="targetGrossProfit" type="number" min="0" step="1" required defaultValue={goals.find(g=>g.employee_id===selectedId)?.target_gross_profit??0} className={input}/></label></div><button disabled={pending||!members.length} className="rounded-lg bg-[#f2c94c] px-4 py-2.5 text-sm font-bold disabled:opacity-50">目標を保存</button>{state.message&&<p role="status" className={`text-sm ${state.success?'text-slate-500':'text-red-700'}`}>{state.message}</p>}</form>;
}
