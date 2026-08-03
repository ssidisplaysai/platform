import type { ScheduleClaimRecord } from "./types";

export interface ScheduleClaimStore {
  upsert(claim: ScheduleClaimRecord): Promise<void>;
  getByOccurrenceId(occurrenceId: string): Promise<ScheduleClaimRecord | null>;
  list(): Promise<ScheduleClaimRecord[]>;
}
