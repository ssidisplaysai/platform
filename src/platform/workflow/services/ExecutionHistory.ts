import type { WorkflowExecutionRecord } from "../contracts";

export class ExecutionHistory {
  private readonly byInstance = new Map<string, WorkflowExecutionRecord[]>();

  append(record: WorkflowExecutionRecord): void {
    const existing = this.byInstance.get(record.instanceId) ?? [];
    existing.push(record);
    this.byInstance.set(record.instanceId, existing);
  }

  list(instanceId: string): WorkflowExecutionRecord[] {
    return [...(this.byInstance.get(instanceId) ?? [])];
  }
}
