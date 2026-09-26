import type { SalesActivityRepository } from "@/application/ports/sales-activity-repository";

export async function searchCustomers(repository: SalesActivityRepository, query: string) {
  const normalized = query.trim();
  if (normalized.length < 2) return [];
  return repository.searchCustomers(normalized, 20);
}
