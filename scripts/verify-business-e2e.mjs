import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createSalesActivity } from "../src/application/activities/create-sales-activity.ts";
import { deleteSalesActivity } from "../src/application/activities/delete-sales-activity.ts";
import { saveActivityResult } from "../src/application/activities/save-activity-result.ts";
import { updateSalesActivity } from "../src/application/activities/update-sales-activity.ts";
import { removeCustomer, saveCustomer } from "../src/application/customers/manage-customer.ts";
import { createSupabaseCustomerRepository } from "../src/infrastructure/supabase/customer-repository.ts";
import { createSupabaseDashboardRepository } from "../src/infrastructure/supabase/dashboard-repository.ts";
import { createSupabaseSalesActivityRepository } from "../src/infrastructure/supabase/sales-activity-repository.ts";

const required = ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "BOOTSTRAP_ADMIN_EMAIL"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`未設定の環境変数: ${missing.join(", ")}`);

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const suffix = randomBytes(6).toString("hex");
const customerName = `E2E顧客-${suffix}`;
let customerId;
let activityId;

try {
  const { data: admin, error } = await db.from("app_users").select("organization_id,employee_id,role,app_user_departments(department_id)").eq("email", process.env.BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase()).single();
  if (error) throw error;
  const departmentId = admin.app_user_departments[0]?.department_id;
  if (!departmentId) throw new Error("管理者の所属部門がありません。");
  const scope = { organizationId: admin.organization_id, employeeId: admin.employee_id, role: admin.role, departmentIds: admin.app_user_departments.map((item) => item.department_id) };
  const customerRepository = createSupabaseCustomerRepository(db, scope);
  const activityRepository = createSupabaseSalesActivityRepository(db, scope);
  const dashboardRepository = createSupabaseDashboardRepository(db, scope);

  await saveCustomer(customerRepository, { departmentId, name: customerName, phone: "03-0000-0000", address: "E2E住所", notes: "登録確認" });
  const createdCustomer = (await customerRepository.findAll(customerName)).find((item) => item.name === customerName);
  if (!createdCustomer) throw new Error("登録した顧客を取得できませんでした。");
  customerId = createdCustomer.id;
  await saveCustomer(customerRepository, { id: customerId, departmentId, name: `${customerName}-更新`, phone: "03-1111-1111", address: "E2E更新住所", notes: "編集確認" });
  const updatedCustomer = (await customerRepository.findAll(`${customerName}-更新`)).find((item) => item.id === customerId);
  if (updatedCustomer?.notes !== "編集確認") throw new Error("顧客編集結果を取得できませんでした。");

  const startsAt = new Date(Date.now() + 3_600_000).toISOString();
  const endsAt = new Date(Date.now() + 7_200_000).toISOString();
  activityId = await createSalesActivity(activityRepository, { departmentId, customerId, newCustomerName: null, title: `E2E予定-${suffix}`, activityType: "visit", startsAt, endsAt });
  await updateSalesActivity(activityRepository, { id: activityId, title: `E2E予定-${suffix}-更新`, activityType: "online", startsAt, endsAt });
  await saveActivityResult(activityRepository, activityId, "E2E活動結果");
  const activities = await dashboardRepository.findActivitiesBetween(new Date().toISOString(), new Date(Date.now() + 86_400_000).toISOString());
  const completed = activities.find((item) => item.id === activityId);
  if (completed?.title !== `E2E予定-${suffix}-更新` || completed.result !== "E2E活動結果" || completed.status !== "completed") {
    throw new Error("予定編集または活動結果を取得できませんでした。");
  }

  await deleteSalesActivity(activityRepository, activityId);
  activityId = undefined;
  await removeCustomer(customerRepository, customerId);
  customerId = undefined;
  console.log("OK: 顧客の登録・検索・編集・削除を確認しました。");
  console.log("OK: 予定の登録・編集・削除と活動結果の入力・編集を確認しました。");
} finally {
  if (activityId) await db.from("activities").delete().eq("id", activityId);
  if (customerId) await db.from("customers").delete().eq("id", customerId);
}
