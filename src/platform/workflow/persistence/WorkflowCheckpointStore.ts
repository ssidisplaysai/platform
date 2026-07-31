import type { WorkflowCheckpoint } from "../contracts";

export interface WorkflowCheckpointStore {
  append(checkpoint: WorkflowCheckpoint): Promise<void>;
  list(instanceId: string): Promise<WorkflowCheckpoint[]>;
  listAll(): Promise<WorkflowCheckpoint[]>;
}
