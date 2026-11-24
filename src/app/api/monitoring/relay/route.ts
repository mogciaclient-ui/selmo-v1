import { createSeqmoBrowserRelay } from "@seqmo/nextjs";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { settingsFor, identity } from "@/lib/seqmo/server";
export const runtime = "nodejs";
export async function GET() {
  const context = await getCurrentUser();
  if (!context) return new Response(null, { status: 401 });
  const settings = settingsFor(context.organizationId);
  let replay = false;
  if (settings?.replay === true) {
    try {
      const response = await fetch(new URL("/v1/replays", settings.endpoint), {
        headers: { authorization: `Bearer ${settings.ingestKey}`, "x-seqmo-project": settings.projectId },
        signal: AbortSignal.timeout(3000), redirect: "error", cache: "no-store",
      });
      replay = response.ok && (await response.json()).enabled === true;
    } catch { /* No recording if the monitoring configuration cannot be confirmed. */ }
  }
  return Response.json({ enabled: !!settings, replay, bufferMs: 60_000, maxBytes: 500_000 }, { headers: { "Cache-Control": "private, no-store" } });
}
export async function POST(request: Request) {
  const context = await getCurrentUser(); if (!context) return new Response(null, { status: 401 });
  const settings = settingsFor(context.organizationId); if (!settings) return new Response(null, { status: 204 });
  const origin = process.env.SEQMO_APPLICATION_ORIGIN;
  if (!origin) return new Response(null, { status: 503 });
  return createSeqmoBrowserRelay({ ...settings, allowReplay: settings.replay === true, origin, authenticate: async () => identity(context, settings) })(request);
}
