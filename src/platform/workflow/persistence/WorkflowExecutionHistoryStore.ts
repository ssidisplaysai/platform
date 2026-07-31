import type { WorkflowExecutionRecord } from "../contracts";

export interface WorkflowExecutionHistoryStore {
  append(record: WorkflowExecutionRecord): Promise<void>;
  list(instanceId: string): Promise<WorkflowExecutionRecord[]>;
  listAll(): Promise<WorkflowExecutionRecord[]>;
}
