export type CustomerStatus = "lead" | "active" | "inactive" | "archived";

export type Customer = {
  id: string;
  companyId: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
  status: CustomerStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};