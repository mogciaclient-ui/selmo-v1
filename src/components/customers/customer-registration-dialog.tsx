"use client";

import { useActionState, useEffect, useRef } from "react";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { registerCustomer, type RegisterCustomerState } from "@/app/customers/register-action";

type Department = { id: string; name: string };
const initial: RegisterCustomerState = {};
const equipmentTypes = ["電話機", "複合機", "UTM", "サーバー", "AP", "SPC", "カメラ", "その他"];
const prefectures = ["北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"];

export function CustomerRegistrationDialog({ departments }: { departments: Department[] }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(registerCustomer, initial);
  useEffect(() => {
    if (!state.success) return;
    ref.current?.close();
    if (state.customerExternalId) router.push(`/customers/${state.customerExternalId}`);
    router.refresh();
  }, [router, state.customerExternalId, state.success]);
  return <>
    <button type="button" onClick={() => ref.current?.showModal()} className="flex items-center gap-2 rounded-xl bg-[#f2c94c] px-4 py-2.5 text-sm font-semibold text-slate-900"><Plus size={18}/>顧客を追加</button>
    <dialog ref={ref} aria-labelledby="register-customer-title" className="m-auto w-[min(960px,calc(100%-2rem))] rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/40">
      <form action={action} className="max-h-[90vh] overflow-y-auto p-5 md:p-7">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold text-amber-800">顧客リスト</p><h2 id="register-customer-title" className="mt-1 text-xl font-bold">顧客の新規登録</h2></div><button type="button" onClick={() => ref.current?.close()} aria-label="閉じる" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20}/></button></div>
        <Section title="基本情報"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Select name="departmentId" label="担当部門" options={departments.map((item) => [item.id, item.name])}/>
          <Field name="name" label="顧客名"/><Select name="corporatePosition" label="株式会社の位置" options={[["", "該当なし"], ["prefix", "先頭"], ["suffix", "末尾"]]}/>
          <Field name="nameKana" label="顧客名［カナ］" hint="全角カタカナで入力"/><Field name="shortName" label="略称"/><Field name="shortNameKana" label="略称［カナ］"/>
          <Field name="representative" label="代表者"/><Field name="representativeKana" label="代表者［カナ］"/><Field name="url" label="URL" type="url" placeholder="https://"/>
          <Select name="listing" label="上場区分" options={[["", "選択なし"], ["listed", "上場"], ["unlisted", "非上場"], ["unknown", "不明"]]}/><Field name="capital" label="資本金" type="number"/><Field name="employeesCount" label="従業員数" type="number"/>
          <Select name="customerCategory" label="顧客区分" options={[["", "選択してください"], ["corporate", "法人・団体"], ["individual", "個人"]]}/>
          {(["alphaHikari", "alphaDenki", "axcel"] as const).map((name) => <Select key={name} name={name} label={{ alphaHikari: "アルファひかり", alphaDenki: "アルファ電気", axcel: "AXCEL" }[name]} options={[["", "選択してください"], ["yes", "あり"], ["no", "なし"]]}/>)}
          <Area name="basicNotes" label="備考"/>
        </div></Section>
        <Section title="商材・リース"><div className="space-y-3">{[1, 2, 3].map((index) => <div key={index} className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-3"><Field name={`product${index}Name`} label={`商材${index}`}/><Field name={`product${index}LeaseFee`} label="リース料金" type="number"/><Field name={`product${index}LeaseStart`} label="リース開始日" type="date"/></div>)}</div></Section>
        <Section title="拠点情報"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field name="branchName" label="拠点名" value="本社"/><Field name="branchKana" label="拠点名［カナ］" value="ホンシャ"/><Field name="postalCode" label="郵便番号" placeholder="123-4567"/><Select name="prefecture" label="都道府県" options={[["", "選択してください"], ...prefectures.map((name) => [name, name])]}/><Field name="address1" label="住所1［市区町村・番地等］"/><Field name="branchAddress2" label="住所2［ビル名等］"/><Field name="branchPhone" label="TEL" type="tel"/><Field name="branchFax" label="FAX" type="tel"/><label className="flex items-center gap-2 self-end pb-3 text-sm font-semibold"><input name="bookmark" type="checkbox" value="1" className="size-4 accent-amber-500"/>ブックマーク登録</label><Area name="branchNotes" label="拠点の備考"/></div></Section>
        <Section title="OA機器"><p className="mb-3 text-xs text-slate-500">利用中の機器だけ入力してください。</p><div className="space-y-2">{Array.from({ length: 8 }, (_, index) => <details key={index} className="rounded-xl border border-slate-200"><summary className="cursor-pointer px-4 py-3 text-sm font-bold">OA機器（{index + 1}）</summary><div className="grid gap-3 border-t border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-3"><Select name={`equipment${index + 1}Type`} label="機器" options={[["", "選択なし"], ...equipmentTypes.map((name) => [name, name])]}/><Field name={`equipment${index + 1}Dealer`} label="販売店"/><Field name={`equipment${index + 1}Manufacturer`} label="メーカー"/><Field name={`equipment${index + 1}Model`} label="型式"/><Field name={`equipment${index + 1}LeaseCompany`} label="リース会社"/><Field name={`equipment${index + 1}RemainingPayments`} label="残回数" type="number"/><Field name={`equipment${index + 1}LeaseFee`} label="リース料金" type="number"/><Field name={`equipment${index + 1}InstalledAt`} label="導入年月日" type="date"/><Field name={`equipment${index + 1}LeaseEnd`} label="リース終了年月日" type="date"/></div></details>)}</div></Section>
        {state.message && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.message}</p>}
        <div className="sticky bottom-0 mt-6 flex justify-end gap-3 border-t border-slate-200 bg-white py-4"><button type="button" onClick={() => ref.current?.close()} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold">顧客リストへ戻る</button><button disabled={pending} className="rounded-xl bg-[#f2c94c] px-5 py-2.5 text-sm font-bold disabled:opacity-50">{pending ? "登録中…" : "顧客を登録する"}</button></div>
      </form>
    </dialog>
  </>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="mt-6"><h3 className="mb-4 border-b border-amber-200 pb-2 text-base font-bold">{title}</h3>{children}</section>; }
function Field({ name, label, type = "text", value, hint, placeholder }: { name: string; label: string; type?: string; value?: string; hint?: string; placeholder?: string }) { return <label className="text-xs font-bold text-slate-600">{label}<input name={name} type={type} defaultValue={value} placeholder={placeholder} min={type === "number" ? 0 : undefined} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-amber-500"/>{hint && <span className="mt-1 block text-[11px] font-normal text-slate-400">{hint}</span>}</label>; }
function Select({ name, label, options }: { name: string; label: string; options: string[][] }) { return <label className="text-xs font-bold text-slate-600">{label}<select name={name} defaultValue="" className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal"><option value="">選択してください</option>{options.filter(([value]) => value !== "").map(([value, text]) => <option key={`${name}-${value}`} value={value}>{text}</option>)}</select></label>; }
function Area({ name, label }: { name: string; label: string }) { return <label className="text-xs font-bold text-slate-600 sm:col-span-2 lg:col-span-3">{label}<textarea name={name} rows={3} className="mt-1.5 w-full rounded-lg border border-slate-200 p-3 text-sm font-normal"/></label>; }
