import "server-only";

import { z } from "zod";

const feedback = z.object({ point: z.string(), evidence: z.string() });
const criterion = z.object({ criterion: z.string(), score: z.number().int().min(0).max(100), evidence: z.string() });
const habit = z.object({ habit: z.string(), occurrences: z.number().int().min(0), examples: z.array(z.string()), coaching: z.string() });
const resultSchema = z.object({ score: z.number().int().min(0).max(100), summary: z.string(), strengths: z.array(feedback), improvements: z.array(feedback), criterionResults: z.array(criterion), speechHabits: z.array(habit), salesCharacterShare: z.number().int().min(0).max(100), customerCharacterShare: z.number().int().min(0).max(100), questionCount: z.number().int().min(0), nextPractice: z.string() });
export type RoleplayAnalysis = z.infer<typeof resultSchema>;

function normalizeSpeech(value: string) { return value.normalize("NFKC").toLowerCase().replace(/[\s、。,.!?！？：:・「」『』“”"'（）()]/g, ""); }
function countOccurrences(source: string, phrase: string) { if (!phrase) return 0; let count = 0; let position = 0; while ((position = source.indexOf(phrase, position)) !== -1) { count += 1; position += phrase.length; } return count; }
function verifiedHabits(candidates: RoleplayAnalysis["speechHabits"], salesMessages: string[]) {
  const normalizedMessages = salesMessages.map(normalizeSpeech);
  return candidates.flatMap((candidate) => {
    const phrase = normalizeSpeech(candidate.habit.replace(/[~〜…].*$/u, ""));
    if (phrase.length < 2 || /[~〜…]/u.test(candidate.habit)) return [];
    const occurrences = normalizedMessages.reduce((total, message) => total + countOccurrences(message, phrase), 0);
    if (occurrences < 2) return [];
    const examples = salesMessages.filter((_, index) => normalizedMessages[index]?.includes(phrase)).slice(0, 3).map((message) => `営業: ${message}`);
    return [{ ...candidate, occurrences, examples }];
  });
}
function conversationMetrics(messages: { role: "customer" | "sales"; text: string }[]) {
  const salesMessages = messages.filter((item) => item.role === "sales").map((item) => item.text.trim()).filter(Boolean);
  const customerMessages = messages.filter((item) => item.role === "customer").map((item) => item.text.trim()).filter(Boolean);
  const salesCharacters = salesMessages.reduce((total, item) => total + normalizeSpeech(item).length, 0);
  const customerCharacters = customerMessages.reduce((total, item) => total + normalizeSpeech(item).length, 0);
  const totalCharacters = salesCharacters + customerCharacters;
  const salesCharacterShare = totalCharacters ? Math.round((salesCharacters / totalCharacters) * 100) : 0;
  const questionCount = salesMessages.flatMap((message) => message.split(/[。.!！\n]+/).map((part) => part.trim()).filter(Boolean)).filter((sentence) => /[?？]$/.test(sentence) || /(ですか|ますか|でしょうか|ませんか|いかがですか|教えてください)$/u.test(sentence)).length;
  return { salesMessages, salesCharacterShare, customerCharacterShare: totalCharacters ? 100 - salesCharacterShare : 0, questionCount };
}
export function verifyRoleplayAnalysis(analysis: RoleplayAnalysis, messages: { role: "customer" | "sales"; text: string }[]): RoleplayAnalysis {
  const metrics = conversationMetrics(messages);
  return { ...analysis, speechHabits: verifiedHabits(analysis.speechHabits ?? [], metrics.salesMessages), salesCharacterShare: metrics.salesCharacterShare, customerCharacterShare: metrics.customerCharacterShare, questionCount: metrics.questionCount };
}

const schema = { type: "object", additionalProperties: false, properties: {
  score: { type: "integer", minimum: 0, maximum: 100 }, summary: { type: "string" },
  strengths: { type: "array", items: { type: "object", additionalProperties: false, properties: { point: { type: "string" }, evidence: { type: "string" } }, required: ["point", "evidence"] } },
  improvements: { type: "array", items: { type: "object", additionalProperties: false, properties: { point: { type: "string" }, evidence: { type: "string" } }, required: ["point", "evidence"] } },
  criterionResults: { type: "array", items: { type: "object", additionalProperties: false, properties: { criterion: { type: "string" }, score: { type: "integer", minimum: 0, maximum: 100 }, evidence: { type: "string" } }, required: ["criterion", "score", "evidence"] } },
  speechHabits: { type: "array", items: { type: "object", additionalProperties: false, properties: { habit: { type: "string" }, occurrences: { type: "integer", minimum: 0 }, examples: { type: "array", items: { type: "string" } }, coaching: { type: "string" } }, required: ["habit", "occurrences", "examples", "coaching"] } },
  salesCharacterShare: { type: "integer", minimum: 0, maximum: 100 }, customerCharacterShare: { type: "integer", minimum: 0, maximum: 100 }, questionCount: { type: "integer", minimum: 0 },
  nextPractice: { type: "string" },
}, required: ["score", "summary", "strengths", "improvements", "criterionResults", "speechHabits", "salesCharacterShare", "customerCharacterShare", "questionCount", "nextPractice"] } as const;

export async function analyzeRoleplaySession(input: { title: string; product: string; category: string; objective: string; expectedObjections: string; scoringCriteria: string; customFields: { label: string; value: string }[]; messages: { role: "customer" | "sales"; text: string }[] }) {
  const apiKey = process.env.OPENAI_API_KEY; if (!apiKey) throw new Error("OPENAI_API_KEYが設定されていません。");
  const model = process.env.OPENAI_ANALYSIS_MODEL || "gpt-4o-mini";
  const transcript = input.messages.map((item) => `${item.role === "sales" ? "営業" : "顧客"}: ${item.text}`).join("\n");
  const custom = input.customFields.map((item) => `${item.label}: ${item.value}`).join("\n") || "なし";
  const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, store: false,
    instructions: "あなたは日本語の営業ロープレ評価者です。会話記録に実際に現れた営業担当者の発言だけを根拠に評価してください。顧客役の発言を営業の成果として数えないでください。発言が確認できない項目は未達として扱い、根拠を捏造しないでください。総合点は採点基準と練習ゴールへの達成度から算出し、甘すぎる固定点を避けてください。強みと改善点には会話から短い根拠を示してください。speechHabitsには営業発言内で完全に同じ語句が実際に2回以上現れた場合だけ、その原文の語句をhabitへ入れてください。言い換え、要約、ワイルドカード、顧客発言は含めないでください。回数・例・発話量・質問数はサーバー側で再計算されます。",
    input: `シナリオ: ${input.title}\n商材: ${input.product || "未指定"}\nカテゴリー: ${input.category}\n練習ゴール: ${input.objective}\n想定反論: ${input.expectedObjections || "指定なし"}\n採点基準: ${input.scoringCriteria || "指定なし"}\n追加条件:\n${custom}\n\n会話記録:\n${transcript || "会話なし"}`,
    text: { format: { type: "json_schema", name: "roleplay_evaluation", strict: true, schema } },
  }) });
  const body = await response.json() as { output_text?: string; error?: { message?: string }; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }; if (!response.ok) throw new Error(body.error?.message || "ロープレ分析に失敗しました。");
  const output = body.output_text ?? body.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text; if (!output) throw new Error("ロープレ分析結果を取得できませんでした。");
  const parsed = resultSchema.parse(JSON.parse(output));
  return { model, analysis: verifyRoleplayAnalysis(parsed, input.messages) };
}
