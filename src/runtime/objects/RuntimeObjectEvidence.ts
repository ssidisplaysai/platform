import type { RuntimeObjectEvidenceEntry } from "./types";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child as T);
    }
  }
  return value;
}

export class RuntimeObjectEvidence {
  private sequence = 1;
  private readonly entries: RuntimeObjectEvidenceEntry[] = [];

  append(
    runtimeInstanceId: string,
    type: RuntimeObjectEvidenceEntry["type"],
    details: Readonly<Record<string, unknown>>,
    objectId?: string,
  ): RuntimeObjectEvidenceEntry {
    const entry = deepFreeze({
      sequence: this.sequence++,
      runtimeInstanceId,
      objectId,
      type,
      details,
    });
    this.entries.push(entry);
    return entry;
  }

  all(): readonly RuntimeObjectEvidenceEntry[] {
    return Object.freeze([...this.entries]);
  }
}
