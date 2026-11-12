import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { requireAuth } from "@/lib/auth/require-auth";
import { canActAsSalesRep } from "@/lib/auth/roles";
import { activityTypeLabel } from "@/domain/activities/labels";
import { getMissingActivities } from "@/infrastructure/supabase/missing-activity-repository";

type Member = { employee_id: string; employees: { name: string } | { name: string }[] | null; app_user_departments: { department_id: string }[] };
export default async function ResultsPage({ searchParams }: { searchParams: Promise<{ employeeId?: string }> }) {
  const [context, query] = await Promise.all([requireAuth(), searchParams]);
  const management = context.role !== "sales_rep";
  const { data: users, error: memberError } = await context.db.from("app_users").select("employee_id,employees(name),app_user_departments(department_id)").eq("organization_id", context.organizationId).eq("status", "active").in("role", ["sales_rep", "department_admin_sales_rep"]);
  if (memberError) throw new Error("メンバーを取得できませんでした。");
  const members = (users as unknown as Member[]).filter(member => context.role === "organization_admin" || member.app_user_departments.some(d => context.departmentIds.includes(d.department_id))).filter(member => management || member.employee_id === context.employeeId);
  const memberNames = new Map(members.map(member => [member.employee_id, relation(member.employees)?.name ?? "名称未設定"]));
  // 打ち漏れは営業メンバー（営業担当・部門管理者兼営業担当）の分だけ表示する。
  const rows = (await getMissingActivities(context.db, context)).filter(row => memberNames.has(row.employee_id));
  const selected = management && query.employeeId && (memberNames.has(query.employeeId) || rows.some(row => row.employee_id === query.employeeId)) ? query.employeeId : "";
  const visible = selected ? rows.filter(row => row.employee_id === selected) : rows;
  return <AppShell active="/results" displayName={context.displayName} department={context.departmentName}>
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-5 py-6 md:px-8">
        <div>
          <p className="text-xs font-bold tracking-wide text-amber-800">ACTIVITY REPORTS</p>
          <h1 className="mt-1 text-2xl font-bold">打ち漏れリスト</h1>
          <p className="mt-1 text-sm text-slate-400">前日以前の「訪問」「オンライン」で、活動詳細が未入力の予定です。</p>
        </div>
        <Link href="/" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:border-amber-300 hover:bg-amber-50">カレンダーへ</Link>
      </div>
    </header>
    <div className="mx-auto max-w-[1500px] p-4 pb-24 md:p-8">
      {management && <form className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-700">検索条件</h2>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="w-full text-xs font-bold text-slate-500 sm:w-64">担当者
            <select name="employeeId" defaultValue={selected} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-amber-500">
              <option value="">全メンバー</option>
              {[...memberNames.keys()].map(id => <option key={id} value={id}>{memberNames.get(id)}</option>)}
            </select>
          </label>
          <button className="h-11 rounded-xl bg-[#f2c94c] px-5 text-sm font-bold text-slate-900 hover:bg-[#ddb62f]">絞り込む</button>
          <Link href="/results" className="inline-flex h-11 items-center rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 hover:bg-slate-50">条件をクリア</Link>
        </div>
      </form>}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
          <h2 className="font-bold">{selected ? "検索結果" : "未入力の予定"} <span className="text-amber-700">{visible.length}件</span></h2>
          {selected && <p className="text-xs text-slate-500">全体の未入力：{rows.length}件</p>}
        </div>
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500"><tr>{["予定日", "担当者", "顧客", "活動種別"].map(label => <th key={label} className="px-4 py-3">{label}</th>)}<th className="px-4 py-3 text-right">操作</th></tr></thead>
            <tbody>{visible.length ? visible.map(row => <tr key={row.id} className="border-t border-slate-100 hover:bg-amber-50/40">
              <td className="whitespace-nowrap px-4 py-3 text-red-600">{new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "medium" }).format(new Date(row.starts_at))}</td>
              <td className="px-4 py-3 text-slate-600">{memberNames.get(row.employee_id) ?? "名称未設定"}</td>
              <td className="px-4 py-3 font-semibold">{relation(row.customers)?.name ?? "顧客未設定"}</td>
              <td className="px-4 py-3">{activityTypeLabel(row.activity_type)}</td>
              <td className="px-4 py-3 text-right"><Link href={`/activities/${row.id}/report`} className="inline-flex whitespace-nowrap rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:border-amber-400 hover:bg-white">{canActAsSalesRep(context.role) && row.employee_id === context.employeeId ? "結果を入力" : "詳細を確認"}</Link></td>
            </tr>) : <tr><td colSpan={5} className="py-20 text-center text-slate-400">未入力の予定はありません。</td></tr>}</tbody>
          </table>
        </div>
      </section>
    </div>
  </AppShell>;
}
function relation<T>(value: T | T[] | null) { return Array.isArray(value) ? value[0] : value; }
