import type { RuntimePlanRecord } from "./types";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child as T);
    }
  }
  return value;
}

export class RuntimePlan {
  constructor(private readonly record: RuntimePlanRecord) {}

  snapshot(): RuntimePlanRecord {
    return deepFreeze(this.record);
  }
}