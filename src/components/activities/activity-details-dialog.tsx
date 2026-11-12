"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Bot, BriefcaseBusiness, CalendarDays, Clock3, LoaderCircle, MapPin, Pencil, Trash2, X } from "lucide-react";
import Link from "next/link";
import { deleteActivity, type MutateActivityState, updateActivity } from "@/app/activities/actions";
import type { DashboardActivity } from "@/domain/dashboard/types";
import { activityTypeLabel } from "@/domain/activities/labels";
import { categoryOptions, completionLabel, customerTypes, defaultScheduleType, isMissingResult, scheduleTypeLabels, type ScheduleCategory } from "@/domain/schedules/rules";

const initialState: MutateActivityState = {};

export function ActivityDetailsDialog({ activity, variant = "calendar", canManage = false }: { activity: DashboardActivity; variant?: "calendar" | "list" | "button"; calendarView?: "month" | "week"; canManage?: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState(false);
  const [updateState, updateAction, updatePending] = useActionState(updateActivity, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteActivity, initialState);
  const headingId = useId();
  const [category, setCategory] = useState<ScheduleCategory>(activity.scheduleDetails?.category === "non_sales" || activity.scheduleDetails?.category === "accompaniment" ? activity.scheduleDetails.category : "sales");
  const [activityType, setActivityType] = useState(scheduleTypeLabels[activity.activityType] ? activity.activityType : "visit");
  const [product, setProduct] = useState(String(activity.scheduleDetails?.product ?? ""));
  const [products, setProducts] = useState<string[]>([]);
  const [productError, setProductError] = useState("");
  useEffect(() => {
    if (!editing) return;
    const controller = new AbortController();
    fetch("/api/products/options", { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("商材マスタを取得できませんでした。");
      const body = await response.json(); setProducts(body.products);
    }).catch(error => { if (!controller.signal.aborted) setProductError(error.message); });
    return () => controller.abort();
  }, [editing]);
  const overdue = isMissingResult(activity);
  const stateLabel = completionLabel(activity);
  const busy = updatePending || deletePending;

  useEffect(() => {
    if (updateState.success || deleteState.success) {
      dialogRef.current?.close();
    }
  }, [deleteState.success, updateState.success]);

  const date = toTokyoDate(activity.startsAt);
  const startTime = toTokyoTime(activity.startsAt);
  const endTime = toTokyoTime(activity.endsAt);
  const opportunityHref = opportunityDetailHref(activity);
  function openDialog() {
    setEditing(false);
    dialogRef.current?.showModal();
  }

  return (
    <>
      <button type="button" onClick={openDialog} className={`block w-full rounded-lg border p-2 text-left text-xs transition ${overdue ? "border-red-300 bg-red-50 text-red-800 hover:bg-red-100" : "border-slate-200 bg-white text-slate-800 hover:bg-amber-50"} ${variant === "button" ? "w-auto" : ""}`}>
        <span className="block font-bold tabular-nums">{startTime}〜{endTime}</span>
        <span className="mt-1 block truncate font-bold">{activity.customerName ?? "顧客未設定"}</span>
        <span className="mt-1 block truncate">{String(activity.scheduleDetails?.area ?? activity.scheduleDetails?.location ?? "エリア未設定")} · {String(activity.scheduleDetails?.customerType ?? "顧客種別未設定")}</span>
        <span className={`mt-1 block text-[10px] font-bold ${overdue ? "text-red-700" : "text-slate-500"}`}>{stateLabel}{overdue ? "・結果未入力" : ""}</span>
      </button>

      <dialog ref={dialogRef} onClose={() => setEditing(false)} aria-labelledby={headingId} className="m-auto w-[min(560px,calc(100%-2rem))] rounded-2xl border border-slate-200 bg-white p-0 text-[#18212f] shadow-2xl backdrop:bg-slate-950/40">
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs font-semibold text-amber-800">予定の詳細</p><h2 id={headingId} className="mt-1 text-xl font-bold">{activity.title}</h2></div>
            <button type="button" onClick={() => dialogRef.current?.close()} aria-label="閉じる" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
          </div>
        </div>

        {editing ? (
          <form action={updateAction} className="p-6">
            <input type="hidden" name="id" value={activity.id} />
            <div className="space-y-5">
              <label className="block text-sm font-bold">カテゴリー<select name="category" required value={category} onChange={event => { const value = event.target.value as ScheduleCategory; setCategory(value); setActivityType(defaultScheduleType(value)); }} className="mt-2 h-11 w-full rounded-xl border px-3">{Object.entries(categoryOptions).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select></label>
              <label className="block text-sm font-bold">活動種別<select name="activityType" required value={activityType} onChange={event => setActivityType(event.target.value)} className="mt-2 h-11 w-full rounded-xl border px-3"><option value="">選択してください</option>{categoryOptions[category].types.map(type => <option key={type} value={type}>{scheduleTypeLabels[type]}</option>)}</select></label>
              <label className="block text-sm font-bold">顧客種別<select name="customerType" defaultValue={String(activity.scheduleDetails?.customerType ?? "")} className="mt-2 h-11 w-full rounded-xl border px-3"><option value="">選択してください</option>{customerTypes.map(type => <option key={type}>{type}</option>)}</select></label>
              <Field label="エリア" name="area" defaultValue={String(activity.scheduleDetails?.area ?? activity.scheduleDetails?.location ?? "")}/>
              <label className="block text-sm font-bold">商材<select name="product" value={product} onChange={event => setProduct(event.target.value)} className="mt-2 h-11 w-full rounded-xl border px-3"><option value="">選択してください</option>{[...new Set([product, ...products].filter(Boolean))].map(name => <option key={name}>{name}</option>)}</select></label>{productError && <p role="alert" className="text-sm text-red-600">{productError}</p>}

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
              <p className={`rounded-lg p-3 text-sm font-bold ${overdue ? "bg-red-50 text-red-700" : "bg-slate-50"}`}>{stateLabel}</p>
              <Detail icon={Clock3} label="時間" value={`${startTime}〜${endTime}`} />
              <div className="rounded-xl bg-slate-50 px-4 py-3"><p className="text-xs font-semibold text-slate-400">活動種別</p><p className="mt-1 text-sm font-semibold">{activityTypeLabel(activity.activityType)}</p></div>
              {(activity.scheduleDetails?.area || activity.scheduleDetails?.location) && <div className="rounded-xl bg-slate-50 px-4 py-3"><p className="text-xs font-semibold text-slate-400">エリア</p><p className="mt-1 text-sm font-semibold">{String(activity.scheduleDetails.area ?? activity.scheduleDetails.location)}</p></div>}
              {activity.scheduleDetails?.notes && <div className="rounded-xl bg-slate-50 px-4 py-3"><p className="text-xs font-semibold text-slate-400">備考</p><p className="mt-1 whitespace-pre-wrap text-sm">{String(activity.scheduleDetails.notes)}</p></div>}
              {(activity.scheduleDetails?.product || activity.commonReport?.product) && <div className="rounded-xl bg-slate-50 px-4 py-3"><p className="text-xs font-semibold text-slate-400">商材</p><p className="mt-1 text-sm font-semibold">{activity.scheduleDetails?.product || activity.commonReport?.product}</p></div>}
              {activity.commonReport?.salesProcess && <div className="rounded-xl bg-slate-50 px-4 py-3"><p className="text-xs font-semibold text-slate-400">営業プロセス</p><p className="mt-1 text-sm font-semibold">{activity.commonReport.salesProcess}</p></div>}
              {(activity.commonReport?.progressStep ?? activity.scheduleDetails?.progressStep) && <div className="rounded-xl bg-slate-50 px-4 py-3"><p className="text-xs font-semibold text-slate-400">進行工程</p><p className="mt-1 text-sm font-semibold">{activity.commonReport?.progressStep ?? activity.scheduleDetails?.progressStep}</p></div>}
              {activity.commonReport?.activityStatus && <div className="rounded-xl bg-slate-50 px-4 py-3"><p className="text-xs font-semibold text-slate-400">活動ステータス</p><p className="mt-1 text-sm font-semibold">{activity.commonReport.activityStatus}</p></div>}
              {activity.aiAnalysisSummary && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"><p className="flex items-center gap-2 text-xs font-bold text-amber-800"><Bot size={15} />AI分析の要約</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{activity.aiAnalysisSummary}</p></div>}
              {(updateState.message || deleteState.message) && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{updateState.message ?? deleteState.message}</p>}
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {opportunityHref && <Link href={opportunityHref} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-amber-300 hover:bg-amber-50"><BriefcaseBusiness size={16} />過去の活動内容</Link>}
            </div>
            {canManage && <Link href={`/activities/${activity.id}/report`} className="mt-5 block rounded-xl bg-amber-100 p-3 text-center text-sm font-bold text-amber-900">活動詳細・結果入力へ</Link>}
            {canManage && <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
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

function Field({ label, name, type = "text", defaultValue, required }: { label: string; name: string; type?: string; defaultValue: string; required?: boolean }) {
  const id = useId();
  return <div><label htmlFor={id} className="mb-2 block text-sm font-semibold">{label}</label><input id={id} name={name} type={type} defaultValue={defaultValue} required={required} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-amber-500" /></div>;
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
