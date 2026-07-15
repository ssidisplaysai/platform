import type { CompilerMetricsSnapshot } from "./types";

export class CompilerMetrics {
  private readonly startedAt: string;
  private completedAt?: string;
  private passCount = 0;
  private completedPassCount = 0;
  private failedPassCount = 0;
  private warningCount = 0;
  private errorCount = 0;
  private artifactCount = 0;
  private rollbackCount = 0;
  private eventCount = 0;
  private lastDurationMs = 0;

  constructor(startedAt: string) {
    this.startedAt = startedAt;
  }

  setPassCount(count: number): void {
    this.passCount = count;
  }

  incrementCompletedPasses(): void {
    this.completedPassCount += 1;
  }

  incrementFailedPasses(): void {
    this.failedPassCount += 1;
  }

  incrementWarnings(count = 1): void {
    this.warningCount += count;
  }

  incrementErrors(count = 1): void {
    this.errorCount += count;
  }

  incrementArtifacts(count = 1): void {
    this.artifactCount += count;
  }

  incrementRollbacks(count = 1): void {
    this.rollbackCount += count;
  }

  incrementEvents(count = 1): void {
    this.eventCount += count;
  }

  complete(completedAt: string, durationMs: number): void {
    this.completedAt = completedAt;
    this.lastDurationMs = durationMs;
  }

  snapshot(): CompilerMetricsSnapshot {
    return Object.freeze({
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      durationMs: this.lastDurationMs,
      passCount: this.passCount,
      completedPassCount: this.completedPassCount,
      failedPassCount: this.failedPassCount,
      warningCount: this.warningCount,
      errorCount: this.errorCount,
      artifactCount: this.artifactCount,
      rollbackCount: this.rollbackCount,
      eventCount: this.eventCount,
    });
  }
}