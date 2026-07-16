import type { RuntimeEnvelopeSnapshot } from "./types";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child as T);
    }
  }
  return value;
}

export class RuntimeEnvelope {
  constructor(private readonly record: RuntimeEnvelopeSnapshot) {}

  snapshot(): RuntimeEnvelopeSnapshot {
    return deepFreeze(this.record);
  }
}
