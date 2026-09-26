"use client";

import { useActionState, useEffect, useRef } from "react";
import { FileCheck2, LoaderCircle, X } from "lucide-react";
import { submitActivityResult, type ResultActionState } from "@/app/results/actions";
import type { DashboardActivity } from "@/domain/dashboard/types";

const initial: ResultActionState = {};
export function ResultDialog({ activity }: { activity: DashboardActivity }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(submitActivityResult, initial);
  useEffect(() => { if (state.success) ref.current?.close(); }, [state.success]);
  return <><button onClick={() => ref.current?.showModal()} className="rounded-xl bg-[#f2c94c] px-4 py-2 text-xs font-semibold text-slate-900">{activity.result ? "結果を編集" : "結果を入力"}</button><dialog ref={ref} aria-labelledby={`result-title-${activity.id}`} className="m-auto w-[min(600px,calc(100%-2rem))] rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/40"><form action={action} className="p-6"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold text-amber-800">活動結果</p><h2 id={`result-title-${activity.id}`} className="mt-1 text-xl font-bold">{activity.title}</h2><p className="mt-1 text-sm text-slate-400">{activity.customerName ?? "顧客未設定"}</p></div><button type="button" aria-label="閉じる" onClick={() => ref.current?.close()} className="p-2 text-slate-400"><X size={20} /></button></div><input type="hidden" name="id" value={activity.id} /><label className="mt-6 block text-sm font-semibold">結果・次回アクション<textarea name="result" defaultValue={activity.result ?? ""} required rows={8} placeholder="商談内容、顧客の反応、次回アクションを記録" className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal outline-none focus:border-amber-500" /></label>{state.message && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.message}</p>}<div className="mt-5 flex justify-end"><button disabled={pending} className="flex items-center gap-2 rounded-xl bg-[#f2c94c] px-5 py-2.5 text-sm font-semibold text-slate-900 disabled:opacity-50">{pending ? <LoaderCircle size={17} className="animate-spin" /> : <FileCheck2 size={17} />}保存する</button></div></form></dialog></>;
}
