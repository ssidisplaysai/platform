import type { RuntimePolicyTelemetrySnapshot } from "./types";
import { deepFreeze } from "./types";

export class RuntimePolicyTelemetry {
  private readonly counters = new Map<string, number>();

  increment(counter: string, amount = 1): void {
    this.counters.set(counter, (this.counters.get(counter) ?? 0) + amount);
  }

  snapshot(): RuntimePolicyTelemetrySnapshot {
    return deepFreeze({
      counters: Object.freeze(Object.fromEntries([...this.counters.entries()].sort((a, b) => a[0].localeCompare(b[0])))),
    });
  }
}
