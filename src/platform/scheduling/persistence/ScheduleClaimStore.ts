import type { AtomicClaimInput, AtomicClaimResult, ScheduleClaimRecord } from "./types";

export interface ScheduleClaimStore {
  upsert(claim: ScheduleClaimRecord): Promise<void>;
  getByOccurrenceId(occurrenceId: string): Promise<ScheduleClaimRecord | null>;
  list(): Promise<ScheduleClaimRecord[]>;
  claimAtomic?(input: AtomicClaimInput): Promise<AtomicClaimResult>;
}
