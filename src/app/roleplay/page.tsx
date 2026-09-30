import { AppShell } from "@/components/layout/app-shell";
import { RoleplayWorkspace } from "@/components/roleplay/roleplay-workspace";
import { requireAuth } from "@/lib/auth/require-auth";
import { verifyRoleplayAnalysis, type RoleplayAnalysis } from "@/lib/openai/analyze-roleplay-session";
import { productOptions } from "@/domain/products/defaults";

type MemberRow = { employee_id: string; employees: { name: string } | { name: string }[] | null; app_user_departments: { department_id: string }[] };

export default async function RoleplayPage({ searchParams }: { searchParams: Promise<{ departmentId?: string; employeeId?: string }> }) {
  const query = await searchParams;
  const context = await requireAuth();
  const [{ data: departmentRows }, { data: memberRows }] = await Promise.all([
    context.db.from("departments").select("id,name").eq("organization_id", context.organizationId).order("name"),
    context.db.from("app_users").select("employee_id,employees(name),app_user_departments(department_id)").eq("organization_id", context.organizationId).eq("status", "active"),
  ]);
  const departments = (departmentRows ?? []).filter((department) => context.role === "organization_admin" || context.departmentIds.includes(department.id));
  const selectedDepartmentId = context.role === "organization_admin" && query.departmentId && departments.some((department) => department.id === query.departmentId) ? query.departmentId : "";
  const members = ((memberRows ?? []) as unknown as MemberRow[]).filter((member) => context.role === "organization_admin" || member.app_user_departments.some((department) => context.departmentIds.includes(department.department_id))).filter((member) => !selectedDepartmentId || member.app_user_departments.some((department) => department.department_id === selectedDepartmentId)).map((member) => ({ id: member.employee_id, name: relation(member.employees)?.name ?? "名称未設定" })).sort((left, right) => left.name.localeCompare(right.name, "ja"));
  const selectedEmployeeId = context.role !== "sales_rep" && query.employeeId && members.some((member) => member.id === query.employeeId) ? query.employeeId : "";
  let historyQuery = context.db.from("roleplay_sessions").select("id,title,product_name,category,score,completed_at,analysis,messages,employee_id,department_id,employees(name)").eq("organization_id", context.organizationId).order("completed_at", { ascending: false }).limit(200);
  if (context.role === "sales_rep") historyQuery = historyQuery.eq("employee_id", context.employeeId);
  if (context.role === "department_admin") historyQuery = historyQuery.in("department_id", context.departmentIds);
  if (selectedDepartmentId) historyQuery = historyQuery.eq("department_id", selectedDepartmentId);
  if (selectedEmployeeId) historyQuery = historyQuery.eq("employee_id", selectedEmployeeId);
  const [{ data: productRows }, { data: scenarioRows }, { data: historyRows }] = await Promise.all([
    context.db.from("products").select("name").eq("organization_id", context.organizationId).eq("status", "active").order("name"),
    context.db.from("roleplay_scenarios").select("id,title,category,difficulty,customer_role,customer_profile,practice_goal,product_name,expected_objections,scoring_criteria,custom_fields").eq("organization_id", context.organizationId).order("updated_at", { ascending: false }),
    historyQuery,
  ]);
  const scenarios = (scenarioRows ?? []).map((item) => ({ id: item.id, title: item.title, category: item.category, difficulty: item.difficulty, customer: [item.customer_role, item.customer_profile].filter(Boolean).join("｜"), objective: item.practice_goal, minutes: 10, product: item.product_name, expectedObjections: item.expected_objections ?? "", scoringCriteria: item.scoring_criteria ?? "", customFields: Array.isArray(item.custom_fields) ? item.custom_fields as { label: string; value: string }[] : [] }));
  const histories = (historyRows ?? []).map((item) => { const analysis = item.analysis as RoleplayAnalysis | null; const messages = Array.isArray(item.messages) ? item.messages as { role: "customer" | "sales"; text: string }[] : []; return { id: item.id, title: item.title, product: item.product_name ?? "—", category: item.category ?? "—", score: item.score, completedAt: item.completed_at, employeeName: relation(item.employees)?.name ?? "担当者不明", analysis: analysis ? verifyRoleplayAnalysis(analysis, messages) : undefined }; });
  return <AppShell active="/roleplay" displayName={context.displayName} department={context.departmentName}><RoleplayWorkspace products={productOptions((productRows ?? []).map((item) => item.name))} savedScenarios={scenarios} initialHistories={histories} canViewTeam={context.role !== "sales_rep"} historyOnly={context.role !== "sales_rep"} departments={context.role === "organization_admin" ? departments : []} selectedDepartmentId={selectedDepartmentId} members={members} selectedEmployeeId={selectedEmployeeId} /></AppShell>;
}

function relation<T>(value: T | T[] | null) { return Array.isArray(value) ? value[0] : value; }
