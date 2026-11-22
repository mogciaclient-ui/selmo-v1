import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient, type ClientOptions, type EventInput } from "@seqmo/core";

export type { ClientOptions, EventInput } from "@seqmo/core";

type TraceContext = Pick<EventInput, "traceId" | "requestId" | "route">;
type MonitoringOptions = { requests?: boolean; errors?: boolean; authentication?: boolean; authorization?: boolean };
type RuntimeState = {
  context: AsyncLocalStorage<TraceContext>;
  client?: ReturnType<typeof createClient>;
  monitoring: MonitoringOptions;
  heartbeat?: ReturnType<typeof setInterval>;
};

// Next.js loads instrumentation and handlers in separate server bundles.
const runtimeKey = Symbol.for("@seqmo/node/runtime/v1");
const globals = globalThis as typeof globalThis & { [runtimeKey]?: RuntimeState };
const state = globals[runtimeKey] ??= { context: new AsyncLocalStorage<TraceContext>(), monitoring: {} };

export function initSeQmo(options: ClientOptions & { monitoring?: MonitoringOptions }) {
  stopSeQmo();
  state.monitoring = options.monitoring ?? {};
  try {
    state.client = createClient(options);
    if (options.enabled !== false && (!options.environments || options.environments.includes(options.environment)) && options.heartbeatIntervalMs !== 0) {
      const interval = Math.min(300_000, Math.max(10_000, options.heartbeatIntervalMs ?? 60_000));
      const heartbeat = () => state.client?.capture({ category: "system", action: "sdk_heartbeat", result: "success", metadata: { intervalMs: Number.isFinite(interval) ? interval : 60_000 } });
      heartbeat();
      state.heartbeat = setInterval(heartbeat, Number.isFinite(interval) ? interval : 60_000);
      state.heartbeat.unref();
    }
  } catch { state.client = undefined; }
}

export function captureSecurityEvent(event: EventInput) {
  if (event.category === "authentication" && state.monitoring.authentication === false) return;
  if (event.category === "authorization" && state.monitoring.authorization === false) return;
  state.client?.capture({ ...state.context.getStore(), ...event });
}

export function flushSeQmo() { return state.client?.flush() ?? Promise.resolve(); }
export function stopSeQmo() {
  if (state.heartbeat) clearInterval(state.heartbeat);
  state.heartbeat = undefined;
  state.client?.stop();
  state.client = undefined;
}

export function withTrace<T>(headers: Headers, route: string, callback: () => T): T {
  const candidate = headers.get("traceparent");
  const parent = candidate?.match(/^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/);
  const traceId = parent && !/^0+$/.test(parent[1]) && !/^0+$/.test(parent[2])
    ? parent[1] : randomBytes(16).toString("hex");
  return state.context.run({ traceId, requestId: randomUUID(), route }, callback);
}

export function captureRequest(method: string, status: number, durationMs: number) {
  if (state.monitoring.requests === false) return;
  captureSecurityEvent({
    category: status === 403 ? "authorization" : "api",
    action: status === 403 ? "access_denied" : "http_request",
    result: status >= 400 ? "failure" : "success",
    severity: status >= 500 ? "medium" : "info",
    metadata: { method, status, durationMs },
  });
}

export function captureError(route?: string) {
  if (state.monitoring.errors === false) return;
  captureSecurityEvent({
    category: "system", action: "request_error", result: "failure", severity: "medium",
    ...(route ? { route } : {}),
  });
}

export function monitoringActorId(uid: string, secret: string) {
  if (secret.length < 32) throw new Error("Use a dedicated HMAC secret of at least 32 characters");
  return import("node:crypto").then(({ createHmac }) => createHmac("sha256", secret).update(uid).digest("hex"));
}
export type ProtectionCommand = { id: string; version: number; action: string; target: string; desired: boolean; expiresAt: string };
export function createSeqmoProtectionAgent(options: ClientOptions & {
  enforcedActions: string[];
  apply?: (command: ProtectionCommand) => Promise<{ applied: boolean; before: Record<string, boolean>; after: Record<string, boolean> }>;
}) {
  let active: ProtectionCommand[] = [];
  let ready = false;
  let stopped = false;
  let pending: Promise<void> | undefined;
  const endpoint = new URL("/v1/control", options.endpoint);
  if (endpoint.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname)) throw new Error("HTTPS required");
  const headers = { authorization: `Bearer ${options.ingestKey}`, "x-seqmo-project": options.projectId, "content-type": "application/json" };
  const applied = new Map<string, string>();
  async function sync() {
    if (pending || stopped) return pending;
    pending = (async () => {
      try {
        const response = await fetch(endpoint, { headers, signal: AbortSignal.timeout(5000), redirect: "error" });
        if (!response.ok) return;
        const body = await response.json() as { commands: ProtectionCommand[] };
        if (!Array.isArray(body.commands) || body.commands.length > 100) return;
        for (const command of body.commands) {
          if (!command || typeof command.id !== "string" || typeof command.version !== "number" || typeof command.desired !== "boolean") continue;
          const signature = `${command.desired}/${command.action}/${command.target}`;
          if (applied.get(command.id) === signature) continue;
          const before = { active: active.some(item => item.id === command.id) };
          let result: { applied: boolean; before: Record<string, boolean>; after: Record<string, boolean> };
          if (!options.enforcedActions.includes(command.action) || !["ip_restrict", "account_suspend", "session_revoke", "export_disable", "operation_disable", "api_restrict", "read_only"].includes(command.action)) result = { applied: false, before, after: before };
          else if (options.apply) result = await options.apply(command);
          else {
            active = active.filter(item => item.id !== command.id);
            if (command.desired) active.push(command);
            result = { applied: true, before, after: { active: command.desired } };
          }
          const receipt = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify({ id: command.id, version: command.version, ...result }), signal: AbortSignal.timeout(5000), redirect: "error" });
          if (receipt.ok && result.applied) applied.set(command.id, signature);
        }
        ready = true;
      } catch { /* Keep confirmed restrictions during monitoring outages. */ }
    })().finally(() => { pending = undefined; });
    return pending;
  }
  // Must be called after the host application's authentication and before the protected operation.
  function allowed(context: { actorId?: string; sessionId?: string; ip?: string; operation?: string; route?: string; write?: boolean }) {
    if (!ready) return false;
    return !active.some(command => {
      if (!command.desired) return false;
      // Expired restrictions remain enforced until an explicit release is received and acknowledged.
      switch (command.action) {
        case "account_suspend": return context.actorId === command.target;
        case "session_revoke": return context.sessionId === command.target;
        case "ip_restrict": return context.ip === command.target;
        case "export_disable": return context.operation === "export";
        case "operation_disable": return context.operation === command.target;
        case "api_restrict": return context.route === command.target;
        case "read_only": return context.write === true;
        default: return false;
      }
    });
  }
  const timer = setInterval(() => void sync(), 15_000); timer.unref();
  void sync();
  return { sync, allowed, ready: () => ready, stop() { stopped = true; clearInterval(timer); } };
}

export async function sendDependencyInventory(options: ClientOptions, packages: { name: string; version: string }[]) {
  const endpoint = new URL("/v1/inventory", options.endpoint);
  if (endpoint.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname)) return false;
  try {
    const response = await fetch(endpoint, { method: "POST", headers: { authorization: `Bearer ${options.ingestKey}`, "x-seqmo-project": options.projectId, "content-type": "application/json" }, body: JSON.stringify({ packages: packages.slice(0, 100) }), signal: AbortSignal.timeout(5000), redirect: "error" });
    return response.ok;
  } catch { return false; }
}
