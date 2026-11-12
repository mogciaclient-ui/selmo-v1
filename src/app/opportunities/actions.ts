"use server";

import { findProductOptions } from "@/infrastructure/supabase/product-options-repository";
import { isDepartmentAdmin } from "@/lib/auth/roles";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/get-current-user";

export type OpportunityActionState = { message?: string; success?: boolean; opportunityId?: string; customerExternalId?: string };
const schema = z.object({ customerId: z.uuid(), name: z.string().trim().max(200), productName: z.string().trim().min(1, "商材を選択してください。").max(200), stage: z.enum(["approach", "discovery", "proposal", "closing"]), status: z.enum(["open", "won", "lost"]), confidence: z.enum(["A", "B", "C", "D"]), priority: z.enum(["high", "medium", "low"]), expectedAmount: z.coerce.number().int().min(0).max(99999999999999), expectedCloseDate: z.union([z.iso.date(), z.literal("")]), notes: z.string().trim().max(5000), customerType: z.enum(["corporate","individual"]), branchName: z.string().trim().max(200), customerContact: z.string().trim().max(200), prefecture: z.string().trim().max(50), address: z.string().trim().max(500), teamVisibility: z.enum(["private","department","organization"]), salesType: z.string().trim().max(100), salesProcess: z.string().trim().max(100), activityLocation: z.string().trim().max(500), activityContact: z.string().trim().max(200), activityAttendees: z.string().trim().max(500), activityFrom: z.union([z.iso.date(),z.literal("")]), activityTo: z.union([z.iso.date(),z.literal("")]), quoteAmount: z.coerce.number().int().min(0), orderAmount: z.coerce.number().int().min(0), vendor: z.string().trim().max(200), proposedLeaseFee: z.coerce.number().int().min(0), products: z.string().trim().max(1000), dealStages: z.string().trim().max(1000), contractCopy: z.enum(["","yes","no"]), detailCopy: z.enum(["","yes","no"]), leaseStartDate: z.union([z.iso.date(),z.literal("")]), leaseEndDate: z.union([z.iso.date(),z.literal("")]) });

export async function createOpportunity(_: OpportunityActionState, formData: FormData): Promise<OpportunityActionState> {
  const context = await getCurrentUser(); if (!context) return { message: "ログインし直してください。" };
  const parsed = schema.safeParse({ customerId: formData.get("customerId"), name: formData.get("name") ?? "", productName: formData.get("productName") ?? "", stage: formData.get("stage"), status: formData.get("status"), confidence: formData.get("confidence"), priority: formData.get("priority"), expectedAmount: formData.get("expectedAmount") || 0, expectedCloseDate: formData.get("expectedCloseDate") ?? "", notes: formData.get("notes") ?? "", customerType: formData.get("customerType") ?? "corporate", branchName: formData.get("branchName") ?? "", customerContact: formData.get("customerContact") ?? "", prefecture: formData.get("prefecture") ?? "", address: formData.get("address") ?? "", teamVisibility: formData.get("teamVisibility") ?? "department", salesType: formData.get("salesType") ?? "", salesProcess: formData.get("salesProcess") ?? "", activityLocation: formData.get("activityLocation") ?? "", activityContact: formData.get("activityContact") ?? "", activityAttendees: formData.get("activityAttendees") ?? "", activityFrom: formData.get("activityFrom") ?? "", activityTo: formData.get("activityTo") ?? "", quoteAmount: formData.get("quoteAmount") || 0, orderAmount: formData.get("orderAmount") || 0, vendor: formData.get("vendor") ?? "", proposedLeaseFee: formData.get("proposedLeaseFee") || 0, products: formData.get("products") ?? "", dealStages: formData.get("dealStages") ?? "", contractCopy: formData.get("contractCopy") ?? "", detailCopy: formData.get("detailCopy") ?? "", leaseStartDate: formData.get("leaseStartDate") ?? "", leaseEndDate: formData.get("leaseEndDate") ?? "" });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };
  const productOptions = await findProductOptions(context.db, context.organizationId).catch(() => null);
  if (!productOptions) return { message: "商材マスタを取得できませんでした。" };
  if (!productOptions.includes(parsed.data.productName)) return { message: "有効な商材を選択してください。" };
  let customerQuery = context.db.from("customers").select("id,external_id,department_id").eq("organization_id", context.organizationId).eq("id", parsed.data.customerId);
  if (context.role !== "organization_admin") customerQuery = customerQuery.in("department_id", context.departmentIds);
  const { data: customer } = await customerQuery.maybeSingle(); if (!customer?.department_id) return { message: "選択した顧客を利用できません。" };
  const value = parsed.data;
  const { data: existingCase } = await context.db.from("opportunities").select("id").eq("organization_id", context.organizationId).eq("employee_id", context.employeeId).eq("customer_id", customer.id).eq("product_name", value.productName).is("merged_into_id", null).maybeSingle();
  if (existingCase) return { success: true, message: "同じ顧客・商材の既存案件にまとめました。", opportunityId: existingCase.id, customerExternalId: customer.external_id };

  const { data: opportunity, error } = await context.db.from("opportunities").insert({ organization_id: context.organizationId, department_id: customer.department_id, customer_id: customer.id, employee_id: context.employeeId, name: value.name || value.productName, product_name: value.productName, stage: value.stage, status: value.status, confidence: value.confidence, priority: value.priority, expected_amount: value.expectedAmount, expected_close_date: value.expectedCloseDate || null, notes: value.notes || null, customer_type: value.customerType, branch_name: value.branchName || null, customer_contact: value.customerContact || null, prefecture: value.prefecture || null, address: value.address || null, team_visibility: value.teamVisibility, sales_type: value.salesType || null, sales_process: value.salesProcess || null, activity_location: value.activityLocation || null, activity_contact: value.activityContact || null, activity_attendees: value.activityAttendees || null, activity_from: value.activityFrom || null, activity_to: value.activityTo || null, quote_amount: value.quoteAmount, order_amount: value.orderAmount, vendor: value.vendor || null, proposed_lease_fee: value.proposedLeaseFee, products: splitList(value.products), deal_stages: splitList(value.dealStages), contract_copy: triState(value.contractCopy), detail_copy: triState(value.detailCopy), lease_start_date: value.leaseStartDate || null, lease_end_date: value.leaseEndDate || null }).select("id").single();
  if (error?.code === "23505") {
    const { data: concurrentCase } = await context.db.from("opportunities").select("id").eq("organization_id", context.organizationId).eq("employee_id", context.employeeId).eq("customer_id", customer.id).eq("product_name", value.productName).is("merged_into_id", null).maybeSingle();
    if (concurrentCase) return { success: true, message: "同じ顧客・商材の既存案件にまとめました。", opportunityId: concurrentCase.id, customerExternalId: customer.external_id };
  }
  if (error) return { message: error.message.includes("opportunities") ? "案件テーブルが未作成です。追加SQLを適用してください。" : "案件を登録できませんでした。" };
  revalidatePath("/"); revalidatePath("/opportunities"); revalidatePath(`/customers/${customer.external_id}`); return { success: true, message: "案件を登録しました。", opportunityId: opportunity.id, customerExternalId: customer.external_id };
}

