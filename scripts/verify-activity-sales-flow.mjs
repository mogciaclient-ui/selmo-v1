import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { syncOpportunityFromActivity } from "../src/lib/activities/sync-opportunity-from-activity.ts";

const required = ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "BOOTSTRAP_ADMIN_EMAIL"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`未設定の環境変数: ${missing.join(", ")}`);

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const suffix = randomBytes(6).toString("hex");
let customerId;
let activityId;
let opportunityId;

try {
  const { data: admin, error: adminError } = await db.from("app_users").select("organization_id,employee_id,app_user_departments(department_id)").eq("email", process.env.BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase()).single();
  if (adminError) throw adminError;
  const departmentId = admin.app_user_departments[0]?.department_id;
  if (!departmentId) throw new Error("検証用の所属部門がありません。");

  const { data: customer, error: customerError } = await db.from("customers").insert({ organization_id: admin.organization_id, department_id: departmentId, assigned_employee_id: admin.employee_id, name: `活動連携E2E-${suffix}` }).select("id").single();
  if (customerError) throw customerError;
  customerId = customer.id;

  const activityDate = new Date().toISOString().slice(0, 10);
  const { data: activity, error: activityError } = await db.from("activities").insert({ organization_id: admin.organization_id, department_id: departmentId, customer_id: customerId, employee_id: admin.employee_id, title: `新規提案-${suffix}`, activity_type: "visit", starts_at: `${activityDate}T01:00:00.000Z`, ends_at: `${activityDate}T02:00:00.000Z` }).select("id").single();
  if (activityError) throw activityError;
  activityId = activity.id;

  const base = { organizationId: admin.organization_id, activityId, departmentId, customerId, employeeId: admin.employee_id, title: `新規提案-${suffix}`, activityDate, opportunityName: `案件-${suffix}`, product: "複合機", salesType: "IT営業活動", salesProcess: "提案" };
  await syncOpportunityFromActivity(db, base);
  await syncOpportunityFromActivity(db, { ...base, activityStatus: "受注", confidence: "A：高" });

  const { data: opportunities, error: opportunityError } = await db.from("opportunities").select("id,status,confidence,customer_id,source_activity_id,expected_close_date").eq("source_activity_id", activityId);
  if (opportunityError) throw opportunityError;
  if (opportunities.length !== 1) throw new Error(`案件が${opportunities.length}件作成されました。1件である必要があります。`);
  const opportunity = opportunities[0];
  opportunityId = opportunity.id;
  if (opportunity.status !== "won" || opportunity.confidence !== "A" || opportunity.customer_id !== customerId || opportunity.expected_close_date !== activityDate) throw new Error("活動内容が案件・受注情報へ正しく反映されていません。");

  const { data: linkedActivity, error: linkedError } = await db.from("activities").select("id,customer_id").eq("id", activityId).single();
  if (linkedError || linkedActivity.customer_id !== customerId) throw new Error("活動が顧客へ連携されていません。");

  console.log("OK: 活動は顧客に連携されています。");
  console.log("OK: 予定登録から案件が自動生成されます。");
  console.log("OK: 活動報告の受注・確度・予定日が同じ案件へ反映され、重複しません。");
} finally {
  if (opportunityId) await db.from("opportunities").delete().eq("id", opportunityId);
  if (activityId) await db.from("activities").delete().eq("id", activityId);
  if (customerId) await db.from("customers").delete().eq("id", customerId);
}
