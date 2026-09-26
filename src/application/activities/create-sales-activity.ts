import type { SalesActivityRepository } from "@/application/ports/sales-activity-repository";
import type { CreateActivityInput } from "@/domain/activities/types";

export async function createSalesActivity(repository: SalesActivityRepository, input: CreateActivityInput) {
  if (new Date(input.endsAt) <= new Date(input.startsAt)) {
    throw new Error("終了時刻は開始時刻より後に設定してください。");
  }
  return repository.createWithCustomer(input);
}
