import { z } from "zod";
import { searchCustomers } from "@/application/customers/search-customers";
import { createSupabaseSalesActivityRepository } from "@/infrastructure/supabase/sales-activity-repository";
import { getCurrentUser } from "@/lib/auth/get-current-user";

const querySchema = z.string().trim().min(2).max(100);

export async function GET(request: Request) {
  const context = await getCurrentUser();
  if (!context) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const query = querySchema.safeParse(new URL(request.url).searchParams.get("q"));
  if (!query.success) return Response.json({ customers: [] });

  try {
    const customers = await searchCustomers(createSupabaseSalesActivityRepository(context.db, context), query.data);
    return Response.json({ customers }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "顧客を検索できませんでした。" }, { status: 500 });
  }
}
