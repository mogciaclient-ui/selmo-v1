import { getCurrentUser } from "@/lib/auth/get-current-user";
import { findProductOptions } from "@/infrastructure/supabase/product-options-repository";
export async function GET() {
  const context = await getCurrentUser();
  if (!context) return Response.json({ message: "ログインし直してください。" }, { status: 401 });
  try {
    const products = await findProductOptions(context.db, context.organizationId);
    return Response.json({ products }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ message: "商材マスタを取得できませんでした。" }, { status: 500 });
  }
}
