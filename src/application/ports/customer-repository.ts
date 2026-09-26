import type { Customer, SaveCustomerInput } from "@/domain/customers/types";

export interface CustomerRepository {
  findAll(query?: string): Promise<Customer[]>;
  create(input: SaveCustomerInput): Promise<void>;
  update(input: SaveCustomerInput & { id: string }): Promise<void>;
  delete(id: string): Promise<void>;
}
