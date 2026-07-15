import type { CompilerEventType, CompilerTelemetrySnapshot } from "./types";

export class CompilerTelemetry {
  private readonly eventCounts = new Map<string, number>();
  private readonly passDurations = new Map<string, number>();
  private readonly timestamps = new Map<string, string>();

  constructor(
    private readonly compilationId: string,
    private readonly sessionId: string,
  ) {}

  recordEvent(type: CompilerEventType, timestamp: string): void {
    this.eventCounts.set(type, (this.eventCounts.get(type) ?? 0) + 1);
    this.timestamps.set(`${type}:${this.eventCounts.get(type)}`, timestamp);
  }

  recordPassDuration(passId: string, durationMs: number): void {
    this.passDurations.set(passId, durationMs);
  }

  snapshot(): CompilerTelemetrySnapshot {
    return Object.freeze({
      compilationId: this.compilationId,
      sessionId: this.sessionId,
      eventCounts: Object.freeze(Object.fromEntries([...this.eventCounts.entries()].sort(([left], [right]) => left.localeCompare(right)))),
      passDurations: Object.freeze(Object.fromEntries([...this.passDurations.entries()].sort(([left], [right]) => left.localeCompare(right)))),
      timestamps: Object.freeze(Object.fromEntries([...this.timestamps.entries()].sort(([left], [right]) => left.localeCompare(right)))),
    });
  }
}