"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { analyzeSalesTranscript } from "@/lib/openai/analyze-sales-transcript";
import { syncOpportunityFromActivity } from "@/lib/activities/sync-opportunity-from-activity";
import { processActivityAudio } from "@/lib/activities/process-activity-audio";

export type DetailedReportState = { success?: boolean; message?: string };
const text = (max = 500) => z.string().trim().max(max);
const optionalText = (max = 500) => text(max).optional().default("");
const reportSchema = z.object({
  id: z.uuid(), activityOwnerId: z.uuid(), registrationType: z.enum(["actual", "planned"]), salesType: text(100), salesProcess: text(100),
  activityStatus: text(100), activityDate: text(10), product: text(200), customerContact: optionalText(200), progressStep: optionalText(200),
  confidence: text(100), collaborationProposal: optionalText(100), electricityProposal: optionalText(100), dealChange: optionalText(100),
  axcelProposal: optionalText(100), axcelProposalDetail: optionalText(200), customerAttribute: optionalText(200),
  startTime: text(5), endTime: text(5), details: optionalText(5000), visitCount: optionalText(100),
  appointmentType: optionalText(200), negotiator: optionalText(200), negotiatorTitle: optionalText(200), dealStage: optionalText(100), vendor: optionalText(200),
  model: optionalText(200), proposedModel: optionalText(200), currentLeaseCompany: optionalText(200), leaseCompany: optionalText(200),
  currentLeaseFee: z.union([z.literal(""), z.coerce.number().int().min(0)]).optional().default(""), proposedLeaseFee: z.union([z.literal(""), z.coerce.number().int().min(0)]).optional().default(""),
  remainingLeasePayments: z.union([z.literal(""), z.coerce.number().int().min(0)]).optional().default(""), pricingSetting: optionalText(100), aiTranscript: optionalText(30000),
  audioPath: optionalText(1000), audioContentType: optionalText(100),
});

