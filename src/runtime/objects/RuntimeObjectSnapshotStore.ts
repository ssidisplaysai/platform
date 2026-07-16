import type { RuntimeObjectSnapshot, RuntimeObjectSnapshotRecord } from "./types";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child as T);
    }
  }
  return value;
}

export class RuntimeObjectSnapshotStore {
  private readonly records = new Map<string, RuntimeObjectSnapshotRecord[]>();

  save(snapshot: RuntimeObjectSnapshot): RuntimeObjectSnapshotRecord {
    const history = this.records.get(snapshot.runtimeInstanceId) ?? [];
    const record = deepFreeze({ revision: history.length + 1, snapshot });
    this.records.set(snapshot.runtimeInstanceId, [...history, record]);
    return record;
  }

  loadLatest(runtimeInstanceId: string): RuntimeObjectSnapshotRecord {
    const history = this.records.get(runtimeInstanceId) ?? [];
    if (history.length === 0) {
      throw new Error(`GRT-OBJ-SNAPSHOT-001: No object snapshot history for runtime instance: ${runtimeInstanceId}`);
    }
    return history[history.length - 1];
  }

  history(runtimeInstanceId: string): readonly RuntimeObjectSnapshotRecord[] {
    return Object.freeze([...(this.records.get(runtimeInstanceId) ?? [])]);
  }
}
