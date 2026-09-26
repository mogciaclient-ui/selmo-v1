import "server-only";

import { z } from "zod";

const resultSchema = z.object({
  title: z.string(), customerRole: z.string(), difficulty: z.enum(["やさしい", "標準", "難しい"]),
  summary: z.string(), customerProfile: z.string(), practiceGoal: z.string(),
  expectedObjections: z.string(), scoringCriteria: z.string(),
});

const jsonSchema = {
  type: "object", additionalProperties: false,
  properties: {
    title: { type: "string" }, customerRole: { type: "string" }, difficulty: { type: "string", enum: ["やさしい", "標準", "難しい"] },
    summary: { type: "string" }, customerProfile: { type: "string" }, practiceGoal: { type: "string" },
    expectedObjections: { type: "string" }, scoringCriteria: { type: "string" },
  },
  required: ["title", "customerRole", "difficulty", "summary", "customerProfile", "practiceGoal", "expectedObjections", "scoringCriteria"],
} as const;

export async function generateRoleplayScenario(input: { product: string; category: string; target: string; challenge: string; pastImprovements: string[] }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEYが設定されていません。");
  const model = process.env.OPENAI_ANALYSIS_MODEL || "gpt-4o-mini";
  const evidence = input.pastImprovements.length ? input.pastImprovements.map((item) => `- ${item}`).join("\n") : "- 過去分析なし";
  const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({
    model, store: false,
    instructions: "あなたは日本語の営業育成コーチです。入力された商材・顧客区分・本人の課題と、実商談の過去分析にある改善点だけを根拠に、反復練習向けロープレシナリオを作成してください。過去分析がない場合はその事実を補わず、入力条件だけで作成してください。採点基準は観察可能な行動を3項目程度にしてください。",
    input: `商材: ${input.product}\nカテゴリー: ${input.category}\nターゲット層: ${input.target || "指定なし"}\n今回の課題: ${input.challenge || "指定なし"}\n過去分析の改善点:\n${evidence}`,
    text: { format: { type: "json_schema", name: "roleplay_scenario", strict: true, schema: jsonSchema } },
  }) });
  const body = await response.json() as { output_text?: string; error?: { message?: string }; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  if (!response.ok) throw new Error(body.error?.message || "AIシナリオ生成に失敗しました。");
  const output = body.output_text ?? body.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
  if (!output) throw new Error("AIシナリオを取得できませんでした。");
  return { model, scenario: resultSchema.parse(JSON.parse(output)) };
}
