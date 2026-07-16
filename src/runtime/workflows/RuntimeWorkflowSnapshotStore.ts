import type { RuntimeWorkflowSnapshot, RuntimeWorkflowSnapshotRecord } from "./types";
import { deepFreeze } from "./types";

export class RuntimeWorkflowSnapshotStore {
  private readonly records = new Map<string, RuntimeWorkflowSnapshotRecord[]>();

  save(snapshot: RuntimeWorkflowSnapshot): RuntimeWorkflowSnapshotRecord {
    const history = this.records.get(snapshot.runtimeInstanceId) ?? [];
    const record = deepFreeze({ revision: history.length + 1, snapshot });
    this.records.set(snapshot.runtimeInstanceId, [...history, record]);
    return record;
  }

  loadLatest(runtimeInstanceId: string): RuntimeWorkflowSnapshotRecord {
    const history = this.records.get(runtimeInstanceId) ?? [];
    if (history.length === 0) {
      throw new Error(`GRT-WF-SNAPSHOT-001: No workflow snapshot history for runtime instance: ${runtimeInstanceId}`);
    }
    return history[history.length - 1];
  }

  history(runtimeInstanceId: string): readonly RuntimeWorkflowSnapshotRecord[] {
    return Object.freeze([...(this.records.get(runtimeInstanceId) ?? [])]);
  }
}