export async function importOpportunitiesCsv(_: OpportunityActionState, formData: FormData): Promise<OpportunityActionState> {
  const context = await getCurrentUser(); if (!context) return { message: "ログインし直してください。" };
  const file = formData.get("file"); if (!(file instanceof File) || !file.size) return { message: "CSVファイルを選択してください。" }; if (file.size > 2_000_000) return { message: "CSVは2MB以下にしてください。" };
  const rows = parseCsv((await file.text()).replace(/^\uFEFF/, "")); if (rows.length < 2) return { message: "CSVにデータがありません。" };
  const headers = rows[0].map((value) => value.trim()); const required = ["顧客名", "商材"]; if (required.some((name) => !headers.includes(name))) return { message: "CSVには「顧客名」「商材」列が必要です。" };
  const records = rows.slice(1).flatMap((values, index) => values.some(value => value.trim())
    ? [{ line: index + 2, fields: Object.fromEntries(headers.map((header, column) => [header, values[column]?.trim() ?? ""])) }]
    : []);
  for (const { line, fields } of records) {
    if (!fields["顧客名"] || !fields["商材"]) return { message: `CSVの${line}行目に顧客名と商材を入力してください。` };
    if (fields["ステータス"] === "保留") return { message: "保留は登録できません。提案・受注・失注を指定してください。" };
  }
  if (!records.length) return { message: "登録できる案件がありません。" };

  const names = new Set(records.map(({ fields }) => fields["顧客名"]));
  const customerMap = new Map<string, { id: string; department_id: string }>();
  const pageSize = 1000;
  for (let start = 0; customerMap.size < names.size; start += pageSize) {
    let query = context.db.from("customers").select("id,name,department_id").eq("organization_id", context.organizationId);
    if (context.role !== "organization_admin") query = query.in("department_id", context.departmentIds);
    const { data, error } = await query.order("id").range(start, start + pageSize - 1);
    if (error) return { message: "顧客を確認できませんでした。" };
    for (const customer of data ?? []) {
      const name = customer.name.trim();
      if (names.has(name) && !customerMap.has(name)) customerMap.set(name, customer);
    }
    if ((data?.length ?? 0) < pageSize) break;
  }
  const missing = [...names].filter(name => !customerMap.has(name));
  if (missing.length) return { message: `顧客が見つかりません：${missing.slice(0, 5).join("、")}` };

  const inserts = records.map(({ fields: row }) => {
    const customer = customerMap.get(row["顧客名"])!;
    return {
      organization_id: context.organizationId,
      department_id: customer.department_id,
      customer_id: customer.id,
      employee_id: context.employeeId,
      name: row["案件名"] || row["商材"],
      product_name: row["商材"],
      stage: stageValue(row["商談ステージ"]),
      status: statusValue(row["ステータス"]),
      confidence: ["A", "B", "C", "D"].includes(row["確度"]) ? row["確度"] : "B",
      priority: priorityValue(row["優先度"]),
      expected_amount: Number((row["見込金額"] ?? "").replaceAll(",", "")) || 0,
      expected_close_date: row["受注予定日"] || null,
      notes: row["備考"] || null,
    };
  });
  const { data: existingCases, error: existingError } = await context.db.from("opportunities").select("customer_id,product_name").eq("organization_id", context.organizationId).eq("employee_id", context.employeeId).is("merged_into_id", null);
  if (existingError) return { message: "既存案件を確認できませんでした。" };
  const keys = new Set((existingCases ?? []).filter(row => row.product_name).map(row => `${row.customer_id}:${row.product_name}`));
  const newCases = inserts.filter(row => { if (!row.product_name) return true; const key = `${row.customer_id}:${row.product_name}`; if (keys.has(key)) return false; keys.add(key); return true; });
  if (!newCases.length) return { success: true, message: "すべて同じ顧客・商材の既存案件にまとめました。" };
  const { error } = await context.db.from("opportunities").insert(newCases); if (error) return { message: error.message.includes("opportunities") ? "案件テーブルが未作成です。追加SQLを適用してください。" : "CSVを取り込めませんでした。" };
  revalidatePath("/"); revalidatePath("/opportunities"); return { success: true, message: `${newCases.length}件の案件を登録しました。` };
}

