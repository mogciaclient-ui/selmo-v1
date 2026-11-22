import "server-only";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { isSeqmoAllowed, telemetry } from "./server";
export function withSeqmoRoute<Args extends unknown[]>(handler: (...args: Args) => Promise<Response>, route: string, operation?: string, write = false) {
  return async (...args: Args) => {
    const context = await getCurrentUser();
    if (!context) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!await isSeqmoAllowed(context, { route, operation, write })) return Response.json({ error: "現在この操作は保護機能で制限されています。" }, { status: 403 });
    const start = performance.now();
    try {
      const response = await handler(...args);
      await telemetry(context, { category: "api", action: "http_request", route, result: response.status >= 400 ? "failure" : "success", metadata: { status: response.status, durationMs: Math.round(performance.now() - start) } });
      if (operation === "export" && response.ok && response.headers.get("content-type")?.includes("text/csv")) await telemetry(context, { category: "activity", action: "data_exported", route, result: "success" });
      return response;
    } catch (error) {
      await telemetry(context, { category: "system", action: "request_error", route, result: "failure" }); throw error;
    }
  };
}
