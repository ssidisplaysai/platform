import type { RuntimeScheduleRecord } from "./types";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child as T);
    }
  }
  return value;
}

export class RuntimeSchedule {
  constructor(private readonly record: RuntimeScheduleRecord) {}

  snapshot(): RuntimeScheduleRecord {
    return deepFreeze(this.record);
  }
}