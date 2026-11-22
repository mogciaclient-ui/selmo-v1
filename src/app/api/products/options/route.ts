import { withSeqmoRoute } from "@/lib/seqmo/route";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { findProductOptions } from "@/infrastructure/supabase/product-options-repository";
async function GETHandler() {
  const context = await getCurrentUser();
  if (!context) return Response.json({ message: "ログインし直してください。" }, { status: 401 });
  try {
    const products = await findProductOptions(context.db, context.organizationId);
    return Response.json({ products }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ message: "商材マスタを取得できませんでした。" }, { status: 500 });
  }
}

export const GET = withSeqmoRoute(GETHandler, "/api/products/options", "/api/products/options", false);
