import type { SalesActivityRepository } from "@/application/ports/sales-activity-repository";
import type { UpdateActivityInput } from "@/domain/activities/types";

export async function updateSalesActivity(repository: SalesActivityRepository, input: UpdateActivityInput) {
  if (new Date(input.endsAt) <= new Date(input.startsAt)) {
    throw new Error("終了時刻は開始時刻より後に設定してください。");
  }
  await repository.update(input);
}
