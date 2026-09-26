import type { AuthRole } from "@/lib/auth/types";

export type RepositoryScope = {
  organizationId: string;
  employeeId: string;
  role: AuthRole;
  departmentIds: string[];
};
