import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth/require-auth';
import { canActAsSalesRep } from '@/lib/auth/roles';
import { AppShell } from '@/components/layout/app-shell';
import { CheckSheetForm } from '@/components/checksheets/checksheet-form';
import type { CheckSheet } from '@/infrastructure/supabase/checksheet-repository';
export default async function CheckSheetPage({params}:{params:Promise<{id:string}>}){
 const [context,{id}]=await Promise.all([requireAuth(),params]);let q=context.db.from('activities').select('id,employee_id,status,activity_type,starts_at,schedule_details,customers(name,phone,address)').eq('organization_id',context.organizationId).eq('id',id);if(context.role==='sales_rep')q=q.eq('employee_id',context.employeeId);if(context.role!=='organization_admin')q=q.in('department_id',context.departmentIds);const {data:a}=await q.maybeSingle();if(!a||a.status!=='completed'||!['visit','online'].includes(a.activity_type)||(a.schedule_details?.customerType&&a.schedule_details.customerType!=='新規'))notFound();
 const {data:saved,error}=await context.db.from('visit_check_sheets').select('*').eq('organization_id',context.organizationId).eq('activity_id',id).maybeSingle();if(error)throw new Error('チェックシートを取得できませんでした。');const c=Array.isArray(a.customers)?a.customers[0]:a.customers;
 return <AppShell active="/analysis" displayName={context.displayName} department={context.departmentName}><main className="mx-auto max-w-[1400px] space-y-5 p-4 pb-28 md:p-8"><Link href={`/activities/${id}/report`} className="text-sm text-slate-500">活動詳細へ戻る</Link><h1 className="text-2xl font-bold">訪問後チェックシート</h1><CheckSheetForm activityId={id} date={new Date(a.starts_at).toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'})} defaults={{customerName:c?.name??'',address:c?.address??'',telephone:c?.phone??''}} saved={saved as CheckSheet|undefined} canEdit={canActAsSalesRep(context.role)&&a.employee_id===context.employeeId}/></main></AppShell>;
}
