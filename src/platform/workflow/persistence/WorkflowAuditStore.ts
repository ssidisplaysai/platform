import type { WorkflowAudit } from "../contracts";

export interface WorkflowAuditStore {
  append(record: WorkflowAudit): Promise<void>;
  list(): Promise<WorkflowAudit[]>;
}
