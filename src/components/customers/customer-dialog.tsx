"use client";

import { useActionState, useEffect, useRef } from "react";
import { LoaderCircle, Pencil, Plus, Trash2, X } from "lucide-react";
import { deleteCustomer, type CustomerActionState, upsertCustomer } from "@/app/customers/actions";
import type { Customer } from "@/domain/customers/types";

type Department = { id: string; name: string };
const initialState: CustomerActionState = {};

export function CustomerDialog({ departments, customer }: { departments: Department[]; customer?: Customer }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [saveState, saveAction, savePending] = useActionState(upsertCustomer, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteCustomer, initialState);
  useEffect(() => { if (saveState.success || deleteState.success) ref.current?.close(); }, [deleteState.success, saveState.success]);
  return <>
    <button type="button" onClick={() => ref.current?.showModal()} className={customer ? "rounded-lg p-2 text-slate-400 hover:bg-amber-50 hover:text-amber-800" : "flex items-center gap-2 rounded-xl bg-[#f2c94c] px-4 py-2.5 text-sm font-semibold text-slate-900"}>{customer ? <Pencil size={17} /> : <><Plus size={18} />顧客を追加</>}</button>
    <dialog ref={ref} aria-labelledby={`customer-dialog-title-${customer?.id ?? "new"}`} className="m-auto w-[min(600px,calc(100%-2rem))] rounded-2xl border border-slate-200 bg-white p-0 text-[#18212f] shadow-2xl backdrop:bg-slate-950/40">
      <form action={saveAction} className="p-6">
        <div className="mb-6 flex items-start justify-between"><div><p className="text-xs font-semibold text-amber-800">顧客管理</p><h2 id={`customer-dialog-title-${customer?.id ?? "new"}`} className="mt-1 text-xl font-bold">{customer ? "顧客情報を編集" : "新しい顧客を登録"}</h2></div><button type="button" aria-label="閉じる" onClick={() => ref.current?.close()} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={20} /></button></div>
        <input type="hidden" name="id" value={customer?.id ?? ""} />
        <div className="space-y-4">
          <label className="block text-sm font-semibold">担当部門<select name="departmentId" defaultValue={customer?.departmentId ?? departments[0]?.id} required className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-normal"><option value="" disabled>部門を選択</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          <Field label="顧客名・会社名" name="name" value={customer?.name} required />
          <div className="grid gap-4 sm:grid-cols-2"><Field label="電話番号" name="phone" value={customer?.phone ?? undefined} /><Field label="住所" name="address" value={customer?.address ?? undefined} /></div>
          <label className="block text-sm font-semibold">メモ<textarea name="notes" defaultValue={customer?.notes ?? ""} rows={4} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal outline-none focus:border-amber-500" /></label>
          {(saveState.message || deleteState.message) && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{saveState.message ?? deleteState.message}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" onClick={() => ref.current?.close()} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600">キャンセル</button><button disabled={savePending || deletePending} className="flex min-w-24 items-center justify-center gap-2 rounded-xl bg-[#f2c94c] px-5 py-2.5 text-sm font-semibold text-slate-900 disabled:opacity-50">{savePending && <LoaderCircle size={17} className="animate-spin" />}保存する</button></div>
      </form>
      {customer && <form action={deleteAction} onSubmit={(e) => { if (!window.confirm("この顧客を削除しますか？関連する予定の顧客情報は未設定になります。")) e.preventDefault(); }} className="absolute bottom-6 left-6"><input type="hidden" name="id" value={customer.id} /><button disabled={savePending || deletePending} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">{deletePending ? <LoaderCircle size={17} className="animate-spin" /> : <Trash2 size={17} />}削除</button></form>}
    </dialog>
  </>;
}

function Field({ label, name, value, required }: { label: string; name: string; value?: string; required?: boolean }) {
  return <label className="block text-sm font-semibold">{label}<input name={name} defaultValue={value ?? ""} required={required} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 font-normal outline-none focus:border-amber-500" /></label>;
}
