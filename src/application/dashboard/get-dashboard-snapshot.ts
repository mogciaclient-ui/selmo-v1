import type { DashboardRepository } from "@/application/ports/dashboard-repository";
import type { DashboardSnapshot } from "@/domain/dashboard/types";

type DashboardPeriod = {
  calendarStart: string;
  calendarEnd: string;
  todayStart: string;
  todayEnd: string;
};

export async function getDashboardSnapshot(
  repository: DashboardRepository,
  period: DashboardPeriod,
): Promise<DashboardSnapshot> {
  const [activities, pendingResultCount] = await Promise.all([
    repository.findActivitiesBetween(period.calendarStart, period.calendarEnd),
    repository.countPendingResults(period.todayStart),
  ]);

  const todayCount = activities.filter(
    (activity) => activity.startsAt >= period.todayStart && activity.startsAt < period.todayEnd,
  ).length;

  return { activities, todayCount, pendingResultCount };
}
