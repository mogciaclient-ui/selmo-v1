"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { saveActivityResult } from "@/application/activities/save-activity-result";
import { createSupabaseSalesActivityRepository } from "@/infrastructure/supabase/sales-activity-repository";
import { getCurrentUser } from "@/lib/auth/get-current-user";

export type ResultActionState = { message?: string; success?: boolean };
const schema = z.object({ id: z.uuid(), result: z.string().trim().min(1, "活動結果を入力してください。").max(5000) });
export async function submitActivityResult(_: ResultActionState, formData: FormData): Promise<ResultActionState> {
  const context = await getCurrentUser();
  if (!context) return { message: "ログインし直してください。" };
  const raw = Object.fromEntries(formData);
  if (formData.get("detailed") === "1") raw.result = formatDetailedResult(formData);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { message: parsed.error.issues[0]?.message };
  try { await saveActivityResult(createSupabaseSalesActivityRepository(context.db, context), parsed.data.id, parsed.data.result); }
  catch (error) { return { message: error instanceof Error ? error.message : "活動結果を保存できませんでした。" }; }
  revalidatePath("/"); revalidatePath("/results");
  return { success: true };
}

function formatDetailedResult(formData: FormData) {
  const value = (name: string) => String(formData.get(name) ?? "").trim();
  const values = (name: string) => formData.getAll(name).map(String).filter(Boolean).join("、");
  const rows = [
    ["登録内容", value("registrationType") === "planned" ? "活動予定" : "活動実績"], ["営業タイプ", value("salesType")], ["営業プロセス", value("salesProcess")], ["ステータス", value("activityStatus")],
    ["商材", value("product")], ["面談者", value("customerContact")], ["同席者", values("attendees")], ["確度", value("confidence")],
    ["コラボ提案", value("collaborationProposal")], ["電気提案", value("electricityProposal")], ["商談変化", value("dealChange")], ["提案商材", values("proposedProducts")],
    ["面談者区分", values("contactRoles")], ["AXCEL同時提案", value("axcelProposal")], ["AXCEL提案内容", value("axcelProposalDetail")], ["AXCELプレゼン内容", values("axcelPresentation")], ["顧客属性", value("customerAttribute")],
    ["活動詳細", value("details")], ["訪問回数", value("visitCount")], ["アポ担当", value("appointmentOwner")], ["現場担当", value("fieldOwner")], ["同行担当", value("companionOwner")], ["アポ内容", value("appointmentType")],
    ["商談担当者", value("negotiator")], ["商談担当者役職", value("negotiatorTitle")], ["商談ステージ", value("dealStage")], ["販社", value("vendor")], ["機種", value("model")], ["提案機種", value("proposedModel")],
    ["現在リース会社", value("currentLeaseCompany")], ["リース会社", value("leaseCompany")], ["現在リース料金", yen(value("currentLeaseFee"))], ["提案リース料金", yen(value("proposedLeaseFee"))], ["リース残回数", value("remainingLeasePayments")], ["料金設定", value("pricingSetting")],
  ].filter(([, content]) => content);
  return rows.map(([label, content]) => `【${label}】${content}`).join("\n");
}
function yen(value: string) { return value ? `${Number(value).toLocaleString("ja-JP")}円` : ""; }
