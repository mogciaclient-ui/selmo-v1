import { record } from "rrweb";
export type BrowserOptions = { relayEndpoint: string; replay?: boolean; bufferMs?: number; maxBytes?: number; blockSelector?: string };
export function initSeqmoBrowser(options: BrowserOptions) {
  const endpoint = new URL(options.relayEndpoint, location.href);
  if (endpoint.origin !== location.origin) throw new Error("seQmo browser relay must be same-origin");
  const sessionId = crypto.randomUUID();
  let buffer: { type: number; timestamp: number; [key: string]: unknown }[] = [];
  let bytes = 0;
  let meta: typeof buffer[number] | undefined;
  let lastUpload = 0;
  let stopped = false;
  const capacity = Math.min(1_000_000, Math.max(65_536, Number.isFinite(options.maxBytes) ? options.maxBytes! : 500_000));
  const duration = Math.min(300_000, Math.max(10_000, Number.isFinite(options.bufferMs) ? options.bufferMs! : 60_000));
  const stop = options.replay ? record({
    emit(event) {
      try {
      let nodes = 0;
      function redact(value: unknown, key = "", depth = 0): unknown {
        if (++nodes > 80_000 || depth > 100) throw new Error("replay_too_complex");
        if (key === "attributes") return {};
        if (Array.isArray(value)) return value.map(item => redact(item, "", depth + 1));
        if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, redact(item, name, depth + 1)]));
        if (typeof value === "string") return key === "tagName" ? (/^[a-z][a-z0-9-]{0,30}$/i.test(value) && !["script", "iframe", "object", "embed"].includes(value) ? value : "div") : "***";
        return value;
      }
      const item = redact(event) as typeof buffer[number];
      if (item.type === 4) meta = item;
      const size = JSON.stringify(item).length * 2;
      if (size > capacity) { buffer = []; bytes = 0; return; }
      if (item.type === 2 && (bytes + size > capacity || (buffer[0] && item.timestamp - buffer[0].timestamp > duration))) {
        buffer = meta ? [{ ...meta, timestamp: item.timestamp }] : [];
        bytes = buffer.length ? JSON.stringify(buffer[0]).length * 2 : 0;
      }
      if (bytes + size > capacity || buffer.length >= 2000) return;
      buffer.push(item); bytes += size;
      } catch { /* Oversized or unsupported snapshots are dropped without affecting the host. */ }
    },
    maskAllInputs: true, maskTextSelector: "*", blockSelector: options.blockSelector ?? "[data-seqmo-private],.seqmo-private",
    recordCanvas: false, collectFonts: false, inlineImages: false, recordCrossOriginIframes: false, checkoutEveryNms: 15_000,
    sampling: { mousemove: false, scroll: 250, input: "last" },
  }) : undefined;
  async function captureError() {
    if (stopped || Date.now() - lastUpload < 10_000) return;
    lastUpload = Date.now();
    const replay = options.replay && buffer.some(event => event.type === 2) ? buffer : undefined;
    try {
      await fetch(endpoint, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, replay, event: "browser_error" }), signal: AbortSignal.timeout(5000), keepalive: !replay,
      });
    } catch { /* Monitoring never interrupts the host. */ }
  }
  const onError = () => { void captureError(); };
  addEventListener("error", onError); addEventListener("unhandledrejection", onError);
  return { sessionId, captureError, stop() { stopped = true; stop?.(); buffer = []; bytes = 0; removeEventListener("error", onError); removeEventListener("unhandledrejection", onError); } };
}
