import type { SupabaseClient } from "@supabase/supabase-js";

type Input = {
  organizationId: string;
  activityId: string;
  departmentId: string;
  customerId: string | null;
  employeeId: string;
  title: string;
  activityDate: string;
  opportunityId?: string;
  opportunityName?: string;
  product?: string;
  salesType?: string;
  salesProcess?: string;
  progressStep?: string;
  activityStatus?: string;
  confidence?: string;
};

const statuses: Record<string, "open" | "won" | "lost" | "on_hold"> = {
  提案中: "open",
  受注: "won",
  失注: "lost",
  保留中: "on_hold",
};

const confidences: Record<string, "A" | "B" | "C" | "D"> = {
  "A：高": "A",
  "B：普通": "B",
  "C：低": "C",
  "D：未確定": "D",
};

export async function syncOpportunityFromActivity(db: SupabaseClient, input: Input) {
  if (!input.customerId) return;

  const name = input.opportunityName?.trim() || input.product?.trim() || input.title.trim() || "営業案件";
  const status = statuses[input.activityStatus ?? ""] ?? "open";
  const confidence = confidences[input.confidence ?? ""] ?? "B";
  const now = new Date().toISOString();

  const { data: linked, error: linkedError } = await db
    .from("opportunities")
    .select("id,expected_amount,order_amount")
    .eq("organization_id", input.organizationId)
    .eq(input.opportunityId ? "id" : "source_activity_id", input.opportunityId || input.activityId)
    .eq("customer_id", input.customerId)
    .maybeSingle();
  if (linkedError) throw linkedError;

  let opportunity = linked;
  if (!opportunity) {
    const { data: existing, error: existingError } = await db
      .from("opportunities")
      .select("id,expected_amount,order_amount")
      .eq("organization_id", input.organizationId)
      .eq("customer_id", input.customerId)
      .eq("name", name)
      .is("source_activity_id", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;
    opportunity = existing;
  }

  const shared = {
    source_activity_id: input.activityId,
    department_id: input.departmentId,
    customer_id: input.customerId,
    employee_id: input.employeeId,
    name,
    product_name: input.product?.trim() || null,
    status,
    confidence,
    expected_close_date: input.activityDate || null,
    sales_type: input.salesType?.trim() || null,
    sales_process: input.salesProcess?.trim() || null,
    progress_step: input.progressStep?.trim() || null,
    updated_at: now,
  };

  if (opportunity) {
    const orderAmount = status === "won" && Number(opportunity.order_amount) === 0
      ? Number(opportunity.expected_amount)
      : Number(opportunity.order_amount);
    const { error } = await db.from("opportunities").update({ ...shared, order_amount: orderAmount }).eq("id", opportunity.id).eq("organization_id", input.organizationId);
    if (error) throw error;
    return;
  }

  const { error } = await db.from("opportunities").insert({
    ...shared,
    organization_id: input.organizationId,
    stage: status === "won" ? "closing" : "proposal",
    priority: "medium",
    expected_amount: 0,
    order_amount: 0,
  });
  if (error) throw error;
}
