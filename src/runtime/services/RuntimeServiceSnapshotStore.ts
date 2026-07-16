import type { RuntimeExecutionContextRestoreRecord, RuntimeExecutionContextSnapshot } from "./types";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child as T);
    }
  }
  return value;
}

export class RuntimeServiceSnapshotStore {
  private readonly records = new Map<string, RuntimeExecutionContextRestoreRecord[]>();

  save(snapshot: RuntimeExecutionContextSnapshot): RuntimeExecutionContextRestoreRecord {
    const history = this.records.get(snapshot.runtimeInstanceId) ?? [];
    const record = deepFreeze({ revision: history.length + 1, snapshot });
    const next = [...history, record];
    this.records.set(snapshot.runtimeInstanceId, next);
    return record;
  }

  loadLatest(runtimeInstanceId: string): RuntimeExecutionContextRestoreRecord {
    const history = this.records.get(runtimeInstanceId) ?? [];
    if (history.length === 0) {
      throw new Error(`GRT-SVC-SNAPSHOT-001: No snapshot history for runtime instance: ${runtimeInstanceId}`);
    }
    return history[history.length - 1];
  }

  history(runtimeInstanceId: string): readonly RuntimeExecutionContextRestoreRecord[] {
    return Object.freeze([...(this.records.get(runtimeInstanceId) ?? [])]);
  }
}
