import type { RuntimeMessagingEvidenceEntry } from "./types";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child as T);
    }
  }
  return value;
}

export class RuntimeEvidence {
  private sequence = 1;
  private readonly entries: RuntimeMessagingEvidenceEntry[] = [];

  append(
    runtimeInstanceId: string,
    type: RuntimeMessagingEvidenceEntry["type"],
    details: Readonly<Record<string, unknown>>,
    messageId?: string,
  ): RuntimeMessagingEvidenceEntry {
    const entry = deepFreeze({
      sequence: this.sequence++,
      runtimeInstanceId,
      messageId,
      type,
      details,
    });
    this.entries.push(entry);
    return entry;
  }

  all(): readonly RuntimeMessagingEvidenceEntry[] {
    return Object.freeze([...this.entries]);
  }
}
