import { randomUUID } from "node:crypto";
import type { AIAuditFailureRecord, AIAuditRecord } from "../contracts";

export class ExecutionAuditTrail {
  private readonly records: AIAuditRecord[] = [];
  private readonly failures: AIAuditFailureRecord[] = [];

  append(record: Omit<AIAuditRecord, "recordId" | "recordedAt">): AIAuditRecord {
    const created: AIAuditRecord = {
      ...record,
      recordId: `aaudit_${randomUUID()}`,
      recordedAt: new Date().toISOString(),
    };
    this.records.push(created);
    return structuredClone(created);
  }

  appendMany(records: Array<Omit<AIAuditRecord, "recordId" | "recordedAt">>): AIAuditRecord[] {
    return records.map((record) => this.append(record));
  }

  recordFailure(failure: Omit<AIAuditFailureRecord, "failureId" | "occurredAt">): AIAuditFailureRecord {
    const created: AIAuditFailureRecord = {
      ...failure,
      failureId: `afailure_${randomUUID()}`,
      occurredAt: new Date().toISOString(),
    };
    this.failures.push(created);
    return structuredClone(created);
  }

  list(limit = 200): AIAuditRecord[] {
    return this.records.slice(-limit).map((record) => structuredClone(record));
  }

  listFailures(limit = 200): AIAuditFailureRecord[] {
    return this.failures.slice(-limit).map((record) => structuredClone(record));
  }
}
