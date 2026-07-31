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

  listAll(): WorkflowExecutionRecord[] {
    return [...this.byInstance.values()].flat().map((record) => ({
      ...record,
      result: {
        ...record.result,
        outputVariables: record.result.outputVariables ? { ...record.result.outputVariables } : undefined,
      },
    }));
  }

  restore(records: WorkflowExecutionRecord[]): void {
    this.byInstance.clear();
    for (const record of records) {
      const existing = this.byInstance.get(record.instanceId) ?? [];
      existing.push({
        ...record,
        result: {
          ...record.result,
          outputVariables: record.result.outputVariables ? { ...record.result.outputVariables } : undefined,
        },
      });
      this.byInstance.set(record.instanceId, existing);
    }
  }
}
