import Link from 'next/link';
import type {AuthContext} from '@/lib/auth/types';
import {canActAsSalesRep} from '@/lib/auth/roles';
import {analyticsMembers,analyticsData} from '@/infrastructure/supabase/analytics-repository';
import {closingPeriod,defaultClosingMonth,summarizeMetrics} from '@/domain/analytics/metrics';
import {monthWeeks,dailyNumberSeries,addDailyNumbers} from '@/domain/analytics/daily-dashboard';
import {DailyReportForm} from './today-daily-report';
import {DailyDashboardSummary} from './daily-dashboard-summary';
export async function DashboardDailySection({context,today,monthValue,calendarQuery={},ownOnly=false}:{context:AuthContext;today:string;monthValue?:string;ownOnly?:boolean;calendarQuery?:Record<string,string|string[]|undefined>}){
 const month=/^20\d{2}-(0[1-9]|1[0-2])$/.test(monthValue??'')?monthValue!:defaultClosingMonth(today);const period=closingPeriod(month);const weeks=monthWeeks(month);const days:string[]=[];for(let d=new Date(`${period.start}T00:00:00Z`);d.toISOString().slice(0,10)<=period.end;d.setUTCDate(d.getUTCDate()+1))days.push(d.toISOString().slice(0,10));
 const [scopedMembers,ownDay]=await Promise.all([analyticsMembers(context),context.db.from('personal_daily_reports').select('id,employee_id,report_date,calls,appointments,new_count,user_count,new_calls,new_appointments,user_calls,user_appointments,outside_minutes,notes,updated_at').eq('organization_id',context.organizationId).eq('employee_id',context.employeeId).eq('report_date',today).maybeSingle()]);if(ownDay.error)throw new Error('今日の日報を取得できませんでした。');
 const members=ownOnly?scopedMembers.filter(member=>member.id===context.employeeId):scopedMembers;
 const canSelect=!ownOnly&&context.role!=='sales_rep';
 const data=await analyticsData(context,month,members.map(m=>m.id),{allActivities:true});
 const rows=members.map(m=>{const a=data.activities.filter(a=>a.employee_id===m.id),r=data.reports.filter(r=>r.employee_id===m.id);const series=dailyNumberSeries(a,r,period.start,period.end);return {id:m.id,name:m.name,month:addDailyNumbers([...series.values()]),weeks:weeks.map(w=>addDailyNumbers(days.filter(d=>d>=w.start&&d<=w.end).map(d=>series.get(d)!))),days:days.map(d=>series.get(d)!),metrics:summarizeMetrics(a,r,data.goals.filter(g=>g.employee_id===m.id),month)};});
 const contracts=rows.reduce((sum,row)=>sum+row.month.contracts,0);
 const target=rows.reduce((sum,row)=>sum+row.metrics.targetCount,0);
 return <section id="today-daily-report" className="scroll-mt-24 mb-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
  <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 md:px-6">
   <div><h2 className="text-sm font-bold text-slate-800">日報・行動進捗</h2><p className="mt-1 text-xs text-slate-500">{month.replace('-', '年')}月度{canSelect?'・対象メンバー合計':''}</p></div>
   <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
    <p><span className="text-xs text-slate-500">受注 </span><strong>{contracts}件</strong><span className="text-xs text-slate-500"> / 目標 {target>0?`${target}件`:'未設定'}</span>{target>0&&<span className="ml-2 text-xs font-bold text-amber-800">{Math.round(contracts/target*100)}%</span>}</p>
    <Link href={`/analysis?month=${month}`} className="text-xs font-medium text-slate-600 underline underline-offset-4">{context.role === 'sales_rep' ? '詳しい分析' : '詳しい分析・目標設定'}</Link>
   </div>
  </div>
  {canActAsSalesRep(context.role)&&<details className="group border-t border-slate-100">
   <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-3 text-sm md:px-6 [&::-webkit-details-marker]:hidden"><span aria-hidden="true" className="text-slate-400 transition-transform group-open:rotate-90">▸</span><span className="font-medium">今日の日報</span><span className={`rounded-full px-2 py-0.5 text-xs ${ownDay.data?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-800'}`}>{ownDay.data?'入力済み':'未入力'}</span><span className="ml-auto text-xs text-slate-500">入力・編集</span></summary>
   <div className="px-4 pb-4 md:px-6"><DailyReportForm date={today} today={today} report={ownDay.data??undefined}/></div>
  </details>}
  <details className="group border-t border-slate-100">
   <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm md:px-6 [&::-webkit-details-marker]:hidden"><span aria-hidden="true" className="text-slate-400 transition-transform group-open:rotate-90">▸</span><span className="font-medium">週別・日別の集計</span><span className="ml-auto text-xs text-slate-500">開く</span></summary>
   <div className="space-y-4 px-4 pb-4 md:px-6">
    <form className="flex flex-wrap items-center gap-3">{Object.entries(calendarQuery).filter(([k])=>['month','view','week','scope','employeeId','employeeIds','departmentId'].includes(k)).flatMap(([key,value])=>(Array.isArray(value)?value:value?[value]:[]).map(v=><input key={`${key}:${v}`} type="hidden" name={key} value={v}/>))}<label className="text-xs font-bold">集計月度<input name="dailyMonth" type="month" required defaultValue={month} className="ml-2 rounded-lg border px-3 py-2 text-sm font-normal"/></label><button className="rounded-lg bg-[#f2c94c] px-3 py-2 text-sm font-bold">表示</button><span className="text-xs text-slate-500">{period.start}〜{period.end}（21日始まり・20日締め）</span></form>
    <DailyDashboardSummary key={month} members={rows} weeks={weeks} days={days} month={month} today={today} canSelect={canSelect}/>
   </div>
  </details>
 </section>;
}
