import Link from "next/link";
import { redirect } from "next/navigation";
import { BriefcaseBusiness, ChartNoAxesCombined, Handshake, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { requireAuth } from "@/lib/auth/require-auth";
import { getViewMode } from "@/lib/auth/get-view-mode";
import { analyticsData, analyticsMembers } from "@/infrastructure/supabase/analytics-repository";
import { getMissingActivities, missingCounts } from "@/infrastructure/supabase/missing-activity-repository";
import { closingPeriod, defaultClosingMonth, rate, summarizeMetrics } from "@/domain/analytics/metrics";

type Query = { month?: string; departmentId?: string };
const salesRoles = ["sales_rep", "department_admin_sales_rep"] as const;

export default async function ManagerDashboardPage({ searchParams }: { searchParams: Promise<Query> }) {
  const [context, query] = await Promise.all([requireAuth(), searchParams]);
  if (await getViewMode(context) !== "manager") redirect("/");
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  const month = /^20\d{2}-(0[1-9]|1[0-2])$/.test(query.month ?? "") ? query.month! : defaultClosingMonth(today);
  const period = closingPeriod(month);

  let departmentQuery = context.db.from("departments").select("id,name").eq("organization_id", context.organizationId).not("name", "ilike", "%axcel%").order("name");
  if (context.role !== "organization_admin") departmentQuery = departmentQuery.in("id", context.departmentIds);
  // 集計対象は営業活動をする人（営業担当・部門管理者兼営業担当）だけ。部門管理者・本部管理者は含めない。
  const salesRoleQuery = context.db.from("app_users").select("employee_id").eq("organization_id", context.organizationId).eq("status", "active").in("role", salesRoles);
  const [{ data: departmentRows }, allMembers, missingRows, { data: salesRoleRows, error: salesRoleError }] = await Promise.all([departmentQuery, analyticsMembers(context), getMissingActivities(context.db, context), salesRoleQuery]);
  if (salesRoleError) throw new Error("営業メンバーを取得できませんでした。", { cause: salesRoleError });
  const salesEmployeeIds = new Set((salesRoleRows ?? []).map((row) => row.employee_id as string));
  const departments = (departmentRows ?? []) as { id: string; name: string }[];
  const departmentId = query.departmentId && departments.some((item) => item.id === query.departmentId) ? query.departmentId : "";
  const members = allMembers.filter((member) => salesEmployeeIds.has(member.id) && (!departmentId || member.departmentId === departmentId));
  const data = await analyticsData(context, month, members.map((member) => member.id));
  const names = new Map(members.map((member) => [member.id, member.name]));
  const missing = missingCounts(missingRows.filter((row) => names.has(row.employee_id)));

  const team = summarizeMetrics(data.activities, data.reports, data.goals, month);
  const rows = members.map((member) => {
    const metrics = summarizeMetrics(data.activities.filter((a) => a.employee_id === member.id), data.reports.filter((r) => r.employee_id === member.id), data.goals.filter((g) => g.employee_id === member.id), month);
    return { ...member, metrics, meetings: metrics.visits + metrics.online, missing: missing[member.id] ?? 0 };
  });
  const coaching = rows.flatMap((row) => {
    const reasons = [row.missing ? `打ち漏れ ${row.missing}件` : "", row.meetings === 0 ? "今月の商談なし" : "", row.metrics.reportDays === 0 && today >= period.start ? "日報未提出" : ""].filter(Boolean);
    return reasons.length ? [{ ...row, reasons }] : [];
  }).toSorted((a, b) => b.missing - a.missing || b.reasons.length - a.reasons.length).slice(0, 5);
  const ranking = rows.filter((row) => row.metrics.wins > 0).toSorted((a, b) => b.metrics.wins - a.metrics.wins || b.metrics.orderAmount - a.metrics.orderAmount).slice(0, 5);
  const maxMeetings = Math.max(1, ...rows.map((row) => row.meetings));
  const inPeriod = (value: string) => { const day = new Date(value).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }); return day >= period.start && day <= period.end; };
  const recent = data.activities.filter((activity) => inPeriod(activity.starts_at)).toSorted((a, b) => b.starts_at.localeCompare(a.starts_at)).slice(0, 6);
  const reports = data.reports.toSorted((a, b) => b.report_date.localeCompare(a.report_date)).slice(0, 5);
  const proposalRate = rate(team.proposalWon, team.proposalWon + team.proposalLost);
  const goalRate = rate(team.wins, team.targetCount);

  return <AppShell active="/dashboard" displayName={context.displayName} department={context.departmentName}>
    <div className="px-4 pt-4 md:px-6 lg:px-8"><div className="mx-auto max-w-[1480px]">
      <form className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-[#e0e4eb] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(17,24,39,0.04)]">
          <span className="text-[12px] font-black text-[#596273]">{period.start.replaceAll("-", "/")} 〜 {period.end.replaceAll("-", "/")}</span>
          <input type="month" name="month" defaultValue={month} aria-label="集計月（20日締め）" className="h-8 rounded-[9px] border border-[#e4e8ef] bg-[#fcfcfd] px-2 text-[12px] font-black text-[#343b48] outline-none focus:border-[#e0bd4b]" />
        </div>
        {departments.length > 1 && <select name="departmentId" defaultValue={departmentId} aria-label="部署" className="h-[42px] rounded-[12px] border border-[#e0e4eb] bg-white px-3 text-[12px] font-black text-[#343b48] shadow-[0_1px_2px_rgba(17,24,39,0.04)] outline-none focus:border-[#e0bd4b]"><option value="">{context.role === "organization_admin" ? "全部署" : "担当部署すべて"}</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}
        <button className="h-[42px] rounded-[12px] border border-[#ead8a8] bg-[#fffaf0] px-4 text-[12px] font-black text-[#8a6500] transition hover:bg-[#fff3cd]">表示</button>
      </form>

      <section className="mt-5 overflow-hidden rounded-[16px] border border-[#e4e8ef] bg-white shadow-[0_8px_22px_rgba(17,24,39,0.05)]">
        <div className="border-b border-[#eef1f5] bg-white px-4 py-4 lg:px-5"><p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#8a6500]">Overview</p><h2 className="mt-1 text-[22px] font-black tracking-[-0.03em] text-[#171717]">チーム営業サマリー</h2><p className="mt-1.5 max-w-[720px] text-[13px] leading-6 text-[#596273]">{month.replace("-", "年")}月度（20日締め）の商談、受注、目標の進み具合を担当者別に確認します。</p></div>
        <div className="grid md:grid-cols-2 xl:grid-cols-4">
          <Kpi icon={Handshake} label="今月の商談活動" value={`${team.visits + team.online}件`} note={`訪問 ${team.visits}件・オンライン ${team.online}件`} />
          <Kpi icon={Trophy} label="受注" value={`${team.wins}件`} note={`目標 ${team.targetCount}件・達成率 ${goalRate ?? "-"}%`} />
          <Kpi icon={BriefcaseBusiness} label="受注金額" value={yen(team.orderAmount)} note={`粗利 ${yen(team.grossProfit)}${team.unknownGrossProfit ? `（未入力 ${team.unknownGrossProfit}件）` : ""}`} />
          <Kpi icon={ChartNoAxesCombined} label="提案→受注率" value={proposalRate === null ? "-" : `${proposalRate}%`} note={`受注 ${team.proposalWon}件・失注 ${team.proposalLost}件`} />
        </div>
      </section>

      <Card className="mt-5" title="営業マン別 今月の活動・受注" action={<CardLink href={`/analysis?month=${month}`}>日報・分析へ</CardLink>}>
        <div className="overflow-x-auto p-4">{rows.length ? <table className="w-full min-w-[720px] text-left"><thead><tr className="border-b border-[#eef1f5] text-[12px] text-[#7a808c]">{["メンバー", "商談", "受注", "受注金額", "目標達成", "日報", "打ち漏れ"].map((head) => <th key={head} className="px-3 py-3 font-bold">{head}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b border-[#f0f2f6] last:border-b-0"><td className="px-3 py-3"><span className="flex items-center gap-3"><Avatar name={row.name} /><span className="text-[13px] font-black text-[#171717]">{row.name}</span></span></td><Num>{row.meetings}件</Num><Num>{row.metrics.wins}件</Num><Num>{yen(row.metrics.orderAmount)}</Num><Num>{row.metrics.targetCount ? `${rate(row.metrics.wins, row.metrics.targetCount)}%` : "目標未設定"}</Num><Num>{row.metrics.reportDays}日</Num><td className="px-3 py-3">{row.missing ? <Link href={`/results?employeeId=${row.id}`} className="rounded-full bg-[#fff3cf] px-2.5 py-1 text-[11px] font-black text-[#8a6500]">{row.missing}件</Link> : <span className="text-[12px] font-bold text-[#8a909b]">なし</span>}</td></tr>)}</tbody></table> : <Empty title="表示できるメンバーがいません" text="担当部署に所属する営業メンバーが登録されると表示されます。" />}</div>
      </Card>

      <section className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)]">
        <div className="space-y-5">
          <Card title="指導必要ユーザー" action={<CardLink href="/results">打ち漏れ一覧へ</CardLink>}>
            <div className="p-4">{coaching.length ? <div className="space-y-3">{coaching.map((row) => <Link key={row.id} href={row.missing ? `/results?employeeId=${row.id}` : `/analysis?month=${month}`} className="grid gap-3 rounded-[12px] border border-[#eef1f5] bg-[#fcfcfd] px-4 py-3.5 transition hover:border-[#ead8a8] hover:bg-[#fffdf7] md:grid-cols-[minmax(0,1fr)_110px_170px_28px]">
              <div className="flex min-w-0 items-center gap-3"><Avatar name={row.name} size="lg" /><div className="min-w-0"><div className="truncate text-[14px] font-black text-[#171717]">{row.name}</div><div className="mt-0.5 truncate text-[12px] font-bold text-[#8a909b]">商談 {row.meetings}件 ・ 日報 {row.metrics.reportDays}日</div></div></div>
              <div className="flex items-center md:justify-center"><span className="rounded-full bg-[#fff3cf] px-2.5 py-1 text-[11px] font-black text-[#8a6500]">要確認</span></div>
              <div className="text-[12px] font-bold text-[#343b48]">{row.reasons[0]}<div className="mt-1 text-[#8a909b]">{row.reasons.slice(1).join("・") || `受注 ${row.metrics.wins}件`}</div></div>
              <div className="flex items-center justify-end text-[20px] font-black text-[#8a6500]">›</div>
            </Link>)}</div> : <Empty title="指導が必要なメンバーはいません" text="打ち漏れ・商談なし・日報未提出のメンバーがここに表示されます。" />}</div>
          </Card>
          <Card title="直近の商談レビュー" action={<CardLink href="/opportunities">検討リストへ</CardLink>}>
            <div className="max-h-[430px] overflow-auto p-4">{recent.length ? <table className="w-full min-w-[620px] text-left"><thead className="sticky top-0 z-10 bg-white"><tr className="border-b border-[#eef1f5] text-[12px] text-[#7a808c]">{["商談日", "顧客名", "商材", "結果", "担当"].map((head) => <th key={head} className="px-3 py-3 font-bold">{head}</th>)}</tr></thead><tbody>{recent.map((activity) => { const customer = Array.isArray(activity.customers) ? activity.customers[0] : activity.customers; const result = String(activity.common_report?.activityStatus ?? "未入力"); return <tr key={activity.id} className="border-b border-[#f0f2f6] last:border-b-0"><td className="px-3 py-3 text-[12px] font-bold text-[#596273]">{shortDate(activity.starts_at)}</td><td className="px-3 py-3 text-[13px] font-black text-[#171717]"><Link href={`/activities/${activity.id}/report`} className="hover:text-[#8a6500]">{(customer as { name?: string } | null)?.name ?? "顧客未設定"}</Link></td><td className="px-3 py-3 text-[12px] font-bold text-[#596273]">{String(activity.common_report?.product ?? "—")}</td><td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${result === "受注" ? "bg-[#e8f6ee] text-[#2f7a4f]" : result === "失注" ? "bg-[#fdecec] text-[#b4473f]" : "bg-[#f1f2f5] text-[#596273]"}`}>{result}</span></td><td className="px-3 py-3 text-[12px] font-bold text-[#596273]">{names.get(activity.employee_id) ?? "—"}</td></tr>; })}</tbody></table> : <Empty title="商談はまだありません" text="訪問・オンラインの活動を登録すると表示されます。" />}</div>
          </Card>
          <Card title="日報報告" action={<CardLink href={`/analysis?month=${month}`}>日報一覧へ</CardLink>}>
            <div className="p-4">{reports.length ? <div className="space-y-3">{reports.map((report) => <div key={report.id} className="rounded-[12px] border border-[#eef1f5] bg-[#fcfcfd] px-4 py-3.5"><div className="flex flex-wrap items-center justify-between gap-2"><span className="flex items-center gap-3"><Avatar name={names.get(report.employee_id) ?? "—"} /><span className="text-[13px] font-black text-[#171717]">{names.get(report.employee_id) ?? "—"}</span></span><span className="text-[12px] font-bold text-[#8a909b]">{report.report_date.replaceAll("-", "/")}</span></div><p className="mt-2 text-[12px] font-bold text-[#596273]">コール {report.calls}件・アポ {report.appointments}件・外出 {report.outside_minutes}分</p>{report.notes && <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap text-[13px] leading-6 text-[#343b48]">{report.notes}</p>}</div>)}</div> : <Empty title="日報はまだありません" text="営業メンバーが日報を保存すると、ここに最新の日報が表示されます。" />}</div>
          </Card>
        </div>
        <div className="space-y-5">
          <Card title="営業パフォーマンス分布">
            <div className="p-4">
              <div className="relative h-[260px] rounded-[12px] border border-[#f3e3b3] bg-[#fffdf7]">
                <span className="absolute left-3 top-3 text-[11px] font-bold text-[#8a909b]">成約率</span>
                <span className="absolute bottom-3 right-3 text-[11px] font-bold text-[#8a909b]">商談数</span>
                <div className="absolute inset-y-8 left-1/2 border-l border-[#f0d58a]" /><div className="absolute inset-x-8 top-1/2 border-t border-[#f0d58a]" />
                <Quadrant className="left-[12%] top-8">成約率は高い / 商談数は少ない</Quadrant><Quadrant className="right-[10%] top-8 text-[#2f7a4f]">高パフォーマンス</Quadrant><Quadrant className="bottom-9 left-[12%] text-[#b4473f]">改善が必要</Quadrant><Quadrant className="bottom-9 right-[16%] text-[#2f6fb4]">商談数は多い / 成約率は低い</Quadrant>
                {rows.map((row) => { const win = row.meetings ? Math.min(100, row.metrics.wins / row.meetings * 100) : 0; return <span key={row.id} title={`${row.name}：商談 ${row.meetings}件・成約率 ${Math.round(win)}%`} className="absolute size-3 -translate-x-1/2 translate-y-1/2 rounded-full bg-[#f0b400] ring-2 ring-white" style={{ left: `${10 + row.meetings / maxMeetings * 80}%`, bottom: `${10 + win * 0.8}%` }} />; })}
              </div>
              <div className="mt-4 overflow-hidden rounded-[12px] border border-[#eef1f5]"><table className="w-full text-left"><thead><tr className="border-b border-[#eef1f5] text-[11px] text-[#7a808c]"><th className="px-3 py-2.5 font-bold">メンバー</th><th className="px-3 py-2.5 text-right font-bold">商談</th><th className="px-3 py-2.5 text-right font-bold">成約率</th><th className="px-3 py-2.5 text-right font-bold">状態</th></tr></thead><tbody>{rows.map((row) => { const needsCheck = coaching.some((item) => item.id === row.id); return <tr key={row.id} className="border-b border-[#f0f2f6] last:border-b-0"><td className="px-3 py-2.5"><span className="flex items-center gap-2.5"><Avatar name={row.name} /><span className="text-[13px] font-black text-[#171717]">{row.name}</span></span></td><td className="px-3 py-2.5 text-right text-[13px] font-black text-[#171717]">{row.meetings}件</td><td className="px-3 py-2.5 text-right text-[13px] font-black text-[#171717]">{row.meetings ? `${rate(row.metrics.wins, row.meetings)}%` : "-%"}</td><td className="px-3 py-2.5 text-right"><span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${needsCheck ? "bg-[#fff3cf] text-[#8a6500]" : "bg-[#e8f6ee] text-[#2f7a4f]"}`}>{needsCheck ? "確認" : "良好"}</span></td></tr>; })}</tbody></table></div>
            </div>
          </Card>
          <Card title="営業ランキング" action={<CardLink href={`/analysis?month=${month}`}>詳しく見る</CardLink>}>
            <div className="p-4">{ranking.length ? <ol className="space-y-3">{ranking.map((row, index) => <li key={row.id} className="flex items-center gap-3 rounded-[12px] border border-[#eef1f5] bg-[#fcfcfd] px-4 py-3"><span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black ${index === 0 ? "bg-[#ffe7a0] text-[#8a6500]" : "bg-[#f1f2f5] text-[#8d94a1]"}`}>{index + 1}</span><Avatar name={row.name} /><span className="min-w-0 flex-1 truncate text-[13px] font-black text-[#171717]">{row.name}</span><span className="text-right"><span className="block text-[13px] font-black text-[#171717]">{row.metrics.wins}件</span><span className="block text-[11px] font-bold text-[#8a909b]">{yen(row.metrics.orderAmount)}</span></span></li>)}</ol> : <Empty title="ランキングはまだありません" text="商談結果が蓄積されると表示されます。" />}</div>
          </Card>
        </div>
      </section>
    </div></div>
  </AppShell>;
}

function Kpi({ icon: Icon, label, value, note }: { icon: LucideIcon; label: string; value: string; note: string }) {
  return <article className="border-b border-[#eef1f5] px-4 py-4 md:border-r md:last:border-r-0 xl:border-b-0"><div className="flex items-start gap-3"><span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#fff3cf] text-[#f0b400]"><Icon size={19} /></span><div className="min-w-0"><div className="text-[12px] font-black text-[#596273]">{label}</div><div className="mt-1 text-[26px] font-black tracking-[-0.03em] text-[#171717]">{value}</div><div className="mt-1 text-[11px] font-bold text-[#8a909b]">{note}</div></div></div></article>;
}
function Card({ title, action, className = "", children }: { title: string; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return <section className={`rounded-[16px] border border-[#e4e8ef] bg-white shadow-[0_6px_16px_rgba(17,24,39,0.04)] ${className}`}><div className="flex items-center justify-between gap-4 border-b border-[#eef1f5] px-4 py-3.5"><h2 className="text-[16px] font-black text-[#171717]">{title}</h2>{action}</div>{children}</section>;
}
function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="shrink-0 rounded-[9px] border border-[#ead8a8] bg-[#fffaf0] px-3 py-1.5 text-[12px] font-black text-[#8a6500] transition hover:bg-[#fff3cd]">{children}</Link>;
}
function Empty({ title, text }: { title: string; text: string }) {
  return <div className="rounded-[12px] border border-dashed border-[#dfe4ec] bg-[#fcfcfd] px-5 py-8 text-center"><h3 className="text-[16px] font-black text-[#171717]">{title}</h3><p className="mx-auto mt-2 max-w-[360px] text-[13px] leading-6 text-[#7a808c]">{text}</p></div>;
}
function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  return <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-[#fff3cf] font-black text-[#8a6500] ${size === "lg" ? "h-10 w-10 text-[14px]" : "h-8 w-8 text-[12px]"}`}>{name.slice(0, 1)}</span>;
}
function Num({ children }: { children: React.ReactNode }) { return <td className="px-3 py-3 text-[13px] font-black text-[#171717]">{children}</td>; }
function Quadrant({ className, children }: { className: string; children: React.ReactNode }) { return <span className={`absolute rounded-full border border-[#f0e4c2] bg-white px-2.5 py-1 text-[11px] font-bold text-[#596273] ${className}`}>{children}</span>; }
function yen(value: number) { return `${value.toLocaleString("ja-JP")}円`; }
function shortDate(value: string) { return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "2-digit", day: "2-digit" }).format(new Date(value)); }
