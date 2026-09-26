import type { CustomerRepository } from "@/application/ports/customer-repository";
import type { SaveCustomerInput } from "@/domain/customers/types";

export async function saveCustomer(repository: CustomerRepository, input: SaveCustomerInput) {
  if (input.id) return repository.update({ ...input, id: input.id });
  return repository.create(input);
}

export async function removeCustomer(repository: CustomerRepository, id: string) {
  return repository.delete(id);
}
