import { randomUUID } from "node:crypto";
import type { ScheduleAuditRecord } from "../contracts";

export class SchedulingAuditWriter {
  private readonly records: ScheduleAuditRecord[] = [];

  write(input: Omit<ScheduleAuditRecord, "recordId" | "recordedAt">): ScheduleAuditRecord {
    const record: ScheduleAuditRecord = {
      ...input,
      recordId: randomUUID(),
      recordedAt: new Date().toISOString(),
    };
    this.records.push(record);
    return structuredClone(record);
  }

  list(): ScheduleAuditRecord[] {
    return structuredClone(this.records);
  }

  restore(records: ScheduleAuditRecord[]): void {
    this.records.length = 0;
    this.records.push(...structuredClone(records));
  }
}
