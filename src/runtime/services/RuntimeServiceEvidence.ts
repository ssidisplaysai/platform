import type { RuntimeServiceEvidenceEntry } from "./types";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child as T);
    }
  }
  return value;
}

export class RuntimeServiceEvidence {
  private readonly entries: RuntimeServiceEvidenceEntry[] = [];
  private sequence = 1;

  append(
    runtimeInstanceId: string,
    type: RuntimeServiceEvidenceEntry["type"],
    details: Readonly<Record<string, unknown>>,
    serviceId?: string,
  ): void {
    this.entries.push(deepFreeze({
      sequence: this.sequence++,
      runtimeInstanceId,
      serviceId,
      type,
      details,
    }));
  }

  all(): readonly RuntimeServiceEvidenceEntry[] {
    return Object.freeze([...this.entries]);
  }
}
