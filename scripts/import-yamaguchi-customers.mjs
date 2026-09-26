import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error("CSVファイルのパスを指定してください。");
for (const name of ["SUPABASE_URL", "SUPABASE_SECRET_KEY"]) {
  if (!process.env[name]) throw new Error(`未設定の環境変数: ${name}`);
}

const expectedHeaders = ["会社名", "県", "市", "番地", "電話番号", "物件", "型式", "リース料金", "リース会社", "設置年月", "物件取得者"];
const csv = new TextDecoder("shift_jis").decode(await readFile(sourcePath));
const records = parseCsv(csv);
const headers = records.shift() ?? [];
if (JSON.stringify(headers) !== JSON.stringify(expectedHeaders)) {
  throw new Error(`CSV列が想定と異なります: ${headers.join(", ")}`);
}

const rows = records.filter((row) => row.some(Boolean)).map((values, index) => {
  if (values.length !== headers.length) throw new Error(`${index + 2}行目の列数が不正です。`);
  return Object.fromEntries(headers.map((header, column) => [header, values[column]]));
});

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: organizations, error: organizationError } = await db.from("organizations").select("id");
if (organizationError) throw organizationError;
if (organizations.length !== 1) throw new Error(`取込先の組織を一意に決められません（${organizations.length}件）。`);
const organizationId = organizations[0].id;

const { data: salesDepartment, error: departmentError } = await db.from("departments").select("id").eq("organization_id", organizationId).eq("name", "営業").maybeSingle();
if (departmentError) throw departmentError;
if (!salesDepartment) throw new Error("「営業」部署がありません。先に部署を作成してください。");

const grouped = new Map();
for (const row of rows) {
  const key = [row["会社名"], row["県"], row["市"], row["番地"], row["電話番号"]].join("\u001f");
  const customer = grouped.get(key) ?? { key, rows: [] };
  customer.rows.push(row);
  grouped.set(key, customer);
}

const customers = [...grouped.values()].map(({ key, rows: sourceRows }) => {
  const first = sourceRows[0];
  return {
    id: deterministicUuid(`山口県.csv\u001f${key}`),
    organization_id: organizationId,
    department_id: salesDepartment.id,
    name: first["会社名"],
    phone: first["電話番号"] || null,
    address: `${first["県"]}${first["市"]}${first["番地"]}` || null,
    registration_details: {
      importSource: "山口県.csv",
      prefecture: first["県"],
      address1: `${first["市"]}${first["番地"]}`,
      sourceRows,
      equipment: sourceRows.map((row) => ({
        type: row["物件"],
        model: row["型式"],
        leaseFee: row["リース料金"],
        leaseCompany: row["リース会社"],
        installedAt: row["設置年月"],
        acquiredBy: row["物件取得者"],
      })),
    },
  };
});

for (let offset = 0; offset < customers.length; offset += 250) {
  const { error } = await db.from("customers").upsert(customers.slice(offset, offset + 250), { onConflict: "id" });
  if (error) throw new Error(`${offset + 1}件目からの取込に失敗しました: ${error.message}`);
  console.log(`${Math.min(offset + 250, customers.length)} / ${customers.length} 顧客`);
}

console.log(`取込完了: ${customers.length}顧客、CSV ${rows.length}行`);

function deterministicUuid(value) {
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const text = hex.join("");
  return `${text.slice(0, 8)}-${text.slice(8, 12)}-${text.slice(12, 16)}-${text.slice(16, 20)}-${text.slice(20)}`;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { row.push(field); field = ""; }
    else if (character === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += character;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  return rows;
}
