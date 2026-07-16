import type { RuntimeStateRecord } from "./types";

export class RuntimeStateStore {
  private readonly records = new Map<string, RuntimeStateRecord>();

  save(instanceId: string, record: RuntimeStateRecord): void {
    this.records.set(instanceId, record);
  }

  load(instanceId: string): RuntimeStateRecord {
    const record = this.records.get(instanceId);
    if (!record) {
      throw new Error(`No persisted runtime state for instance: ${instanceId}`);
    }
    return record;
  }
}
