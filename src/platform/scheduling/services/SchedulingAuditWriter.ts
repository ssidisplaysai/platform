import { randomUUID } from "node:crypto";
import type { ScheduleAuditRecord } from "../contracts";
import type { Clock } from "./Clock";
import { SystemClock } from "./Clock";

export class SchedulingAuditWriter {
  private readonly records: ScheduleAuditRecord[] = [];

  constructor(private readonly clock: Clock = new SystemClock()) {}

  write(input: Omit<ScheduleAuditRecord, "recordId" | "recordedAt">): ScheduleAuditRecord {
    const record: ScheduleAuditRecord = {
      ...input,
      recordId: randomUUID(),
      recordedAt: this.clock.nowIso(),
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
