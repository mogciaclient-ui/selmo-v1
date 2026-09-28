"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CalendarPlus, LoaderCircle, Plus, Search, X } from "lucide-react";
import { createActivity, type CreateActivityState } from "@/app/activities/actions";
import type { CustomerSearchResult } from "@/domain/customers/types";

type DepartmentOption = { id: string; name: string };
const initialState: CreateActivityState = {};

export function AddScheduleDialog({ departments, defaultDate, trigger = "button", defaultCustomer, defaultOpportunity, openOnMount = false }: { departments: DepartmentOption[]; defaultDate: string; trigger?: "button" | "cell" | "menu" | "pickup" | "hidden"; defaultCustomer?: CustomerSearchResult; defaultOpportunity?: { id: string; name: string; salesType?: string | null; salesProcess?: string | null; progressStep?: string | null }; openOnMount?: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(createActivity, initialState);
  const [query, setQuery] = useState(defaultCustomer?.name ?? "");
  const [customers, setCustomers] = useState<CustomerSearchResult[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(defaultCustomer ?? null);
  const [departmentId, setDepartmentId] = useState(defaultCustomer?.departmentId ?? departments[0]?.id ?? "");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (openOnMount) dialogRef.current?.showModal();
  }, [openOnMount]);

  useEffect(() => {
    if (query.trim().length < 2 || selectedCustomer) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/customers/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const body = (await response.json()) as { customers?: CustomerSearchResult[] };
        setCustomers(response.ok ? body.customers ?? [] : []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setCustomers([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, selectedCustomer]);

  function selectCustomer(customer: CustomerSearchResult) {
    setSelectedCustomer(customer);
    setQuery(customer.name);
    setDepartmentId(customer.departmentId);
    setCustomers([]);
  }

  function resetCustomer() {
    setSelectedCustomer(null);
    setQuery("");
    setCustomers([]);
  }

  return (
    <>
      {trigger !== "hidden" && <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        disabled={!departments.length}
        aria-label={`${defaultDate}に予定を追加`}
        title="この日に予定を追加"
        className={trigger === "cell" ? "grid size-6 place-items-center rounded-md border border-amber-300 bg-amber-50 text-amber-800 transition hover:bg-[#f2c94c] hover:text-slate-900 disabled:opacity-40" : trigger === "menu" ? "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-amber-50 disabled:opacity-40" : trigger === "pickup" ? "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 hover:bg-[#f2c94c]" : "flex items-center gap-2 rounded-xl bg-[#f2c94c] px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-[#ddb62f] disabled:cursor-not-allowed disabled:bg-slate-300"}
      >
        {trigger === "menu" || trigger === "pickup" ? <CalendarPlus size={trigger === "pickup" ? 15 : 17} className="text-amber-700" /> : <Plus size={trigger === "cell" ? 14 : 18} />}<span className={trigger === "cell" ? "sr-only" : trigger === "menu" ? "" : trigger === "pickup" ? "" : "hidden sm:inline"}>{trigger === "menu" ? "スケジュール登録" : trigger === "pickup" ? "予定登録" : "予定を追加"}</span>
      </button>}

      <dialog ref={dialogRef} aria-labelledby="add-schedule-title" className="m-auto w-[min(840px,calc(100%-2rem))] rounded-2xl border border-slate-200 bg-white p-0 text-[#18212f] shadow-2xl backdrop:bg-slate-950/40">
        <form action={action} className="max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-5">
            <h2 id="add-schedule-title" className="text-lg font-bold">スケジュール登録</h2>
            <button type="button" onClick={() => dialogRef.current?.close()} aria-label="閉じる" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
          </div>

          <div className="space-y-5 p-6">
            <div>
              <label htmlFor="departmentId" className="mb-2 block text-sm font-semibold">担当部門</label>
              <select id="departmentId" name="departmentId" required value={departmentId} onChange={(event) => { resetCustomer(); setDepartmentId(event.target.value); }} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-amber-500">
                {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </select>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between"><label htmlFor="customerSearch" className="text-sm font-semibold">顧客名（営業予定のみ・任意）</label>{selectedCustomer && <button type="button" onClick={resetCustomer} className="text-xs font-semibold text-amber-800">選び直す</button>}</div>
              <input type="hidden" name="customerId" value={selectedCustomer?.id ?? ""} />
                <div className="relative">
                  <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input id="customerSearch" value={query} onChange={(event) => { setSelectedCustomer(null); setCustomers([]); setQuery(event.target.value); }} className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-10 text-sm outline-none focus:border-amber-500" placeholder="顧客名または電話番号を2文字以上入力" autoComplete="off" />
                  {searching && <LoaderCircle className="absolute right-3 top-3 animate-spin text-slate-400" size={18} />}
                  {!selectedCustomer && query.trim().length >= 2 && !searching && (
                    <div className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                      {customers.map((customer) => (
                        <button key={customer.id} type="button" onClick={() => selectCustomer(customer)} className="w-full rounded-lg px-3 py-2.5 text-left hover:bg-amber-50">
                          <p className="text-sm font-semibold">{customer.name}</p><p className="mt-0.5 truncate text-xs text-slate-400">{customer.phone ?? "電話番号なし"}{customer.address ? `・${customer.address}` : ""}</p>
                        </button>
                      ))}
                      {!customers.length && <p className="px-3 py-2 text-xs text-slate-500">該当する顧客がいません。必要なら顧客リストから先に登録してください。</p>}
                    </div>
                  )}
                </div>
              <input type="hidden" name="newCustomerName" value="" />
              {selectedCustomer && <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">選択中：{selectedCustomer.name}</p>}
            </div>

            <Field label="件名" name="title" placeholder="例：新商品のご提案" required />
            <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">カテゴリ<select name="category" defaultValue="sales" className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-normal"><option value="sales">営業</option><option value="general">一般業務</option></select></label><div><label htmlFor="activityType" className="mb-2 block text-sm font-semibold">活動種別</label><select id="activityType" name="activityType" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-amber-500"><option value="visit">訪問</option><option value="online">オンライン</option><option value="telephone">電話・テレアポ</option><option value="other">その他</option></select></div></div>
            <div className="grid gap-4 sm:grid-cols-2"><Field label="開始日" name="date" type="date" defaultValue={defaultDate} required /><Field label="開始時刻" name="startTime" type="time" defaultValue="10:00" required /><Field label="終了日" name="endDate" type="date" defaultValue={defaultDate} required /><Field label="終了時刻" name="endTime" type="time" defaultValue="11:00" required /></div>
            <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">場所の区分<select name="locationType" defaultValue="external" className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-normal"><option value="external">社外</option><option value="internal">社内</option></select></label><Field label="場所" name="location"/></div>
            <div className="grid gap-4 sm:grid-cols-3"><Field label="案件名" name="opportunityName" defaultValue={defaultOpportunity?.name}/><label className="text-sm font-semibold">営業タイプ<select name="salesType" defaultValue={defaultOpportunity?.salesType ?? ""} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-normal"><option value="">選択してください</option><option>IT営業活動</option><option>IT同行活動</option><option>フォロー</option></select></label><label className="text-sm font-semibold">営業プロセス<select name="salesProcess" defaultValue={defaultOpportunity?.salesProcess ?? ""} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-normal"><option value="">選択してください</option><option>IT営業活動</option><option>IT同行活動</option><option>AXCEL同行活動</option><option>CS営業活動</option><option>CS営業外活動</option><option>アルファサポート</option><option>AXCEL</option><option>書類不備</option><option>工事立会</option><option>納品</option><option>フォロー</option></select></label></div>
            <input type="hidden" name="opportunityId" value={defaultOpportunity?.id ?? ""}/>
            <Field label="進行工程" name="progressStep" defaultValue={defaultOpportunity?.progressStep ?? ""} placeholder="例：提案準備、実施中、確認待ち"/>
            <label className="block text-sm font-semibold">備考<textarea name="notes" rows={3} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal outline-none focus:border-amber-500"/></label>
            {state.message && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.message}</p>}
          </div>

          <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4">
            <button type="button" onClick={() => dialogRef.current?.close()} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600">キャンセル</button>
            <button type="submit" disabled={pending || !departmentId} className="flex min-w-28 items-center justify-center gap-2 rounded-xl bg-[#f2c94c] px-5 py-2.5 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-50">{pending && <LoaderCircle size={17} className="animate-spin" />}{pending ? "登録中" : "登録する"}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}

function Field({ label, name, type = "text", placeholder, defaultValue, required }: { label: string; name: string; type?: string; placeholder?: string; defaultValue?: string; required?: boolean }) {
  return <div><label htmlFor={name} className="mb-2 block text-sm font-semibold">{label}</label><input id={name} name={name} type={type} placeholder={placeholder} defaultValue={defaultValue} required={required} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-amber-500" /></div>;
}
