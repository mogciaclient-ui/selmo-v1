"use client";

import { useState } from "react";

type Tab = "recent" | "pickups" | "consideration" | "processing" | "todo";
const additionalTabs = [{ id: "consideration", label: "検討リスト" }, { id: "processing", label: "処理一覧" }, { id: "todo", label: "ToDoリスト" }] as const;

export function InformationTabs({ initialTab, recentCount, pickupCount, recentScope, recentContent, pickupContent, todoContent, todoCount, considerationContent, considerationCount, processingContent, processingCount }: { considerationContent: React.ReactNode; considerationCount: number; processingContent: React.ReactNode; processingCount: number; todoContent: React.ReactNode; todoCount: number; initialTab: Tab; recentCount: number; pickupCount: number; recentScope: string; recentContent: React.ReactNode; pickupContent: React.ReactNode }) {
  const [active, setActive] = useState<Tab>(initialTab);
  const description = active === "recent"
    ? `${recentScope}の、活動日が14日前以降の日報です。活動実績／活動予定は下の絞り込みで切り替えられます。`
    : active === "pickups" ? "今月重点的に対応する顧客と、訪問予定・実績・日報の状況を確認できます。" : "";

  return <>
    <div className="flex min-w-0 max-w-full gap-1 overflow-x-auto overscroll-x-contain border-b border-slate-100 bg-slate-50 px-4 pt-3 text-xs font-semibold" role="tablist" aria-label="営業活動の情報">
      <TabButton active={active === "recent"} count={recentCount} onClick={() => setActive("recent")}>新着活動一覧</TabButton>
      <TabButton active={active === "pickups"} count={pickupCount} onClick={() => setActive("pickups")}>今月のピックアップ</TabButton>
      {additionalTabs.map(tab => <TabButton key={tab.id} count={tab.id === "todo" ? todoCount : tab.id === "consideration" ? considerationCount : processingCount} active={active === tab.id} onClick={() => setActive(tab.id)}>{tab.label}</TabButton>)}
    </div>
    {description && <p className="border-b border-amber-100 bg-amber-50/60 px-5 py-3 text-xs leading-5 text-amber-950">{description}</p>}
    <div role="tabpanel">{active === "recent" ? recentContent : active === "pickups" ? pickupContent : active === "todo" ? todoContent : active === "consideration" ? considerationContent : processingContent}</div>
  </>;
}

function TabButton({ active, count, onClick, children }: { active: boolean; count?: number; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-t-lg border border-b-0 px-4 py-2.5 transition-colors ${active ? "border-amber-300 bg-white text-amber-900" : "border-transparent text-slate-500 hover:bg-white/70 hover:text-slate-800"}`}>{children}{count !== undefined && <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">{count}</span>}</button>;
}
