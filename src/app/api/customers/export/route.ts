import { requireAuth } from "@/lib/auth/require-auth";

type ExportRow = {
  name: string;
  phone: string | null;
  postal_code: string | null;
  address: string | null;
  status: string | null;
  created_at: string;
  departments: { name: string } | { name: string }[] | null;
  employees: { name: string } | { name: string }[] | null;
};

export async function GET() {
  const context = await requireAuth();
  const header = ["顧客名", "電話番号", "郵便番号", "住所", "ステータス", "担当部署", "営業担当", "データ登録日"];
  const rows: Array<Array<string | null | undefined>> = [];
  const pageSize = 1000;
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await context.db.from("customers")
      .select("name,phone,postal_code,address,status,created_at,departments(name),employees!customers_assigned_employee_id_fkey(name)")
      .eq("organization_id", context.organizationId)
      .order("name")
      .order("id")
      .range(start, start + pageSize - 1);
    if (error) return new Response("顧客データを出力できませんでした。", { status: 500 });

    const page = (data ?? []) as unknown as ExportRow[];
    for (const row of page) {
      rows.push([
        row.name, row.phone, row.postal_code, row.address, row.status,
        first(row.departments)?.name, first(row.employees)?.name, row.created_at.slice(0, 10),
      ]);
    }
    if (page.length < pageSize) break;
  }
  const csv = `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="customers-${new Date().toISOString().slice(0, 10)}.csv"` } });
}

function first<T>(value: T | T[] | null) { return Array.isArray(value) ? value[0] : value; }
function csvCell(value: string | null | undefined) { return `"${(value ?? "").replaceAll('"', '""')}"`; }
