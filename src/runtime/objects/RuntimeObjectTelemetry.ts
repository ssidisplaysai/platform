import type { RuntimeObjectMetrics, RuntimeObjectTelemetrySnapshot } from "./types";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child as T);
    }
  }
  return value;
}

export class RuntimeObjectTelemetry {
  private readonly counters = new Map<string, number>();

  increment(counter: string, amount = 1): void {
    this.counters.set(counter, (this.counters.get(counter) ?? 0) + amount);
  }

  snapshot(metrics: RuntimeObjectMetrics): RuntimeObjectTelemetrySnapshot {
    return deepFreeze({
      counters: Object.freeze(Object.fromEntries([...this.counters.entries()].sort((a, b) => a[0].localeCompare(b[0])))),
      metrics,
    });
  }
}
