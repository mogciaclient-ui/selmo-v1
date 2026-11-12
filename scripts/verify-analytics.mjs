import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { analyticsData } from "../src/infrastructure/supabase/analytics-repository.ts";
import { summarizeMetrics } from "../src/domain/analytics/metrics.ts";
import { networkFields } from "../src/domain/checksheets/schema.ts";
import { salesManualContext } from "../src/infrastructure/supabase/sales-manual-repository.ts";
const require = createRequire(import.meta.url);
const { encodeReply } = require("next/dist/compiled/react-server-dom-webpack/client.node");
const base = process.env.VERIFY_BASE_URL || "http://localhost:3000";
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const auth = getAuth(initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) }));
const suffix = randomBytes(5).toString("hex");
const employeeId = randomUUID(), otherEmployeeId = randomUUID(), userId = randomUUID(), otherUserId = randomUUID();
let uid, cookie, org, dept;
const customerId = randomUUID(), activityId = randomUUID(), firstActivityId = randomUUID(), otherActivityId = randomUUID();
const manualIds = [];
const check = async (q) => { const r = await q; assert.ifError(r.error); return r.data; };
const request = (path, options = {}) => fetch(`${base}${path}`, { ...options, headers: { cookie: cookie || "", ...options.headers } });
async function action(name, path, fields, stateful = true) {
  await (await request(path)).text();
  const manifest = JSON.parse(await readFile(new URL("../.next/dev/server/server-reference-manifest.json", import.meta.url), "utf8"));
  const entry = Object.entries(manifest.node).find(([, value]) => value.exportedName === name); assert(entry, name);
  const form = new FormData(); for (const [key, value] of Object.entries(fields)) form.set(key, String(value));
  const response = await request(path, { method: "POST", redirect: "manual", headers: { origin: base, "next-action": entry[0], accept: "text/x-component" }, body: await encodeReply(stateful ? [{}, form] : [form]) });
  const text = await response.text(); assert(response.status < 400, `${name}: ${response.status} ${text.slice(0, 300)}`);
  console.log(`action verified: ${name}`);
  return text;
}
try {
  org = (await check(db.from("organizations").select("id").eq("name", "Alpha Communications").single())).id;
  dept = (await check(db.from("departments").select("id").eq("organization_id", org).eq("name", "営業").single())).id;
  uid = (await auth.createUser({ email: `todo-${suffix}@example.com` })).uid;
  await check(db.from("employees").insert({ id: employeeId, organization_id: org, primary_department_id: dept, name: `ToDo検証-${suffix}`, status: "active" }));
  await check(db.from("employees").insert({ id: otherEmployeeId, organization_id: org, primary_department_id: dept, name: `ToDo別担当検証-${suffix}`, status: "inactive" }));
  await check(db.from("app_users").insert([{ id: userId, firebase_uid: uid, employee_id: employeeId, organization_id: org, email: `todo-${suffix}@example.com`, role: "sales_rep", status: "active" }, { id: otherUserId, employee_id: otherEmployeeId, organization_id: org, email: `todo-other-${suffix}@example.com`, role: "sales_rep", status: "inactive" }]));
  await check(db.from("app_user_departments").insert({ app_user_id: userId, department_id: dept, is_primary: true }));
  const customToken = await auth.createCustomToken(uid);
  const identity = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) });
  const { idToken } = await identity.json(); assert(idToken);
  const login = await fetch(`${base}/api/auth/session`, { method: "POST", headers: { origin: base, "content-type": "application/json" }, body: JSON.stringify({ idToken }) }); assert.equal(login.status, 200);
  cookie = login.headers.getSetCookie().map(c => c.split(";")[0]).join("; ");
  const axcel = (await check(db.from('departments').select('id').eq('organization_id',org).eq('name','AXCEL').single())).id;
  await check(db.from('app_users').update({status:'active'}).eq('id',otherUserId));await check(db.from('app_user_departments').insert({app_user_id:otherUserId,department_id:axcel,is_primary:true}));
  const path='/analysis?month=2026-11';
  const scope={db,organizationId:org,employeeId,userId,departmentIds:[dept],role:'sales_rep'};
  if(process.env.VERIFY_MANUALS_ONLY!=='1'){
  const daily={reportDate:'2026-10-21',newCalls:'37',newAppointments:'2',userCalls:'3',userAppointments:'1',outsideMinutes:'180',notes:'検証用日報'};
  assert((await action('saveDailyReport',path,daily)).includes('個人日報を保存'));
  await action('saveDailyReport',path,{...daily,newCalls:'47'});
  const dailyRows=await check(db.from('personal_daily_reports').select('employee_id,calls').eq('employee_id',employeeId));assert.equal(dailyRows.length,1);assert.equal(dailyRows[0].calls,50);
  assert(!(await (await request(path)).text()).includes('目標を保存'));
  await check(db.from('app_users').update({role:'department_admin_sales_rep'}).eq('id',userId));
  assert((await action('saveSalesGoal',path,{employeeId,month:'2026-11',targetCount:'5',targetGrossProfit:'100000'})).includes('受注目標を保存'));
  assert((await action('saveSalesGoal',path,{employeeId:otherEmployeeId,month:'2026-11',targetCount:'5',targetGrossProfit:'100000'})).includes('権限がありません'));
  await check(db.from('app_users').update({role:'sales_rep'}).eq('id',userId));
  assert((await action('saveSalesGoal',path,{employeeId,month:'2026-11',targetCount:'9',targetGrossProfit:'100000'})).includes('権限がありません'));
  await check(db.from('customers').insert({id:customerId,organization_id:org,department_id:dept,name:`チェック客先-${suffix}`}));
  const caseId=randomUUID();
  await check(db.from('activities').insert([
   {id:firstActivityId,organization_id:org,department_id:dept,employee_id:employeeId,customer_id:customerId,title:'初訪',activity_type:'visit',status:'completed',starts_at:'2026-10-01T10:00:00+09:00',ends_at:'2026-10-01T11:00:00+09:00',schedule_details:{opportunityId:caseId,customerType:'新規'},common_report:{registrationType:'actual',activityStatus:'提案中',product:'電話機'}},
   {id:activityId,organization_id:org,department_id:dept,employee_id:employeeId,customer_id:customerId,title:'受注訪問',activity_type:'visit',status:'completed',starts_at:'2026-11-02T10:00:00+09:00',ends_at:'2026-11-02T11:00:00+09:00',schedule_details:{opportunityId:caseId,customerType:'新規'},common_report:{registrationType:'actual',activityStatus:'受注',product:'電話機',orderDate:'2026-11-02',orderAmount:'100000',orderGrossProfit:'30000'}},
   {id:otherActivityId,organization_id:org,department_id:axcel,employee_id:otherEmployeeId,customer_id:customerId,title:'別担当訪問',activity_type:'visit',status:'completed',starts_at:'2026-11-02T10:00:00+09:00',ends_at:'2026-11-02T11:00:00+09:00',schedule_details:{customerType:'新規'},common_report:{registrationType:'actual',activityStatus:'提案中',product:'電話機'}}]));
  const data=await analyticsData(scope,'2026-11',[employeeId]);const metrics=summarizeMetrics(data.activities,data.reports,data.goals,'2026-11');assert.equal(metrics.wins,1);assert.equal(metrics.calls,50);assert.equal(metrics.daysTotal,32);assert.equal(metrics.grossProfit,30000);assert.equal(metrics.orderAmount,100000);assert.equal(metrics.targetCount,5);
  const exported=await request(`/api/analytics/export?month=2026-11&selectionProvided=1&employeeIds=${otherEmployeeId}`);assert.equal(exported.status,200);const csv=await exported.text();assert(csv.includes('30000'));assert(!csv.includes('ToDo別担当検証'));
  console.log('daily reports, closing period, goals, weighted totals and month-crossing lead time verified');
  const equipment={type:'ビジネスフォン',manufacturerModel:'検証機種',installedDate:'2020-01-01',dealer:'検証販売店',leaseCompany:'検証リース',monthlyFee:'5000',termMonths:'72',remainingPayments:'6',cancellationFee:'',maintenanceFee:'',baseFee:'',monochromeRate:'',colorRate:''};
  const sheet={activityId,visitDate:'2026-11-02',customerName:`チェック客先-${suffix}`,address:'検証住所',telephone:'09000000000',fax:'',contactName:'',contactTitle:'',collaboration:'',axcel:'',notes:'検証',equipmentJson:JSON.stringify([equipment]),networkJson:JSON.stringify(Object.fromEntries(Object.keys(networkFields).map(k=>[k,''])))};
  const sheetPath=`/activities/${activityId}/checksheet`;
  assert((await action('saveCheckSheet',sheetPath,sheet)).includes('チェックシートを保存'));
  assert((await action('saveCheckSheet',sheetPath,{...sheet,activityId:otherActivityId})).includes('自分の新規訪問'));
  const filtered=await request('/api/checksheets/export?equipment='+encodeURIComponent('ビジネスフォン')+'&remainingMax=12');const sheetCsv=await filtered.text();assert(sheetCsv.includes(sheet.customerName));assert(sheetCsv.includes('検証機種'));
  const excluded=await (await request('/api/checksheets/export?equipment='+encodeURIComponent('ビジネスフォン')+'&remainingMax=3')).text();assert(!excluded.includes(sheet.customerName));
  console.log('visit checklist ownership, equipment persistence, remaining-payment filters and CSV verified');
  }
  await check(db.from('app_users').update({role:'department_admin'}).eq('id',userId));
  await (await request('/manuals')).text();
  await check(db.from('app_users').update({role:'sales_rep'}).eq('id',userId));
  const manual={id:'',operation:'save',title:`マニュアル検証-${suffix}`,content:'質問を先に行い、顧客の課題を確認する。',departmentId:dept,active:'on'};
  assert((await action('saveSalesManual',path,manual)).includes('権限がありません'));
  await check(db.from('app_users').update({role:'department_admin'}).eq('id',userId));
  assert((await action('saveSalesManual','/manuals',manual)).includes('営業マニュアルを保存'));
  manualIds.push(...(await check(db.from('sales_manuals').select('id').eq('updated_by',userId))).map(r=>r.id));
  assert((await action('saveSalesManual','/manuals',{...manual,departmentId:axcel})).includes('権限がありません'));
  const otherManual=await check(db.from('sales_manuals').insert({organization_id:org,department_id:axcel,title:`他部署マニュアル-${suffix}`,content:'他部署専用の内容',active:true}).select('id').single());manualIds.push(otherManual.id);
  const contextManuals=await salesManualContext(db,org,dept);assert(contextManuals.some(m=>m.title===manual.title));assert(!contextManuals.some(m=>m.title===`他部署マニュアル-${suffix}`));
  assert.equal((await analyticsData({...scope,role:'department_admin'},'2026-11',[otherEmployeeId])).activities.length,0);
  await check(db.from('app_users').update({role:'organization_admin'}).eq('id',userId));
  assert((await action('saveSalesGoal',path,{employeeId:otherEmployeeId,month:'2026-11',targetCount:'2',targetGrossProfit:'20000'})).includes('受注目標を保存'));
  if(process.env.VERIFY_MANUALS_ONLY!=='1'){const group=await analyticsData({...scope,role:'organization_admin'},'2026-11',[employeeId,otherEmployeeId]);const total=summarizeMetrics(group.activities,group.reports,group.goals,'2026-11');assert.equal(total.visits,2);assert.equal(total.wins,1);assert.equal(total.targetCount,7);}
  console.log('manual scope, manager/organization permissions and selected-member aggregation verified');
} finally {
  if(manualIds.length)await check(db.from('sales_manuals').delete().in('id',manualIds));
  await check(db.from('sales_manuals').delete().eq('updated_by',userId));
  await check(db.from('visit_check_sheets').delete().eq('activity_id',activityId));
  await check(db.from('personal_daily_reports').delete().in('employee_id',[employeeId,otherEmployeeId]));
  await check(db.from('monthly_sales_goals').delete().in('employee_id',[employeeId,otherEmployeeId]));
  await check(db.from('activities').delete().in('id',[activityId,firstActivityId,otherActivityId]));
  await check(db.from('customers').delete().eq('id',customerId));
  await check(db.from('app_users').delete().in('id',[userId,otherUserId]));
  await check(db.from('employees').delete().in('id',[employeeId,otherEmployeeId]));
  if(uid)await auth.deleteUser(uid);
  console.log('temporary analytics test records removed');
}
