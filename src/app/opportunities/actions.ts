"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/get-current-user";

export type OpportunityActionState = { message?: string; success?: boolean; opportunityId?: string; customerExternalId?: string };
const schema = z.object({ customerId: z.uuid(), name: z.string().trim().min(1, "案件名を入力してください。").max(200), productName: z.string().trim().max(200), stage: z.enum(["approach", "discovery", "proposal", "closing"]), status: z.enum(["open", "won", "lost", "on_hold"]), confidence: z.enum(["A", "B", "C", "D"]), priority: z.enum(["high", "medium", "low"]), expectedAmount: z.coerce.number().int().min(0).max(99999999999999), expectedCloseDate: z.union([z.iso.date(), z.literal("")]), notes: z.string().trim().max(5000), customerType: z.enum(["corporate","individual"]), branchName: z.string().trim().max(200), customerContact: z.string().trim().max(200), prefecture: z.string().trim().max(50), address: z.string().trim().max(500), teamVisibility: z.enum(["private","department","organization"]), salesType: z.string().trim().max(100), salesProcess: z.string().trim().max(100), activityLocation: z.string().trim().max(500), activityContact: z.string().trim().max(200), activityAttendees: z.string().trim().max(500), activityFrom: z.union([z.iso.date(),z.literal("")]), activityTo: z.union([z.iso.date(),z.literal("")]), quoteAmount: z.coerce.number().int().min(0), orderAmount: z.coerce.number().int().min(0), vendor: z.string().trim().max(200), proposedLeaseFee: z.coerce.number().int().min(0), products: z.string().trim().max(1000), dealStages: z.string().trim().max(1000), contractCopy: z.enum(["","yes","no"]), detailCopy: z.enum(["","yes","no"]), leaseStartDate: z.union([z.iso.date(),z.literal("")]), leaseEndDate: z.union([z.iso.date(),z.literal("")]) });