export async function deleteOpportunity(formData: FormData) {
  const context = await getCurrentUser();
  if (!context) return;
  const parsed = z.uuid().safeParse(formData.get("id"));
  if (!parsed.success) return;
  let query = context.db.from("opportunities").delete().eq("organization_id", context.organizationId).eq("id", parsed.data);
  if (context.role === "sales_rep") query = query.eq("employee_id", context.employeeId);
  if (isDepartmentAdmin(context.role)) query = query.in("department_id", context.departmentIds);
  await query;
  revalidatePath("/"); revalidatePath("/opportunities");
  redirect("/opportunities");
}

export async function updateOpportunity(formData: FormData) {
  const context = await getCurrentUser(); if (!context) return;
  const parsed = z.object({ id:z.uuid(), name:z.string().trim().min(1).max(200), productName:z.string().trim().max(200), stage:z.enum(["approach","discovery","proposal","closing"]), status:z.enum(["open","won","lost"]), confidence:z.enum(["A","B","C","D"]), priority:z.enum(["high","medium","low"]), expectedAmount:z.coerce.number().min(0), expectedCloseDate:z.union([z.iso.date(),z.literal("")]), notes:z.string().trim().max(5000) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  let query=context.db.from("opportunities").update({name:parsed.data.name,product_name:parsed.data.productName||null,stage:parsed.data.stage,status:parsed.data.status,confidence:parsed.data.confidence,priority:parsed.data.priority,expected_amount:parsed.data.expectedAmount,expected_close_date:parsed.data.expectedCloseDate||null,notes:parsed.data.notes||null,updated_at:new Date().toISOString()}).eq("organization_id",context.organizationId).eq("id",parsed.data.id);
  if(context.role==="sales_rep")query=query.eq("employee_id",context.employeeId);if(isDepartmentAdmin(context.role))query=query.in("department_id",context.departmentIds);await query;
  revalidatePath("/"); revalidatePath("/opportunities");revalidatePath(`/opportunities/${parsed.data.id}`);redirect(`/opportunities/${parsed.data.id}`);
}

function parseCsv(text: string) { const rows: string[][] = []; let row: string[] = [], value = "", quoted = false; for (let i = 0; i < text.length; i++) { const char = text[i]; if (char === '"' && quoted && text[i + 1] === '"') { value += '"'; i++; } else if (char === '"') quoted = !quoted; else if (char === "," && !quoted) { row.push(value); value = ""; } else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && text[i + 1] === "\n") i++; row.push(value); rows.push(row); row = []; value = ""; } else value += char; } if (value || row.length) { row.push(value); rows.push(row); } return rows; }
function stageValue(value: string) { return ({ アプローチ: "approach", 現状確認: "discovery", 提案: "proposal", クロージング: "closing" } as Record<string,string>)[value] ?? "approach"; }
function statusValue(value: string) { return ({ 提案: "open", 検討中: "open", 進行中: "open", 受注: "won", 失注: "lost" } as Record<string,string>)[value] ?? "open"; }
function priorityValue(value: string) { return ({ 高: "high", 中: "medium", 低: "low" } as Record<string,string>)[value] ?? "medium"; }
function splitList(value: string) { return value.split(/[、,\n]/).map((item) => item.trim()).filter(Boolean); }
function triState(value: string) { return value === "yes" ? true : value === "no" ? false : null; }
