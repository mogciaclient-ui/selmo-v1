"use client";

import { useCallback, useRef } from "react";
import { BriefcaseBusiness, Plus, UserRoundPlus, X } from "lucide-react";
import { BasicOpportunityForm } from "@/components/opportunities/basic-opportunity-form";
import { RelatedRegistrationForm } from "@/components/customers/related-registration-form";

type CustomerInfo = { id: string; externalId: string; name: string; branchName: string };
type Member = { id: string; name: string; department: string };

export function CustomerOpportunityDialog({ customer, contacts, members, products }: { customer: CustomerInfo; contacts: string[]; members: Member[]; products: string[] }) {
  const ref = useRef<HTMLDialogElement>(null); const close = useCallback(() => ref.current?.close(), []);
  return <><IconButton label="案件：新規登録" onClick={() => ref.current?.showModal()}><span className="relative"><BriefcaseBusiness size={18}/><Plus size={10} strokeWidth={3} className="absolute -bottom-1 -right-1 rounded-full bg-white"/></span></IconButton><Modal ref={ref} title="案件：新規登録" subtitle={`${customer.name}${customer.branchName}`} onClose={close}><BasicOpportunityForm customer={customer} contacts={contacts} members={members} products={products} completion="refresh" onSuccess={close}/></Modal></>;
}

export function CustomerContactDialog({ customer }: { customer: CustomerInfo }) {
  const ref = useRef<HTMLDialogElement>(null); const close = useCallback(() => ref.current?.close(), []);
  return <><IconButton label="担当者：新規登録" onClick={() => ref.current?.showModal()}><UserRoundPlus size={18}/></IconButton><Modal ref={ref} title="担当者：新規登録" subtitle={`${customer.name}${customer.branchName}`} onClose={close}><RelatedRegistrationForm kind="contact" customerId={customer.id} externalId={customer.externalId} completion="refresh" onSuccess={close}/></Modal></>;
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} aria-label={label} className="group relative grid size-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-900 focus-visible:outline-2 focus-visible:outline-amber-500">{children}<span role="tooltip" className="pointer-events-none absolute bottom-full right-0 z-30 mb-2 w-max max-w-40 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-visible:opacity-100">{label}</span></button>; }
function Modal({ ref, title, subtitle, onClose, children }: { ref: React.Ref<HTMLDialogElement>; title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) { return <dialog ref={ref} className="m-auto w-[min(900px,calc(100%-2rem))] rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/40"><div className="max-h-[90vh] overflow-y-auto p-6 md:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold text-amber-800">{subtitle}</p><h2 className="mt-1 text-2xl font-bold">{title}</h2></div><button type="button" onClick={onClose} aria-label="閉じる" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={20}/></button></div>{children}</div></dialog>; }
