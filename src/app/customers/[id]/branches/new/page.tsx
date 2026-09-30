import { ArrowLeft, Building2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { RelatedRegistrationForm } from "@/components/customers/related-registration-form";
import { requireAuth } from "@/lib/auth/require-auth";

export default async function NewBranchPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, context] = await Promise.all([params, requireAuth()]);
  let query = context.db.from("customers").select("id,external_id,name,department_id").eq("organization_id", context.organizationId).eq("external_id", id);
  if (context.role !== "organization_admin") query = query.in("department_id", context.departmentIds);
  const { data: customer } = await query.maybeSingle();
  if (!customer) notFound();
  return <AppShell active="/customers" displayName={context.displayName} department={context.departmentName}><main className="mx-auto max-w-3xl p-4 pb-24 md:p-8"><Link href={`/customers/${customer.external_id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500"><ArrowLeft size={17}/>顧客ポータルへ戻る</Link><section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 md:p-8"><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-xl bg-amber-50 text-amber-800"><Building2 size={22}/></div><div><p className="text-xs font-bold text-amber-800">{customer.name}</p><h1 className="text-2xl font-bold">拠点：新規登録</h1></div></div><RelatedRegistrationForm kind="branch" customerId={customer.id} externalId={customer.external_id}/></section></main></AppShell>;
}
