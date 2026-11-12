"use server";
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { isDepartmentAdmin } from '@/lib/auth/roles';
export type ManualState={success?:boolean;message?:string};
export async function saveSalesManual(_:ManualState,form:FormData):Promise<ManualState>{
 const user=await getCurrentUser();if(!user||(user.role!=='organization_admin'&&!isDepartmentAdmin(user.role)))return {message:'営業マニュアルを管理する権限がありません。'};
 const id=String(form.get('id')??'');if(id&&!z.uuid().safeParse(id).success)return {message:'マニュアルを確認してください。'};
 if(form.get('operation')==='delete'){
  if(!id)return {message:'マニュアルを選択してください。'};let q=user.db.from('sales_manuals').delete().eq('id',id).eq('organization_id',user.organizationId);if(user.role!=='organization_admin')q=q.in('department_id',user.departmentIds);const {data,error}=await q.select('id').maybeSingle();if(error||!data)return {message:'削除する権限がありません。'};
 }else{
  let content=String(form.get('content')??'');const file=form.get('file');if(file instanceof File&&file.size){if(!/\.(txt|md)$/i.test(file.name)||file.size>200000)return {message:'20万バイト以下のTXT・Markdownファイルを選択してください。'};content=await file.text();}
  const parsed=z.object({title:z.string().trim().min(1).max(200),content:z.string().trim().min(1).max(20000),departmentId:z.union([z.uuid(),z.literal('')])}).safeParse({title:form.get('title'),content,departmentId:form.get('departmentId')??''});if(!parsed.success)return {message:'タイトル・本文（2万文字以内）・適用部署を確認してください。'};
  const v=parsed.data;if(!v.departmentId&&user.role!=='organization_admin')return {message:'所属部署を選択してください。'};
  if(v.departmentId){let dep=user.db.from('departments').select('id').eq('id',v.departmentId).eq('organization_id',user.organizationId);if(user.role!=='organization_admin')dep=dep.in('id',user.departmentIds);if(!(await dep.maybeSingle()).data)return {message:'この部署のマニュアルを管理する権限がありません。'};}
  const record={organization_id:user.organizationId,department_id:v.departmentId||null,title:v.title,content:v.content,active:form.get('active')==='on',updated_by:user.userId,updated_at:new Date().toISOString()};
  if(id){let q=user.db.from('sales_manuals').update(record).eq('id',id).eq('organization_id',user.organizationId);if(user.role!=='organization_admin')q=q.in('department_id',user.departmentIds);const {data,error}=await q.select('id').maybeSingle();if(error||!data)return {message:'マニュアルを更新できませんでした。'};}
  else if((await user.db.from('sales_manuals').insert(record)).error)return {message:'マニュアルを登録できませんでした。'};
 }
 revalidatePath('/manuals');return {success:true,message:'営業マニュアルを保存しました。'};
}
