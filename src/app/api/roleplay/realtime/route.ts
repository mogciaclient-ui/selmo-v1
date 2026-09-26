import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/get-current-user";

export const runtime = "nodejs";

const schema = z.object({
  sdp: z.string().min(1).max(100_000),
  scenario: z.object({ title: z.string().max(200), product: z.string().max(200).optional(), category: z.string().max(100), customer: z.string().max(3000), objective: z.string().max(2000), expectedObjections: z.string().max(3000).optional(), scoringCriteria: z.string().max(3000).optional(), customFields: z.array(z.object({ label: z.string().max(100), value: z.string().max(1000) })).max(20).optional() }),
});

export async function POST(request: Request) {
  const context = await getCurrentUser();
  if (!context) return NextResponse.json({ message: "ログインし直してください。" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "音声セッションの入力が不正です。" }, { status: 400 });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ message: "音声AIの設定がありません。" }, { status: 503 });
  const { scenario } = parsed.data;
  const customConditions = (scenario.customFields ?? []).filter((item) => item.label || item.value).map((item) => `- ${item.label || "追加条件"}: ${item.value}`).join("\n") || "- なし";
  const session = {
    type: "realtime",
    model: process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1",
    output_modalities: ["audio"],
    instructions: `あなたは営業ロープレの「顧客役」です。相手は商品を提案する「営業担当者」です。以下を厳守してください。
- 最後まで顧客役として振る舞い、営業担当者の役を演じない。
- 営業担当者が名乗った会社名・氏名・業種を、自分や自社の情報として取り込まない。たとえば相手が「株式会社モグシアです」と言った場合は、それを営業会社名として認識する。
- シナリオにない会社名、業種、商品利用状況、具体的な困りごとを勝手に確定しない。聞かれた場合は顧客像の範囲で一貫した設定を一度だけ補い、その後は変更しない。
- 営業担当者への助言、模範解答、採点、進行役の発言はしない。
- 顧客側から営業会社の概要説明を求めて会話を主導しすぎない。営業担当者の質問を受け、現状・背景・影響を少しずつ答える。
- 同じ挨拶や質問を繰り返さない。相手の直前の発言へ直接返答する。
- 日本語で自然に、1回の返答は原則1〜3文にする。

シナリオ: ${scenario.title}
対象商材: ${scenario.product || "未指定"}
カテゴリー: ${scenario.category}
あなたが演じる顧客像: ${scenario.customer}
営業担当者の練習ゴール: ${scenario.objective}
想定反論（会話の流れに応じて自然に使い、一度にすべて言わない）: ${scenario.expectedObjections || "指定なし"}
採点基準（顧客役として、この行動を営業担当者から引き出せるように応答する。ただし基準自体は口にしない）: ${scenario.scoringCriteria || "指定なし"}
追加条件:
${customConditions}`,
    audio: { input: { transcription: { model: "gpt-4o-mini-transcribe", language: "ja" }, turn_detection: { type: "semantic_vad" } }, output: { voice: "marin" } },
  };
  const form = new FormData(); form.set("sdp", parsed.data.sdp); form.set("session", JSON.stringify(session));
  const response = await fetch("https://api.openai.com/v1/realtime/calls", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "OpenAI-Safety-Identifier": createHash("sha256").update(context.userId).digest("hex") }, body: form });
  const body = await response.text();
  if (!response.ok) return NextResponse.json({ message: "音声AIへ接続できませんでした。", detail: body.slice(0, 500) }, { status: response.status });
  return new Response(body, { status: 200, headers: { "Content-Type": "application/sdp" } });
}
