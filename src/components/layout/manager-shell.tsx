import { DevelopmentRoleForm } from "./development-role-form";
import { HybridViewSwitch } from "./hybrid-view-switch";
import { authRoles, roleLabels } from "@/lib/auth/roles";
import { LEGACY_UI_LABEL, LEGACY_UI_OPTION } from "@/lib/auth/view-mode";
import type { AuthContext } from "@/lib/auth/types";
import { ManagerSidebarContent } from "./manager-sidebar";
import { ManagerMobileMenu } from "./manager-mobile-menu";
import { managerPageLabel } from "./manager-nav";

const managerFont = { fontFamily: 'ui-sans-serif, system-ui, -apple-system, "system-ui", "Segoe UI", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif' };

function nowLabel() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  return `${parts.year}/${parts.month}/${parts.day}(${parts.weekday}) ${parts.hour}:${parts.minute} JST`;
}

export function ManagerShell({ context, active, displayName, department, children }: { context: AuthContext; active: string; displayName: string; department?: string; children: React.ReactNode }) {
  const sidebar = <ManagerSidebarContent role={context.role} active={active} displayName={displayName} department={department} />;
  const label = managerPageLabel(context.role, active);
  return <div className="min-h-screen bg-[#f5f5f6] text-[#16140f]" style={managerFont}>
    <div className="mx-auto min-h-screen max-w-[1680px] lg:grid lg:grid-cols-[220px_1fr]">
      <aside className="always-visible-scrollbar hidden min-h-screen overflow-y-auto border-r border-[#eceef4] bg-white px-4 py-7 lg:block">{sidebar}</aside>
      <div className="min-w-0 bg-[#f5f5f6]">
        <header className="sticky top-0 z-30 border-b border-[#eceef4] bg-white/92 px-4 py-3 backdrop-blur md:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="hidden items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#9aa1ad] sm:flex"><span>Selmo</span>{label && <><span className="text-[#d8dde6]">/</span><span className="text-[#171717]">{label}</span></>}</div>
            <div className="min-w-0 flex-1 sm:hidden"><div className="text-[13px] font-semibold tracking-[0.34em] text-[#171717]">selmo<span className="text-[#ffc400]">.</span></div>{label && <div className="mt-0.5 truncate text-[12px] font-semibold text-[#596273]">{label}</div>}</div>
            <div className="flex shrink-0 items-center gap-3 md:gap-[14px]">
              <span className="hidden rounded-full border border-[#e8ebf0] bg-[#f7f7fa] px-3 py-2 text-[12px] font-semibold text-[#7d8490] sm:inline-flex">{nowLabel()}</span>
              <ManagerMobileMenu>{sidebar}</ManagerMobileMenu>
            </div>
          </div>
        </header>
        {context.role === "department_admin_sales_rep" && <HybridViewSwitch mode="manager" />}
        {context.canSwitchRole && <DevelopmentRoleForm buttonClassName="rounded-[9px] border border-[#ead8a8] bg-white px-3 py-1.5 text-[12px] font-black text-[#8a6500] hover:bg-[#fff3cd] disabled:cursor-wait disabled:opacity-60" className="flex flex-wrap items-center gap-2 border-b border-[#f3e3b3] bg-[#fffaf0] px-4 py-2 text-[12px] font-semibold text-[#596273] md:px-6 lg:px-8">
          <label htmlFor="development-role" className="text-[#8a6500]">開発用ロール切り替え</label>
          <select key={context.role} id="development-role" name="role" defaultValue={context.role === "department_admin_sales_rep" ? context.role : LEGACY_UI_OPTION} className="h-8 rounded-[9px] border border-[#e4e8ef] bg-white px-2 text-[12px] font-bold text-[#343b48]">
            {authRoles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}<option value={LEGACY_UI_OPTION}>{LEGACY_UI_LABEL}</option>
          </select>
          <span>現在：{context.role === "department_admin_sales_rep" ? roleLabels[context.role] : `${LEGACY_UI_LABEL}（${roleLabels[context.role]}の権限）`}</span>
        </DevelopmentRoleForm>}
        <main className="manager-main min-w-0 overflow-x-hidden bg-[#f6f7f9] pb-5">{children}</main>
      </div>
    </div>
  </div>;
}
