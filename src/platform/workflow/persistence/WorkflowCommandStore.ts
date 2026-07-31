import type { WorkflowCommandRecord } from "./types";

export interface WorkflowCommandStore {
  append(record: WorkflowCommandRecord): Promise<void>;
  get(commandKey: string): Promise<WorkflowCommandRecord | null>;
  list(): Promise<WorkflowCommandRecord[]>;
}
