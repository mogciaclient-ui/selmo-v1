import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultProductNames, isExcludedProduct } from "@/domain/products/defaults";

export async function findProductOptions(db: SupabaseClient, organizationId: string): Promise<string[]> {
  const { data, error } = await db.from("products")
    .select("name,status")
    .eq("organization_id", organizationId)
    .order("name");

  if (error && error.code !== "42P01") throw error;
  if (!data?.length) return [...defaultProductNames];
  return data.filter(row => row.status === "active" && !isExcludedProduct(row.name)).map(row => row.name);
}
