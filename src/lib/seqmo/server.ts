import "server-only";
import { createHmac } from "node:crypto";
import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { createClient, type ClientOptions } from "@seqmo/core";
import { createSeqmoProtectionAgent } from "@seqmo/node";
import type { AuthContext } from "@/lib/auth/types";
import { FIREBASE_SESSION_COOKIE } from "@/lib/firebase/auth";
import { guardDatabase, type DatabaseIntent, type AuditResult } from "./guard-database";

type Settings = ClientOptions & { actorSecret: string; protection: boolean; replay?: boolean };
type Runtime = { client: ReturnType<typeof createClient>; guard?: ReturnType<typeof createSeqmoProtectionAgent>; syncedAt: number };
const state = globalThis as typeof globalThis & { __selmoSeqmo?: Map<string, Runtime> };
const runtimes = state.__selmoSeqmo ??= new Map();
export function settingsFor(organizationId: string): Settings | undefined {
  let scopes: Record<string, Partial<Settings>>;
  try { scopes = JSON.parse(process.env.SEQMO_SYSTEMS ?? "{}"); if (!scopes || Array.isArray(scopes) || typeof scopes !== "object") return; } catch { return; }
  const source = scopes[organizationId] ?? (process.env.SEQMO_ORGANIZATION_ID === organizationId ? {
    endpoint: process.env.SEQMO_ENDPOINT, projectId: process.env.SEQMO_PROJECT_ID, ingestKey: process.env.SEQMO_INGEST_KEY,
    actorSecret: process.env.SEQMO_ACTOR_SECRET, protection: process.env.SEQMO_PROTECTION_ENABLED === "true", replay: process.env.SEQMO_REPLAY_ENABLED === "true",
  } : undefined);
  if (!source?.endpoint || !source.projectId || !source.ingestKey || !source.actorSecret || source.actorSecret.length < 32) return;
  return { ...source, endpoint: source.endpoint, projectId: source.projectId, ingestKey: source.ingestKey, actorSecret: source.actorSecret, environment: process.env.SEQMO_ENVIRONMENT ?? "production", protection: source.protection === true };
}
function runtimeFor(settings: Settings) {
  const key = `${settings.projectId}/${settings.ingestKey}/${settings.protection}`;
  let runtime = runtimes.get(key);
  if (!runtime) {
    const trustedIp = process.env.VERCEL === "1" || process.env.SEQMO_TRUSTED_IP_HEADER;
    runtime = { client: createClient(settings), syncedAt: 0, guard: settings.protection ? createSeqmoProtectionAgent({ ...settings,
      enforcedActions: ["account_suspend", "session_revoke", "read_only", "export_disable", "api_restrict", "operation_disable", ...(trustedIp ? ["ip_restrict"] : [])],
    }) : undefined };
    runtimes.set(key, runtime);
    const client = runtime.client;
    const beat = () => client.capture({ category: "system", action: "sdk_heartbeat", result: "success", metadata: { intervalMs: 60_000 } });
    beat(); const timer = setInterval(beat, 60_000); timer.unref();
  }
  return runtime;
}
export async function identity(context: Pick<AuthContext, "organizationId" | "firebaseUid">, settings: Settings) {
  const signature = (value: string) => createHmac("sha256", settings.actorSecret).update(context.organizationId + "\0" + value).digest("hex");
  const session = (await cookies()).get(FIREBASE_SESSION_COOKIE)?.value;
  const incoming = await headers();
  const trustedHeader = process.env.VERCEL === "1" ? "x-vercel-forwarded-for" : process.env.SEQMO_TRUSTED_IP_HEADER;
  return { actorId: signature(context.firebaseUid), sessionId: session ? signature(session) : undefined,
    ip: trustedHeader ? incoming.get(trustedHeader)?.split(",")[0]?.trim() : undefined };
}
export async function isSeqmoAllowed(context: Pick<AuthContext, "organizationId" | "firebaseUid">, operation: { operation?: string; route?: string; write?: boolean } = {}) {
  const settings = settingsFor(context.organizationId);
  if (!settings) {
    // Explicitly enabled protection with incomplete configuration must not silently allow access.
    if (process.env.SEQMO_ORGANIZATION_ID === context.organizationId && process.env.SEQMO_PROTECTION_ENABLED === "true") return false;
    try { return JSON.parse(process.env.SEQMO_SYSTEMS ?? "{}")[context.organizationId]?.protection !== true; } catch { return false; }
  }
  if (!settings.protection) return true;
  let runtime: Runtime;
  try { runtime = runtimeFor(settings); } catch { return false; }
  if (!runtime.guard) return false;
  if (!runtime.guard.ready() || Date.now() - runtime.syncedAt > 15_000 || operation.operation === "export") {
    await runtime.guard.sync(); runtime.syncedAt = Date.now();
  }
  return runtime.guard.allowed({ ...await identity(context, settings), ...operation });
}
export async function telemetry(context: Pick<AuthContext, "organizationId" | "firebaseUid">, event: import("@seqmo/core").EventInput) {
  const settings = settingsFor(context.organizationId); if (!settings) return;
  try {
  const runtime = runtimeFor(settings);
  runtime.client.capture({ ...await identity(context, settings), ...event });
  try { after(() => runtime.client.flush()); } catch { void runtime.client.flush(); }
  } catch { /* Monitoring failures must not interrupt business operations. */ }
}
export function protectDatabase(context: AuthContext): AuthContext["db"] {
  if (!settingsFor(context.organizationId)) return context.db;
  return guardDatabase(context.db, intent => isSeqmoAllowed(context, intent), (intent: DatabaseIntent, result: AuditResult) => {
    void telemetry(context, { category: "activity", action: !intent.write ? "data_read" : intent.operation.endsWith(".delete") ? "data_deleted" : "data_updated", resource: intent.resource,
      result: result.error ? "failure" : "success", metadata: typeof result.count === "number" ? { count: result.count } : Array.isArray(result.data) ? { count: result.data.length } : {} });
  });
}

