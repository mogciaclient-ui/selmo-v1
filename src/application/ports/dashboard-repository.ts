import type { DashboardActivity } from "@/domain/dashboard/types";

export interface DashboardRepository {
  findActivitiesBetween(start: string, end: string): Promise<DashboardActivity[]>;
  countPendingResults(before: string): Promise<number>;
}
