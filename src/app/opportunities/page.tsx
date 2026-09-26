import Link from "next/link";
import { Download } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { OpportunityCsvDialog } from "@/components/opportunities/opportunity-dialogs";
import { MasterOpportunityDialog } from "@/components/opportunities/master-opportunity-dialog";
import { OpportunitySearchForm, type OpportunitySearchValues } from "@/components/opportunities/opportunity-search-form";
import { requireAuth } from "@/lib/auth/require-auth";

type Row = {
  id:string; customer_id:string; department_id:string; name:string; product_name:string|null;
  stage:string; status:string; confidence:string; priority:string; expected_amount:number;
  expected_close_date:string|null; branch_name:string|null; sales_process:string|null;
  activity_from:string|null; activity_to:string|null; customers:{name:string}|{name:string}[]|null;
  employees:{name:string}|{name:string}[]|null;
};
const statusLabels:Record<string,string>={open:"進行中",won:"受注",lost:"失注",on_hold:"保留"};
const stageLabels:Record<string,string>={approach:"アプローチ",discovery:"現状確認",proposal:"提案",closing:"クロージング"};
const priorityLabels:Record<string,string>={high:"高",medium:"中",low:"低"};

export default async function OpportunitiesPage({searchParams}:{searchParams:Promise<OpportunitySearchValues>}){
  const [values,context]=await Promise.all([searchParams,requireAuth()]);
  const one=(name:string)=>typeof values[name]==="string" ? values[name] as string : "";
  const many=(name:string)=>Array.isArray(values[name]) ? values[name] as string[] : values[name] ? [values[name] as string] : [];

  let query=context.db.from("opportunities")
    .select("id,customer_id,department_id,name,product_name,stage,status,confidence,priority,expected_amount,expected_close_date,branch_name,sales_process,activity_from,activity_to,employee_id,customers!inner(name),employees!inner(name)")
    .eq("organization_id",context.organizationId).order("updated_at",{ascending:false});
  if(context.role==="sales_rep") query=query.eq("employee_id",context.employeeId);
  if(context.role==="department_admin") query=query.in("department_id",context.departmentIds);

  const textFilters:[string,string][]=[
    ["name",one("q")],["customers.name",one("customer")],["product_name",one("product")],
    ["branch_name",one("branch")],["customer_contact",one("customerContact")],["prefecture",one("prefecture")],
    ["address",one("address")],["sales_type",one("salesType")],["sales_process",one("salesProcess")],
    ["activity_location",one("activityLocation")],["activity_contact",one("activityContact")],
    ["activity_attendees",one("attendees")],["vendor",one("vendor")],
  ];
  for(const [column,value] of textFilters) if(value.trim()) query=query.ilike(column,`%${safe(value)}%`);

  const equals:[string,string][]=[
    ["employee_id",context.role==="sales_rep"?"":one("owner")],["status",one("status")],
    ["department_id",one("salesDepartment")],["employee_id",one("activityOwner")],
    ["department_id",one("activityDepartment")],
  ];
  for(const [column,value] of equals) if(value) query=query.eq(column,value);

  const customerTypes=many("customerTypes");
  if(customerTypes.length) query=query.in("customer_type",customerTypes);
  const stages=many("stages");
  if(stages.length) query=query.in("stage",stages);
  const products=many("products");
  if(products.length) query=query.overlaps("products",products);
  const vendors=many("vendors");
  if(vendors.length) query=query.in("vendor",vendors);
  query=applyRankFilter(query,"confidence",one("confidence"),one("confidenceOperator"),["A","B","C","D"]);
  query=applyRankFilter(query,"priority",one("priority"),one("priorityOperator"),["high","medium","low"]);

  const contractCopies=many("contractCopies");
  if(contractCopies.length===1) query=query.eq("contract_copy",contractCopies[0]==="◎");
  const detailCopies=many("detailCopies");
  if(detailCopies.length===1) query=query.eq("detail_copy",detailCopies[0]==="◎");

  const ranges:[string,string,string][]=[
    ["quote_amount",one("quoteMin"),one("quoteMax")],["order_amount",one("orderMin"),one("orderMax")],
    ["expected_close_date",one("closeFrom"),one("closeTo")],["proposed_lease_fee",one("leaseFeeMin"),one("leaseFeeMax")],
    ["lease_start_date",one("leaseStartFrom"),one("leaseStartTo")],["lease_end_date",one("leaseEndFrom"),one("leaseEndTo")],
  ];
  for(const [column,min,max] of ranges){if(min)query=query.gte(column,min);if(max)query=query.lte(column,max);}
  if(one("activityFrom")) query=query.gte("activity_from",one("activityFrom"));
  if(one("activityTo")) query=query.lte("activity_to",one("activityTo"));

  const {data,error}=await query;
  let customerQuery=context.db.from("customers").select("id,name,department_id").eq("organization_id",context.organizationId).order("name").limit(300);
  let departmentQuery=context.db.from("departments").select("id,name").eq("organization_id",context.organizationId).order("name");
  if(context.role!=="organization_admin"){
    customerQuery=customerQuery.in("department_id",context.departmentIds);
    departmentQuery=departmentQuery.in("id",context.departmentIds);
  }
  const [{data:customers},{data:appUsers},{data:departments},{data:productRows}]=await Promise.all([
    customerQuery,
    context.db.from("app_users").select("employee_id,employees(name),app_user_departments(department_id)").eq("organization_id",context.organizationId).eq("status","active"),
    departmentQuery,
    context.db.from("products").select("name").eq("organization_id",context.organizationId).eq("status","active").order("name"),
  ]);
  const members=((appUsers??[]) as unknown as {employee_id:string;employees:{name:string}|{name:string}[]|null;app_user_departments:{department_id:string}[]}[])
    .filter(user=>context.role==="organization_admin"||(context.role==="sales_rep"?user.employee_id===context.employeeId:user.app_user_departments.some(item=>context.departmentIds.includes(item.department_id))))
    .map(user=>({id:user.employee_id,name:Array.isArray(user.employees)?user.employees[0]?.name??"—":user.employees?.name??"—"}));
  const rows=(data??[]) as unknown as Row[];

  return <AppShell active="/opportunities" displayName={context.displayName} department={context.departmentName}>
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-5 py-6 md:px-8">
      <div><p className="text-xs font-bold tracking-wide text-amber-800">OPPORTUNITIES</p><h1 className="mt-1 text-2xl font-bold">案件リスト</h1><p className="mt-1 text-sm text-slate-400">全案件を一覧表示しています。必要なときだけ条件で絞り込めます。</p></div>
      <div className="flex gap-2"><OpportunityCsvDialog/><MasterOpportunityDialog customers={(customers??[]) as {id:string;name:string}[]} products={(productRows??[]).map((item)=>item.name)}/></div>
    </div></header>
    <main className="mx-auto max-w-[1500px] p-4 pb-24 md:p-8">
      <OpportunitySearchForm values={values} members={members} departments={(departments??[]) as {id:string;name:string}[]}/>
      {error?<div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">案件データを取得できませんでした。検索条件を確認してください。</div>:
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-4"><h2 className="font-bold">{one("searched")==="1" ? "検索結果" : "案件一覧"} <span className="text-amber-700">{rows.length}件</span></h2><a href="/api/opportunities/export" className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold text-slate-600"><Download size={15}/>CSVダウンロード</a></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1280px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3">顧客名</th><th className="px-4 py-3">拠点名</th><th className="px-4 py-3">案件名</th><th className="px-4 py-3">商材名</th><th className="px-4 py-3">営業担当</th><th className="px-4 py-3">最終活動日</th><th className="px-4 py-3">営業プロセス</th><th className="px-4 py-3">ステータス</th><th className="px-4 py-3">確度</th><th className="px-4 py-3">優先順位</th><th className="px-4 py-3 text-right">見込金額</th><th className="px-4 py-3 text-right">操作</th></tr></thead>
          <tbody>{rows.length?rows.map(row=>{const customer=first(row.customers);const employee=first(row.employees);return <tr key={row.id} className="border-t border-slate-100 hover:bg-amber-50/40">
            <td className="px-4 py-3 font-semibold">{customer?.name??"—"}</td><td className="px-4 py-3 text-slate-500">{row.branch_name??"—"}</td><td className="px-4 py-3 font-bold">{row.name}</td><td className="px-4 py-3">{row.product_name??"—"}</td><td className="px-4 py-3">{employee?.name??"—"}</td><td className="px-4 py-3">{row.activity_to??row.activity_from??"—"}</td><td className="px-4 py-3">{row.sales_process??stageLabels[row.stage]??row.stage}</td><td className="px-4 py-3"><Badge>{statusLabels[row.status]??row.status}</Badge></td><td className="px-4 py-3 font-bold">{row.confidence}</td><td className="px-4 py-3">{priorityLabels[row.priority]??row.priority}</td><td className="px-4 py-3 text-right font-semibold">{Number(row.expected_amount).toLocaleString("ja-JP")}円</td><td className="px-4 py-3 text-right"><Link href={"/opportunities/"+row.id} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:border-amber-400 hover:bg-white">詳細情報</Link></td>
          </tr>}):<tr><td colSpan={12} className="py-20 text-center text-slate-400">条件に一致する案件はありません</td></tr>}</tbody>
        </table></div>
      </section>}
    </main>
  </AppShell>;
}

function applyRankFilter<T extends {in:(column:string,values:string[])=>T}>(query:T,column:string,value:string,operator:string,order:string[]){
  if(!value)return query; const index=order.indexOf(value); if(index<0)return query;
  return query.in(column,operator==="gte"?order.slice(0,index+1):order.slice(index));
}
function first<T>(value:T|T[]|null){return Array.isArray(value)?value[0]:value;}
function Badge({children}:{children:React.ReactNode}){return <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">{children}</span>;}
function safe(value:string){return value.replace(/[^\p{L}\p{N}\sー-]/gu,"");}
