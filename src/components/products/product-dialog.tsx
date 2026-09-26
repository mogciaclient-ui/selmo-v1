"use client";

import { useActionState, useEffect, useRef } from "react";
import { LoaderCircle, Plus, X } from "lucide-react";
import { saveProduct, type ProductActionState } from "@/app/products/actions";

export type Product = { id?: string; name: string; nameKana?: string | null; modelNumber?: string | null; price?: number | null; size?: string | null; weight?: string | null; capacity?: string | null; color?: string | null; manufacturerName?: string | null; manufacturerUrl?: string | null; description?: string | null; notes?: string | null; actionProcess?: string | null; status: "active" | "inactive" };
const initial: ProductActionState = {};

export function ProductDialog({ product, canEdit = true }: { product?: Product; canEdit?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(saveProduct, initial);
  useEffect(() => { if (state.success) ref.current?.close(); }, [state.success]);
  return <><button type="button" onClick={() => ref.current?.showModal()} className={product ? "rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:border-amber-400" : "inline-flex items-center gap-2 rounded-xl bg-[#f2c94c] px-4 py-2.5 text-sm font-bold text-slate-900"}>{product ? "詳細情報" : <><Plus size={18}/>商材登録</>}</button>
    <dialog ref={ref} className="m-auto w-[min(900px,calc(100%-2rem))] rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/40">
      <form action={action} className="max-h-[90vh] overflow-y-auto p-5 md:p-7">
        <div className="flex items-start justify-between"><div><p className="text-xs font-bold text-amber-800">PRODUCT</p><h2 className="mt-1 text-xl font-bold">{product ? "商材詳細" : "商材登録"}</h2><p className="mt-1 text-sm text-slate-400">商材の基本情報を入力してください。<span className="text-red-500">＊</span>は必須項目です。</p></div><button type="button" onClick={() => ref.current?.close()} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={20}/></button></div>
        <input type="hidden" name="id" value={product?.id ?? ""}/>
        <section className="mt-6 rounded-xl border border-slate-200"><h3 className="border-b bg-slate-50 px-4 py-3 text-sm font-bold">基本情報</h3><div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field name="name" label="商材名＊" value={product?.name} required/><Field name="nameKana" label="商材名［カナ］" value={product?.nameKana} hint="全角カタカナで入力"/><Field name="modelNumber" label="型番" value={product?.modelNumber}/><Field name="price" label="価格" value={product?.price == null ? "" : String(product.price)} type="number" suffix="円"/><Field name="size" label="サイズ" value={product?.size}/><Field name="weight" label="重量" value={product?.weight}/><Field name="capacity" label="容量" value={product?.capacity}/><Field name="color" label="色" value={product?.color}/><Field name="manufacturerName" label="メーカー名" value={product?.manufacturerName}/><Field name="manufacturerUrl" label="メーカーURL" value={product?.manufacturerUrl} type="url"/><Field name="actionProcess" label="行動プロセス" value={product?.actionProcess}/>
          <Area name="description" label="商材説明" value={product?.description}/><Area name="notes" label="備考" value={product?.notes}/>
        </div></section>
        <section className="mt-4 rounded-xl border border-slate-200"><h3 className="border-b bg-slate-50 px-4 py-3 text-sm font-bold">状態</h3><div className="flex gap-5 p-4 text-sm"><Radio value="active" label="有効" current={product?.status ?? "active"}/><Radio value="inactive" label="無効" current={product?.status ?? "active"}/></div></section>
        {state.message && <p className={`mt-4 rounded-lg p-3 text-sm ${state.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{state.message}</p>}
        <div className="mt-6 flex items-center justify-between"><button type="button" onClick={() => ref.current?.close()} className="text-sm font-bold text-slate-500">商材リストへ戻る</button>{canEdit && <button disabled={pending} className="inline-flex items-center gap-2 rounded-xl bg-[#f2c94c] px-6 py-2.5 text-sm font-bold disabled:opacity-50">{pending && <LoaderCircle size={17} className="animate-spin"/>}保存する</button>}</div>
      </form>
    </dialog></>;
}
function Field({ name, label, value, type = "text", required, hint, suffix }: { name: string; label: string; value?: string | null; type?: string; required?: boolean; hint?: string; suffix?: string }) { return <label className="text-xs font-bold text-slate-500">{label}<div className="mt-1.5 flex items-center gap-2"><input name={name} defaultValue={value ?? ""} type={type} required={required} min={type === "number" ? 0 : undefined} readOnly={false} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-amber-500"/>{suffix && <span>{suffix}</span>}</div>{hint && <span className="mt-1 block text-[10px] font-normal text-slate-400">{hint}</span>}</label>; }
function Area({ name, label, value }: { name: string; label: string; value?: string | null }) { return <label className="text-xs font-bold text-slate-500 sm:col-span-2">{label}<textarea name={name} defaultValue={value ?? ""} rows={3} className="mt-1.5 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal outline-none focus:border-amber-500"/></label>; }
function Radio({ value, label, current }: { value: string; label: string; current: string }) { return <label className="inline-flex items-center gap-2"><input type="radio" name="status" value={value} defaultChecked={current === value} className="size-4 accent-amber-500"/>{label}</label>; }
