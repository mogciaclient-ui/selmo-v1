"use client";
import { useEffect } from "react";
export function SeqmoBrowser() {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SEQMO_BROWSER_ENABLED !== "true") return;
    let stopped = false;
    let monitor: { stop(): void } | undefined;
    void import("@seqmo/browser").then(({ initSeqmoBrowser }) => {
      if (!stopped) monitor = initSeqmoBrowser({ relayEndpoint: "/api/monitoring/relay", replay: process.env.NEXT_PUBLIC_SEQMO_REPLAY_ENABLED === "true", blockSelector: "[data-seqmo-private],input,textarea,[contenteditable],.seqmo-private" });
    }).catch(() => undefined);
    return () => { stopped = true; monitor?.stop(); };
  }, []);
  return null;
}
