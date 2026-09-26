import type { LucideIcon } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";

export function FeaturePage({ active, eyebrow, title, description, icon: Icon, displayName, department, children }: { active: string; eyebrow: string; title: string; description: string; icon: LucideIcon; displayName: string; department?: string; children?: React.ReactNode }) {
  return <AppShell active={active} displayName={displayName} department={department}><div className="mx-auto max-w-6xl p-4 pb-24 md:p-8"><section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"><div className="grid size-12 place-items-center rounded-xl bg-amber-50 text-amber-800"><Icon size={23} /></div><p className="mt-5 text-xs font-bold text-amber-800">{eyebrow}</p><h1 className="mt-1 text-2xl font-bold">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">{description}</p>{children}</section></div></AppShell>;
}
