import type { WorkflowTimeoutRecord } from "./types";

export interface WorkflowTimeoutStore {
  upsert(record: WorkflowTimeoutRecord): Promise<void>;
  resolve(instanceId: string, stepId: string): Promise<void>;
  list(): Promise<WorkflowTimeoutRecord[]>;
}
