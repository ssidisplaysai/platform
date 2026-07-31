import type { WorkflowCompensationRecord } from "./types";

export interface WorkflowCompensationStore {
  append(record: WorkflowCompensationRecord): Promise<void>;
  list(): Promise<WorkflowCompensationRecord[]>;
}
