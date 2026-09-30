"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Bot, BriefcaseBusiness, CalendarDays, Clock3, FilePenLine, LoaderCircle, MapPin, Pencil, Trash2, X } from "lucide-react";
import Link from "next/link";
import { deleteActivity, type MutateActivityState, updateActivity } from "@/app/activities/actions";
import type { DashboardActivity } from "@/domain/dashboard/types";
import { activityTypeLabel } from "@/domain/activities/labels";
import { ActivityAnalysisDialog } from "@/components/activities/activity-analysis-dialog";

const initialState: MutateActivityState = {};

export function ActivityDetailsDialog({ activity, variant = "calendar", calendarView = "month", canManage = false }: { activity: DashboardActivity; variant?: "calendar" | "list" | "button"; calendarView?: "month" | "week"; canManage?: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState(false);
  const [updateState, updateAction, updatePending] = useActionState(updateActivity, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteActivity, initialState);
  const busy = updatePending || deletePending;

  useEffect(() => {
    if (updateState.success || deleteState.success) {
      dialogRef.current?.close();
    }
  }, [deleteState.success, updateState.success]);

  const date = toTokyoDate(activity.startsAt);
  const startTime = toTokyoTime(activity.startsAt);
  const endTime = toTokyoTime(activity.endsAt);
  const customerKey = activity.customerExternalId ?? activity.customerId;
  const opportunityHref = opportunityDetailHref(activity);
  function openDialog() {
    setEditing(false);
    dialogRef.current?.showModal();
  }

  return (
    <>
      {variant === "calendar" ? (
        calendarView === "month" ? (
          <button type="button" onClick={() => openDialog()} className="flex w-full items-center gap-2 border-b border-slate-200 py-1.5 text-left transition hover:bg-amber-50/50">
            <span className="w-9 shrink-0 text-[10px] font-bold tabular-nums text-slate-500 md:text-[11px]">{startTime}</span>
            <span className="min-w-0 flex-1 truncate text-[11px] font-bold leading-tight text-slate-900 md:text-xs">{activity.customerName ?? activity.title}</span>
          </button>
        ) : <div className="group flex items-center gap-2 border-b border-slate-200 py-2 transition hover:bg-amber-50/50">
          <button type="button" onClick={() => openDialog()} className="w-9 shrink-0 text-left text-[10px] font-bold tabular-nums text-slate-500 md:text-[11px]">{startTime}</button>
          <div className="min-w-0 flex-1">
            {customerKey ? <Link href={`/customers/${customerKey}`} className="block truncate text-[11px] font-bold leading-tight text-slate-900 hover:text-amber-800 md:text-xs">{activity.customerName ?? "顧客未設定"}</Link> : <span className="block truncate text-[11px] font-bold leading-tight text-slate-900 md:text-xs">{activity.customerName ?? "顧客未設定"}</span>}
            <button type="button" onClick={() => openDialog()} className="block w-full text-left"><span className="mt-0.5 block truncate text-[10px] font-medium leading-tight text-slate-500 md:text-[11px]">{activity.title}</span></button>
          </div>
          <div className="flex max-w-[60px] shrink-0 flex-wrap items-center justify-end gap-1">
              {opportunityHref && <CalendarAction href={opportunityHref} icon={BriefcaseBusiness} label="過去の活動内容" tone="sky"/>}
              {canManage && <CalendarAction href={`/activities/${activity.id}/report`} icon={FilePenLine} label="活動登録" tone="orange"/>}
              {activity.commonReport?.aiAnalysisStatus === "completed" && <ActivityAnalysisDialog activityId={activity.id}/>} 
          </div>
        </div>
      ) : variant === "list" ? (
        <button type="button" onClick={() => openDialog()} className="flex w-full gap-3 rounded-xl border border-slate-100 p-3 text-left hover:border-amber-200 hover:bg-amber-50/30">
          <div className="pt-0.5 text-sm font-bold text-[#f2c94c]">{startTime}</div>
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{activity.customerName ?? activity.title}</p><p className="mt-1 text-xs text-slate-400">{activityTypeLabel(activity.activityType)}</p></div>
        </button>
      ) : (
        <button type="button" onClick={() => openDialog()} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800">詳細</button>
      )}

      <dialog ref={dialogRef} onClose={() => setEditing(false)} aria-labelledby={`activity-title-${activity.id}`} className="m-auto w-[min(560px,calc(100%-2rem))] rounded-2xl border border-slate-200 bg-white p-0 text-[#18212f] shadow-2xl backdrop:bg-slate-950/40">
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs font-semibold text-amber-800">予定の詳細</p><h2 id={`activity-title-${activity.id}`} className="mt-1 text-xl font-bold">{activity.title}</h2></div>
            <button type="button" onClick={() => dialogRef.current?.close()} aria-label="閉じる" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
          </div>
        </div>

        {editing ? (
          <form action={updateAction} className="p-6">
            <input type="hidden" name="id" value={activity.id} />
            <div className="space-y-5">
              <Field label="予定名" name="title" defaultValue={activity.title} required />
              <div><label htmlFor={`activityType-${activity.id}`} className="mb-2 block text-sm font-semibold">活動種別</label><select id={`activityType-${activity.id}`} name="activityType" defaultValue={activity.activityType} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-amber-500"><option value="visit">訪問</option><option value="online">オンライン</option><option value="telephone">電話・テレアポ</option><option value="other">その他</option></select></div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="日付" name="date" type="date" defaultValue={date} required />
                <Field label="開始" name="startTime" type="time" defaultValue={startTime} required />
                <Field label="終了" name="endTime" type="time" defaultValue={endTime} required />
              </div>
              {updateState.message && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{updateState.message}</p>}
            </div>
            <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button type="button" onClick={() => setEditing(false)} disabled={busy} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600">キャンセル</button>
              <button type="submit" disabled={busy} className="flex min-w-28 items-center justify-center gap-2 rounded-xl bg-[#f2c94c] px-5 py-2.5 text-sm font-semibold text-slate-900 disabled:opacity-50">{updatePending && <LoaderCircle size={17} className="animate-spin" />}{updatePending ? "保存中" : "保存する"}</button>
            </div>
          </form>
        ) : (
          <div className="p-6">
            <div className="space-y-4">
              <Detail icon={MapPin} label="顧客" value={activity.customerName ?? "顧客未設定"} />
              <Detail icon={CalendarDays} label="日付" value={formatTokyoDate(activity.startsAt)} />
              <Detail icon={Clock3} label="時間" value={`${startTime}〜${endTime}`} />
              <div className="rounded-xl bg-slate-50 px-4 py-3"><p className="text-xs font-semibold text-slate-400">活動種別</p><p className="mt-1 text-sm font-semibold">{activityTypeLabel(activity.activityType)}</p></div>
              {activity.scheduleDetails?.location && <div className="rounded-xl bg-slate-50 px-4 py-3"><p className="text-xs font-semibold text-slate-400">場所</p><p className="mt-1 text-sm font-semibold">{String(activity.scheduleDetails.location)}</p></div>}
              {activity.scheduleDetails?.notes && <div className="rounded-xl bg-slate-50 px-4 py-3"><p className="text-xs font-semibold text-slate-400">備考</p><p className="mt-1 whitespace-pre-wrap text-sm">{String(activity.scheduleDetails.notes)}</p></div>}
              {activity.commonReport?.product && <div className="rounded-xl bg-slate-50 px-4 py-3"><p className="text-xs font-semibold text-slate-400">商材</p><p className="mt-1 text-sm font-semibold">{activity.commonReport.product}</p></div>}
              {activity.commonReport?.salesProcess && <div className="rounded-xl bg-slate-50 px-4 py-3"><p className="text-xs font-semibold text-slate-400">営業プロセス</p><p className="mt-1 text-sm font-semibold">{activity.commonReport.salesProcess}</p></div>}
              {(activity.commonReport?.progressStep ?? activity.scheduleDetails?.progressStep) && <div className="rounded-xl bg-slate-50 px-4 py-3"><p className="text-xs font-semibold text-slate-400">進行工程</p><p className="mt-1 text-sm font-semibold">{activity.commonReport?.progressStep ?? activity.scheduleDetails?.progressStep}</p></div>}
              {activity.commonReport?.activityStatus && <div className="rounded-xl bg-slate-50 px-4 py-3"><p className="text-xs font-semibold text-slate-400">活動ステータス</p><p className="mt-1 text-sm font-semibold">{activity.commonReport.activityStatus}</p></div>}
              {activity.aiAnalysisSummary && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"><p className="flex items-center gap-2 text-xs font-bold text-amber-800"><Bot size={15} />AI分析の要約</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{activity.aiAnalysisSummary}</p></div>}
              {(updateState.message || deleteState.message) && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{updateState.message ?? deleteState.message}</p>}
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {opportunityHref && <Link href={opportunityHref} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-amber-300 hover:bg-amber-50"><BriefcaseBusiness size={16} />過去の活動内容</Link>}
            </div>
            {canManage && <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
              <form action={deleteAction} onSubmit={(event) => { if (!window.confirm("この予定を削除しますか？この操作は取り消せません。")) event.preventDefault(); }}>
                <input type="hidden" name="id" value={activity.id} />
                <button type="submit" disabled={busy} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">{deletePending ? <LoaderCircle size={17} className="animate-spin" /> : <Trash2 size={17} />}削除</button>
              </form>
              <button type="button" onClick={() => setEditing(true)} disabled={busy} className="flex items-center gap-2 rounded-xl bg-[#f2c94c] px-5 py-2.5 text-sm font-semibold text-slate-900 disabled:opacity-50"><Pencil size={16} />編集する</button>
            </div>}
          </div>
        )}
      </dialog>
    </>
  );
}

function Detail({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-800"><Icon size={18} /></div><div><p className="text-xs font-semibold text-slate-400">{label}</p><p className="mt-0.5 text-sm font-semibold">{value}</p></div></div>;
}

const actionTone = {
  sky: "bg-sky-50 text-sky-700 ring-sky-200",
  orange: "bg-orange-50 text-orange-700 ring-orange-200",
} as const;

function CalendarAction({ href, icon: Icon, label, tone }: { href: string; icon: typeof CalendarDays; label: string; tone: keyof typeof actionTone }) {
  return <Link href={href} aria-label={label} className={`group/tool relative grid size-7 place-items-center rounded-md ring-1 ring-inset transition hover:-translate-y-px hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${actionTone[tone]}`}><Icon size={14}/><span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-950 px-2 py-1 text-[10px] font-bold text-white opacity-0 shadow-lg transition-opacity group-hover/tool:opacity-100 group-focus-visible/tool:opacity-100">{label}<span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-950"/></span></Link>;
}

function Field({ label, name, type = "text", defaultValue, required }: { label: string; name: string; type?: string; defaultValue: string; required?: boolean }) {
  return <div><label htmlFor={`${name}-${defaultValue}`} className="mb-2 block text-sm font-semibold">{label}</label><input id={`${name}-${defaultValue}`} name={name} type={type} defaultValue={defaultValue} required={required} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-amber-500" /></div>;
}

function toTokyoDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function toTokyoTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

function formatTokyoDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(new Date(value));
}

function opportunityDetailHref(activity: DashboardActivity) {
  const opportunityId = activity.scheduleDetails?.opportunityId;
  return typeof opportunityId === "string" && opportunityId ? `/opportunities/${opportunityId}?activityId=${activity.id}#activity-detail` : null;
}
