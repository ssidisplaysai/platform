import type { ScheduleAuditRecord } from "../contracts";

export interface ScheduleAuditStore {
  append(record: ScheduleAuditRecord): Promise<void>;
  list(): Promise<ScheduleAuditRecord[]>;
}
