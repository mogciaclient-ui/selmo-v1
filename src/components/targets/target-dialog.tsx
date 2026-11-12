"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveTarget } from "@/app/targets/actions";
import { targetTypes } from "@/domain/targets/rules";
import { CustomerRegistrationDialog } from "@/components/customers/customer-registration-dialog";
import type { CustomerSearchResult } from "@/domain/customers/types";

type Props = { month: string; products: string[]; departments: { id: string; name: string }[]; target?: {
  id: string; customer: CustomerSearchResult; customerType: string; product: string; estimatedProfit: number; note: string;
} };
const input = "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-normal";
export function TargetDialog({ month, products, departments, target }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const router = useRouter();
  const [state, action, pending] = useActionState(saveTarget, {});
  const [customer, setCustomer] = useState<CustomerSearchResult | null>(target?.customer ?? null);
  const [query, setQuery] = useState(target?.customer.name ?? "");
  const [matches, setMatches] = useState<CustomerSearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [registering, setRegistering] = useState(false);
  useEffect(() => {
    if (!state.success) return;
    ref.current?.close(); router.refresh();
  }, [state, router]);
  useEffect(() => {
    if (customer || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/customers/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!response.ok) throw new Error();
        const data = await response.json(); setMatches(data.customers); setSearched(true); setError("");
      } catch { if (!controller.signal.aborted) setError("顧客検索に失敗しました。再度入力してください。"); }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, customer]);
  function selectCustomer(value: CustomerSearchResult) { setCustomer(value); setQuery(value.name); setMatches([]); }
  const options = [...new Set([...products, ...(target?.product ? [target.product] : [])])];
  return <>
    <button type="button" onClick={() => ref.current?.showModal()} className={target ? "text-xs font-bold text-amber-800" : "rounded-lg bg-[#f2c94c] px-4 py-2.5 text-sm font-bold"}>{target ? "編集" : "ターゲットを追加"}</button>
    <dialog ref={ref} aria-labelledby={id} className="m-auto w-[min(640px,calc(100%-2rem))] rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/40">
      <form action={action} className="max-h-[90vh] overflow-y-auto p-6">
        <div className="mb-5 flex items-center justify-between"><h2 id={id} className="text-lg font-bold">{target ? "ターゲットの編集" : "ターゲットの登録"}</h2><button type="button" aria-label="閉じる" onClick={() => ref.current?.close()} className="px-2 py-1 text-lg">×</button></div>
        <input type="hidden" name="id" value={target?.id ?? ""}/><input type="hidden" name="customerId" value={customer?.id ?? ""}/>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold">対象月<input name="targetMonth" type="month" required defaultValue={month} className={input}/></label>
          <label className="text-sm font-bold">分類<select name="customerType" defaultValue={target?.customerType ?? "新規"} className={input}>{targetTypes.map(type => <option key={type}>{type}</option>)}</select></label>
          <div className="sm:col-span-2"><label className="text-sm font-bold" htmlFor={`${id}-customer`}>顧客</label><input id={`${id}-customer`} value={query} readOnly={Boolean(customer)} placeholder="顧客名を2文字以上入力" className={input} onChange={e => { setQuery(e.target.value); setMatches([]); setSearched(false); setError(""); }}/>
            {customer && <button type="button" className="mt-2 text-xs text-amber-800" onClick={() => { setCustomer(null); setQuery(""); setSearched(false); }}>顧客を選び直す</button>}
            {!customer && matches.length > 0 && <ul className="mt-2 max-h-40 overflow-y-auto rounded-lg border">{matches.map(value => <li key={value.id}><button type="button" onClick={() => selectCustomer(value)} className="w-full px-3 py-2 text-left text-sm hover:bg-amber-50">{value.name}</button></li>)}</ul>}
            {!customer && searched && !matches.length && <div className="mt-2 text-sm text-slate-500">該当する顧客がありません。<button type="button" className="ml-2 font-bold text-amber-800" onClick={() => setRegistering(true)}>顧客登録へ</button></div>}
            {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
          </div>
          <label className="text-sm font-bold">想定商材<select name="product" required defaultValue={target?.product ?? ""} className={input}><option value="">選択してください</option>{options.map(value => <option key={value}>{value}</option>)}</select>{!options.length && <span className="mt-1 block text-xs font-normal text-slate-500">管理者に商材マスタの登録を依頼してください。</span>}</label>
          <label className="text-sm font-bold">想定粗利（円）<input name="estimatedProfit" type="number" min="0" step="1" required defaultValue={target?.estimatedProfit ?? 0} className={input}/></label>
          <label className="text-sm font-bold sm:col-span-2">フリー入力<textarea name="note" maxLength={10000} rows={5} defaultValue={target?.note ?? ""} className={input}/><span className="mt-1 block text-xs font-normal text-slate-500">保存時に変更履歴を残します。登録日・更新日は自動で記録します。</span></label>
        </div>
        {state.message && <p role="status" className="mt-4 text-sm text-red-700">{state.message}</p>}
        <div className="mt-5 flex justify-end"><button disabled={pending || !customer} className="rounded-lg bg-[#f2c94c] px-5 py-2.5 text-sm font-bold disabled:opacity-50">{pending ? "保存中…" : "保存する"}</button></div>
      </form>
    </dialog>
    {registering && <CustomerRegistrationDialog departments={departments} defaultDepartmentId={departments[0]?.id} defaultName={query} openOnMount hideTrigger onClose={() => setRegistering(false)} onCreated={value => { selectCustomer(value); setRegistering(false); }}/>}</>;
}
