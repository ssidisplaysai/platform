import type { RuntimeSchedulingEvidenceEntry } from "./types";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child as T);
    }
  }
  return value;
}

export class RuntimeScheduleEvidence {
  private sequence = 1;
  private readonly entries: RuntimeSchedulingEvidenceEntry[] = [];

  append(
    runtimeInstanceId: string,
    type: RuntimeSchedulingEvidenceEntry["type"],
    details: Readonly<Record<string, unknown>>,
    scheduleId?: string,
    planId?: string,
  ): RuntimeSchedulingEvidenceEntry {
    const entry = deepFreeze({
      sequence: this.sequence++,
      runtimeInstanceId,
      scheduleId,
      planId,
      type,
      details,
    });
    this.entries.push(entry);
    return entry;
  }

  all(): readonly RuntimeSchedulingEvidenceEntry[] {
    return Object.freeze([...this.entries]);
  }
}