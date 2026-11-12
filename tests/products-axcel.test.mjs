import test from "node:test";
import assert from "node:assert/strict";
import { defaultProductNames, isExcludedProduct, productOptions } from "../src/domain/products/defaults.ts";
import { requiredReportFields } from "../src/domain/schedules/report-requirements.ts";

test("AXCEL は半角・全角とも商材の選択肢に出さない", () => {
  for (const name of ["AXCEL", "ＡＸＣＥＬ", "axcel"]) assert.equal(isExcludedProduct(name), true);
  assert.equal(isExcludedProduct("複合機"), false);
  assert.deepEqual(productOptions(["AXCEL", "複合機", "ＡＸＣＥＬ"]), ["複合機"]);
  assert(!defaultProductNames.some(isExcludedProduct));
});

test("商材マスタが AXCEL だけのときは初期の商材一覧を使う", () => {
  assert.deepEqual(productOptions(["AXCEL"]), [...defaultProductNames]);
});

test("活動報告の必須項目に AXCEL の項目を含めない", () => {
  for (const status of ["提案中", "受注", "失注"]) assert(!requiredReportFields("IT営業活動", status).some((field) => field.toLowerCase().includes("axcel")));
});
