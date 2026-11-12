import type { SupabaseClient } from '@supabase/supabase-js';
export async function salesManualContext(db:SupabaseClient,organizationId:string,departmentId:string){
 const manuals:{title:string;content:string}[]=[];
 for(let start=0;;start+=1000){const {data,error}=await db.from('sales_manuals').select('title,content').eq('organization_id',organizationId).eq('active',true).or(`department_id.is.null,department_id.eq.${departmentId}`).order('updated_at',{ascending:false}).order('id').range(start,start+999);if(error)throw new Error('営業マニュアルを取得できませんでした。');manuals.push(...data);if(data.length<1000)break;}
 if(manuals.reduce((sum,m)=>sum+m.content.length,0)>80000)throw new Error('分析対象マニュアルの本文合計を8万文字以内に調整してください。');
 return manuals;
}
