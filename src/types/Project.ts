export type ProjectStatus =
  | "concept"
  | "planning"
  | "active"
  | "on-hold"
  | "completed"
  | "cancelled";

export type ProjectPriority = "low" | "medium" | "high" | "critical";

export type Project = {
  id: string;
  companyId: string;
  customerId?: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  value: number;
  startDate?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
};