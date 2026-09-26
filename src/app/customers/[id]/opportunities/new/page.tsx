import { ArrowLeft, BriefcaseBusiness } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { BasicOpportunityForm } from "@/components/opportunities/basic-opportunity-form";
import { requireAuth } from "@/lib/auth/require-auth";

export default async function NewCustomerOpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, context] = await Promise.all([params, requireAuth()]);
  let customerQuery = context.db.from("customers").select("id,external_id,name,department_id,registration_details").eq("organization_id", context.organizationId).eq("external_id", id);
  if (context.role !== "organization_admin") customerQuery = customerQuery.in("department_id", context.departmentIds);
  const { data: customer } = await customerQuery.maybeSingle(); if (!customer?.department_id) notFound();
  let usersQuery = context.db.from("app_users").select("employee_id,employees(name),app_user_departments!inner(department_id,departments(name))").eq("organization_id", context.organizationId).eq("status", "active");
  if (context.role === "sales_rep") usersQuery = usersQuery.eq("employee_id", context.employeeId); else if (context.role === "department_admin") usersQuery = usersQuery.eq("app_user_departments.department_id", customer.department_id);
  const [{ data: users }, { data: productRows }] = await Promise.all([usersQuery, context.db.from("products").select("name").eq("organization_id", context.organizationId).eq("status", "active").order("name")]);
  const members = ((users ?? []) as unknown as UserRow[]).map((user) => ({ id: user.employee_id, name: relation(user.employees)?.name ?? "名称未設定", department: relation(user.app_user_departments[0]?.departments)?.name ?? "所属未設定" }));
  const details = (customer.registration_details ?? {}) as Record<string, unknown>; const branchName = String(details.branchName || "本社");
  const contacts = (Array.isArray(details.contacts) ? details.contacts as { name?: string }[] : []).map((item) => item.name).filter((name): name is string => Boolean(name));
  return <AppShell active="/customers" displayName={context.displayName} department={context.departmentName}><main className="mx-auto max-w-3xl p-4 pb-24 md:p-8"><Link href="/customers" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500"><ArrowLeft size={17}/>顧客リストへ戻る</Link><section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8"><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-xl bg-amber-50 text-amber-800"><BriefcaseBusiness size={22}/></div><div><p className="text-xs font-bold text-amber-800">{customer.name}{branchName}</p><h1 className="text-2xl font-bold">案件：新規登録</h1></div></div><BasicOpportunityForm customer={{ id: customer.id, externalId: customer.external_id, name: customer.name, branchName }} contacts={contacts} members={members} products={(productRows ?? []).map((item) => item.name)}/></section></main></AppShell>;
}

type UserRow = { employee_id: string; employees: { name: string } | { name: string }[] | null; app_user_departments: { departments: { name: string } | { name: string }[] | null }[] };
function relation<T>(value: T | T[] | null | undefined) { return Array.isArray(value) ? value[0] : value; }