export async function saveDetailedActivityReport(_: DetailedReportState, formData: FormData): Promise<DetailedReportState> {
  const context = await getCurrentUser();
  if (!context) return { message: "ログインし直してください。" };
  if (context.role !== "sales_rep") return { message: "管理者アカウントは閲覧専用です。" };
  const parsed = reportSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };
  const input = parsed.data;
  const processBySalesType: Record<string, string[]> = { "IT営業活動": ["IT営業活動"], "IT営業外活動": ["書類不備", "工事立会", "納品", "フォロー"], "IT同行活動": ["IT同行活動"], "CS営業活動": ["CS営業活動"], "CS営業外活動": ["CS営業外活動"], "アルファサポート": ["アルファサポート"], "AXCEL定期訪問": ["AXCEL"], "AXCEL不定期訪問": ["AXCEL"] };
  if (!processBySalesType[input.salesType]?.includes(input.salesProcess)) return { message: "営業タイプと営業プロセスの組み合わせを確認してください。" };
  if (!["提案中", "受注", "失注", "保留中"].includes(input.activityStatus)) return { message: "ステータスを確認してください。" };
  const value = (name: string) => String(formData.get(name) ?? "").trim();
  const list = (name: string) => formData.getAll(name).flatMap((item) => String(item).split(/[、,]/)).map((item) => item.trim()).filter(Boolean);
  const missing = (fields: Array<[string, string]>) => fields.find(([name]) => !value(name));
  const requiredCommon: Array<[string, string]> = [["activityDate", "活動日"], ["product", "商材"], ["confidence", "確度"], ["startTime", "活動開始時間"], ["endTime", "活動終了時間"]];
  if (input.salesType !== "アルファサポート") requiredCommon.push(["contactRole", "面談者（区分）"]);
  if (input.activityStatus === "受注") requiredCommon.push(["orderAmount", "受注額"], ["orderDate", "受注日"]);
  if (input.salesType === "IT営業活動" && input.activityStatus === "提案中") requiredCommon.push(["nextVisitDate", "次回訪問予定日"], ["nextActionDetails", "次回アクション内容"]);
  if (["IT営業外活動", "IT同行活動", "CS営業活動", "CS営業外活動", "AXCEL定期訪問", "AXCEL不定期訪問"].includes(input.salesType)) requiredCommon.push(["stayMinutes", "滞在時間"]);
  if (["AXCEL定期訪問", "AXCEL不定期訪問"].includes(input.salesType)) requiredCommon.push(["travelMinutes", "移動時間"]);
  const missingField = missing(requiredCommon);
  if (missingField) return { message: `${missingField[1]}を入力してください。` };
  if (input.salesType === "IT営業活動" && !list("proposedProducts").length) return { message: "提案商材を1つ以上選択してください。" };
  if (input.salesType === "AXCEL定期訪問" && !list("effectMeasurementItems").length) return { message: "効果測定項目を1つ以上選択してください。" };
  let activityQuery = context.db.from("activities").select("id,department_id,employee_id,customer_id,title,schedule_details").eq("id", input.id).eq("organization_id", context.organizationId);
  activityQuery = activityQuery.eq("employee_id", context.employeeId);
  const { data: activity, error: lookupError } = await activityQuery.maybeSingle();
  if (lookupError || !activity) return { message: "この活動を登録する権限がありません。" };
  if (input.audioPath && !input.audioPath.startsWith(`${context.organizationId}/activities/${input.id}/`)) return { message: "アップロードした音声の保存先が不正です。" };

  const attendeeEmployeeIds = formData.getAll("attendeeEmployeeIds").map(String).filter(Boolean);
  const assigneeKeys = [String(formData.get("appointmentOwnerId") ?? ""), String(formData.get("fieldOwnerId") ?? ""), String(formData.get("companionOwnerId") ?? "")].filter(Boolean);
  const relatedEmployeeIds = [...new Set([input.activityOwnerId, ...attendeeEmployeeIds, ...assigneeKeys.filter((id) => !id.startsWith("special:"))])];
  const employeeQuery = context.db.from("employees").select("id,name,primary_department_id").eq("organization_id", context.organizationId).eq("status", "active").in("id", relatedEmployeeIds);
  const { data: employeeRows, error: employeeError } = await employeeQuery;
  if (employeeError) return { message: "社員マスタを確認できませんでした。" };
  const employeeNames = new Map((employeeRows ?? []).map((employee) => [employee.id, employee.name]));
  if (!employeeNames.has(input.activityOwnerId)) return { message: "活動担当者を選び直してください。" };
  if (relatedEmployeeIds.some((id) => !employeeNames.has(id))) return { message: "選択した社内担当者を確認してください。" };
  const specialNames = new Map([["special:external", "外部"], ["special:ntt", "NTT"], ["special:manufacturer", "メーカー"]]);
  if (assigneeKeys.some((id) => !employeeNames.has(id) && !specialNames.has(id))) return { message: "選択した担当者を確認してください。" };
  if (input.activityOwnerId !== context.employeeId) return { message: "活動担当者を変更する権限がありません。" };

  let startsAt: Date | undefined;
  let endsAt: Date | undefined;
  if (input.activityDate && input.startTime && input.endTime) {
    startsAt = new Date(`${input.activityDate}T${input.startTime}:00+09:00`);
    endsAt = new Date(`${input.activityDate}T${input.endTime}:00+09:00`);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return { message: "活動日時の形式を確認してください。" };
    if (endsAt <= startsAt) return { message: "終了時刻は開始時刻より後にしてください。" };
  }

  const analysisRequested = Boolean(input.aiTranscript || input.audioPath);
  let products: Array<{ name: string; amount: string; quantity: string; main: boolean }> = [];
  try { products = z.array(z.object({ name: z.string().min(1).max(200), amount: z.string().max(20), quantity: z.string().max(20), main: z.boolean() })).max(20).parse(JSON.parse(value("productsJson") || "[]")); } catch { return { message: "商材の入力内容を確認してください。" }; }
  if (!products.length || !products.some((product) => product.main)) return { message: "メイン商材を選択してください。" };
  const common = {
    registrationType: input.registrationType, salesType: input.salesType, salesProcess: input.salesProcess, activityStatus: input.activityStatus,
    activityDate: input.activityDate, product: input.product, products, customerContact: input.customerContact, progressStep: input.progressStep,
    attendeeEmployeeIds, attendees: attendeeEmployeeIds.map((id) => employeeNames.get(id)).filter(Boolean),
    confidence: input.confidence, collaborationProposal: input.collaborationProposal, electricityProposal: input.electricityProposal,
    dealChange: input.dealChange, proposedProducts: list("proposedProducts"), contactRoles: list("contactRoles"),
    axcelProposal: input.axcelProposal, axcelProposalDetail: input.axcelProposalDetail, axcelPresentation: list("axcelPresentation"),
    customerAttribute: input.customerAttribute,
    contactRole: value("contactRole"), activityLocation: value("activityLocation"), priority: value("priority"), nextVisitDate: value("nextVisitDate"),
    expectedOrderYear: value("expectedOrderYear"), expectedOrderMonth: value("expectedOrderMonth"), orderAmount: value("orderAmount"), orderQuantity: value("orderQuantity"), orderDate: value("orderDate"),
    lossReason: value("lossReason"), holdReason: value("holdReason"), commonNotes: value("commonNotes"), nextActionDetails: value("nextActionDetails"), followUpVisitDate: value("followUpVisitDate"),
    oaOrderReason: value("oaOrderReason"), axcelOrderReason: value("axcelOrderReason"), oaLossDetail: value("oaLossDetail"), axcelLossDetail: value("axcelLossDetail"),
    speakerSeparationStatus: analysisRequested ? "pending" : "",
    aiAnalysisStatus: analysisRequested ? "waiting_for_speaker_separation" : "",
  };
  const individual = {
    startTime: input.startTime, endTime: input.endTime, details: input.details, visitCount: input.visitCount,
    activityOwnerId: input.activityOwnerId,
    appointmentOwnerId: value("appointmentOwnerId"), appointmentOwner: employeeNames.get(value("appointmentOwnerId")) ?? specialNames.get(value("appointmentOwnerId")) ?? "",
    fieldOwnerId: value("fieldOwnerId"), fieldOwner: employeeNames.get(value("fieldOwnerId")) ?? specialNames.get(value("fieldOwnerId")) ?? "",
    companionOwnerId: value("companionOwnerId"), companionOwner: employeeNames.get(value("companionOwnerId")) ?? specialNames.get(value("companionOwnerId")) ?? "",
    appointmentType: input.appointmentType, negotiator: input.negotiator, negotiatorTitle: input.negotiatorTitle,
    dealStage: input.dealStage, vendor: input.vendor, model: input.model, proposedModel: input.proposedModel,
    currentLeaseCompany: input.currentLeaseCompany, leaseCompany: input.leaseCompany,
    currentLeaseFee: input.currentLeaseFee, proposedLeaseFee: input.proposedLeaseFee,
    remainingLeasePayments: input.remainingLeasePayments, pricingSetting: input.pricingSetting,
    stayMinutes: value("stayMinutes"), plannedStayMinutes: value("plannedStayMinutes"), travelMinutes: value("travelMinutes"), returnTime: value("returnTime"),
    csCustomerRank: value("csCustomerRank"), itCustomerRank: value("itCustomerRank"), respondent: value("respondent"), vehicle: value("vehicle"), csActivityContent: value("csActivityContent"), episode: value("episode"),
    csNonSalesActivity: value("csNonSalesActivity"), constructionContent: value("constructionContent"), constructionProgress: value("constructionProgress"),
    homeworkAcquired: value("homeworkAcquired"), homeworkDetails: value("homeworkDetails"), nextAppointment: value("nextAppointment"), effectMeasurementItems: list("effectMeasurementItems"), referral: value("referral"), remote: value("remote"), axcelIrregularActivity: value("axcelIrregularActivity"),
    aiTranscript: input.aiTranscript, audioPath: input.audioPath, aiAnalysisRequested: analysisRequested,
    speakerSeparationStatus: analysisRequested ? "pending" : null,
    aiAnalysisStatus: analysisRequested ? "waiting_for_speaker_separation" : null,
  };
  const now = new Date().toISOString();
  if (input.registrationType === "actual") {
    const { error } = await context.db.from("activity_individual_reports").upsert({
      organization_id: context.organizationId, activity_id: input.id, employee_id: input.activityOwnerId,
      report: individual, updated_at: now,
    }, { onConflict: "activity_id,employee_id" });
    if (error) return { message: error.code === "42P01" ? "活動報告用のDB更新が未適用です。" : "個別活動報告を保存できませんでした。" };
  }
  const summary = [input.salesType, input.product, input.activityStatus, input.registrationType === "actual" ? input.details : "活動予定"].filter(Boolean).join(" / ");
  const activityUpdate = {
    common_report: common,
    employee_id: input.activityOwnerId,
    ...(startsAt && endsAt ? { starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString() } : {}),
    result: input.registrationType === "actual" ? summary : null,
    status: input.registrationType === "actual" ? "completed" : "scheduled", updated_at: now,
  };
  const { error } = await context.db.from("activities").update(activityUpdate).eq("id", input.id).eq("organization_id", context.organizationId);
  if (error) return { message: error.code === "42703" ? "活動報告用のDB更新が未適用です。" : "共通活動を保存できませんでした。" };

  const scheduleDetails = (activity.schedule_details ?? {}) as Record<string, unknown>;
  try {
    await syncOpportunityFromActivity(context.db, {
      organizationId: context.organizationId,
      activityId: input.id,
      departmentId: activity.department_id,
      customerId: activity.customer_id,
      employeeId: input.activityOwnerId,
      title: activity.title,
      activityDate: input.activityDate,
      opportunityId: String(scheduleDetails.opportunityId ?? ""),
      opportunityName: String(scheduleDetails.opportunityName ?? ""),
      product: input.product,
      salesType: input.salesType || String(scheduleDetails.salesType ?? ""),
      salesProcess: input.salesProcess || String(scheduleDetails.salesProcess ?? ""),
      progressStep: input.progressStep || String(scheduleDetails.progressStep ?? ""),
      activityStatus: input.activityStatus,
      confidence: input.confidence,
    });
  } catch (syncError) {
    console.error("[activity-report] opportunity sync failed", { activityId: input.id, error: syncError });
    return { success: true, message: "活動は保存しましたが、案件・受注情報へ反映できませんでした。" };
  }

  let message = "活動内容を保存しました。";
  if (analysisRequested) {
    const { error: queueError } = await context.db.from("activity_ai_analyses").upsert({
      organization_id: context.organizationId, activity_id: input.id, employee_id: input.activityOwnerId,
      status: input.audioPath ? "pending" : "processing", raw_transcript: input.aiTranscript, separated_transcript: null, analysis: null,
      audio_path: input.audioPath || null, model: null, error_message: null, updated_at: now,
    }, { onConflict: "activity_id" });
    if (queueError) {
      message = queueError.code === "42P01" ? "活動は保存しました。AI分析用のDB更新を適用してください。" : "活動は保存しましたが、AI分析を開始できませんでした。";
    } else if (input.audioPath) {
      after(() => processActivityAudio({ organizationId: context.organizationId, activityId: input.id, employeeId: input.activityOwnerId, audioPath: input.audioPath }));
      message = "活動を保存しました。音声は自動で分析され、完了後にカレンダーから確認できます。";
    } else {
      try {
        const { model, result } = await analyzeSalesTranscript(input.aiTranscript);
        await context.db.from("activity_ai_analyses").update({
          status: "completed", separated_transcript: result.dialogue, analysis: result,
          model, error_message: null, updated_at: new Date().toISOString(),
        }).eq("organization_id", context.organizationId).eq("activity_id", input.id);
        await context.db.from("activities").update({
          common_report: { ...common, speakerSeparationStatus: "completed", aiAnalysisStatus: "completed" },
          updated_at: new Date().toISOString(),
        }).eq("organization_id", context.organizationId).eq("id", input.id);
        message = "活動を保存し、話者分離とAI分析が完了しました。";
      } catch (analysisError) {
        const errorMessage = analysisError instanceof Error ? analysisError.message : "AI分析に失敗しました。";
        await context.db.from("activity_ai_analyses").update({ status: "failed", error_message: errorMessage, updated_at: new Date().toISOString() }).eq("organization_id", context.organizationId).eq("activity_id", input.id);
        await context.db.from("activities").update({ common_report: { ...common, speakerSeparationStatus: "failed", aiAnalysisStatus: "failed" }, updated_at: new Date().toISOString() }).eq("organization_id", context.organizationId).eq("id", input.id);
        message = `活動は保存しましたが、AI分析に失敗しました：${errorMessage}`;
      }
    }
  }
  revalidatePath("/"); revalidatePath("/results"); revalidatePath("/customers"); revalidatePath("/opportunities"); revalidatePath(`/activities/${input.id}/report`);
  revalidatePath("/analysis");
  return { success: true, message };
}
