import {closingPeriod} from './metrics.ts';
import type {DailyReport,MetricActivity} from './metrics.ts';
export const fieldTypes=['新規','GUP','他商材'] as const;
export const dailyClassification={restartAfterLost:false};
export type FieldNumbers={appointments:number;revisits:number;wins:number};
export type DailyNumbers={newCalls:number;newAppointments:number;userCalls:number;userAppointments:number;outsideMinutes:number;legacyDays:number;legacyCalls:number;legacyAppointments:number;field:Record<typeof fieldTypes[number],FieldNumbers>;otherActivities:number;contracts:number;unclassifiedActivities:number;unclassifiedCustomers:number;unclassifiedVisits:number};
export function emptyDailyNumbers():DailyNumbers{return {newCalls:0,newAppointments:0,userCalls:0,userAppointments:0,outsideMinutes:0,legacyDays:0,legacyCalls:0,legacyAppointments:0,field:{新規:{appointments:0,revisits:0,wins:0},GUP:{appointments:0,revisits:0,wins:0},他商材:{appointments:0,revisits:0,wins:0}},otherActivities:0,contracts:0,unclassifiedActivities:0,unclassifiedCustomers:0,unclassifiedVisits:0};}
function date(a:MetricActivity){return new Date(a.starts_at).toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});}
function caseKey(a:MetricActivity){const product=String(a.common_report?.product||a.schedule_details?.product||'').trim();return a.customer_id&&product?`${a.employee_id}:${a.customer_id}:${product}`:a.schedule_details?.opportunityId?`${a.employee_id}:case:${a.schedule_details.opportunityId}`:null;}
export function dailyNumberSeries(activities:MetricActivity[],reports:DailyReport[],start:string,end:string,rules:{restartAfterLost:boolean}=dailyClassification,outcomeCutoff=end){
 const series=new Map<string,DailyNumbers>();for(let d=new Date(`${start}T00:00:00Z`);d.toISOString().slice(0,10)<=end;d.setUTCDate(d.getUTCDate()+1))series.set(d.toISOString().slice(0,10),emptyDailyNumbers());
 for(const r of reports){const out=series.get(r.report_date);if(!out)continue;out.outsideMinutes+=r.outside_minutes;if([r.new_calls,r.new_appointments,r.user_calls,r.user_appointments].some(n=>n==null)){out.legacyDays++;out.legacyCalls+=r.calls;out.legacyAppointments+=r.appointments;}else{out.newCalls+=r.new_calls!;out.newAppointments+=r.new_appointments!;out.userCalls+=r.user_calls!;out.userAppointments+=r.user_appointments!;}}
 const actual=activities.filter(a=>a.status==='completed'&&a.common_report?.registrationType!=='planned').map(a=>({a,day:date(a)})).filter(row=>row.day<=outcomeCutoff).toSorted((x,y)=>x.a.starts_at.localeCompare(y.a.starts_at)||x.a.id.localeCompare(y.a.id));
 const visited=new Set<string>(),cases=new Map<string,MetricActivity>();
 for(const {a,day} of actual){
  const out=series.get(day),category=String(a.schedule_details?.category??''),type=a.activity_type;
  if(category==='accompaniment'||category==='non_sales'){if(out)out.otherActivities++;continue;}
  if(category!=='sales'||!['visit','online'].includes(type)){if(out&&type!=='memo')out.unclassifiedActivities++;continue;}
  const bucket=fieldTypes.find(t=>t===a.schedule_details?.customerType),key=caseKey(a),revisit=key?visited.has(key):null;
  if(out){if(!bucket)out.unclassifiedCustomers++;else if(revisit===null)out.unclassifiedVisits++;else if(revisit)out.field[bucket].revisits++;else out.field[bucket].appointments++;}
  if(key){visited.add(key);if(['提案','提案中','受注','失注'].includes(String(a.common_report?.activityStatus)))cases.set(key,a);if(rules.restartAfterLost&&a.common_report?.activityStatus==='失注')visited.delete(key);}
 }
 for(const a of cases.values()){
  if(a.common_report?.activityStatus!=='受注')continue;const out=series.get(String(a.common_report.orderDate||date(a)));if(!out)continue;
  out.contracts++;const type=fieldTypes.find(t=>t===a.schedule_details?.customerType);if(type)out.field[type].wins++;else out.unclassifiedCustomers++;
 }
 return series;
}
export function summarizeDailyNumbers(activities:MetricActivity[],reports:DailyReport[],start:string,end:string,rules:{restartAfterLost:boolean}=dailyClassification,outcomeCutoff=end):DailyNumbers{return addDailyNumbers([...dailyNumberSeries(activities,reports,start,end,rules,outcomeCutoff).values()]);}
export function monthWeeks(month:string){const p=closingPeriod(month);const out:{label:string;start:string;end:string}[]=[];let cursor=p.start;while(cursor<=p.end){const d=new Date(`${cursor}T00:00:00Z`);const weekday=d.getUTCDay();const daysToSunday=(7-weekday)%7;d.setUTCDate(d.getUTCDate()+daysToSunday);const end=d.toISOString().slice(0,10)>p.end?p.end:d.toISOString().slice(0,10);out.push({label:`${out.length+1}週目`,start:cursor,end});const next=new Date(`${end}T00:00:00Z`);next.setUTCDate(next.getUTCDate()+1);cursor=next.toISOString().slice(0,10);}return out;}
export function goalPace(month:string,today:string,target:number,wins:number){const p=closingPeriod(month);const days=(Date.parse(p.end)-Date.parse(p.start))/86400000+1;const elapsed=Math.max(0,Math.min(days,(Date.parse(today)-Date.parse(p.start))/86400000+1));return {days,elapsed,expected:target*elapsed/days,actualPercent:target?wins/target*100:null,timePercent:elapsed/days*100,difference:wins-target*elapsed/days};}
export function addDailyNumbers(rows:DailyNumbers[]):DailyNumbers{const out=emptyDailyNumbers();for(const r of rows){for(const key of Object.keys(out) as (keyof DailyNumbers)[]){if(key!=='field')out[key]+=r[key] as number;}for(const t of fieldTypes)for(const k of ['appointments','revisits','wins'] as const)out.field[t][k]+=r.field[t][k];}return out;}
