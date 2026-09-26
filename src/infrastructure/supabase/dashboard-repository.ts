import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardRepository } from "@/application/ports/dashboard-repository";
import type { DashboardActivity } from "@/domain/dashboard/types";
import type { RepositoryScope } from "@/application/ports/repository-scope";

type ActivityRow = {
  id: string;
  title: string;
  activity_type: string;
  starts_at: string;
  ends_at: string;
  status: string;
  result: string | null;
  customer_id: string | null;
  employee_id: string;
  department_id: string;
  schedule_details?: Record<string, string | boolean>;
  common_report?: Record<string, string | boolean>;
  customers: { name: string; external_id: string } | { name: string; external_id: string }[] | null;
};

export function createSupabaseDashboardRepository(client: SupabaseClient, scope: RepositoryScope): DashboardRepository {
  return {
    async findActivitiesBetween(start, end) {
      let request = client
        .from("activities")
        .select("id,title,activity_type,starts_at,ends_at,status,result,customer_id,employee_id,department_id,schedule_details,common_report,customers(name,external_id)")
        .eq("organization_id", scope.organizationId)
        .gte("starts_at", start)
        .lt("starts_at", end)
        .order("starts_at");
      if (scope.role === "sales_rep") request = request.eq("employee_id", scope.employeeId);
      if (scope.role === "department_admin") request = request.in("department_id", scope.departmentIds);
      let { data, error } = await request;
      if (error?.code === "42703") {
        let fallback = client.from("activities").select("id,title,activity_type,starts_at,ends_at,status,result,customer_id,employee_id,department_id,schedule_details,customers(name,external_id)").eq("organization_id", scope.organizationId).gte("starts_at", start).lt("starts_at", end).order("starts_at");
        if (scope.role === "sales_rep") fallback = fallback.eq("employee_id", scope.employeeId);
        if (scope.role === "department_admin") fallback = fallback.in("department_id", scope.departmentIds);
        const legacy = await fallback;
        data = legacy.data as typeof data;
        error = legacy.error;
        if (error?.code === "42703") {
          let oldest = client.from("activities").select("id,title,activity_type,starts_at,ends_at,status,result,customer_id,employee_id,department_id,customers(name,external_id)").eq("organization_id", scope.organizationId).gte("starts_at", start).lt("starts_at", end).order("starts_at");
          if (scope.role === "sales_rep") oldest = oldest.eq("employee_id", scope.employeeId);
          if (scope.role === "department_admin") oldest = oldest.in("department_id", scope.departmentIds);
          const legacyWithoutSchedule = await oldest;
          data = legacyWithoutSchedule.data as typeof data;
          error = legacyWithoutSchedule.error;
        }
      }

      if (error) throw new Error("営業予定を取得できませんでした。", { cause: error });

      return ((data ?? []) as ActivityRow[]).map((row): DashboardActivity => ({
        id: row.id,
        title: row.title,
        activityType: row.activity_type,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        status: row.status,
        result: row.result,
        employeeId: row.employee_id,
        departmentId: row.department_id,
        customerId: row.customer_id,
        customerExternalId: Array.isArray(row.customers) ? row.customers[0]?.external_id ?? null : row.customers?.external_id ?? null,
        customerName: Array.isArray(row.customers) ? row.customers[0]?.name ?? null : row.customers?.name ?? null,
        scheduleDetails: row.schedule_details ?? {},
        commonReport: row.common_report ?? {},
      }));
    },

    async countPendingResults(before) {
      let request = client
        .from("activities")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", scope.organizationId)
        .lt("ends_at", before)
        .is("result", null);
      if (scope.role === "sales_rep") request = request.eq("employee_id", scope.employeeId);
      if (scope.role === "department_admin") request = request.in("department_id", scope.departmentIds);
      const { count, error } = await request;

      if (error) throw new Error("結果入力待ち件数を取得できませんでした。", { cause: error });
      return count ?? 0;
    },
  };
}
