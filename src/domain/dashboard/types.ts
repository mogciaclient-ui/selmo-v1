export type DashboardActivity = {
  id: string;
  title: string;
  activityType: string;
  startsAt: string;
  endsAt: string;
  status: string;
  result: string | null;
  employeeId: string;
  departmentId: string;
  customerId: string | null;
  customerExternalId: string | null;
  customerName: string | null;
  scheduleDetails?: Record<string, string | boolean>;
  commonReport?: Record<string, string | boolean>;
};

export type DashboardSnapshot = {
  activities: DashboardActivity[];
  todayCount: number;
  pendingResultCount: number;
};
