import "server-only";

import { z } from "zod";

const dialogueItem = z.object({ speaker: z.enum(["営業", "顧客"]), role: z.enum(["sales", "customer"]), text: z.string().min(1) });
const feedbackItem = z.object({ point: z.string(), evidence: z.string() });
const separationSchema = z.object({ dialogue: z.array(dialogueItem) });
const evaluationSchema = z.object({
  summary: z.string(), score: z.number().int().min(0).max(100), customerTemperature: z.string(),
  customerIssues: z.array(z.string()), customerNeeds: z.array(z.string()), proposalSummary: z.array(z.string()),
  objections: z.array(z.string()), decisions: z.array(z.string()), nextSteps: z.array(z.string()), riskSignals: z.array(z.string()), keyQuotes: z.array(z.string()),
  strengths: z.array(feedbackItem), improvements: z.array(feedbackItem), nextAction: z.string(),
});
const resultSchema = separationSchema.extend(evaluationSchema.shape);
export type SalesAnalysisResult = z.infer<typeof resultSchema>;

const separationJsonSchema = { type: "object", additionalProperties: false, properties: {
  dialogue: { type: "array", items: { type: "object", additionalProperties: false, properties: { speaker: { type: "string", enum: ["営業", "顧客"] }, role: { type: "string", enum: ["sales", "customer"] }, text: { type: "string" } }, required: ["speaker", "role", "text"] } },
}, required: ["dialogue"] } as const;
const evaluationJsonSchema = { type: "object", additionalProperties: false, properties: {
  summary: { type: "string" }, score: { type: "integer", minimum: 0, maximum: 100 }, customerTemperature: { type: "string" },
  customerIssues: { type: "array", items: { type: "string" } }, customerNeeds: { type: "array", items: { type: "string" } }, proposalSummary: { type: "array", items: { type: "string" } },
  objections: { type: "array", items: { type: "string" } }, decisions: { type: "array", items: { type: "string" } }, nextSteps: { type: "array", items: { type: "string" } }, riskSignals: { type: "array", items: { type: "string" } }, keyQuotes: { type: "array", items: { type: "string" } },
  strengths: { type: "array", items: { type: "object", additionalProperties: false, properties: { point: { type: "string" }, evidence: { type: "string" } }, required: ["point", "evidence"] } },
  improvements: { type: "array", items: { type: "object", additionalProperties: false, properties: { point: { type: "string" }, evidence: { type: "string" } }, required: ["point", "evidence"] } },
  nextAction: { type: "string" },
}, required: ["summary", "score", "customerTemperature", "customerIssues", "customerNeeds", "proposalSummary", "objections", "decisions", "nextSteps", "riskSignals", "keyQuotes", "strengths", "improvements", "nextAction"] } as const;

type ResponseBody = { output_text?: string; error?: { message?: string }; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
async function structuredResponse<T>(apiKey: string, model: string, name: string, schema: object, instructions: string, input: string, parser: z.ZodType<T>) {
  const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, store: false, instructions, input, text: { format: { type: "json_schema", name, strict: true, schema } } }) });
  const body = await response.json() as ResponseBody;
  if (!response.ok) throw new Error(body.error?.message || "AI分析APIの呼び出しに失敗しました。");
  const output = body.output_text ?? body.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
  if (!output) throw new Error("AI分析結果を取得できませんでした。");
  return parser.parse(JSON.parse(output));
}

export async function analyzeSalesTranscript(transcript: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEYが設定されていません。");
  const model = process.env.OPENAI_ANALYSIS_MODEL || "gpt-5.4-mini";
  const separated = await structuredResponse(apiKey, model, "sales_speaker_separation", separationJsonSchema,
    "日本語商談の話者分離担当です。入力は音声認識後のため話者ラベルや句読点が欠け、複数の会話が連結される場合があります。商品・サービスを説明、提案、質問する販売側を必ず営業、相談、回答、要望、判断を述べる購入側を必ず顧客に分類してください。unknownや第三の役割は作らないでください。発言順と内容を保持し、同じ話者の連続発言は一つにまとめ、別話者へ切り替わる箇所で分割してください。会社名や商品知識だけで話者を固定せず、各発言の会話上の役割で判断してください。",
    `次の文字起こしを営業と顧客に分離してください。\n\n${transcript}`, separationSchema);
  const labeledTranscript = separated.dialogue.map((item) => `${item.speaker}: ${item.text}`).join("\n");
  const evaluation = await structuredResponse(apiKey, model, "sales_conversation_evaluation", evaluationJsonSchema,
    "あなたは日本語の営業商談分析者です。入力には営業・顧客の話者ラベルが確定済みです。営業の発言だけを営業品質の評価対象とし、顧客発言を営業の成果に混ぜないでください。根拠は入力中の実際の発言を短く引用し、存在しない事実を作らないでください。商談全体の要約、顧客の課題・ニーズ、営業の提案内容、顧客の反論や懸念、合意・決定事項、次の対応、失注リスク、重要発言、温度感、営業の強みと改善点を項目別に具体化してください。該当情報がない配列は空にしてください。nextActionは営業が最優先で行う一つの行動にしてください。",
    `次の話者分離済み商談を分析してください。\n\n${labeledTranscript}`, evaluationSchema);
  return { model, result: resultSchema.parse({ dialogue: separated.dialogue, ...evaluation }) };
}
