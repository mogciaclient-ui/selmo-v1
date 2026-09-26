import type { SalesActivityRepository } from "@/application/ports/sales-activity-repository";

export async function saveActivityResult(repository: SalesActivityRepository, id: string, result: string) {
  if (!result.trim()) throw new Error("活動結果を入力してください。");
  await repository.saveResult(id, result.trim());
}
