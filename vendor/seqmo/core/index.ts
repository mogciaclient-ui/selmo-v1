export const categories = ["authentication", "authorization", "api", "database", "configuration", "network", "system", "activity", "business"] as const;
export const results = ["success", "failure", "blocked", "unknown"] as const;
export const severities = ["info", "low", "medium", "high", "critical"] as const;

export type EventInput = {
  category: typeof categories[number];
  action: string;
  result: typeof results[number];
  severity?: typeof severities[number];
  actorId?: string;
  sessionId?: string;
  ip?: string;
  country?: string;
  resource?: string;
  route?: string;
  traceId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
};

export type WireEvent = EventInput & { id: string; timestamp: string; environment: string };
export type SecurityEvent = WireEvent & {
  organizationId: string;
  projectId: string;
  receivedAt: string;
};

export type ClientOptions = {
  endpoint: string;
  projectId: string;
  ingestKey: string;
  environment: string;
  enabled?: boolean;
  environments?: string[];
  sampleRate?: number;
  heartbeatIntervalMs?: number;
  onDrop?: (count: number) => void;
};

const identifier = /^[\w.-]{1,100}$/;
const action = /^[a-z][a-z0-9_.:-]{0,79}$/;
const metadataEnums: Record<string, Set<string>> = {
  accountState: new Set(["active", "disabled"]),
  reason: new Set(["invalid_credentials", "expired_session", "missing_permission", "rate_limited", "internal_error"]),
  method: new Set(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]),
};

export function validIdentifier(value: unknown): value is string {
  return typeof value === "string" && identifier.test(value);
}

export function normalizeEvent(value: unknown): EventInput | null {
  if (!value || typeof value !== "object") return null;
  const source = value as EventInput;
  if (!categories.includes(source.category) || !results.includes(source.result) ||
      typeof source.action !== "string" || !action.test(source.action)) return null;
  if (source.severity !== undefined && !severities.includes(source.severity)) return null;
  const event: EventInput = {
    category: source.category, action: source.action, result: source.result,
    severity: source.severity ?? "info",
  };
  for (const field of ["actorId", "sessionId", "requestId"] as const) {
    if (validIdentifier(source[field])) event[field] = source[field];
  }
  if (typeof source.traceId === "string" && /^[0-9a-f]{32}$/.test(source.traceId) &&
      source.traceId !== "00000000000000000000000000000000") event.traceId = source.traceId;
  if (typeof source.country === "string" && /^[A-Z]{2}$/.test(source.country)) event.country = source.country;
  if (typeof source.ip === "string" && source.ip.length <= 45 && /^[\da-f:.]+$/i.test(source.ip)) event.ip = source.ip;
  if (validIdentifier(source.resource)) event.resource = source.resource;
  if (typeof source.route === "string") {
    const path = source.route.split(/[?#]/, 1)[0];
    if (path.length <= 200 && /^\/[\w/.:\-[\]]*$/.test(path)) event.route = path;
  }
  const metadata: Record<string, unknown> = {};
  for (const field of ["status", "durationMs", "count", "bytes", "intervalMs"] as const) {
    const number = source.metadata?.[field];
    if (typeof number === "number" && Number.isFinite(number) && number >= 0 && number <= 1e12) metadata[field] = number;
  }
  for (const [field, values] of Object.entries(metadataEnums)) {
    const candidate = source.metadata?.[field];
    if (typeof candidate === "string" && values.has(candidate)) metadata[field] = candidate;
  }
  return { ...event, metadata };
}

export function createClient(options: ClientOptions) {
  const batchSize = 50;
  const capacity = 1000;
  const queue: WireEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: Promise<void> | undefined;
  let stopped = options.enabled === false || (options.environments !== undefined && !options.environments.includes(options.environment));
  const endpoint = new URL("/v1/events/batch", options.endpoint);
  if (endpoint.protocol !== "https:" &&
      !(endpoint.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname))) {
    throw new Error("seQmo requires HTTPS outside loopback");
  }
  const reportDrop = (count: number) => {
    try { options.onDrop?.(count); } catch { /* Monitoring callbacks are isolated. */ }
  };

  async function send(events: WireEvent[]) {
    for (let attempt = 0; attempt < 4 && !stopped; attempt++) {
      if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 200 * (2 ** (attempt - 1)) + Math.random() * 100));
      if (stopped) break;
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { authorization: `Bearer ${options.ingestKey}`, "content-type": "application/json", "x-seqmo-project": options.projectId },
          body: JSON.stringify({ events }),
          signal: AbortSignal.timeout(3000),
          redirect: "error",
        });
        await response.body?.cancel();
        if (response.ok) return;
        if (response.status < 500 && response.status !== 429) break;
      } catch { /* Retry transient transport failures with the same event IDs. */ }
    }
    reportDrop(events.length);
  }

  function flush(): Promise<void> {
    if (timer) clearTimeout(timer);
    timer = undefined;
    if (pending) return pending;
    pending = (async () => {
      while (queue.length && !stopped) await send(queue.splice(0, batchSize));
    })().finally(() => {
      pending = undefined;
      if (queue.length && !stopped) void flush();
    });
    return pending;
  }

  return {
    capture(input: EventInput) {
      if (stopped) return;
      try {
        const event = normalizeEvent(input);
        if (!event) return;
        if (event.result === "success" && event.category === "api" &&
            Math.random() >= (options.sampleRate ?? 1)) return;
        if (queue.length >= capacity) { reportDrop(1); return; }
        queue.push({ ...event, id: crypto.randomUUID(), timestamp: new Date().toISOString(), environment: options.environment });
        if (queue.length >= batchSize) void flush();
        else if (!timer && !pending) timer = setTimeout(() => void flush(), 750);
      } catch { /* Input and SDK failures do not interrupt the host. */ }
    },
    flush,
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = undefined;
      const dropped = queue.splice(0).length;
      if (dropped) reportDrop(dropped);
    },
  };
}
