import type { SupabaseClient } from "@supabase/supabase-js";
import type { SalesActivityRepository } from "@/application/ports/sales-activity-repository";
import type { CustomerSearchResult } from "@/domain/customers/types";
import type { RepositoryScope } from "@/application/ports/repository-scope";

type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  department_id: string;
};

export function createSupabaseSalesActivityRepository(client: SupabaseClient, scope: RepositoryScope): SalesActivityRepository {
  return {
    async searchCustomers(query, limit) {
      const request = client.from("customers").select("id,name,phone,address,department_id").eq("organization_id", scope.organizationId).or(`name.ilike.%${escapeFilter(query)}%,phone.ilike.%${escapeFilter(query)}%`).order("name").limit(Math.min(Math.max(limit, 1), 20));
      const { data, error } = await request;
      if (error) throw new Error("顧客を検索できませんでした。", { cause: error });
      return ((data ?? []) as CustomerRow[]).map((row): CustomerSearchResult => ({
        id: row.id,
        name: row.name,
        phone: row.phone,
        address: row.address,
        departmentId: row.department_id,
      }));
    },

    async createWithCustomer(input) {
      assertDepartment(scope, input.departmentId);
      let customerId = input.customerId;
      let createdCustomerId: string | undefined;
      if (customerId) {
        const { data } = await client.from("customers").select("id").eq("id", customerId).eq("organization_id", scope.organizationId).eq("department_id", input.departmentId).maybeSingle();
        if (!data) throw new Error("顧客が見つかりませんでした。");
      } else if (input.newCustomerName) {
        const { data, error } = await client.from("customers").insert({ organization_id: scope.organizationId, department_id: input.departmentId, name: input.newCustomerName, assigned_employee_id: scope.employeeId }).select("id").single();
        if (error) throw new Error("顧客を登録できませんでした。", { cause: error });
        customerId = data.id;
        createdCustomerId = data.id;
      }
      const { data, error } = await client.from("activities").insert({ organization_id: scope.organizationId, department_id: input.departmentId, customer_id: customerId, employee_id: scope.employeeId, title: input.title, activity_type: input.activityType, starts_at: input.startsAt, ends_at: input.endsAt, schedule_details: input.scheduleDetails ?? {} }).select("id").single();
      if (error) {
        if (createdCustomerId) {
          await client.from("customers").delete().eq("id", createdCustomerId).eq("organization_id", scope.organizationId);
        }
        throw new Error("営業予定を登録できませんでした。", { cause: error });
      }
      return data.id;
    },

    async update(input) {
      const { data, error } = await client
        .from("activities")
        .update({
          title: input.title,
          activity_type: input.activityType,
          starts_at: input.startsAt,
          ends_at: input.endsAt,
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", scope.organizationId)
        .eq("id", input.id)
        .or(permissionFilter(scope))
        .select("id")
        .maybeSingle();
      if (error || !data) throw new Error("予定を更新できませんでした。権限または入力内容を確認してください。", { cause: error });
    },

    async delete(id) {
      const { data, error } = await client.from("activities").delete().eq("organization_id", scope.organizationId).eq("id", id).or(permissionFilter(scope)).select("id").maybeSingle();
      if (error || !data) throw new Error("予定を削除できませんでした。権限を確認してください。", { cause: error });
    },

    async saveResult(id, result) {
      const { data, error } = await client.from("activities").update({ result, status: "completed", updated_at: new Date().toISOString() }).eq("organization_id", scope.organizationId).eq("id", id).or(permissionFilter(scope)).select("id").maybeSingle();
      if (error || !data) throw new Error("活動結果を保存できませんでした。", { cause: error });
    },
  };
}

function assertDepartment(scope: RepositoryScope, departmentId: string) {
  if (scope.role !== "organization_admin" && !scope.departmentIds.includes(departmentId)) throw new Error("この部門を操作する権限がありません。");
}

function permissionFilter(scope: RepositoryScope) {
  if (scope.role === "organization_admin") return `employee_id.eq.${scope.employeeId},employee_id.neq.${scope.employeeId}`;
  if (scope.role === "department_admin" && scope.departmentIds.length) return `employee_id.eq.${scope.employeeId},department_id.in.(${scope.departmentIds.join(",")})`;
  return `employee_id.eq.${scope.employeeId}`;
}

function escapeFilter(value: string) { return value.replace(/[^\p{L}\p{N}\s+\-]/gu, ""); }
