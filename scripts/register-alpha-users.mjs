import { createClient } from "@supabase/supabase-js";

for (const name of ["SUPABASE_URL", "SUPABASE_SECRET_KEY"]) {
  if (!process.env[name]) throw new Error(`未設定の環境変数: ${name}`);
}

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: organization, error: organizationError } = await db.from("organizations").select("id").eq("name", "Alpha Communications").single();
if (organizationError) throw organizationError;
const { data: departments, error: departmentError } = await db.from("departments").select("id,name").eq("organization_id", organization.id).in("name", ["営業", "AXCEL"]);
if (departmentError) throw departmentError;
const departmentIds = new Map(departments.map((department) => [department.name, department.id]));
const salesDepartmentId = departmentIds.get("営業");
const axcelDepartmentId = departmentIds.get("AXCEL");
if (!salesDepartmentId || !axcelDepartmentId) throw new Error("営業またはAXCEL部署がありません。");

const users = [
  { name: "木村", email: "kimura@alpha-communications.co.jp", uid: "EUi0XXO7VvWFXNw49vwL0bmpou42", role: "organization_admin", departments: [salesDepartmentId, axcelDepartmentId] },
  { name: "西村", email: "nishimura@alpha-communications.co.jp", uid: "xubZZDsisaVPLJTdePs2gZrn6Kn2", role: "department_admin", departments: [salesDepartmentId] },
  { name: "松本", email: "matsumoto@alpha-communications.co.jp", uid: "Paah9EFuwGXpREJdHwjKzhDOxzB3", role: "sales_rep", departments: [salesDepartmentId] },
  { name: "沖中", email: "okinaka@alpha-communications.co.jp", uid: "1IpkIlNd5wN7yq0QgVpl2mebWpO2", role: "sales_rep", departments: [salesDepartmentId] },
  { name: "三角", email: "misumi@alpha-communications.co.jp", uid: "G954bl3A4BO64vYzsa1ElDZXd8e2", role: "sales_rep", departments: [salesDepartmentId] },
];

for (const user of users) {
  const { data: existingAppUser, error: appUserLookupError } = await db.from("app_users").select("id,employee_id").eq("email", user.email).maybeSingle();
  if (appUserLookupError) throw appUserLookupError;

  let employeeId = existingAppUser?.employee_id;
  if (!employeeId) {
    const { data: existingEmployee, error: employeeLookupError } = await db.from("employees").select("id").eq("organization_id", organization.id).eq("email", user.email).maybeSingle();
    if (employeeLookupError) throw employeeLookupError;
    employeeId = existingEmployee?.id;
  }

  if (employeeId) {
    const { error } = await db.from("employees").update({ name: user.name, primary_department_id: user.departments[0], status: "active", updated_at: new Date().toISOString() }).eq("id", employeeId);
    if (error) throw error;
  } else {
    const { data: employee, error } = await db.from("employees").insert({ organization_id: organization.id, name: user.name, email: user.email, primary_department_id: user.departments[0], status: "active" }).select("id").single();
    if (error) throw error;
    employeeId = employee.id;
  }

  let appUserId = existingAppUser?.id;
  if (appUserId) {
    const { error } = await db.from("app_users").update({ firebase_uid: user.uid, organization_id: organization.id, employee_id: employeeId, role: user.role, status: "active", updated_at: new Date().toISOString() }).eq("id", appUserId);
    if (error) throw error;
  } else {
    const { data: appUser, error } = await db.from("app_users").insert({ firebase_uid: user.uid, organization_id: organization.id, employee_id: employeeId, email: user.email, role: user.role, status: "active" }).select("id").single();
    if (error) throw error;
    appUserId = appUser.id;
  }

  const { error: deleteMembershipError } = await db.from("app_user_departments").delete().eq("app_user_id", appUserId);
  if (deleteMembershipError) throw deleteMembershipError;
  const { error: membershipError } = await db.from("app_user_departments").insert(user.departments.map((departmentId, index) => ({ app_user_id: appUserId, department_id: departmentId, is_primary: index === 0 })));
  if (membershipError) throw membershipError;
  console.log(`${user.email}: ${user.role}`);
}
