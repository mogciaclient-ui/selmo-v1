"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { generateRoleplayScenario } from "@/lib/openai/generate-roleplay-scenario";
import { analyzeRoleplaySession, type RoleplayAnalysis } from "@/lib/openai/analyze-roleplay-session";

const requestSchema = z.object({ product: z.string().trim().min(1).max(200), category: z.enum(["新規", "既存"]), target: z.string().trim().max(500), challenge: z.string().trim().max(1000) });
const scenarioSchema = requestSchema.extend({ title: z.string().trim().min(1).max(200), customerRole: z.string().trim().max(200), difficulty: z.enum(["やさしい", "標準", "難しい"]), summary: z.string().trim().max(2000), customerProfile: z.string().trim().max(3000), practiceGoal: z.string().trim().min(1).max(2000), expectedObjections: z.string().trim().max(3000), scoringCriteria: z.string().trim().max(3000), customFields: z.array(z.object({ label: z.string().trim().max(100), value: z.string().trim().max(1000) })).max(20) });
const savedScenarioSchema = scenarioSchema.extend({ sourceAnalysisIds: z.array(z.uuid()).max(20), aiModel: z.string().trim().max(100) });
export type GeneratedScenario = z.infer<typeof savedScenarioSchema>;
export type SavedScenario = { id: string; title: string; category: string; difficulty: string; customer: string; objective: string; minutes: number; product?: string; expectedObjections?: string; scoringCriteria?: string; customFields?: { label: string; value: string }[] };
export type RoleplayHistory = { id: string; title: string; product: string; category: string; score: number; completedAt: string; employeeName?: string; analysis?: RoleplayAnalysis };

export async function generateScenarioDraft(input: z.infer<typeof requestSchema>): Promise<{ data?: GeneratedScenario; message?: string }> {
  const context = await getCurrentUser(); if (!context) return { message: "ログインし直してください。" };
  const parsed = requestSchema.safeParse(input); if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };
  const { data: product } = await context.db.from("products").select("id").eq("organization_id", context.organizationId).eq("status", "active").eq("name", parsed.data.product).maybeSingle();
  if (!product) return { message: "有効な商材を選択してください。" };
  let analysisQuery = context.db.from("activity_ai_analyses").select("activity_id,analysis,activities!inner(employee_id,department_id)").eq("organization_id", context.organizationId).eq("status", "completed").order("updated_at", { ascending: false }).limit(20);
  if (context.role === "sales_rep") analysisQuery = analysisQuery.eq("activities.employee_id", context.employeeId);
  if (context.role === "department_admin") analysisQuery = analysisQuery.in("activities.department_id", context.departmentIds);
  const { data: rows } = await analysisQuery;
  const analyses = (rows ?? []) as unknown as { activity_id: string; analysis: { improvements?: { point?: string; evidence?: string }[] } | null }[];
  const improvements = analyses.flatMap((row) => row.analysis?.improvements ?? []).map((item) => [item.point, item.evidence].filter(Boolean).join("：")).filter(Boolean).slice(0, 12);
  try { const generated = await generateRoleplayScenario({ ...parsed.data, pastImprovements: improvements }); return { data: { ...parsed.data, ...generated.scenario, customFields: [], sourceAnalysisIds: analyses.map((row) => row.activity_id), aiModel: generated.model } }; }
  catch (error) { return { message: error instanceof Error ? error.message : "AIシナリオ生成に失敗しました。" }; }
}

export async function saveRoleplayScenario(input: GeneratedScenario): Promise<{ data?: SavedScenario; message?: string }> {
  const context = await getCurrentUser(); if (!context) return { message: "ログインし直してください。" };
  const parsed = savedScenarioSchema.safeParse(input); if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };
  const value = parsed.data;
  const { data: product } = await context.db.from("products").select("id").eq("organization_id", context.organizationId).eq("status", "active").eq("name", value.product).maybeSingle(); if (!product) return { message: "有効な商材を選択してください。" };
  const { data, error } = await context.db.from("roleplay_scenarios").insert({ organization_id: context.organizationId, created_by: context.userId, product_name: value.product, category: value.category, target_segment: value.target || null, challenge: value.challenge || null, title: value.title, customer_role: value.customerRole || null, difficulty: value.difficulty, summary: value.summary || null, customer_profile: value.customerProfile || null, practice_goal: value.practiceGoal, expected_objections: value.expectedObjections || null, scoring_criteria: value.scoringCriteria || null, custom_fields: value.customFields, source_analysis_ids: value.sourceAnalysisIds, ai_model: value.aiModel || null }).select("id").single();
  if (error || !data) return { message: error?.code === "42P01" ? "ロープレ用のDB更新が未適用です。" : "シナリオを保存できませんでした。" };
  revalidatePath("/roleplay"); return { data: { id: data.id, title: value.title, category: value.category, difficulty: value.difficulty, customer: [value.customerRole, value.customerProfile].filter(Boolean).join("｜"), objective: value.practiceGoal, minutes: 10, product: value.product, expectedObjections: value.expectedObjections, scoringCriteria: value.scoringCriteria, customFields: value.customFields } };
}

const sessionSchema = z.object({ scenarioId: z.string().max(100), title: z.string().trim().min(1).max(200), product: z.string().trim().max(200), category: z.string().trim().max(100), objective: z.string().trim().max(2000), expectedObjections: z.string().trim().max(3000), scoringCriteria: z.string().trim().max(3000), customFields: z.array(z.object({ label: z.string().max(100), value: z.string().max(1000) })).max(20), messages: z.array(z.object({ role: z.enum(["customer", "sales"]), text: z.string().max(5000) })).min(2).max(200) });
export async function saveRoleplaySession(input: z.infer<typeof sessionSchema>): Promise<{ data?: RoleplayHistory; message?: string }> {
  const context = await getCurrentUser(); if (!context) return { message: "ログインし直してください。" };
  const parsed = sessionSchema.safeParse(input); if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "ロープレ結果を確認してください。" };
  const value = parsed.data; const scenarioId = z.uuid().safeParse(value.scenarioId).success ? value.scenarioId : null; const completedAt = new Date().toISOString();
  let evaluated; try { evaluated = await analyzeRoleplaySession(value); } catch (error) { return { message: error instanceof Error ? error.message : "ロープレ分析に失敗しました。" }; }
  const { data: primaryDepartment } = await context.db.from("app_user_departments").select("department_id").eq("app_user_id", context.userId).order("is_primary", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await context.db.from("roleplay_sessions").insert({ organization_id: context.organizationId, department_id: primaryDepartment?.department_id ?? context.departmentIds[0] ?? null, employee_id: context.employeeId, scenario_id: scenarioId, scenario_key: scenarioId ? null : value.scenarioId, title: value.title, product_name: value.product || null, category: value.category || null, score: evaluated.analysis.score, messages: value.messages, analysis: evaluated.analysis, analysis_model: evaluated.model, completed_at: completedAt }).select("id").single();
  if (error || !data) return { message: error?.code === "42P01" ? "ロープレ履歴用のDB更新が未適用です。" : "ロープレ履歴を保存できませんでした。" };
  revalidatePath("/roleplay"); return { data: { id: data.id, title: value.title, product: value.product, category: value.category, score: evaluated.analysis.score, completedAt, employeeName: context.displayName, analysis: evaluated.analysis } };
}
