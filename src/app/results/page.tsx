import { getDashboardSnapshot } from "@/application/dashboard/get-dashboard-snapshot";
import { ResultDialog } from "@/components/activities/result-dialog";
import { AppShell } from "@/components/layout/app-shell";
import { createSupabaseDashboardRepository } from "@/infrastructure/supabase/dashboard-repository";
import { requireAuth } from "@/lib/auth/require-auth";

export default async function ResultsPage() {
  const context = await requireAuth();
  const end = new Date(); const start = new Date(end); start.setFullYear(start.getFullYear() - 1);
  const snapshot = await getDashboardSnapshot(createSupabaseDashboardRepository(context.db, context), { calendarStart: start.toISOString(), calendarEnd: end.toISOString(), todayStart: end.toISOString(), todayEnd: end.toISOString() });
  const activities = snapshot.activities.toSorted((a, b) => b.endsAt.localeCompare(a.endsAt));
  return <AppShell active="/results" displayName={context.displayName} department={context.departmentName}><header className="flex h-20 items-center border-b border-slate-200 bg-white px-5 md:px-8"><div><p className="text-sm text-slate-400">営業活動</p><h1 className="text-xl font-bold">活動結果</h1></div></header><div className="mx-auto max-w-5xl p-4 pb-24 md:p-8"><div className="mb-5 grid grid-cols-2 gap-4"><Stat label="未入力" value={activities.filter((a) => !a.result).length} accent /><Stat label="入力済み" value={activities.filter((a) => a.result).length} /></div><div className="space-y-3">{activities.length ? activities.map((a) => <article key={a.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-4"><div><div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${a.result ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{a.result ? "入力済み" : "未入力"}</span><span className="text-xs text-slate-400">{formatDate(a.endsAt)}</span></div><h2 className="mt-2 font-bold">{a.title}</h2><p className="mt-1 text-sm text-slate-500">{a.customerName ?? "顧客未設定"}</p></div><ResultDialog activity={a} /></div>{a.result && <p className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">{a.result}</p>}</article>) : <p className="py-16 text-center text-sm text-slate-400">入力対象の活動はありません</p>}</div></div></AppShell>;
}
function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) { return <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-400">{label}</p><p className={`mt-1 text-3xl font-bold ${accent ? "text-amber-600" : "text-emerald-600"}`}>{value}件</p></div>; }
function formatDate(v: string) { return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric" }).format(new Date(v)); }
