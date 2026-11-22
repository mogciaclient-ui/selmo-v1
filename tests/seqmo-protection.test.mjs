import test from "node:test";
import assert from "node:assert/strict";
import { guardDatabase } from "../src/lib/seqmo/guard-database.ts";
function fakeDatabase() {
  const calls = [];
  const builder = () => {
    const value = {
      insert() { calls.push("construct-insert"); return value; }, update() { calls.push("construct-update"); return value; }, delete() { return value; }, select() { return value; }, eq() { return value; },
      then(resolve) { calls.push("database-request"); return Promise.resolve({ data: [{ id: "safe" }], error: null, count: 1 }).then(resolve); },
    }; return value;
  };
  return { client: { from: () => builder(), rpc: () => builder() }, calls };
}
test("read-only protection rejects before the actual database write and preserves reads", async () => {
  const { client, calls } = fakeDatabase(); const audits = [];
  const db = guardDatabase(client, async intent => !intent.write, (intent,result) => audits.push({ intent, result }));
  const denied = await db.from("customers").insert({ private: "not-collected" }).select().eq("id", "x");
  assert.equal(denied.error.code, "SEQMO_PROTECTED"); assert.equal(calls.includes("database-request"), false);
  const read = await db.from("customers").select(); assert.equal(read.error, null); assert.equal(audits[0].intent.write, false);
});
test("important-operation scope is precise and only completed writes are audited", async () => {
  const { client, calls } = fakeDatabase(); const audits=[];
  const db = guardDatabase(client, async intent => intent.operation !== "customers.delete", (intent,result)=>audits.push({intent,result}));
  assert.equal((await db.from("customers").delete().eq("id","x")).status,403);
  assert.equal(calls.includes("database-request"),false);
  await db.from("customers").update({ name:"private" }).eq("id","x").select();
  assert.equal(audits.length,1); assert.equal(audits[0].intent.operation,"customers.update"); assert.equal(audits[0].result.count,1);
  assert.equal((await db.rpc("sync_report_case", {})).error,null);
});
