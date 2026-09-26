import type { SupabaseClient } from "@supabase/supabase-js";
import type { CustomerRepository } from "@/application/ports/customer-repository";
import type { Customer } from "@/domain/customers/types";
import type { RepositoryScope } from "@/application/ports/repository-scope";

type Row = { id: string; department_id: string; name: string; phone: string | null; address: string | null; notes: string | null; updated_at: string };

export function createSupabaseCustomerRepository(client: SupabaseClient, scope: RepositoryScope): CustomerRepository {
  return {
    async findAll(query) {
      let request = client.from("customers").select("id,department_id,name,phone,address,notes,updated_at").eq("organization_id", scope.organizationId).order("name").limit(200);
      if (query?.trim()) request = request.or(`name.ilike.%${escapeFilter(query.trim())}%,phone.ilike.%${escapeFilter(query.trim())}%`);
      const { data, error } = await request;
      if (error) throw new Error("顧客一覧を取得できませんでした。", { cause: error });
      return ((data ?? []) as Row[]).map((row): Customer => ({ id: row.id, departmentId: row.department_id, name: row.name, phone: row.phone, address: row.address, notes: row.notes, updatedAt: row.updated_at }));
    },
    async create(input) {
      assertDepartment(scope, input.departmentId);
      const { error } = await client.from("customers").insert({ organization_id: scope.organizationId, department_id: input.departmentId, name: input.name, phone: input.phone, address: input.address, notes: input.notes, assigned_employee_id: scope.employeeId });
      if (error) throw new Error("顧客を登録できませんでした。", { cause: error });
    },
    async update(input) {
      assertDepartment(scope, input.departmentId);
      let request = client.from("customers").update({ department_id: input.departmentId, name: input.name, phone: input.phone, address: input.address, notes: input.notes, updated_at: new Date().toISOString() }).eq("organization_id", scope.organizationId).eq("id", input.id);
      if (scope.role !== "organization_admin") request = request.in("department_id", scope.departmentIds);
      const { data, error } = await request.select("id").maybeSingle();
      if (error || !data) throw new Error("顧客を更新できませんでした。", { cause: error });
    },
    async delete(id) {
      if (scope.role === "sales_rep") throw new Error("顧客を削除する権限がありません。");
      let request = client.from("customers").delete().eq("organization_id", scope.organizationId).eq("id", id);
      if (scope.role !== "organization_admin") request = request.in("department_id", scope.departmentIds);
      const { data, error } = await request.select("id").maybeSingle();
      if (error || !data) throw new Error("顧客を削除できません。管理者権限を確認してください。", { cause: error });
    },
  };
}

function assertDepartment(scope: RepositoryScope, departmentId: string) {
  if (scope.role !== "organization_admin" && !scope.departmentIds.includes(departmentId)) throw new Error("この部門を操作する権限がありません。");
}

function escapeFilter(value: string) {
  return value.replace(/[^\p{L}\p{N}\s+\-]/gu, "");
}
