import type { ScheduleOccurrence } from "../contracts";

export interface ScheduleOccurrenceStore {
  append(occurrence: ScheduleOccurrence): Promise<void>;
  update(occurrence: ScheduleOccurrence): Promise<void>;
  listByInstance(instanceId: string): Promise<ScheduleOccurrence[]>;
  listAll(): Promise<ScheduleOccurrence[]>;
  findByLogicalRunKey?(instanceId: string, logicalRunKey: string): Promise<ScheduleOccurrence | null>;
}
