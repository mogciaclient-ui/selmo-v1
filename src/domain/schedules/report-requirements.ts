// Business fields shown for each report variant. AI transcript/upload is an optional tool.
export function requiredReportFields(type: string, status: string, actual = true): string[] {
  const fields = ["salesType", "salesProcess", "activityStatus", "activityDate", "product", "confidence", "activityOwnerId", "startTime", "endTime"];
  if (actual) fields.push("details");
  const it = type === "IT営業活動";
  if (["IT営業活動", "CS営業活動", "CS営業外活動", "アルファサポート"].includes(type)) fields.push("customerAttribute");
  if (status === "受注") fields.push("orderAmount", "orderDate");
  if (status === "受注" && (it || type === "IT同行活動")) fields.push("orderQuantity");
  if (it && status === "提案中") fields.push("nextVisitDate");
  if (type === "IT同行活動") fields.push("activityLocation", "priority", "commonNotes");
  if (status === "失注" && type === "IT同行活動") fields.push("lossReason");
  if (it) {
    fields.push("progressStep", "collaborationProposal", "electricityProposal", "dealChange", "proposedProducts", "visitCount", "appointmentOwnerId", "fieldOwnerId", "companionOwnerId", "appointmentType", "negotiator", "negotiatorTitle", "dealStage", "vendor", "model", "proposedModel", "currentLeaseCompany", "leaseCompany", "currentLeaseFee", "proposedLeaseFee", "remainingLeasePayments", "pricingSetting");
    if (status === "提案中") fields.push("nextActionDetails"); else fields.push("followUpVisitDate");
    if (status === "受注") fields.push("oaOrderReason");
    if (status === "失注") fields.push("oaLossDetail");
  }
  if (type === "CS営業活動") fields.push("csCustomerRank", "itCustomerRank", "stayMinutes", "returnTime", "respondent", "vehicle", "csActivityContent", "episode");
  if (type === "CS営業外活動") fields.push("csNonSalesActivity", "stayMinutes");
  if (type === "アルファサポート") fields.push("plannedStayMinutes", "stayMinutes", "returnTime", "vehicle", "constructionContent", "constructionProgress");
  if (["IT営業外活動", "IT同行活動"].includes(type)) fields.push("stayMinutes");
  return fields;
}
export function missingReportFields(form: Pick<FormData, "getAll">, type: string, status: string, actual = true) {
  return requiredReportFields(type, status, actual).filter(name => !form.getAll(name).some(value => String(value).trim()));
}
