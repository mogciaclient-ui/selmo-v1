import Link from "next/link";
import { Building2, Download, Search, X } from "lucide-react";
import { CustomerRegistrationDialog } from "@/components/customers/customer-registration-dialog";
import { CustomerContactDialog, CustomerOpportunityDialog } from "@/components/customers/customer-row-dialogs";
import { AppShell } from "@/components/layout/app-shell";
import { requireAuth } from "@/lib/auth/require-auth";

type SearchValues = Record<string, string | string[] | undefined>;
type CustomerRow = {
  id: string; external_id: string; department_id: string | null; name: string; phone: string | null;
  address: string | null; notes: string | null; assigned_employee_id: string | null;
  updated_at: string; registration_details: Record<string, unknown> | null;
};
type AppUserRow = { employee_id: string; employees: { name: string } | { name: string }[] | null; app_user_departments: { department_id: string; departments: { name: string } | { name: string }[] | null }[] };
type OpportunityRow = {
  customer_id: string; branch_name: string | null; customer_contact: string | null;
  customer_type: string; product_name: string | null; products: string[] | null;
  status: string; sales_type: string | null; sales_process: string | null;
};
type ActivityRow = { customer_id: string | null; starts_at: string };

const products = ["ホームテレホン", "ビジネスフォン", "FAX", "複合機", "UTM", "サーバー", "ネットワーク商材", "防犯カメラ", "AXCEL", "コラボ", "LED", "UPS・SSW・ルーター", "その他"];
const statuses = [["open", "提案中"], ["won", "受注"], ["lost", "失注"], ["on_hold", "保留中"], ["undecided", "未定案"]] as const;
const salesProcesses = ["IT営業活動", "IT同行活動", "AXCEL同行活動", "CS営業活動", "CS営業外活動", "アルファサポート", "AXCEL", "書類不備", "工事立会", "納品", "フォロー"];

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SearchValues> }) {
  const [values, context] = await Promise.all([searchParams, requireAuth()]);
  const one = (key: string) => typeof values[key] === "string" ? values[key] : "";
  const many = (key: string) => Array.isArray(values[key]) ? values[key] : values[key] ? [values[key] as string] : [];
  const searched = one("searched") === "1";

  const customerQueries = Array.from({ length: 5 }, (_, page) => context.db.from("customers").select("id,external_id,department_id,name,phone,address,notes,assigned_employee_id,updated_at,registration_details").eq("organization_id", context.organizationId).order("updated_at", { ascending: false }).range(page * 1000, page * 1000 + 999));
  let opportunityQuery = context.db.from("opportunities").select("customer_id,branch_name,customer_contact,customer_type,product_name,products,status,sales_type,sales_process,department_id,employee_id").eq("organization_id", context.organizationId).limit(5000);
  let activityQuery = context.db.from("activities").select("customer_id,starts_at,department_id,employee_id").eq("organization_id", context.organizationId).limit(5000);
  const departmentQuery = context.db.from("departments").select("id,name").eq("organization_id", context.organizationId).order("name");
  if (context.role === "sales_rep") {
    opportunityQuery = opportunityQuery.eq("employee_id", context.employeeId);
    activityQuery = activityQuery.eq("employee_id", context.employeeId);
  } else if (context.role === "department_admin") {
    opportunityQuery = opportunityQuery.in("department_id", context.departmentIds);
    activityQuery = activityQuery.in("department_id", context.departmentIds);
  }
  const [customerPageResults, { data: rawOpportunities }, { data: rawActivities }, { data: departments }, { data: appUsers }, { data: productRows }] = await Promise.all([
    Promise.all(customerQueries), opportunityQuery, activityQuery, departmentQuery,
    context.db.from("app_users").select("employee_id,employees(name),app_user_departments(department_id,departments(name))").eq("organization_id", context.organizationId).eq("status", "active"),
    context.db.from("products").select("name").eq("organization_id", context.organizationId).eq("status", "active").order("name"),
  ]);
  const rawCustomers = customerPageResults.flatMap((result) => result.data ?? []);
  const error = customerPageResults.find((result) => result.error)?.error ?? null;
  const members = ((appUsers ?? []) as unknown as AppUserRow[]).map((user) => ({ id: user.employee_id, name: first(user.employees)?.name ?? "—", department: first(user.app_user_departments[0]?.departments)?.name ?? "所属未設定", departmentIds: user.app_user_departments.map((item) => item.department_id) }));
  const productNames = (productRows ?? []).map((product) => product.name);
  const customerRows = (rawCustomers ?? []) as CustomerRow[];
  const opportunityRows = (rawOpportunities ?? []) as OpportunityRow[];
  const activityRows = (rawActivities ?? []) as ActivityRow[];

  const relatedOpportunities = new Map<string, OpportunityRow[]>();
  for (const row of opportunityRows) relatedOpportunities.set(row.customer_id, [...(relatedOpportunities.get(row.customer_id) ?? []), row]);
  const relatedActivities = new Map<string, ActivityRow[]>();
  for (const row of activityRows) if (row.customer_id) relatedActivities.set(row.customer_id, [...(relatedActivities.get(row.customer_id) ?? []), row]);

  const selectedTypes = many("customerTypes");
  const selectedStatuses = many("statuses");
  const rows = customerRows.filter((customer) => {
    const opportunities = relatedOpportunities.get(customer.id) ?? [];
    const activities = relatedActivities.get(customer.id) ?? [];
    const types = new Set(opportunities.length ? opportunities.map((item) => item.customer_type || "corporate") : ["corporate"]);
    if (selectedTypes.length && !selectedTypes.some((type) => types.has(type))) return false;
    if (one("departmentId") && customer.department_id !== one("departmentId")) return false;
    if (one("memberId") && customer.assigned_employee_id !== one("memberId")) return false;
    if (!includes(customer.name, one("customerName"))) return false;
    if (!includes(customer.address, one("address"))) return false;
    if (one("prefecture") && !includes(customer.address, one("prefecture"))) return false;
    if (one("customerContact") && !opportunities.some((item) => includes(item.customer_contact, one("customerContact")))) return false;
    if (one("product") && !opportunities.some((item) => item.product_name === one("product") || item.products?.includes(one("product")))) return false;
    if (selectedStatuses.length && !opportunities.some((item) => selectedStatuses.includes(item.status))) return false;
    if (one("salesType") && !opportunities.some((item) => item.sales_type === one("salesType"))) return false;
    if (one("salesProcess") && !opportunities.some((item) => item.sales_process === one("salesProcess"))) return false;
    if (!meetsCount(opportunities.length, one("opportunityCount"), one("opportunityOperator"))) return false;
    if (!meetsCount(activities.length, one("activityCount"), one("activityOperator"))) return false;
    const dates = activities.map((item) => item.starts_at.slice(0, 10));
    if (one("activityFrom") && !dates.some((date) => date >= one("activityFrom"))) return false;
    if (one("activityTo") && !dates.some((date) => date <= one("activityTo"))) return false;
    return true;
  });

  const page = Math.max(1, Number(one("page")) || 1);
  const pageSize = 20;
  const visibleRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const departmentOptions = (departments ?? []) as { id: string; name: string }[];

  return <AppShell active="/customers" displayName={context.displayName} department={context.departmentName}>
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-5 py-6 md:px-8">
      <div><p className="text-xs font-bold tracking-wide text-amber-800">CUSTOMERS</p><h1 className="mt-1 text-2xl font-bold">顧客リスト</h1><p className="mt-1 text-sm text-slate-400">全顧客を一覧表示しています。必要なときだけ条件で絞り込めます。</p></div>
      <CustomerRegistrationDialog departments={departmentOptions}/>
    </div></header>
    <main className="mx-auto max-w-[1500px] p-4 pb-24 md:p-8">
      <form className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <input type="hidden" name="searched" value="1"/>
        <details open={searched}>
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 marker:content-none hover:bg-slate-50"><span className="font-bold">絞り込み条件を開く</span>{searched && <span className="text-xs font-semibold text-slate-400">条件を適用中 ▲</span>}</summary>
        <div className="flex items-center justify-between border-y border-slate-200 bg-slate-50 px-5 py-3"><h2 className="text-sm font-bold">検索条件</h2>{searched && <Link href="/customers" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500"><X size={15}/>条件をクリア</Link>}</div>
        <div className="grid gap-4 px-4 py-4 md:grid-cols-2 md:px-5">
          <Input name="customerName" label="顧客名" value={one("customerName")}/>
          <Select name="departmentId" label="部署・チーム" value={one("departmentId")}><option value="">すべて</option>{departmentOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
        </div>
        <details className="border-t border-slate-100">
          <summary className="cursor-pointer px-5 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50">詳細条件を表示</summary>
          <div className="divide-y divide-slate-100 px-4 md:px-5">
          <SearchGroup title="表示対象">
            <div className="grid gap-4 lg:grid-cols-2">
              <div><Label>顧客種別</Label><div className="flex min-h-11 flex-wrap items-center gap-x-5 gap-y-2 text-sm"><Check name="customerTypes" value="corporate" label="法人・団体顧客" checked={selectedTypes.length === 0 || selectedTypes.includes("corporate")}/><Check name="customerTypes" value="individual" label="個人顧客" checked={selectedTypes.length === 0 || selectedTypes.includes("individual")}/><Check name="includeFamily" value="1" label="家族情報を含む" checked={one("includeFamily") === "1"}/></div></div>
              <div><Label>表示範囲</Label><div className="flex min-h-11 flex-wrap items-center gap-x-5 gap-y-2 text-sm"><Radio name="displayScope" value="all" label="すべての顧客" checked={!one("displayScope") || one("displayScope") === "all"}/><Radio name="displayScope" value="bookmarked" label="ブックマークのみ" checked={one("displayScope") === "bookmarked"}/></div></div>
            </div>
          </SearchGroup>
          <SearchGroup title="担当者">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div><Label>営業担当範囲</Label><div className="flex h-11 items-center gap-5 text-sm"><Radio name="salesScope" value="department" label="部署" checked={one("salesScope") === "department"}/><Radio name="salesScope" value="team" label="チーム" checked={!one("salesScope") || one("salesScope") === "team"}/></div></div>
            <Select name="memberId" label="メンバー" value={one("memberId")}><option value="">選択なし</option>{members.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
          </div>
          </SearchGroup>
          <SearchGroup title="顧客情報">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Input name="customerContact" label="顧客担当者" value={one("customerContact")}/>
            <Select name="prefecture" label="都道府県" value={one("prefecture")}><option value="">すべて</option>{prefectures.map((name) => <option key={name}>{name}</option>)}</Select><Input name="address" label="住所" value={one("address")}/>
          </div>
          </SearchGroup>
          <SearchGroup title="案件・活動">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Select name="product" label="商材" value={one("product")}><option value="">選択なし</option>{products.map((name) => <option key={name}>{name}</option>)}</Select>
            <div className="md:col-span-2 xl:col-span-3"><Label>ステータス</Label><div className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-2">{statuses.map(([value, label]) => <Check key={value} name="statuses" value={value} label={label} checked={selectedStatuses.includes(value)}/>)}</div></div>
            <Select name="salesType" label="営業タイプ" value={one("salesType")}><option value="">選択なし</option><option>IT営業活動</option><option>IT同行活動</option><option>書類不備</option><option>フォロー</option></Select>
            <Select name="salesProcess" label="営業プロセス" value={one("salesProcess")}><option value="">選択なし</option>{salesProcesses.map((name) => <option key={name} value={name}>{name}</option>)}</Select>
            <CountField name="opportunityCount" operatorName="opportunityOperator" label="案件数" value={one("opportunityCount")} operator={one("opportunityOperator")}/>
            <CountField name="activityCount" operatorName="activityOperator" label="活動回数" value={one("activityCount")} operator={one("activityOperator")}/>
            <div className="md:col-span-2"><Label>活動期間</Label><div className="flex items-center gap-2"><input type="date" name="activityFrom" defaultValue={one("activityFrom")} className={control}/><span className="text-slate-400">〜</span><input type="date" name="activityTo" defaultValue={one("activityTo")} className={control}/></div></div>
          </div>
          </SearchGroup>
          </div>
        </details>
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4"><p className="hidden text-xs text-slate-400 sm:block">未入力の項目はすべて検索対象になります</p><div className="ml-auto flex gap-2"><Link href="/customers" className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600"><X size={16}/>クリア</Link><button className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#f2c94c] px-7 text-sm font-bold text-slate-950 shadow-sm hover:bg-[#e5b92f]"><Search size={17}/>この条件で検索</button></div></div>
        </details>
      </form>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><h2 className="font-bold">{searched ? "検索結果" : "顧客一覧"} <span className="text-amber-700">{rows.length}件</span></h2><a href="/api/customers/export" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"><Download size={15}/>CSVダウンロード</a></div>
        {error ? <p className="p-8 text-sm text-red-600">顧客データを取得できませんでした。</p> : <div className="overflow-x-auto overscroll-x-contain"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3">No.</th><th className="px-4 py-3">顧客名</th><th className="px-4 py-3">拠点名</th><th className="px-4 py-3">都道府県</th><th className="px-4 py-3">住所</th><th className="px-4 py-3">最終活動日</th><th className="px-4 py-3 text-center">案件数</th><th className="px-4 py-3 text-right">操作</th></tr></thead>
          <tbody>{visibleRows.length ? visibleRows.map((row, index) => { const opportunities = relatedOpportunities.get(row.id) ?? []; const activities = relatedActivities.get(row.id) ?? []; const latest = activities.map((item) => item.starts_at).sort().at(-1); const details = row.registration_details ?? {}; const branchName = String(details.branchName || opportunities.find((item) => item.branch_name)?.branch_name || "本社"); const contacts = (Array.isArray(details.contacts) ? details.contacts as { name?: string }[] : []).map((item) => item.name).filter((name): name is string => Boolean(name)); const availableMembers = members.filter((member) => context.role === "organization_admin" || (context.role === "sales_rep" ? member.id === context.employeeId : Boolean(row.department_id && member.departmentIds.includes(row.department_id)))); const customer = { id: row.id, externalId: row.external_id, name: row.name, branchName }; return <tr key={row.id} className="border-t border-slate-100 hover:bg-amber-50/40"><td className="px-4 py-3 text-slate-400">{(page - 1) * pageSize + index + 1}</td><td className="px-4 py-3 font-bold"><Link href={`/customers/${row.external_id}`} className="hover:text-amber-800 hover:underline">{row.name}</Link></td><td className="px-4 py-3">{branchName}</td><td className="px-4 py-3">{findPrefecture(row.address) ?? "—"}</td><td className="max-w-[300px] truncate px-4 py-3 text-slate-600">{row.address ?? "—"}</td><td className="px-4 py-3">{latest ? formatDate(latest) : "—"}</td><td className="px-4 py-3 text-center font-bold">{opportunities.length}</td><td className="px-4 py-3"><div className="flex justify-end gap-1.5"><IconLink href={`/customers/${row.external_id}`} label="顧客詳細"><Building2 size={18}/></IconLink><CustomerOpportunityDialog customer={customer} contacts={contacts} members={availableMembers} products={productNames}/><CustomerContactDialog customer={customer}/></div></td></tr>; }) : <tr><td colSpan={8} className="py-20 text-center text-slate-400">条件に一致する顧客はありません</td></tr>}</tbody>
        </table></div>}
        {rows.length > pageSize && <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 text-xs text-slate-500"><span>{rows.length}件中 {(page - 1) * pageSize + 1}〜{Math.min(page * pageSize, rows.length)}件</span><div className="flex gap-2">{page > 1 && <Link href={pageHref(values, page - 1)} className="rounded-lg border px-3 py-2">前へ</Link>}{page * pageSize < rows.length && <Link href={pageHref(values, page + 1)} className="rounded-lg border px-3 py-2">次へ</Link>}</div></div>}
      </section>
    </main>
  </AppShell>;
}

const control = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-amber-500";
function Label({ children }: { children: React.ReactNode }) { return <span className="mb-1.5 block text-xs font-bold text-slate-500">{children}</span>; }
function SearchGroup({ title, children }: { title: string; children: React.ReactNode }) { return <section className="py-3"><h3 className="mb-3 border-l-2 border-amber-400 pl-2 text-xs font-bold text-slate-700">{title}</h3>{children}</section>; }
function Input({ name, label, value }: { name: string; label: string; value: string }) { return <label><Label>{label}</Label><input name={name} defaultValue={value} className={control}/></label>; }
function Select({ name, label, value, children }: { name: string; label: string; value: string; children: React.ReactNode }) { return <label><Label>{label}</Label><select name={name} defaultValue={value} className={control}>{children}</select></label>; }
function Check({ name, value, label, checked }: { name: string; value: string; label: string; checked: boolean }) { return <label className="inline-flex items-center gap-2"><input type="checkbox" name={name} value={value} defaultChecked={checked} className="size-4 accent-amber-500"/><span>{label}</span></label>; }
function Radio({ name, value, label, checked }: { name: string; value: string; label: string; checked: boolean }) { return <label className="inline-flex items-center gap-2"><input type="radio" name={name} value={value} defaultChecked={checked} className="size-4 accent-amber-500"/><span>{label}</span></label>; }
function CountField({ name, operatorName, label, value, operator }: { name: string; operatorName: string; label: string; value: string; operator: string }) { return <label><Label>{label}</Label><div className="flex gap-2"><input type="number" min="0" name={name} defaultValue={value} className={control}/><select name={operatorName} defaultValue={operator || "gte"} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="gte">以上</option><option value="lte">以下</option><option value="eq">一致</option></select></div></label>; }
function IconLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) { return <Link href={href} aria-label={label} className="group relative grid size-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-900 focus-visible:outline-2 focus-visible:outline-amber-500">{children}<span role="tooltip" className="pointer-events-none absolute bottom-full right-0 z-30 mb-2 w-max max-w-40 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-visible:opacity-100">{label}</span></Link>; }
function first<T>(value: T | T[] | null) { return Array.isArray(value) ? value[0] : value; }
function includes(source: string | null, needle: string) { return !needle.trim() || (source ?? "").toLocaleLowerCase("ja").includes(needle.trim().toLocaleLowerCase("ja")); }
function meetsCount(actual: number, raw: string, operator: string) { if (!raw) return true; const expected = Number(raw); return operator === "lte" ? actual <= expected : operator === "eq" ? actual === expected : actual >= expected; }
function formatDate(value: string) { return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)); }
function findPrefecture(address: string | null) { return prefectures.find((name) => address?.includes(name)); }
function pageHref(values: SearchValues, page: number) { const params = new URLSearchParams(); for (const [key, value] of Object.entries(values)) for (const item of Array.isArray(value) ? value : value ? [value] : []) params.append(key, item); params.set("page", String(page)); return `/customers?${params}`; }
const prefectures = ["北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"];
