"use client";

import { useId, useRef } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import type { DashboardActivity } from "@/domain/dashboard/types";

export function DayActivityList({ date, activities, buttonLabel, buttonClassName, compact = false }: { date: string; activities: DashboardActivity[]; buttonLabel?: string; buttonClassName?: string; compact?: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  if (!activities.length) return null;

  return <>
    <button type="button" onClick={() => dialogRef.current?.showModal()} className={buttonClassName ?? (compact ? "whitespace-nowrap rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-[10px] font-bold text-sky-700 hover:bg-sky-100" : "rounded-md border border-amber-300 bg-amber-50 px-1.5 py-1 text-[10px] font-bold text-amber-900 hover:bg-amber-100")} aria-label={`${date}の予定一覧を開く`}>{compact ? `予定 ${activities.length}件` : buttonLabel ?? `予定一覧 ${activities.length}`}</button>
    <dialog ref={dialogRef} onClick={(event) => { if (event.target === dialogRef.current) dialogRef.current.close(); }} aria-labelledby={headingId} className="m-auto w-[min(720px,calc(100%-2rem))] max-h-[85vh] rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/40">
      <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4"><h2 id={headingId} className="text-lg font-bold">{date} の予定一覧 <span className="text-sm font-medium text-slate-500">{activities.length}件</span></h2><button type="button" onClick={() => dialogRef.current?.close()} aria-label="閉じる" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18}/></button></div>
      <div className="max-h-[calc(85vh-72px)] overflow-y-auto p-4">
        {activities.map((activity) => <div key={activity.id} className="mb-2 rounded-xl border border-slate-200 p-4 last:mb-0">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold text-amber-800">{time(activity.startsAt)}〜{time(activity.endsAt)}</p><p className="mt-1 font-bold text-slate-900">{activity.customerName ?? activity.title}</p>{activity.customerName && <p className="text-sm text-slate-600">{activity.title}</p>}</div><Link href={activityDetailHref(activity)} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-50">詳細情報</Link></div>
          {(activity.commonReport?.product || activity.commonReport?.salesProcess || activity.commonReport?.activityStatus || activity.scheduleDetails?.opportunityName) && <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-600">{activity.scheduleDetails?.opportunityName && <span>案件：{activity.scheduleDetails.opportunityName}</span>}{activity.commonReport?.product && <span>商材：{activity.commonReport.product}</span>}{(activity.commonReport?.salesProcess ?? activity.scheduleDetails?.salesProcess) && <span>営業プロセス：{activity.commonReport?.salesProcess ?? activity.scheduleDetails?.salesProcess}</span>}{activity.commonReport?.activityStatus && <span>ステータス：{activity.commonReport.activityStatus}</span>}</div>}
        </div>)}
      </div>
    </dialog>
  </>;
}

function time(value: string) { return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)); }
function activityDetailHref(activity: DashboardActivity) { const opportunityId = activity.scheduleDetails?.opportunityId; if (typeof opportunityId === "string" && opportunityId) return `/opportunities/${opportunityId}?activityId=${activity.id}#activity-detail`; const customerId = activity.customerExternalId ?? activity.customerId; return customerId ? `/customers/${customerId}?section=activities&activityId=${activity.id}#activities` : "/"; }
