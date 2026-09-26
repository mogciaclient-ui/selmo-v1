export type CustomerSearchResult = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  departmentId: string;
};

export type Customer = CustomerSearchResult & {
  notes: string | null;
  updatedAt: string;
};

export type SaveCustomerInput = {
  id?: string;
  departmentId: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
};
