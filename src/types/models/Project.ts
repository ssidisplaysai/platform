export type ProjectStatus = "concept" | "planning" | "active" | "on_hold" | "completed" | "cancelled";

export type ProjectPriority = "low" | "medium" | "high";

export type Project = {
  id: string;
  companyId: string;
  customerId?: string;
  name: string;
  description: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  value: number;
  startDate?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
};
