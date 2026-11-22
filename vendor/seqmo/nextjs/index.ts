import { captureError, captureRequest, withTrace } from "@seqmo/node";
export { captureSecurityEvent, flushSeQmo, initSeQmo, stopSeQmo } from "@seqmo/node";

export function onRequestError(_error: unknown, _request: unknown, context: { routePath: string }) {
  captureError(context.routePath);
}

export function withSeQmoRoute<Args extends unknown[]>(
  route: string, handler: (request: Request, ...args: Args) => Response | Promise<Response>,
) {
  return (request: Request, ...args: Args) => withTrace(request.headers, route, async () => {
    const start = performance.now();
    try {
      const response = await handler(request, ...args);
      captureRequest(request.method, response.status, Math.round(performance.now() - start));
      return response;
    } catch (error) {
      captureRequest(request.method, 500, Math.round(performance.now() - start));
      throw error;
    }
  });
}

export function withSeQmoAction<Args extends unknown[], T>(route: string, handler: (...args: Args) => Promise<T>) {
  return async (...args: Args): Promise<T> => withTrace(new Headers(), route, async () => {
    try { return await handler(...args); } catch (error) {
      captureError();
      throw error;
    }
  });
}

// Install on the monitored application's server. Authenticate using the host application's session.
export function createSeqmoBrowserRelay(options: import("@seqmo/core").ClientOptions & {
  origin: string; authenticate: (request: Request) => Promise<{ actorId: string; ip?: string } | null>;
}) {
  return async (request: Request) => {
    if (request.headers.get("origin") !== options.origin) return new Response(null, { status: 403 });
    const identity = await options.authenticate(request);
    if (!identity) return new Response(null, { status: 401 });
    const reader = request.body?.getReader();
    if (!reader) return new Response(null, { status: 400 });
    let size = 0;
    const parts: Uint8Array[] = [];
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.length;
        if (size > 1_100_000) { await reader.cancel(); return new Response(null, { status: 413 }); }
        parts.push(part.value);
      }
      const data = JSON.parse(new TextDecoder().decode(Buffer.concat(parts)));
      const { validIdentifier, createClient } = await import("@seqmo/core");
      if (!validIdentifier(data.sessionId) || data.event !== "browser_error") return new Response(null, { status: 400 });
      const client = createClient({ ...options, heartbeatIntervalMs: 0 });
      client.capture({ category: "system", action: "browser_error", result: "failure", severity: "medium", actorId: identity.actorId, ip: identity.ip, sessionId: data.sessionId });
      await client.flush(); client.stop();
      if (Array.isArray(data.replay)) {
        const endpoint = new URL("/v1/replays", options.endpoint);
        const response = await fetch(endpoint, { method: "POST", headers: { authorization: `Bearer ${options.ingestKey}`, "x-seqmo-project": options.projectId, "content-type": "application/json" },
          body: JSON.stringify({ sessionId: data.sessionId, actorId: identity.actorId, events: data.replay }), signal: AbortSignal.timeout(5000), redirect: "error" });
        if (!response.ok) return new Response(null, { status: 502 });
      }
      return new Response(null, { status: 202 });
    } catch { return new Response(null, { status: 400 }); } finally { reader.releaseLock(); }
  };
}
