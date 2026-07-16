import type { RuntimeWaitingStateRecord } from "./types";
import { deepFreeze } from "./types";

export class RuntimeWaitingStateStore {
  private readonly records = new Map<string, RuntimeWaitingStateRecord[]>();

  save(record: Omit<RuntimeWaitingStateRecord, "revision"> & { revision?: number }): RuntimeWaitingStateRecord {
    const history = this.records.get(record.waitingStateId) ?? [];
    const persisted = deepFreeze({
      ...record,
      revision: history.length + 1,
    });
    this.records.set(record.waitingStateId, [...history, persisted]);
    return persisted;
  }

  latest(waitingStateId: string): RuntimeWaitingStateRecord {
    const history = this.records.get(waitingStateId) ?? [];
    if (history.length === 0) {
      throw new Error(`GRT-WF-WAIT-001: Unknown waiting state: ${waitingStateId}`);
    }
    return history[history.length - 1];
  }

  history(waitingStateId: string): readonly RuntimeWaitingStateRecord[] {
    return Object.freeze([...(this.records.get(waitingStateId) ?? [])]);
  }

  listLatest(): readonly RuntimeWaitingStateRecord[] {
    return Object.freeze(
      [...this.records.keys()]
        .sort((a, b) => a.localeCompare(b))
        .map((waitingStateId) => this.latest(waitingStateId)),
    );
  }

  listActiveForInstance(workflowInstanceId: string): readonly RuntimeWaitingStateRecord[] {
    return Object.freeze(
      this.listLatest().filter((entry) =>
        entry.workflowInstanceId === workflowInstanceId
        && ["Active", "Observed"].includes(entry.state)),
    );
  }
}
