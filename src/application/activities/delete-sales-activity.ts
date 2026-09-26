import type { SalesActivityRepository } from "@/application/ports/sales-activity-repository";

export async function deleteSalesActivity(repository: SalesActivityRepository, id: string) {
  await repository.delete(id);
}
