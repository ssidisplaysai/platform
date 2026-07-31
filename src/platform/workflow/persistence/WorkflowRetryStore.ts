import type { WorkflowRetryRecord } from "./types";

export interface WorkflowRetryStore {
  append(record: WorkflowRetryRecord): Promise<void>;
  clear(instanceId: string, stepId: string): Promise<void>;
  list(): Promise<WorkflowRetryRecord[]>;
}
