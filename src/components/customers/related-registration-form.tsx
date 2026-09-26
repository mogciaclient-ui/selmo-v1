"use client";

import { useActionState, useEffect } from "react";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { createCustomerBranch, createCustomerContact, type RelatedCustomerState } from "@/app/customers/[id]/related-actions";

const initial: RelatedCustomerState = {};

export function RelatedRegistrationForm({ kind, customerId, externalId, completion = "portal", onSuccess }: { kind: "branch" | "contact"; customerId: string; externalId: string; completion?: "portal" | "refresh"; onSuccess?: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(kind === "branch" ? createCustomerBranch : createCustomerContact, initial);
  useEffect(() => { if (!state.success) return; onSuccess?.(); if (completion === "portal" && state.externalId) router.push(`/customers/${state.externalId}`); else router.refresh(); }, [completion, onSuccess, router, state]);
  return <form action={action} className="mt-6 space-y-5">
    <input type="hidden" name="customerId" value={customerId}/><input type="hidden" name="externalId" value={externalId}/>
    {kind === "branch" ? <div className="grid gap-5 sm:grid-cols-2">
      <Field name="name" label="拠点名" required/><Field name="kana" label="拠点名［カナ］"/>
        <Field name="postalCode" label="郵便番号"/><Field name="prefecture" label="都道府県"/><Field name="address" label="住所"/><Field name="phone" label="電話番号" type="tel"/><Field name="fax" label="FAX" type="tel"/>
    </div> : <ContactFields/>} 
    <label className="block text-sm font-semibold">備考<textarea name="notes" rows={4} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal outline-none focus:border-amber-500"/></label>
    {state.message && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.message}</p>}
    <div className="flex justify-end"><button disabled={pending} className="flex items-center gap-2 rounded-xl bg-[#f2c94c] px-6 py-2.5 text-sm font-bold disabled:opacity-50">{pending && <LoaderCircle size={17} className="animate-spin"/>}{pending ? "登録中" : "登録する"}</button></div>
  </form>;
}

function ContactFields() { return <>
  <section><h2 className="border-l-4 border-amber-400 pl-3 font-bold">基本情報</h2><p className="mt-2 text-sm text-slate-500">顧客担当者の「基本情報」をご登録ください。「*」は必須項目です。</p><div className="mt-5 grid gap-5 sm:grid-cols-2">
    <Field name="department" label="部署"/><Field name="title" label="役職"/>
    <NameFields label="担当者名*" last="lastName" first="firstName"/><NameFields label="担当者名［カナ］*" last="lastNameKana" first="firstNameKana" kana/>
    <SelectField name="gender" label="性別" options={[["male","男性"],["female","女性"],["unknown","不明"]]}/><SelectField name="role" label="役割" options={[["contact","窓口"],["decision_maker","決裁者"],["key_person","キーマン"],["other","その他"],["unknown","不明"]]}/>
    <Field name="phone" label="TEL" type="tel"/><Field name="mobilePhone" label="TEL［携帯］" type="tel"/><Field name="pcEmail" label="e-mail［PC］" type="email"/><Field name="mobileEmail" label="e-mail［携帯］" type="email"/>
    <Field name="firstCardDate" label="初回名刺取得日" type="date"/><Field name="firstCardOwner" label="初回名刺取得者"/>
  </div></section>
  <section className="border-t border-slate-200 pt-6"><h2 className="border-l-4 border-amber-400 pl-3 font-bold">補足情報</h2><div className="mt-5 grid gap-5 sm:grid-cols-2"><Field name="birthDate" label="生年月日" type="date"/><Field name="birthplace" label="出身地"/><Field name="previousJob" label="前職"/><Field name="familyCount" label="家族人数" type="number"/><Field name="hobby" label="趣味"/><SelectField name="employmentStatus" label="在籍状態" options={[["active","在籍中"],["retired","退職"]]}/></div></section>
</>; }

function NameFields({ label, last, first, kana = false }: { label: string; last: string; first: string; kana?: boolean }) { return <fieldset className="sm:col-span-2"><legend className="text-sm font-semibold">{label}</legend><div className="mt-2 grid grid-cols-2 gap-3"><label className="flex items-center gap-2 text-xs text-slate-500">姓<input name={last} required placeholder={kana ? "セイ" : "姓"} className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-amber-500"/></label><label className="flex items-center gap-2 text-xs text-slate-500">名<input name={first} required placeholder={kana ? "メイ" : "名"} className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-amber-500"/></label></div>{kana && <p className="mt-1 text-xs text-slate-400">全角カタカナで入力してください。</p>}</fieldset>; }

function SelectField({ name, label, options }: { name: string; label: string; options: [string, string][] }) { return <label className="text-sm font-semibold">{label}<select name={name} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-normal">{options.map(([value,text])=><option key={value} value={value}>{text}</option>)}</select></label>; }

function Field({ name, label, type = "text", required }: { name: string; label: string; type?: string; required?: boolean }) { return <label className="text-sm font-semibold">{label}<input name={name} type={type} required={required} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 font-normal outline-none focus:border-amber-500"/></label>; }
