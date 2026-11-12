import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { TargetDialog } from "@/components/targets/target-dialog";
import { PickupAppointmentActions } from "@/components/dashboard/pickup-appointment-actions";
import { requireAuth } from "@/lib/auth/require-auth";
import { canActAsSalesRep } from "@/lib/auth/roles";
import { canViewAllTargets, executionRate, targetTypes } from "@/domain/targets/rules";
import { findTargets } from "@/infrastructure/supabase/target-repository";
import { isExcludedProduct } from "@/domain/products/defaults";

export default async function TargetsPage({ searchParams }: { searchParams: Promise<{ month?: string; type?: string; employeeId?: string }> }) {
  const context = await requireAuth();
  const query = await searchParams;
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(query.month ?? "") ? query.month! : today.slice(0, 7);
  const type = targetTypes.find(value => value === query.type) ?? "";
  const isAdmin = canViewAllTargets(context.role);
  const employeeId = isAdmin && /^[0-9a-f-]{36}$/i.test(query.employeeId ?? "") ? query.employeeId! : "";
  let departmentQuery = context.db.from("departments").select("id,name").eq("organization_id", context.organizationId).not("name", "ilike", "%axcel%").order("name");
  if (context.role !== "organization_admin") departmentQuery = departmentQuery.in("id", context.departmentIds);
  let membersQuery = context.db.from("employees").select("id,name").eq("organization_id", context.organizationId).eq("status", "active").order("name");
  if (context.role !== "organization_admin") membersQuery = membersQuery.in("primary_department_id", context.departmentIds);
  const [targets, departmentResult, productResult, membersResult] = await Promise.all([
    findTargets(context, month, employeeId), departmentQuery,
    context.db.from("products").select("name").eq("organization_id", context.organizationId).eq("status", "active").order("name"),
    isAdmin ? membersQuery : Promise.resolve({ data: [], error: null }),
  ]);
  if (departmentResult.error || productResult.error || membersResult.error) throw new Error("ターゲットリストの選択肢を取得できませんでした。");
  const departments = departmentResult.data ?? [];
  const products = (productResult.data ?? []).map(p => p.name).filter((name) => !isExcludedProduct(name));
  const rows = targets.filter(row => !type || row.customer_type === type);
  const executed = rows.filter(row => row.executed).length;
  const grossProfit = rows.reduce((sum, row) => sum + Number(row.estimated_profit), 0);
  const tabs = ["", ...targetTypes];
  function href(value: string) { const params = new URLSearchParams({ month }); if (value) params.set("type", value); if (employeeId) params.set("employeeId", employeeId); return `/targets?${params}`; }
  return <AppShell active="/targets" displayName={context.displayName} department={context.departmentName}>
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-5 py-5 md:px-8 md:py-6"><div><p className="text-xs font-bold text-amber-800">TARGETS</p><h1 className="mt-1 text-2xl font-bold">ターゲットリスト</h1><p className="mt-1 text-sm text-slate-400">訪問前の見込み顧客と、月ごとの活動状況を管理します。</p></div>{canActAsSalesRep(context.role) && <TargetDialog key={month} month={month} departments={departments} products={products}/>}</div></header>
    <div className="mx-auto max-w-[1500px] space-y-5 p-4 pb-24 md:p-8">
      <form className="flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200 bg-white p-5">
        <input type="hidden" name="type" value={type}/><label className="text-xs font-bold text-slate-600">対象月<input name="month" type="month" required defaultValue={month} className="mt-2 block rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal"/></label>
        {isAdmin && <label className="text-xs font-bold text-slate-600">担当者<select name="employeeId" defaultValue={employeeId} className="mt-2 block min-w-44 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal"><option value="">全員</option>{(membersResult.data ?? []).map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>}
        <button className="rounded-lg bg-[#f2c94c] px-5 py-2.5 text-sm font-bold">表示する</button>
      </form>
      <div className="grid gap-3 sm:grid-cols-3">{[["ターゲット", `${rows.length}件`], ["想定粗利", `${grossProfit.toLocaleString("ja-JP")}円`], ["実行率", `${executionRate(executed, rows.length)}%（${executed} / ${rows.length}件）`]].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white px-5 py-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-xl font-bold">{value}</p></div>)}</div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <nav aria-label="ターゲットの分類" className="flex gap-1 border-b border-slate-200 px-4">{tabs.map(value => <Link key={value} href={href(value)} aria-current={type === value ? "page" : undefined} className={`border-b-2 px-4 py-3 text-sm font-bold ${type === value ? "border-[#f2c94c] text-slate-950" : "border-transparent text-slate-400"}`}>{value || "すべて"}</Link>)}</nav>
        <div className="overflow-x-auto"><table className="w-full min-w-[1150px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{["登録日", ...(isAdmin ? ["担当者"] : []), "顧客", "分類", "想定商材", "想定粗利", "フリー入力・変更履歴", "更新日", "活動状況", "操作"].map(label => <th key={label} className="whitespace-nowrap px-4 py-3">{label}</th>)}</tr></thead><tbody>
          {rows.map(row => { const editable = canActAsSalesRep(context.role) && row.employee_id === context.employeeId;
            const customer = { id: row.customer_id, name: row.customers?.name ?? "顧客情報なし", phone: row.customers?.phone ?? null, address: row.customers?.address ?? null, departmentId: row.department_id };
            return <tr key={row.id} className="border-t border-slate-100 align-top hover:bg-amber-50/30">
              <td className="whitespace-nowrap px-4 py-4 text-slate-500">{shortDate(row.created_at)}</td>
              {isAdmin && <td className="whitespace-nowrap px-4 py-4">{row.employees?.name ?? "—"}</td>}
              <td className="min-w-40 px-4 py-4 font-bold"><Link href={`/customers/${row.customers?.external_id ?? row.customer_id}`} className="hover:text-amber-800 hover:underline">{customer.name}</Link></td>
              <td className="px-4 py-4">{row.customer_type}</td><td className="px-4 py-4">{row.product || "—"}</td><td className="whitespace-nowrap px-4 py-4 text-right">{Number(row.estimated_profit).toLocaleString("ja-JP")}円</td>
              <td className="min-w-56 max-w-sm px-4 py-4"><p className="whitespace-pre-wrap break-words text-slate-600">{row.reason || "—"}</p>{row.history.length > 0 && <details className="mt-2 text-xs"><summary className="cursor-pointer font-semibold text-amber-800">変更履歴（{row.history.length}件）</summary><ol className="mt-2 max-h-60 space-y-3 overflow-y-auto rounded-lg bg-slate-50 p-3">{row.history.map(h => <li key={h.id}><time className="text-slate-400">{dateTime(h.changed_at)}</time>{h.previous_note !== null && <p className="mt-1 whitespace-pre-wrap break-words text-slate-400">変更前：{h.previous_note || "（空欄）"}</p>}<p className="mt-1 whitespace-pre-wrap break-words">{h.previous_note !== null ? "変更後：" : "登録："}{h.note || "（空欄）"}</p></li>)}</ol></details>}</td>
              <td className="whitespace-nowrap px-4 py-4 text-slate-500">{shortDate(row.updated_at)}</td><td className="whitespace-nowrap px-4 py-4"><span className={`rounded-full px-2 py-1 text-xs font-bold ${row.executed ? "bg-emerald-50 text-emerald-700" : row.appointmentIds.length ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-500"}`}>{row.executed ? "実行済み" : row.appointmentIds.length ? "予定登録済み" : "未実行"}</span></td>
              <td className="min-w-40 space-y-3 px-4 py-4">{editable ? <><TargetDialog month={row.target_month.slice(0, 7)} departments={departments} products={products} target={{ id: row.id, customer, customerType: row.customer_type, product: row.product, estimatedProfit: Number(row.estimated_profit), note: row.reason ?? "" }}/><PickupAppointmentActions departments={departments} defaultDate={today.startsWith(month) ? today : `${month}-01`} item={{ id: row.id, customerId: row.customer_id, customerName: customer.name, customerPhone: customer.phone, customerAddress: customer.address, departmentId: row.department_id, employeeId: row.employee_id, departmentName: "", employeeName: "", product: row.product, customerType: row.customer_type, appointmentIds: row.appointmentIds, plannedDates: [], visitedDates: [], hasReport: row.executed }}/></> : <span className="text-xs text-slate-400">閲覧のみ</span>}</td>
            </tr>; })}
          {!rows.length && <tr><td colSpan={isAdmin ? 10 : 9} className="px-5 py-16 text-left text-slate-400 md:text-center">この条件のターゲットはまだ登録されていません。</td></tr>}
        </tbody></table></div>
      </section>
      <p className="text-xs text-slate-500">実行率：対象月のターゲットのうち、紐づく訪問・オンラインの活動結果を登録した割合です。予定登録だけでは実行済みになりません。</p>
    </div>
  </AppShell>;
}
function shortDate(value: string) { return new Date(value).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", month: "long", day: "numeric" }); }
function dateTime(value: string) { return new Date(value).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }); }