export async function createOpportunity(_: OpportunityActionState, formData: FormData): Promise<OpportunityActionState> {
  const context = await getCurrentUser(); if (!context) return { message: "ログインし直してください。" };
  const parsed = schema.safeParse({ customerId: formData.get("customerId"), name: formData.get("name"), productName: formData.get("productName") ?? "", stage: formData.get("stage"), status: formData.get("status"), confidence: formData.get("confidence"), priority: formData.get("priority"), expectedAmount: formData.get("expectedAmount") || 0, expectedCloseDate: formData.get("expectedCloseDate") ?? "", notes: formData.get("notes") ?? "", customerType: formData.get("customerType") ?? "corporate", branchName: formData.get("branchName") ?? "", customerContact: formData.get("customerContact") ?? "", prefecture: formData.get("prefecture") ?? "", address: formData.get("address") ?? "", teamVisibility: formData.get("teamVisibility") ?? "department", salesType: formData.get("salesType") ?? "", salesProcess: formData.get("salesProcess") ?? "", activityLocation: formData.get("activityLocation") ?? "", activityContact: formData.get("activityContact") ?? "", activityAttendees: formData.get("activityAttendees") ?? "", activityFrom: formData.get("activityFrom") ?? "", activityTo: formData.get("activityTo") ?? "", quoteAmount: formData.get("quoteAmount") || 0, orderAmount: formData.get("orderAmount") || 0, vendor: formData.get("vendor") ?? "", proposedLeaseFee: formData.get("proposedLeaseFee") || 0, products: formData.get("products") ?? "", dealStages: formData.get("dealStages") ?? "", contractCopy: formData.get("contractCopy") ?? "", detailCopy: formData.get("detailCopy") ?? "", leaseStartDate: formData.get("leaseStartDate") ?? "", leaseEndDate: formData.get("leaseEndDate") ?? "" });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };
  const { data: activeProduct } = await context.db.from("products").select("id").eq("organization_id", context.organizationId).eq("status", "active").eq("name", parsed.data.productName).maybeSingle();
  if (!activeProduct) return { message: "有効な商材を選択してください。" };
  let customerQuery = context.db.from("customers").select("id,external_id,department_id").eq("organization_id", context.organizationId).eq("id", parsed.data.customerId);
  if (context.role !== "organization_admin") customerQuery = customerQuery.in("department_id", context.departmentIds);
  const { data: customer } = await customerQuery.maybeSingle(); if (!customer?.department_id) return { message: "選択した顧客を利用できません。" };
  const value = parsed.data;
  const { data: opportunity, error } = await context.db.from("opportunities").insert({ organization_id: context.organizationId, department_id: customer.department_id, customer_id: customer.id, employee_id: context.employeeId, name: value.name, product_name: value.productName || null, stage: value.stage, status: value.status, confidence: value.confidence, priority: value.priority, expected_amount: value.expectedAmount, expected_close_date: value.expectedCloseDate || null, notes: value.notes || null, customer_type: value.customerType, branch_name: value.branchName || null, customer_contact: value.customerContact || null, prefecture: value.prefecture || null, address: value.address || null, team_visibility: value.teamVisibility, sales_type: value.salesType || null, sales_process: value.salesProcess || null, activity_location: value.activityLocation || null, activity_contact: value.activityContact || null, activity_attendees: value.activityAttendees || null, activity_from: value.activityFrom || null, activity_to: value.activityTo || null, quote_amount: value.quoteAmount, order_amount: value.orderAmount, vendor: value.vendor || null, proposed_lease_fee: value.proposedLeaseFee, products: splitList(value.products), deal_stages: splitList(value.dealStages), contract_copy: triState(value.contractCopy), detail_copy: triState(value.detailCopy), lease_start_date: value.leaseStartDate || null, lease_end_date: value.leaseEndDate || null }).select("id").single();
  if (error) return { message: error.message.includes("opportunities") ? "案件テーブルが未作成です。追加SQLを適用してください。" : "案件を登録できませんでした。" };
  revalidatePath("/opportunities"); revalidatePath(`/customers/${customer.external_id}`); return { success: true, message: "案件を登録しました。", opportunityId: opportunity.id, customerExternalId: customer.external_id };
}

export async function importOpportunitiesCsv(_: OpportunityActionState, formData: FormData): Promise<OpportunityActionState> {
  const context = await getCurrentUser(); if (!context) return { message: "ログインし直してください。" };
  const file = formData.get("file"); if (!(file instanceof File) || !file.size) return { message: "CSVファイルを選択してください。" }; if (file.size > 2_000_000) return { message: "CSVは2MB以下にしてください。" };
  const rows = parseCsv((await file.text()).replace(/^\uFEFF/, "")); if (rows.length < 2) return { message: "CSVにデータがありません。" };
  const headers = rows[0].map((value) => value.trim()); const required = ["顧客名", "案件名"]; if (required.some((name) => !headers.includes(name))) return { message: "CSVには「顧客名」「案件名」列が必要です。" };
  let customerQuery = context.db.from("customers").select("id,name,department_id").eq("organization_id", context.organizationId); if (context.role !== "organization_admin") customerQuery = customerQuery.in("department_id", context.departmentIds); const { data: customers } = await customerQuery; const customerMap = new Map((customers ?? []).map((customer) => [customer.name.trim(), customer]));
  const inserts = []; const missing = new Set<string>();
  for (const values of rows.slice(1)) { if (!values.some((value) => value.trim())) continue; const row = Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""])); const customer = customerMap.get(row["顧客名"]); if (!customer) { missing.add(row["顧客名"]); continue; } inserts.push({ organization_id: context.organizationId, department_id: customer.department_id, customer_id: customer.id, employee_id: context.employeeId, name: row["案件名"], product_name: row["商材"] || null, stage: stageValue(row["商談ステージ"]), status: statusValue(row["ステータス"]), confidence: ["A","B","C","D"].includes(row["確度"]) ? row["確度"] : "B", priority: priorityValue(row["優先度"]), expected_amount: Number(row["見込金額"].replaceAll(",", "")) || 0, expected_close_date: row["受注予定日"] || null, notes: row["備考"] || null }); }
  if (missing.size) return { message: `顧客が見つかりません：${[...missing].slice(0, 5).join("、")}` }; if (!inserts.length) return { message: "登録できる案件がありません。" };
  const { error } = await context.db.from("opportunities").insert(inserts); if (error) return { message: error.message.includes("opportunities") ? "案件テーブルが未作成です。追加SQLを適用してください。" : "CSVを取り込めませんでした。" };
  revalidatePath("/opportunities"); return { success: true, message: `${inserts.length}件の案件を登録しました。` };
}

