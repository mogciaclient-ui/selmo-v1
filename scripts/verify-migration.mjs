import { createClient } from "@supabase/supabase-js";

const required = ["SUPABASE_URL", "SUPABASE_SECRET_KEY"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`未設定の環境変数: ${missing.join(", ")}`);

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function count(table) {
  const { count: value, error } = await db.from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(`${table}の件数取得に失敗しました: ${error.message}`);
  return value ?? 0;
}

const tables = ["organizations", "departments", "profiles", "customers", "activities", "employees", "app_users"];
const entries = await Promise.all(tables.map(async (table) => [table, await count(table)]));
const counts = Object.fromEntries(entries);
console.table(counts);

const [{ data: activities, error: activityError }, { data: employees, error: employeeError }] = await Promise.all([
  db.from("activities").select("id,organization_id,employee_id"),
  db.from("employees").select("id,organization_id"),
]);
if (activityError) {
  console.error(`NG: 活動担当者の検査に失敗しました: ${activityError.message}`);
  console.error("マイグレーションが未適用または途中状態です。supabase/migrationsを順番に適用してください。");
  process.exit(1);
}
if (employeeError) {
  console.error(`NG: Employeeの検査に失敗しました: ${employeeError.message}`);
  process.exit(1);
}
const employeesById = new Map((employees ?? []).map((employee) => [employee.id, employee]));
const invalidActivities = (activities ?? []).filter((activity) => {
  const employee = employeesById.get(activity.employee_id);
  return !activity.employee_id || !employee || employee.organization_id !== activity.organization_id;
});

const problems = [];
if (counts.employees !== counts.profiles) problems.push(`employees(${counts.employees})とprofiles(${counts.profiles})の件数が一致しません`);
if (counts.app_users !== counts.profiles) problems.push(`app_users(${counts.app_users})とprofiles(${counts.profiles})の件数が一致しません`);
if (invalidActivities.length) problems.push(`担当Employee不整合のactivitiesが${invalidActivities.length}件あります`);

if (problems.length) {
  for (const problem of problems) console.error(`NG: ${problem}`);
  process.exitCode = 1;
} else {
  console.log("OK: ユーザー分離件数とactivities担当者整合性を確認しました。");
}
