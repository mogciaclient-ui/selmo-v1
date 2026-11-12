import type { SupabaseClient } from "@supabase/supabase-js";

type Input = {
  organizationId: string; activityId: string; departmentId: string; customerId: string | null; employeeId: string;
  title: string; activityDate: string; opportunityId?: string; opportunityName?: string; product?: string;
  salesType?: string; salesProcess?: string; progressStep?: string; activityStatus?: string; confidence?: string;
};
const statuses: Record<string, "open" | "won" | "lost"> = { 提案中: "open", 提案: "open", 受注: "won", 失注: "lost" };

export async function syncOpportunityFromActivity(db: SupabaseClient, input: Input): Promise<string | undefined> {
  const product = input.product?.trim();
  if (!input.customerId || !product) return;
  const status = statuses[input.activityStatus ?? ""];
  const confidenceKey = input.confidence?.match(/[A-DＡ-Ｄ]/)?.[0] ?? "";
  const confidence = ({ A: "A", B: "B", C: "C", D: "D", "Ａ": "A", "Ｂ": "B", "Ｃ": "C", "Ｄ": "D" } as const)[confidenceKey as "A"];
  const { data, error } = await db.rpc("sync_report_case", { payload: { ...input, product, status, confidence } });
  if (error) throw error;
  return data as string;
}
