import type { CreateActivityInput, UpdateActivityInput } from "@/domain/activities/types";
import type { CustomerSearchResult } from "@/domain/customers/types";

export interface SalesActivityRepository {
  searchCustomers(query: string, limit: number): Promise<CustomerSearchResult[]>;
  createWithCustomer(input: CreateActivityInput): Promise<string>;
  update(input: UpdateActivityInput): Promise<void>;
  delete(id: string): Promise<void>;
  saveResult(id: string, result: string): Promise<void>;
}
