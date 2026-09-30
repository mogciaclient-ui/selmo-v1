"use client";

import { useState } from "react";

type Tab = "recent" | "pickups";

export function InformationTabs({ initialTab, recentCount, pickupCount, recentScope, recentContent, pickupContent }: { initialTab: Tab; recentCount: number; pickupCount: number; recentScope: string; recentContent: React.ReactNode; pickupContent: React.ReactNode }) {
  const [active, setActive] = useState<Tab>(initialTab);
  const description = active === "recent"
    ? `${recentScope}の、活動日が14日前以降の日報です。活動実績／活動予定は下の絞り込みで切り替えられます。`
    : "今月重点的に対応する顧客と、訪問予定・実績・日報の状況を確認できます。";

  return <>
    <div className="flex gap-1 overflow-x-auto border-b border-slate-100 bg-slate-50 px-4 pt-3 text-xs font-semibold" role="tablist" aria-label="営業活動の情報">
      <TabButton active={active === "recent"} count={recentCount} onClick={() => setActive("recent")}>新着活動一覧</TabButton>
      <TabButton active={active === "pickups"} count={pickupCount} onClick={() => setActive("pickups")}>今月のピックアップ</TabButton>
      {['活動コメント', 'アラート', 'メッセージ', '活動メモ'].map((label) => <span key={label} title="準備中" className="cursor-not-allowed whitespace-nowrap rounded-t-lg border border-b-0 border-transparent px-4 py-2.5 text-slate-300">{label}<span className="ml-1 text-[9px]">準備中</span></span>)}
    </div>
    <p className="border-b border-amber-100 bg-amber-50/60 px-5 py-3 text-xs leading-5 text-amber-950">{description}</p>
    <div role="tabpanel">{active === "recent" ? recentContent : pickupContent}</div>
  </>;
}

function TabButton({ active, count, onClick, children }: { active: boolean; count: number; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`whitespace-nowrap rounded-t-lg border border-b-0 px-4 py-2.5 transition-colors ${active ? "border-amber-300 bg-white text-amber-900" : "border-transparent text-slate-500 hover:bg-white/70 hover:text-slate-800"}`}>{children}<span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">{count}</span></button>;
}
