import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarPlus } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { DeleteOpportunityForm } from "@/components/opportunities/delete-opportunity-form";
import { requireAuth } from "@/lib/auth/require-auth";
import { activityStatusLabel, activityTypeLabel } from "@/domain/activities/labels";

type Row=Record<string,unknown>&{id:string;customer_id:string;department_id:string;employee_id:string;name:string;product_name:string|null;stage:string;status:string;confidence:string;priority:string;customers:{name:string}|{name:string}[]|null;employees:{name:string}|{name:string}[]|null};
type Activity={id:string;title:string;activity_type:string;starts_at:string;status:string;result:string|null};
const labels:Record<string,string>={product_name:"商材",stage:"商談ステージ",status:"案件状態",confidence:"確度",priority:"優先順位",expected_amount:"見込金額",expected_close_date:"受注予定日",branch_name:"拠点名",customer_contact:"顧客担当者",prefecture:"都道府県",address:"住所",sales_type:"営業タイプ",sales_process:"営業プロセス",progress_step:"進行工程",activity_location:"活動拠点",activity_contact:"顧客面談者",activity_attendees:"活動同席者",activity_from:"活動開始日",activity_to:"活動終了日",quote_amount:"見積額",order_amount:"受注額",vendor:"販社",proposed_lease_fee:"提案リース料金",lease_start_date:"リース開始日",lease_end_date:"リース終了日",notes:"備考"};
const displayKeys=Object.keys(labels);

export default async function OpportunityDetailPage({params}:{params:Promise<{id:string}>}){
 const [{id},context]=await Promise.all([params,requireAuth()]);
 let request=context.db.from("opportunities").select("*,customers(name),employees(name)").eq("organization_id",context.organizationId).eq("id",id);
 if(context.role==="sales_rep")request=request.eq("employee_id",context.employeeId);
 if(context.role==="department_admin")request=request.in("department_id",context.departmentIds);
 const {data}=await request.maybeSingle(); if(!data)notFound();
 const row=data as unknown as Row; const customer=first(row.customers); const employee=first(row.employees);
 let activityRequest=context.db.from("activities").select("id,title,activity_type,starts_at,status,result").eq("organization_id",context.organizationId).eq("customer_id",row.customer_id).order("starts_at",{ascending:false}).limit(20);
 if(context.role==="sales_rep")activityRequest=activityRequest.eq("employee_id",context.employeeId);
 if(context.role==="department_admin")activityRequest=activityRequest.in("department_id",context.departmentIds);
 const {data:activityRows}=await activityRequest; const activities=(activityRows??[]) as Activity[];
 return <AppShell active="/opportunities" displayName={context.displayName} department={context.departmentName}><main className="mx-auto max-w-6xl p-4 pb-24 md:p-8">
  <Link href="/opportunities" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-500"><ArrowLeft size={17}/>案件リストへ戻る</Link>
  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><header className="flex flex-wrap items-start justify-between gap-4 border-b p-6"><div><p className="text-xs font-bold text-amber-800">案件詳細</p><h1 className="mt-1 text-2xl font-bold">{row.name}</h1><p className="mt-2 text-sm text-slate-500">{customer?.name??"—"} ・ 営業担当 {employee?.name??"—"}</p></div><div className="flex gap-2"><Link href={`/?customer=${row.customer_id}&date=${new Date().toISOString().slice(0,10)}`} className="inline-flex items-center gap-2 rounded-xl bg-[#f2c94c] px-4 py-2.5 text-sm font-bold"><CalendarPlus size={17}/>活動登録</Link><Link href={"/opportunities/"+row.id+"/edit"} className="inline-flex items-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold">編集</Link><DeleteOpportunityForm id={row.id}/></div></header>
  <div className="grid gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">{displayKeys.map(key=><div key={key} className="bg-white p-4"><p className="text-xs font-semibold text-slate-400">{labels[key]}</p><p className="mt-1 whitespace-pre-wrap text-sm font-medium">{formatValue(key,row[key])}</p></div>)}</div>
 </section>
 <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b px-5 py-4"><h2 className="font-bold">活動履歴 <span className="text-amber-700">{activities.length}件</span></h2></div>{activities.length?<div>{activities.map(activity=><article key={activity.id} className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4 last:border-0"><div><p className="text-xs font-semibold text-amber-800">{new Date(activity.starts_at).toLocaleDateString("ja-JP")}</p><h3 className="mt-1 font-bold">{activity.title}</h3><p className="mt-1 text-xs text-slate-400">{activityTypeLabel(activity.activity_type)} ・ {activityStatusLabel(activity.status)}</p></div><Link href={`/activities/${activity.id}/report`} className="rounded-lg border px-3 py-2 text-xs font-bold">詳細情報</Link></article>)}</div>:<p className="py-12 text-center text-sm text-slate-400">活動履歴はありません</p>}</section>
 </main></AppShell>;
}
function first<T>(value:T|T[]|null){return Array.isArray(value)?value[0]:value;}
function formatValue(key:string,value:unknown){if(value===null||value===undefined||value==="")return "—";if(Array.isArray(value))return value.join("、")||"—";if(typeof value==="boolean")return value?"◎":"×";if(["expected_amount","quote_amount","order_amount","proposed_lease_fee"].includes(key))return `${Number(value).toLocaleString("ja-JP")}円`;return String(value);}
