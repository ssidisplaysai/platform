import { randomUUID } from "node:crypto";
import type { WorkflowAudit, WorkflowEventType } from "../contracts";

export class WorkflowAuditWriter {
  private readonly records: WorkflowAudit[] = [];

  write(input: {
    instanceId: string;
    workflowId: string;
    eventType: WorkflowEventType;
    message: string;
    details?: Record<string, unknown>;
  }): WorkflowAudit {
    const record: WorkflowAudit = {
      recordId: randomUUID(),
      instanceId: input.instanceId,
      workflowId: input.workflowId,
      eventType: input.eventType,
      message: input.message,
      details: input.details ? { ...input.details } : undefined,
      recordedAt: new Date().toISOString(),
    };

    this.records.push(record);
    return record;
  }

  list(): WorkflowAudit[] {
    return this.records.map((record) => ({
      ...record,
      details: record.details ? { ...record.details } : undefined,
    }));
  }

  restore(records: WorkflowAudit[]): void {
    this.records.length = 0;
    for (const record of records) {
      this.records.push({
        ...record,
        details: record.details ? { ...record.details } : undefined,
      });
    }
  }
}
