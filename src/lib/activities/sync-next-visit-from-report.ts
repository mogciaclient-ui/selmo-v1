import type { SupabaseClient } from "@supabase/supabase-js";

type Input = {
  organizationId: string;
  sourceActivityId: string;
  departmentId: string;
  customerId: string | null;
  employeeId: string;
  nextVisitDate: string;
  title: string;
  opportunityId?: string;
  opportunityName?: string;
  salesType?: string;
  salesProcess?: string;
  progressStep?: string;
  notes?: string;
};

export async function syncNextVisitFromReport(db: SupabaseClient, input: Input) {
  const marker = { autoCreatedFromReport: true, sourceReportActivityId: input.sourceActivityId };
  const { data: existing, error: lookupError } = await db
    .from("activities")
    .select("id")
    .eq("organization_id", input.organizationId)
    .contains("schedule_details", marker)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (!input.nextVisitDate) {
    if (existing) {
      const { error } = await db.from("activities").delete().eq("id", existing.id).eq("organization_id", input.organizationId);
      if (error) throw error;
    }
    return;
  }

  const startsAt = new Date(`${input.nextVisitDate}T10:00:00+09:00`).toISOString();
  const endsAt = new Date(`${input.nextVisitDate}T11:00:00+09:00`).toISOString();
  const scheduleDetails = {
    ...marker,
    category: "sales",
    locationType: "external",
    opportunityId: input.opportunityId?.trim() ?? "",
    opportunityName: input.opportunityName?.trim() ?? "",
    salesType: input.salesType?.trim() ?? "",
    salesProcess: input.salesProcess?.trim() ?? "",
    progressStep: input.progressStep?.trim() ?? "",
    notes: input.notes?.trim() ?? "",
  };
  const values = {
    department_id: input.departmentId,
    customer_id: input.customerId,
    employee_id: input.employeeId,
    title: input.title.trim() || "次回訪問",
    activity_type: "visit",
    starts_at: startsAt,
    ends_at: endsAt,
    status: "scheduled",
    result: null,
    schedule_details: scheduleDetails,
    updated_at: new Date().toISOString(),
  };

  const result = existing
    ? await db.from("activities").update(values).eq("id", existing.id).eq("organization_id", input.organizationId)
    : await db.from("activities").insert({ ...values, organization_id: input.organizationId });
  if (result.error) throw result.error;
}
