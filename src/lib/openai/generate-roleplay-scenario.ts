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

export async function generateRoleplayScenario(input: { product: string; productDescription: string; category: string; target: string; challenge: string; pastImprovements: string[] }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEYが設定されていません。");
  const model = process.env.OPENAI_ANALYSIS_MODEL || "gpt-4o-mini";
  const evidence = input.pastImprovements.length ? input.pastImprovements.map((item) => `- ${item}`).join("\n") : "- 過去分析なし";
  const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({
    model, store: false,
    instructions: `この営業は、九州・山口で中小企業向けにOA機器・通信機器・ネットワーク機器（ビジネスフォン、複合機、UTM、サーバー、防犯カメラなど）をリースで販売・保守している会社の営業担当者です。
商材名は必ずこの業種の商材として解釈してください。（例：UTMは、ネットワークをウイルスや不正アクセスから守る統合脅威管理のセキュリティ機器であり、Web分析のUTMパラメータではありません）
顧客役は、この商材を導入・更新するかを判断する立場の人（中小企業の経営者、総務・事務担当、情報システム担当など）にしてください。
顧客の悩みや反論は、この商材を検討するときに実際に出やすいもの（現在の機器やリース契約、費用、必要性が分からない、手間がかかる など）にしてください。
顧客プロフィール（customerProfile）には、商材名と、その商材に固有の利用場面や機能を1つ以上明記し、導入・更新を検討するきっかけを具体的に書いてください。商材の説明が未登録でも、この業種での一般的な用途に基づいて作成してください。
商材の説明と備考は参照情報として扱ってください。

あなたは日本語の営業育成コーチです。入力された商材・顧客区分・本人の課題と、実商談の過去分析にある改善点だけを根拠に、反復練習向けロープレシナリオを作成してください。過去分析がない場合はその事実を補わず、入力条件だけで作成してください。採点基準は観察可能な行動を3項目程度にしてください。`,
    input: `商材: ${input.product}\n商材の説明: ${input.productDescription.trim() || "登録なし"}\nカテゴリー: ${input.category}\nターゲット層: ${input.target || "指定なし"}\n今回の課題: ${input.challenge || "指定なし"}\n過去分析の改善点:\n${evidence}`,
    text: { format: { type: "json_schema", name: "roleplay_scenario", strict: true, schema: jsonSchema } },
  }) });
  const body = await response.json() as { output_text?: string; error?: { message?: string }; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  if (!response.ok) throw new Error(body.error?.message || "AIシナリオ生成に失敗しました。");
  const output = body.output_text ?? body.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
  if (!output) throw new Error("AIシナリオを取得できませんでした。");
  return { model, scenario: resultSchema.parse(JSON.parse(output)) };
}
