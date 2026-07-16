import type { RuntimeObjectRecord } from "./types";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child as T);
    }
  }
  return value;
}

export class RuntimeObject {
  constructor(private readonly record: RuntimeObjectRecord) {}

  snapshot(): RuntimeObjectRecord {
    return deepFreeze({
      ...this.record,
      metadata: this.record.metadata,
      state: this.record.state,
      relationshipRefs: Object.freeze([...this.record.relationshipRefs]),
      behaviorRefs: Object.freeze([...this.record.behaviorRefs]),
      evidenceRefs: Object.freeze([...this.record.evidenceRefs]),
      snapshotRefs: Object.freeze([...this.record.snapshotRefs]),
    });
  }
}
