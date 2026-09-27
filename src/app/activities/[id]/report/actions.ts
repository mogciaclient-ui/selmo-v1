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
const reportSchema = z.object({
  id: z.uuid(), registrationType: z.enum(["actual", "planned"]), salesType: text(100), salesProcess: text(100),
  activityStatus: text(100), activityDate: text(10), product: text(200), customerContact: text(200), progressStep: text(200),
  confidence: text(100), collaborationProposal: text(100), electricityProposal: text(100), dealChange: text(100),
  axcelProposal: text(100), axcelProposalDetail: text(200), customerAttribute: text(200),
  startTime: text(5), endTime: text(5),
  details: text(5000), visitCount: text(100), appointmentOwner: text(200), fieldOwner: text(200), companionOwner: text(200),
  appointmentType: text(200), negotiator: text(200), negotiatorTitle: text(200), dealStage: text(100), vendor: text(200),
  model: text(200), proposedModel: text(200), currentLeaseCompany: text(200), leaseCompany: text(200),
  currentLeaseFee: z.union([z.literal(""), z.coerce.number().int().min(0)]), proposedLeaseFee: z.union([z.literal(""), z.coerce.number().int().min(0)]),
  remainingLeasePayments: z.union([z.literal(""), z.coerce.number().int().min(0)]), pricingSetting: text(100), aiTranscript: text(30000),
  audioPath: text(1000), audioContentType: text(100),
});

export async function saveDetailedActivityReport(_: DetailedReportState, formData: FormData): Promise<DetailedReportState> {
  const context = await getCurrentUser();
  if (!context) return { message: "ログインし直してください。" };
  const parsed = reportSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };
  const input = parsed.data;
  let activityQuery = context.db.from("activities").select("id,department_id,employee_id,customer_id,title,schedule_details").eq("id", input.id).eq("organization_id", context.organizationId);
  if (context.role === "sales_rep") activityQuery = activityQuery.eq("employee_id", context.employeeId);
  if (context.role === "department_admin") activityQuery = activityQuery.in("department_id", context.departmentIds);
  const { data: activity, error: lookupError } = await activityQuery.maybeSingle();
  if (lookupError || !activity) return { message: "この活動を登録する権限がありません。" };
  if (input.audioPath && !input.audioPath.startsWith(`${context.organizationId}/activities/${input.id}/`)) return { message: "アップロードした音声の保存先が不正です。" };

  let startsAt: Date | undefined;
  let endsAt: Date | undefined;
  if (input.activityDate && input.startTime && input.endTime) {
    startsAt = new Date(`${input.activityDate}T${input.startTime}:00+09:00`);
    endsAt = new Date(`${input.activityDate}T${input.endTime}:00+09:00`);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return { message: "活動日時の形式を確認してください。" };
    if (endsAt <= startsAt) return { message: "終了時刻は開始時刻より後にしてください。" };
  }

  const list = (name: string) => formData.getAll(name).flatMap((value) => String(value).split(/[、,]/)).map((value) => value.trim()).filter(Boolean);
  const analysisRequested = Boolean(input.aiTranscript || input.audioPath);
  const common = {
    registrationType: input.registrationType, salesType: input.salesType, salesProcess: input.salesProcess, activityStatus: input.activityStatus,
    activityDate: input.activityDate, product: input.product, customerContact: input.customerContact, progressStep: input.progressStep, attendees: list("attendees"),
    confidence: input.confidence, collaborationProposal: input.collaborationProposal, electricityProposal: input.electricityProposal,
    dealChange: input.dealChange, proposedProducts: list("proposedProducts"), contactRoles: list("contactRoles"),
    axcelProposal: input.axcelProposal, axcelProposalDetail: input.axcelProposalDetail, axcelPresentation: list("axcelPresentation"),
    customerAttribute: input.customerAttribute,
    speakerSeparationStatus: analysisRequested ? "pending" : "",
    aiAnalysisStatus: analysisRequested ? "waiting_for_speaker_separation" : "",
  };
  const individual = {
    startTime: input.startTime, endTime: input.endTime, details: input.details, visitCount: input.visitCount,
    appointmentOwner: input.appointmentOwner, fieldOwner: input.fieldOwner, companionOwner: input.companionOwner,
    appointmentType: input.appointmentType, negotiator: input.negotiator, negotiatorTitle: input.negotiatorTitle,
    dealStage: input.dealStage, vendor: input.vendor, model: input.model, proposedModel: input.proposedModel,
    currentLeaseCompany: input.currentLeaseCompany, leaseCompany: input.leaseCompany,
    currentLeaseFee: input.currentLeaseFee, proposedLeaseFee: input.proposedLeaseFee,
    remainingLeasePayments: input.remainingLeasePayments, pricingSetting: input.pricingSetting,
    aiTranscript: input.aiTranscript, audioPath: input.audioPath, aiAnalysisRequested: analysisRequested,
    speakerSeparationStatus: analysisRequested ? "pending" : null,
    aiAnalysisStatus: analysisRequested ? "waiting_for_speaker_separation" : null,
  };
  const now = new Date().toISOString();
  if (input.registrationType === "actual") {
    const { error } = await context.db.from("activity_individual_reports").upsert({
      organization_id: context.organizationId, activity_id: input.id, employee_id: context.employeeId,
      report: individual, updated_at: now,
    }, { onConflict: "activity_id,employee_id" });
    if (error) return { message: error.code === "42P01" ? "活動報告用のDB更新が未適用です。" : "個別活動報告を保存できませんでした。" };
  }
  const summary = [input.salesType, input.product, input.activityStatus, input.registrationType === "actual" ? input.details : "活動予定"].filter(Boolean).join(" / ");
  const activityUpdate = {
    common_report: common,
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
      employeeId: activity.employee_id,
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
      organization_id: context.organizationId, activity_id: input.id, employee_id: context.employeeId,
      status: input.audioPath ? "pending" : "processing", raw_transcript: input.aiTranscript, separated_transcript: null, analysis: null,
      audio_path: input.audioPath || null, model: null, error_message: null, updated_at: now,
    }, { onConflict: "activity_id" });
    if (queueError) {
      message = queueError.code === "42P01" ? "活動は保存しました。AI分析用のDB更新を適用してください。" : "活動は保存しましたが、AI分析を開始できませんでした。";
    } else if (input.audioPath) {
      after(() => processActivityAudio({ organizationId: context.organizationId, activityId: input.id, employeeId: activity.employee_id, audioPath: input.audioPath }));
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
