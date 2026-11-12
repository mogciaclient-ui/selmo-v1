import { DevelopmentRoleForm } from "./development-role-form";
import { HybridViewSwitch } from "./hybrid-view-switch";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { authRoles, roleLabels } from "@/lib/auth/roles";
import Link from "next/link";
import { Boxes, BriefcaseBusiness, Building2, ClipboardList, Home, LogOut, MessagesSquare, Target, ChartNoAxesCombined } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { getViewMode } from "@/lib/auth/get-view-mode";
import { LEGACY_UI_LABEL, LEGACY_UI_OPTION } from "@/lib/auth/view-mode";
import { ManagerShell } from "./manager-shell";

const baseItems = [
  { href: "/", label: "TOP", icon: Home },
  { href: "/customers", label: "顧客リスト", icon: Building2 },
  { href: "/opportunities", label: "検討リスト", icon: BriefcaseBusiness },
  { href: "/products", label: "商材リスト", icon: Boxes },
  { href: "/results", label: "打ち漏れ", icon: ClipboardList },
  { href: "/analysis", label: "日報・分析", icon: ChartNoAxesCombined },
  { href: "/roleplay", label: "ロープレ", icon: MessagesSquare },
];

export async function AppShell({ active, displayName, department, children }: { active: string; displayName: string; department?: string; children: React.ReactNode }) {
  const context = await getCurrentUser();
  if (context && await getViewMode(context) === "manager") return <ManagerShell context={context} active={active} displayName={displayName} department={department}>{children}</ManagerShell>;
  const items = baseItems.flatMap(item => item.href === "/products"
    ? context?.role === "sales_rep"
      ? [{ href: "/targets", label: "ターゲットリスト", icon: Target }]
      : [item, { href: "/targets", label: "ターゲットリスト", icon: Target }]
    : [item]);
  return <div className="min-h-screen bg-[#f4f6f8] text-[#18212f]">
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-6 px-4 md:px-8">
        <Link href="/" className="shrink-0 text-2xl font-bold tracking-[-0.04em] text-slate-950">selmo<span className="text-[#f2c94c]">.</span></Link>
        <nav className="hidden h-full min-w-0 flex-1 items-center gap-0.5 overflow-x-auto md:flex">{items.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex h-full shrink-0 items-center gap-1.5 border-b-2 px-2 text-xs font-semibold transition lg:px-3 lg:text-sm ${active === href ? "border-[#f2c94c] text-slate-950" : "border-transparent text-slate-500 hover:text-slate-900"}`}><Icon size={16} />{label}</Link>)}</nav>
        <div className="ml-auto hidden items-center gap-3 sm:flex"><div className="grid size-9 place-items-center rounded-full bg-[#f2c94c] text-xs font-bold text-slate-900">{displayName.slice(0, 2)}</div><div className="hidden lg:block"><p className="text-xs font-semibold">{displayName}</p><p className="text-[10px] text-slate-400">{department ?? "所属未設定"}</p></div><form action={signOut}><button aria-label="ログアウト" title="ログアウト" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><LogOut size={17} /></button></form></div>
      </div>
    </header>
    {context?.role === "department_admin_sales_rep" && <HybridViewSwitch mode="sales" />}
    {context?.canSwitchRole && <DevelopmentRoleForm buttonClassName="rounded bg-slate-900 px-3 py-1.5 font-semibold text-white disabled:cursor-wait disabled:opacity-60" className="flex flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs">
      <label htmlFor="development-role" className="font-semibold">開発用ロール切り替え</label>
      <select key={context.role} id="development-role" name="role" defaultValue={context.role} className="rounded border border-amber-300 bg-white px-2 py-1">
        {authRoles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}<option value={LEGACY_UI_OPTION}>{LEGACY_UI_LABEL}</option>
      </select>
      <span>現在：{roleLabels[context.role]}</span>
    </DevelopmentRoleForm>}
    <main className="min-w-0">{children}</main>
    <nav className="fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">{items.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex min-h-14 min-w-[76px] flex-1 shrink-0 flex-col items-center justify-center gap-1 px-0.5 py-2 text-[9px] font-semibold ${active === href ? "text-amber-800" : "text-slate-400"}`}><Icon size={18} /><span className="max-w-full truncate">{label}</span></Link>)}</nav>
  </div>;
}
