import type { RuntimePolicySnapshot, RuntimePolicySnapshotRecord } from "./types";
import { deepFreeze } from "./types";

export class RuntimePolicySnapshotStore {
  constructor(private readonly runtimeExecutionContextId: string) {}

  private readonly records = new Map<string, RuntimePolicySnapshotRecord[]>();

  save(runtimeExecutionContextId: string, runtimePolicyIrId: string, snapshot: RuntimePolicySnapshot): RuntimePolicySnapshotRecord {
    this.assertContext(runtimeExecutionContextId);
    const history = this.records.get(runtimePolicyIrId) ?? [];
    const record = deepFreeze({
      runtimeExecutionContextId: this.runtimeExecutionContextId,
      revision: history.length + 1,
      snapshot,
    });
    this.records.set(runtimePolicyIrId, [...history, record]);
    return record;
  }

  loadLatest(runtimeExecutionContextId: string, runtimePolicyIrId: string): RuntimePolicySnapshotRecord {
    this.assertContext(runtimeExecutionContextId);
    const history = this.records.get(runtimePolicyIrId) ?? [];
    if (history.length === 0) {
      throw new Error(`GRT-POL-SNAPSHOT-001: No snapshot history for RuntimePolicyIR ${runtimePolicyIrId}`);
    }
    return history[history.length - 1];
  }

  history(runtimeExecutionContextId: string, runtimePolicyIrId: string): readonly RuntimePolicySnapshotRecord[] {
    this.assertContext(runtimeExecutionContextId);
    return Object.freeze([...(this.records.get(runtimePolicyIrId) ?? [])]);
  }

  private assertContext(runtimeExecutionContextId: string): void {
    if (runtimeExecutionContextId !== this.runtimeExecutionContextId) {
      throw new Error(
        `GRT-POL-SNAPSHOT-CTX-001: Snapshot context mismatch. Expected ${this.runtimeExecutionContextId}, received ${runtimeExecutionContextId}`,
      );
    }
  }
}
