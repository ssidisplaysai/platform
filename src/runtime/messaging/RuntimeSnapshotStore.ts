import type { RuntimeMessagingSnapshot, RuntimeMessagingSnapshotRecord } from "./types";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child as T);
    }
  }
  return value;
}

export class RuntimeSnapshotStore {
  private readonly records = new Map<string, RuntimeMessagingSnapshotRecord[]>();

  save(snapshot: RuntimeMessagingSnapshot): RuntimeMessagingSnapshotRecord {
    const history = this.records.get(snapshot.runtimeInstanceId) ?? [];
    const record = deepFreeze({ revision: history.length + 1, snapshot });
    this.records.set(snapshot.runtimeInstanceId, [...history, record]);
    return record;
  }

  loadLatest(runtimeInstanceId: string): RuntimeMessagingSnapshotRecord {
    const history = this.records.get(runtimeInstanceId) ?? [];
    if (history.length === 0) {
      throw new Error(`GRT-MSG-SNAPSHOT-001: No messaging snapshot history for runtime instance: ${runtimeInstanceId}`);
    }
    return history[history.length - 1];
  }

  history(runtimeInstanceId: string): readonly RuntimeMessagingSnapshotRecord[] {
    return Object.freeze([...(this.records.get(runtimeInstanceId) ?? [])]);
  }
}
