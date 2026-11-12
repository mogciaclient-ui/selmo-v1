import Image from "next/image";
import Link from "next/link";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { roleLabels } from "@/lib/auth/roles";
import type { AuthRole } from "@/lib/auth/types";
import { managerNavGroups } from "./manager-nav";

const hasMascot = existsSync(join(process.cwd(), "public", "sels1.png"));

export function ManagerSidebarContent({ role, active, displayName, department }: { role: AuthRole; active: string; displayName: string; department?: string }) {
  return <>
    <div className="text-[13px] font-semibold tracking-[0.34em] text-[#171717]">selmo<span className="text-[#ffc400]">.</span></div>
    <div className="mt-2 text-[11px] uppercase tracking-[0.24em] text-[#9aa1ad]">manager console</div>
    {hasMascot && <div className="mt-8 px-4 py-5"><Image src="/sels1.png" alt="selmo" width={112} height={112} className="mx-auto h-auto w-[112px] object-contain" /></div>}
    <nav className="mt-7 space-y-6">
      {managerNavGroups(role).map((group) => <div key={group.label}>
        <div className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#a3aab5]">{group.label}</div>
        <div className="space-y-2">{group.items.map((item) => {
          const current = item.match.includes(active);
          return <Link key={item.href} href={item.href} aria-current={current ? "page" : undefined} className={`group flex items-center gap-2.5 rounded-[18px] px-3 py-3.5 text-[14px] font-medium transition ${current ? "bg-[linear-gradient(180deg,#fff2c8_0%,#ffe7a0_100%)] text-[#171717] shadow-[0_8px_18px_rgba(245,189,7,0.18)]" : "text-[#616875] hover:bg-[#f7f7fa] hover:text-[#171717]"}`}>
            <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black transition ${current ? "bg-white text-[#d79d00]" : "bg-[#f1f2f5] text-[#8d94a1] group-hover:text-[#171717]"}`}>{item.number}</span>
            <span className="min-w-0 flex-1 truncate whitespace-nowrap">{item.label}</span>
            <span className={`text-[12px] transition ${current ? "text-[#d79d00]" : "text-[#c6ccd5] group-hover:text-[#8d94a1]"}`}>›</span>
          </Link>;
        })}</div>
      </div>)}
    </nav>
    <div className="mt-8 rounded-[20px] border border-[#e8ebf0] bg-white px-4 py-3.5 shadow-[0_8px_22px_rgba(17,24,39,0.04)]">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#fff1bf] text-[14px] font-black text-[#8a6500]">{displayName.slice(0, 1)}</div>
        <div className="min-w-0 flex-1"><div className="truncate text-[14px] font-semibold text-[#20242c]">{displayName}</div><div className="mt-0.5 truncate text-[12px] text-[#7d8490]">旧selmo（{roleLabels[role]}）{department ? `・${department}` : ""}</div></div>
        <form action={signOut}><button aria-label="ログアウト" title="ログアウト" className="rounded-lg p-1.5 text-[#9aa1ad] transition hover:bg-[#f7f7fa] hover:text-[#171717]"><LogOut size={16} /></button></form>
      </div>
    </div>
  </>;
}
