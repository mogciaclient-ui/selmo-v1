export type DatabaseIntent = { resource: string; operation: string; write: boolean };
export type AuditResult = { error?: unknown; count?: number | null; data?: unknown };
// Wrap the authenticated client's lazy query. The check runs before the request is dispatched.
export function guardDatabase<T extends object>(client: T, check: (intent: DatabaseIntent) => Promise<boolean>, audit: (intent: DatabaseIntent, result: AuditResult) => void): T {
  const mutations = new Set(["insert", "update", "upsert", "delete"]);
  function wrap(target: object, resource: string, intent?: DatabaseIntent): object {
    return new Proxy(target, { get(object, property) {
      const value = Reflect.get(object, property);
      if (property === "then" && typeof value === "function") return (fulfilled?: (result: unknown) => unknown, rejected?: (error: unknown) => unknown) => {
        const execute = async () => {
          if (intent && !await check(intent)) return { data: null, error: { message: "現在この操作は保護機能で制限されています。管理者へ確認してください。", code: "SEQMO_PROTECTED" }, status: 403, count: null };
          const result = await new Promise<AuditResult>((resolve, reject) => Reflect.apply(value, object, [resolve, reject]));
          if (intent) audit(intent, result);
          return result;
        };
        return execute().then(fulfilled, rejected);
      };
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        const next = Reflect.apply(value, object, args);
        const nextIntent = mutations.has(String(property)) ? { resource, operation: `${resource}.${String(property)}`, write: true } : property === "select" && !intent ? { resource, operation: `${resource}.select`, write: false } : intent;
        return next && typeof next === "object" ? wrap(next, resource, nextIntent) : next;
      };
    } });
  }
  return new Proxy(client, { get(object, property) {
    const value = Reflect.get(object, property);
    if (property === "from" && typeof value === "function") return (table: string) => wrap(Reflect.apply(value, object, [table]), table);
    if (property === "rpc" && typeof value === "function") return (name: string, ...args: unknown[]) => wrap(Reflect.apply(value, object, [name, ...args]), name, { resource: name, operation: `rpc.${name}`, write: true });
    return typeof value === "function" ? value.bind(object) : value;
  } });
}
