"use client";

import { useActionState, useRef, useState } from "react";
import { FilePenLine, LoaderCircle, X } from "lucide-react";
import { createActivityMemo, type CreateActivityState } from "@/app/activities/actions";

type DepartmentOption = { id: string; name: string };

export function ActivityMemoDialog({ departments, defaultDate }: { departments: DepartmentOption[]; defaultDate: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(createActivityMemo, {} as CreateActivityState);
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? "");

  return <>
    <button type="button" onClick={() => dialogRef.current?.showModal()} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-amber-50"><FilePenLine size={17} className="text-amber-700" />活動メモ登録</button>
    <dialog ref={dialogRef} aria-labelledby="activity-memo-title" className="m-auto w-[min(680px,calc(100%-2rem))] rounded-2xl border border-slate-200 bg-white p-0 text-[#18212f] shadow-2xl backdrop:bg-slate-950/40">
      <form action={action} className="max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-5"><div><p className="text-xs font-semibold text-amber-800">活動メモ</p><h2 id="activity-memo-title" className="mt-1 text-lg font-bold">活動メモを登録</h2></div><button type="button" onClick={() => dialogRef.current?.close()} aria-label="閉じる" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={20} /></button></div>
        <div className="space-y-5 p-6">
          <label className="block text-sm font-semibold">顧客名<span className="ml-1 text-red-500">*</span><input name="customerName" required maxLength={200} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 font-normal outline-none focus:border-amber-500" /></label>
          <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold">担当部門<select name="departmentId" required value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-normal outline-none focus:border-amber-500">{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label><label className="block text-sm font-semibold">活動日<input name="date" type="date" defaultValue={defaultDate} required className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 font-normal outline-none focus:border-amber-500" /></label></div>
          <div className="grid grid-cols-2 gap-4"><label className="block text-sm font-semibold">開始<input name="startTime" type="time" defaultValue="10:00" required className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 font-normal outline-none focus:border-amber-500" /></label><label className="block text-sm font-semibold">終了<input name="endTime" type="time" defaultValue="11:00" required className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 font-normal outline-none focus:border-amber-500" /></label></div>
          <label className="block text-sm font-semibold">活動詳細<span className="ml-1 text-red-500">*</span><textarea name="details" required rows={8} maxLength={5000} placeholder="訪問・電話・打ち合わせの内容、先方の反応、次の対応など" className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal leading-6 outline-none focus:border-amber-500" /></label>
          {state.message && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.message}</p>}
        </div>
        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4"><button type="button" onClick={() => dialogRef.current?.close()} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600">キャンセル</button><button disabled={pending || !departmentId} className="flex min-w-28 items-center justify-center gap-2 rounded-xl bg-[#f2c94c] px-5 py-2.5 text-sm font-semibold text-slate-900 disabled:opacity-50">{pending && <LoaderCircle size={17} className="animate-spin" />}{pending ? "登録中" : "登録する"}</button></div>
      </form>
    </dialog>
  </>;
}
