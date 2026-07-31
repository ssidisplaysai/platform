import type { WorkflowInstance } from "../contracts";

export interface WorkflowInstanceStore {
  create(instance: WorkflowInstance): Promise<void>;
  get(instanceId: string): Promise<WorkflowInstance | null>;
  update(instance: WorkflowInstance, expectedVersion: number): Promise<"UPDATED" | "STALE">;
  list(): Promise<WorkflowInstance[]>;
}