export function startMonitoring() {
  let scopes: Record<string, unknown> = {};
  try { scopes = JSON.parse(process.env.SEQMO_SYSTEMS ?? "{}"); if (!scopes || Array.isArray(scopes) || typeof scopes !== "object") scopes = {}; } catch { /* Invalid configuration remains unavailable. */ }
  for (const org of new Set([...Object.keys(scopes), ...(process.env.SEQMO_ORGANIZATION_ID ? [process.env.SEQMO_ORGANIZATION_ID] : [])])) {
    const settings = settingsFor(org); if (settings) { try { runtimeFor(settings); } catch { /* Fail-soft monitoring startup. */ } }
  }
}
export async function captureAuthenticatedServerError(firebaseUid: string, organizationId: string, session: string, route: string) {
  const settings = settingsFor(organizationId); if (!settings) return;
  try {
    const sign = (value: string) => createHmac("sha256", settings.actorSecret).update(organizationId + "\0" + value).digest("hex");
    const runtime = runtimeFor(settings);
    runtime.client.capture({ category: "system", action: "request_error", result: "failure", route, actorId: sign(firebaseUid), sessionId: sign(session) });
    await runtime.client.flush();
  } catch { /* Error monitoring must not replace the original application failure. */ }
}

export async function captureAuthentication(firebaseUid: string, organizationId: string, session: string, action: "login_success" | "logout") {
  const settings = settingsFor(organizationId); if (!settings) return;
  try {
    const sign = (value: string) => createHmac("sha256", settings.actorSecret).update(organizationId + "\0" + value).digest("hex");
    const runtime = runtimeFor(settings);
    runtime.client.capture({ category: "authentication", action, result: "success", actorId: sign(firebaseUid), sessionId: sign(session) });
    try { after(() => runtime.client.flush()); } catch { void runtime.client.flush(); }
  } catch { /* Authentication must survive monitoring delivery failures. */ }
}

export async function flushMonitoring() {
  await Promise.allSettled([...runtimes.values()].map(runtime => runtime.client.flush()));
}
