import type { ScheduleDefinition, ScheduleId } from "../contracts";

export interface ScheduleDefinitionStore {
  save(definition: ScheduleDefinition): Promise<void>;
  get(scheduleId: ScheduleId): Promise<ScheduleDefinition | null>;
  list(): Promise<ScheduleDefinition[]>;
}
