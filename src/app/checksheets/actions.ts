"use server";
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { canActAsSalesRep } from '@/lib/auth/roles';
import { revalidatePath } from 'next/cache';
import { checkSheetSchema } from '@/domain/checksheets/schema';
export type CheckSheetState={success?:boolean;message?:string};
export async function saveCheckSheet(_:CheckSheetState,form:FormData):Promise<CheckSheetState>{
 const user=await getCurrentUser();if(!user||!canActAsSalesRep(user.role))return {message:'チェックシートは営業担当本人が入力してください。'};
 let raw;try{raw={...Object.fromEntries(form),equipment:JSON.parse(String(form.get('equipmentJson')??'[]')),network:JSON.parse(String(form.get('networkJson')??'{}'))};}catch{return {message:'入力内容を確認してください。'};}
 const parsed=checkSheetSchema.safeParse(raw);if(!parsed.success)return {message:parsed.error.issues[0]?.message??'入力内容を確認してください。'};
 const v=parsed.data;const {data:activity}=await user.db.from('activities').select('id,customer_id,department_id,status,activity_type,schedule_details').eq('id',v.activityId).eq('organization_id',user.organizationId).eq('employee_id',user.employeeId).in('department_id',user.departmentIds).maybeSingle();
 if(!activity||activity.status!=='completed'||!['visit','online'].includes(activity.activity_type)|| (activity.schedule_details?.customerType&&activity.schedule_details.customerType!=='新規'))return {message:'自分の新規訪問後の活動を選択してください。'};
 if(v.equipment.some(e=>e.installedDate&&e.installedDate>v.visitDate))return {message:'設置年月日は訪問日以前の日付を入力してください。'};
 const {error}=await user.db.from('visit_check_sheets').upsert({organization_id:user.organizationId,department_id:activity.department_id,employee_id:user.employeeId,activity_id:activity.id,customer_id:activity.customer_id,visit_date:v.visitDate,customer_name:v.customerName,address:v.address,telephone:v.telephone,fax:v.fax,contact_name:v.contactName,contact_title:v.contactTitle,collaboration:v.collaboration,equipment:v.equipment,network:v.network,notes:v.notes,updated_at:new Date().toISOString()},{onConflict:'activity_id'});
 if(error)return {message:'チェックシートを保存できませんでした。'};revalidatePath('/checksheets');revalidatePath(`/activities/${activity.id}/checksheet`);return {success:true,message:'チェックシートを保存しました。'};
}
