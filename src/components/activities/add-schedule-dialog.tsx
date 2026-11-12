"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { CalendarPlus, LoaderCircle, Search, UserPlus, X } from "lucide-react";
import { createActivity, type CreateActivityState } from "@/app/activities/actions";
import { CustomerRegistrationDialog } from "@/components/customers/customer-registration-dialog";
import { categoryOptions, customerTypes, defaultScheduleType, scheduleTypeLabels, type ScheduleCategory } from "@/domain/schedules/rules";
import type { CustomerSearchResult } from "@/domain/customers/types";

type DepartmentOption = { id: string; name: string };
const initialState: CreateActivityState = {};

export function AddScheduleDialog({ departments, defaultDate, trigger = "button", defaultCustomer, defaultOpportunity, openOnMount = false, onClose, defaultProduct = "", defaultCustomerType = "", pickupId = "" }: { departments: DepartmentOption[]; defaultDate: string; trigger?: "button" | "cell" | "menu" | "pickup" | "hidden"; defaultCustomer?: CustomerSearchResult; defaultOpportunity?: { id: string; name: string; salesType?: string | null; salesProcess?: string | null; progressStep?: string | null }; openOnMount?: boolean; onClose?: () => void; defaultProduct?: string; defaultCustomerType?: string; pickupId?: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(createActivity, initialState);
  const [query, setQuery] = useState(defaultCustomer?.name ?? "");
  const [customers, setCustomers] = useState<CustomerSearchResult[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(defaultCustomer ?? null);
  const [departmentId, setDepartmentId] = useState(defaultCustomer?.departmentId ?? departments[0]?.id ?? "");
  const [searching, setSearching] = useState(false);

  const formId = useId();
  const [category, setCategory] = useState<ScheduleCategory>("sales");
  const [activityType, setActivityType] = useState("visit");
  const [selectedProduct, setSelectedProduct] = useState(defaultProduct);
  const [products, setProducts] = useState<string[]>([]);
  const [productError, setProductError] = useState("");
  const [registeringCustomer, setRegisteringCustomer] = useState(false);
  const [searched, setSearched] = useState(false);
  const [opened, setOpened] = useState(openOnMount);
  const [searchError, setSearchError] = useState("");
  useEffect(() => {
    if (!opened) return;
    const controller = new AbortController();
    fetch("/api/products/options", { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("商材マスタを取得できませんでした。");
      const body = await response.json(); setProducts(body.products);
    }).catch(error => { if (!controller.signal.aborted) setProductError(error.message); });
    return () => controller.abort();
  }, [opened]);
  useEffect(() => {
    if (openOnMount) dialogRef.current?.showModal();
  }, [openOnMount]);

  useEffect(() => {
    if (query.trim().length < 2 || selectedCustomer) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true); setSearched(false); setSearchError("");
      try {
        const response = await fetch(`/api/customers/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const body = (await response.json()) as { customers?: CustomerSearchResult[] };
        if (!response.ok) throw new Error("顧客検索に失敗しました。");
        setCustomers(body.customers ?? []); setSearched(true);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) { setCustomers([]); setSearchError("顧客を検索できませんでした。入力し直して再試行してください。"); }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);

    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, selectedCustomer]);
  const visibleCustomers = customers.filter(customer => departments.some(department => department.id === customer.departmentId));
  function selectCustomer(customer: CustomerSearchResult) { setSelectedCustomer(customer); setQuery(customer.name); setDepartmentId(customer.departmentId); setCustomers([]); }
  function resetCustomer() { setSelectedCustomer(null); setQuery(""); setCustomers([]); setSearched(false); }
  return <>
    {trigger !== "hidden" && <button type="button" onClick={() => { setOpened(true); dialogRef.current?.showModal(); }} disabled={!departments.length} aria-label={`${defaultDate}に予定を追加`} className={trigger === "cell" ? "rounded-md border border-amber-300 p-1 text-amber-800" : "inline-flex items-center gap-2 rounded-lg bg-[#f2c94c] px-3 py-2 text-sm font-bold text-slate-900"}><CalendarPlus size={17}/>{trigger === "cell" ? <span className="sr-only">予定登録</span> : "スケジュール登録"}</button>}
    <dialog ref={dialogRef} onClose={onClose} aria-labelledby={`${formId}-title`} className="m-auto w-[min(760px,calc(100%-2rem))] rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/40">
      <form action={action} className="max-h-[90vh] overflow-y-auto">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-5"><h2 id={`${formId}-title`} className="text-lg font-bold">スケジュール登録</h2><button type="button" aria-label="閉じる" onClick={() => dialogRef.current?.close()}><X size={20}/></button></header>
        <div className="space-y-5 p-6">
          <input type="hidden" name="departmentId" value={departmentId}/><input type="hidden" name="opportunityId" value={defaultOpportunity?.id ?? ""}/><input type="hidden" name="pickupId" value={pickupId}/>
          <div className="grid gap-4 sm:grid-cols-3"><Field label="日付" name="date" type="date" defaultValue={defaultDate} required/><Field label="開始時刻" name="startTime" type="time" defaultValue="10:00" required/><Field label="終了時刻" name="endTime" type="time" defaultValue="11:00" required/></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold">カテゴリー（必須）<select name="category" required value={category} onChange={event => { const value = event.target.value as ScheduleCategory; setCategory(value); setActivityType(defaultScheduleType(value)); }} className={inputClass}>{Object.entries(categoryOptions).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select></label>
            <label className="text-sm font-bold">活動種別（必須）<select name="activityType" required value={activityType} onChange={event => setActivityType(event.target.value)} className={inputClass}><option value="">選択してください</option>{categoryOptions[category].types.map(type => <option key={type} value={type}>{scheduleTypeLabels[type]}</option>)}</select></label>
          </div>
          <div><div className="mb-2 flex justify-between"><label htmlFor={`${formId}-customer`} className="text-sm font-bold">顧客名</label>{selectedCustomer && <button type="button" onClick={resetCustomer} className="text-xs text-amber-800">選び直す</button>}</div>
            <input type="hidden" name="customerId" value={selectedCustomer?.id ?? ""}/>
            <div className="relative"><Search size={18} className="absolute left-3 top-3 text-slate-400"/><input id={`${formId}-customer`} value={query} onChange={event => { setSelectedCustomer(null); setCustomers([]); setSearched(false); setQuery(event.target.value); }} className="h-11 w-full rounded-xl border pl-10 pr-10 text-sm" placeholder="顧客名または電話番号を2文字以上入力" autoComplete="off"/>{searching && <LoaderCircle size={18} className="absolute right-3 top-3 animate-spin"/>}</div>
            {!selectedCustomer && searched && query.trim().length >= 2 && (
              visibleCustomers.length ? (
                <div className="mt-2 max-h-56 overflow-auto rounded-xl border p-2">
                  {visibleCustomers.map(customer => (
                    <button type="button" key={customer.id} onClick={() => selectCustomer(customer)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-amber-50">
                      <span className="font-bold">{customer.name}</span>
                      <span className="ml-2 text-xs text-slate-500">{customer.address}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 rounded-lg bg-slate-50 px-3 py-1">
                  <p role="status" className="text-xs text-slate-600">一致する顧客がいません</p>
                  <button type="button" onClick={() => setRegisteringCustomer(true)} className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-amber-600">
                    <UserPlus size={15} aria-hidden="true"/>
                    顧客登録へ
                  </button>
                </div>
              )
            )}
            {searchError && <p role="alert" className="mt-2 text-sm text-red-600">{searchError}</p>}
            {selectedCustomer && <p className="mt-2 text-sm font-semibold text-emerald-700">選択中：{selectedCustomer.name}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">顧客種別<select name="customerType" className={inputClass} defaultValue={defaultCustomerType}><option value="">選択してください</option>{customerTypes.map(type => <option key={type} value={type}>{type === "GUP" ? "GUP（グレードアップ）" : type}</option>)}</select></label><label className="text-sm font-bold">商材<select name="product" value={selectedProduct} onChange={event => setSelectedProduct(event.target.value)} className={inputClass}><option value="">選択してください</option>{products.map(product => <option key={product}>{product}</option>)}</select></label></div>
          {productError && <p role="alert" className="text-sm text-red-600">{productError}</p>}<Field label="エリア" name="area"/>
          {state.message && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.message}</p>}
        </div>
        <footer className="sticky bottom-0 flex justify-end gap-3 border-t bg-white px-6 py-4"><button type="button" onClick={() => dialogRef.current?.close()} className="rounded-lg border px-4 py-2">キャンセル</button><button disabled={pending || !departmentId || (!selectedCustomer && Boolean(query.trim()))} className="rounded-lg bg-[#f2c94c] px-5 py-2 font-bold disabled:opacity-50">{pending ? "登録中…" : "登録する"}</button></footer>
      </form>
    </dialog>
    {registeringCustomer && <CustomerRegistrationDialog departments={departments} defaultDepartmentId={departmentId} defaultName={query} openOnMount hideTrigger onClose={() => setRegisteringCustomer(false)} onCreated={customer => { selectCustomer(customer); setRegisteringCustomer(false); }}/ >}
  </>;
}
const inputClass = "mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal";
function Field({ label, name, type = "text", defaultValue, required }: { label: string; name: string; type?: string; defaultValue?: string; required?: boolean }) {
  return <label className="block text-sm font-bold">{label}<input name={name} type={type} defaultValue={defaultValue} required={required} maxLength={type === "text" ? 200 : undefined} className={inputClass}/></label>;
}
