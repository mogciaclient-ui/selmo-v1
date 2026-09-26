"use client";

import { useActionState, useEffect } from "react";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { createBasicOpportunity, type BasicOpportunityState } from "@/app/customers/[id]/opportunities/new/actions";

const initial: BasicOpportunityState = {};

export function BasicOpportunityForm({ customer, contacts, members, products, completion = "portal", onSuccess }: { customer: { id: string; externalId: string; name: string; branchName: string }; contacts: string[]; members: { id: string; name: string; department: string }[]; products: string[]; completion?: "portal" | "refresh"; onSuccess?: () => void }) {
  const router = useRouter(); const [state, action, pending] = useActionState(createBasicOpportunity, initial);
  useEffect(() => { if (!state.success) return; onSuccess?.(); if (completion === "portal" && state.externalId && state.opportunityId) router.push(`/customers/${state.externalId}?opportunityId=${state.opportunityId}`); else router.refresh(); }, [completion, onSuccess, router, state]);
  return <form action={action} className="mt-6 space-y-6"><input type="hidden" name="customerId" value={customer.id}/><input type="hidden" name="externalId" value={customer.externalId}/>
    <section><h2 className="border-l-4 border-amber-400 pl-3 font-bold">基本情報</h2><p className="mt-2 text-sm text-slate-500">案件の「基本情報」をご登録ください。「*」は必須項目です。</p><div className="mt-5 grid gap-5 sm:grid-cols-2">
      <ReadOnly label="顧客名*" value={customer.name}/><ReadOnly label="拠点名" value={customer.branchName}/><input type="hidden" name="branchName" value={customer.branchName}/>
      <Field name="name" label="案件名*" required/><Select name="productName" label="商材*" required options={products.map((value) => [value, value])}/>
      <Select name="customerContact" label="顧客担当者" options={contacts.map((value) => [value, value])} empty="担当者を選択する"/><Select name="employeeId" label="主営業担当*" required options={members.map((value) => [value.id, `${value.department}｜${value.name}`])}/>
      <Select name="teamVisibility" label="他チームへの案件公開" options={[["organization","公開"],["private","非公開"]]}/><label className="text-sm font-semibold sm:col-span-2">備考<textarea name="notes" rows={4} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal outline-none focus:border-amber-500"/></label>
    </div></section>
    <section className="border-t border-slate-200 pt-6"><Select name="status" label="案件状態" options={[["open","継続中"],["won","終了"],["on_hold","保留"],["lost","中止"]]}/></section>
    {state.message && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.message}</p>}
    <div className="flex justify-end"><button disabled={pending} className="flex items-center gap-2 rounded-xl bg-[#f2c94c] px-6 py-2.5 text-sm font-bold disabled:opacity-50">{pending && <LoaderCircle size={17} className="animate-spin"/>}{pending ? "登録中" : "入力内容を確認する"}</button></div>
  </form>;
}

function ReadOnly({ label, value }: { label: string; value: string }) { return <div><p className="text-sm font-semibold">{label}</p><div className="mt-2 flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm">{value}</div></div>; }
function Field({ name, label, required }: { name: string; label: string; required?: boolean }) { return <label className="text-sm font-semibold">{label}<input name={name} required={required} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 font-normal outline-none focus:border-amber-500"/></label>; }
function Select({ name, label, options, empty, required }: { name: string; label: string; options: string[][]; empty?: string; required?: boolean }) { return <label className="text-sm font-semibold">{label}<select name={name} required={required} defaultValue="" className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-normal">{(empty || required) && <option value="">{empty ?? "選択してください"}</option>}{options.map(([value,text])=><option key={value} value={value}>{text}</option>)}</select></label>; }
