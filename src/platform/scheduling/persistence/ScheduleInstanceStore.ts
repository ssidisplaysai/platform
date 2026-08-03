import type { ScheduleId, ScheduleInstance } from "../contracts";

export interface ScheduleInstanceStore {
  create(instance: ScheduleInstance): Promise<void>;
  update(instance: ScheduleInstance): Promise<void>;
  get(instanceId: string): Promise<ScheduleInstance | null>;
  list(): Promise<ScheduleInstance[]>;
  findByScheduleId(scheduleId: ScheduleId): Promise<ScheduleInstance | null>;
}
