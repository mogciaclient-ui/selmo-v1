"use client";
import { useEffect } from "react";
export function SeqmoBrowser() {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SEQMO_BROWSER_ENABLED !== "true") return;
    let stopped = false;
    let monitor: { stop(): void } | undefined;
    const controller = new AbortController();
    void fetch("/api/monitoring/relay", { credentials: "same-origin", cache: "no-store", signal: controller.signal }).then(async response => {
      if (!response.ok) return;
      const config = await response.json();
      if (stopped || config.enabled !== true) return;
      const { initSeqmoBrowser } = await import("@seqmo/browser");
      if (!stopped) monitor = initSeqmoBrowser({ relayEndpoint: "/api/monitoring/relay", replay: config.replay === true, bufferMs: config.bufferMs, maxBytes: config.maxBytes, blockSelector: "[data-seqmo-private],input,textarea,[contenteditable],.seqmo-private" });
    }).catch(() => undefined);
    return () => { stopped = true; controller.abort(); monitor?.stop(); };
  }, []);
  return null;
}
