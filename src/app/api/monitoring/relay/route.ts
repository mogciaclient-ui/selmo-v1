import { createSeqmoBrowserRelay } from "@seqmo/nextjs";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { settingsFor, identity } from "@/lib/seqmo/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const context = await getCurrentUser(); if (!context) return new Response(null, { status: 401 });
  const settings = settingsFor(context.organizationId); if (!settings) return new Response(null, { status: 204 });
  const origin = process.env.SEQMO_APPLICATION_ORIGIN;
  if (!origin) return new Response(null, { status: 503 });
  return createSeqmoBrowserRelay({ ...settings, origin, authenticate: async () => identity(context, settings) })(request);
}
