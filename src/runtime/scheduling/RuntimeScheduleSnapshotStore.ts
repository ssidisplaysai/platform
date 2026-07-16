import type { RuntimeSchedulingSnapshot, RuntimeSchedulingSnapshotRecord } from "./types";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child as T);
    }
  }
  return value;
}

export class RuntimeScheduleSnapshotStore {
  private readonly records = new Map<string, RuntimeSchedulingSnapshotRecord[]>();

  save(snapshot: RuntimeSchedulingSnapshot): RuntimeSchedulingSnapshotRecord {
    const history = this.records.get(snapshot.runtimeInstanceId) ?? [];
    const record = deepFreeze({ revision: history.length + 1, snapshot });
    this.records.set(snapshot.runtimeInstanceId, [...history, record]);
    return record;
  }

  loadLatest(runtimeInstanceId: string): RuntimeSchedulingSnapshotRecord {
    const history = this.records.get(runtimeInstanceId) ?? [];
    if (history.length === 0) {
      throw new Error(`GRT-SCH-SNAPSHOT-001: No scheduling snapshot history for runtime instance: ${runtimeInstanceId}`);
    }
    return history[history.length - 1];
  }

  history(runtimeInstanceId: string): readonly RuntimeSchedulingSnapshotRecord[] {
    return Object.freeze([...(this.records.get(runtimeInstanceId) ?? [])]);
  }
}