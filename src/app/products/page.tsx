import { AppShell } from "@/components/layout/app-shell";
import { ProductDialog, type Product } from "@/components/products/product-dialog";
import { requireAuth } from "@/lib/auth/require-auth";

type ProductRow = { id: string; name: string; name_kana: string | null; model_number: string | null; price: number | null; size: string | null; weight: string | null; capacity: string | null; color: string | null; manufacturer_name: string | null; manufacturer_url: string | null; description: string | null; notes: string | null; action_process: string | null; status: "active" | "inactive" };
const initialNames = ["AXCEL", "ビジネスフォン", "ＦＡＸ", "複合機", "UTM", "サーバー", "ネットワーク商材", "防犯カメラ", "ＡＸＣＥＬ", "アルファ電気", "コラボ", "ＬＥＤ", "ＵＰＳ・ＳＳＷ・ルーター", "その他", "アルファサポート", "CS事業部", "商材未定", "IT事業部"];

export default async function ProductsPage() {
  const context = await requireAuth();
  const { data, error } = await context.db.from("products").select("id,name,name_kana,model_number,price,size,weight,capacity,color,manufacturer_name,manufacturer_url,description,notes,action_process,status").eq("organization_id", context.organizationId).order("created_at").limit(1000);
  const databaseRows = (data ?? []) as ProductRow[];
  const rows: Product[] = error?.code === "42P01" || databaseRows.length === 0
    ? initialNames.map((name, index) => ({ name, status: index === 17 ? "inactive" : "active" }))
    : databaseRows.map(toProduct);
  const canEdit = context.role === "organization_admin";

  return <AppShell active="/products" displayName={context.displayName} department={context.departmentName}>
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-5 py-5 md:px-8 md:py-6"><div><p className="text-xs font-bold text-amber-800">PRODUCTS</p><h1 className="mt-1 text-2xl font-bold">商材リスト</h1><p className="mt-1 text-sm text-slate-400">取扱商材の基本情報と状態を管理します。</p></div>{canEdit && <ProductDialog/>}</div></header>
    <main className="mx-auto max-w-[1400px] p-4 pb-24 md:p-8">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-4 font-bold">商材一覧 <span className="text-amber-700">{rows.length}件</span></div><div className="overflow-x-auto overscroll-x-contain"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3">No.</th><th className="px-4 py-3">商材名</th><th className="px-4 py-3">型番</th><th className="px-4 py-3">メーカー名</th><th className="px-4 py-3 text-right">価格</th><th className="px-4 py-3">行動プロセス</th><th className="px-4 py-3">状態</th><th className="px-4 py-3 text-right">操作</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.id ?? `${row.name}-${index}`} className="border-t border-slate-100 hover:bg-amber-50/40"><td className="px-4 py-3 text-slate-400">{index + 1}</td><td className="px-4 py-3 font-bold">{row.name}</td><td className="px-4 py-3">{row.modelNumber ?? "—"}</td><td className="px-4 py-3">{row.manufacturerName ?? "—"}</td><td className="px-4 py-3 text-right">{row.price == null ? "—" : `${row.price.toLocaleString("ja-JP")}円`}</td><td className="px-4 py-3">{row.actionProcess ?? "—"}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${row.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{row.status === "active" ? "有効" : "無効"}</span></td><td className="px-4 py-3 text-right"><ProductDialog product={row} canEdit={canEdit && Boolean(row.id)}/></td></tr>)}</tbody></table></div><div className="border-t border-slate-100 px-5 py-4 text-xs text-slate-500">{rows.length}件中 {rows.length ? 1 : 0}～{rows.length}件</div></section>
      {error?.code === "42P01" && <p className="mt-3 text-xs text-slate-400">現在は初期商材を表示しています。商材の登録・編集を使うには最新のデータベース更新を適用してください。</p>}
    </main>
  </AppShell>;
}

function toProduct(row: ProductRow): Product { return { id: row.id, name: row.name, nameKana: row.name_kana, modelNumber: row.model_number, price: row.price, size: row.size, weight: row.weight, capacity: row.capacity, color: row.color, manufacturerName: row.manufacturer_name, manufacturerUrl: row.manufacturer_url, description: row.description, notes: row.notes, actionProcess: row.action_process, status: row.status }; }