export async function deleteOpportunity(formData: FormData) {
  const context = await getCurrentUser();
  if (!context) return;
  const parsed = z.uuid().safeParse(formData.get("id"));
  if (!parsed.success) return;
  let query = context.db.from("opportunities").delete().eq("organization_id", context.organizationId).eq("id", parsed.data);
  if (context.role === "sales_rep") query = query.eq("employee_id", context.employeeId);
  if (context.role === "department_admin") query = query.in("department_id", context.departmentIds);
  await query;
  revalidatePath("/opportunities");
  redirect("/opportunities");
}

export async function updateOpportunity(formData: FormData) {
  const context = await getCurrentUser(); if (!context) return;
  const parsed = z.object({ id:z.uuid(), name:z.string().trim().min(1).max(200), productName:z.string().trim().max(200), stage:z.enum(["approach","discovery","proposal","closing"]), status:z.enum(["open","won","lost","on_hold"]), confidence:z.enum(["A","B","C","D"]), priority:z.enum(["high","medium","low"]), expectedAmount:z.coerce.number().min(0), expectedCloseDate:z.union([z.iso.date(),z.literal("")]), notes:z.string().trim().max(5000) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  let query=context.db.from("opportunities").update({name:parsed.data.name,product_name:parsed.data.productName||null,stage:parsed.data.stage,status:parsed.data.status,confidence:parsed.data.confidence,priority:parsed.data.priority,expected_amount:parsed.data.expectedAmount,expected_close_date:parsed.data.expectedCloseDate||null,notes:parsed.data.notes||null,updated_at:new Date().toISOString()}).eq("organization_id",context.organizationId).eq("id",parsed.data.id);
  if(context.role==="sales_rep")query=query.eq("employee_id",context.employeeId);if(context.role==="department_admin")query=query.in("department_id",context.departmentIds);await query;
  revalidatePath("/opportunities");revalidatePath(`/opportunities/${parsed.data.id}`);redirect(`/opportunities/${parsed.data.id}`);
}

function parseCsv(text: string) { const rows: string[][] = []; let row: string[] = [], value = "", quoted = false; for (let i = 0; i < text.length; i++) { const char = text[i]; if (char === '"' && quoted && text[i + 1] === '"') { value += '"'; i++; } else if (char === '"') quoted = !quoted; else if (char === "," && !quoted) { row.push(value); value = ""; } else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && text[i + 1] === "\n") i++; row.push(value); rows.push(row); row = []; value = ""; } else value += char; } if (value || row.length) { row.push(value); rows.push(row); } return rows; }
function stageValue(value: string) { return ({ アプローチ: "approach", 現状確認: "discovery", 提案: "proposal", クロージング: "closing" } as Record<string,string>)[value] ?? "approach"; }
function statusValue(value: string) { return ({ 進行中: "open", 受注: "won", 失注: "lost", 保留: "on_hold" } as Record<string,string>)[value] ?? "open"; }
function priorityValue(value: string) { return ({ 高: "high", 中: "medium", 低: "low" } as Record<string,string>)[value] ?? "medium"; }
function splitList(value: string) { return value.split(/[、,\n]/).map((item) => item.trim()).filter(Boolean); }
function triState(value: string) { return value === "yes" ? true : value === "no" ? false : null; }
