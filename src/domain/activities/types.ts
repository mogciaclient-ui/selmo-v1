export type CreateActivityInput = {
  departmentId: string;
  customerId: string | null;
  newCustomerName: string | null;
  title: string;
  activityType: string;
  startsAt: string;
  endsAt: string;
  scheduleDetails?: Record<string, string | boolean>;
};

export type UpdateActivityInput = {
  id: string;
  title: string;
  activityType: string;
  startsAt: string;
  endsAt: string;
};
