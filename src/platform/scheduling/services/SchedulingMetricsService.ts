import type { ScheduleInstance, ScheduleMetrics } from "../contracts";

const defaultMetrics: ScheduleMetrics = {
  registeredSchedules: 0,
  activeSchedules: 0,
  pausedSchedules: 0,
  completedSchedules: 0,
  failedSchedules: 0,
  dueOccurrences: 0,
  claimedOccurrences: 0,
  dispatchedOccurrences: 0,
  skippedOccurrences: 0,
  missedOccurrences: 0,
  catchUpOccurrences: 0,
  duplicateClaimRejections: 0,
  claimConflicts: 0,
  dstAmbiguityCount: 0,
  corruptPersistenceCount: 0,
  recoveryFailures: 0,
  dispatchRetryCount: 0,
  auditFailureCount: 0,
  dispatchFailures: 0,
  recoveryCount: 0,
  oldestOverdueOccurrenceAgeMs: null,
  averageSchedulingDelayMs: 0,
  averageDispatchLatencyMs: 0,
};

export class SchedulingMetricsService {
  private metrics: ScheduleMetrics = structuredClone(defaultMetrics);
  private schedulingDelaySamples = 0;
  private dispatchLatencySamples = 0;

  snapshot(): ScheduleMetrics {
    return structuredClone(this.metrics);
  }

  hydrate(metrics: ScheduleMetrics): void {
    this.metrics = structuredClone(metrics);
  }

  trackRegisteredSchedule(): void {
    this.metrics.registeredSchedules += 1;
  }

  trackDueOccurrence(): void {
    this.metrics.dueOccurrences += 1;
  }

  trackClaimedOccurrence(): void {
    this.metrics.claimedOccurrences += 1;
  }

  trackDispatchedOccurrence(): void {
    this.metrics.dispatchedOccurrences += 1;
  }

  trackSkippedOccurrence(): void {
    this.metrics.skippedOccurrences += 1;
  }

  trackMissedOccurrence(count = 1): void {
    this.metrics.missedOccurrences += count;
  }

  trackCatchUpOccurrence(count = 1): void {
    this.metrics.catchUpOccurrences += count;
  }

  trackDuplicateClaimRejection(): void {
    this.metrics.duplicateClaimRejections += 1;
  }

  trackClaimConflict(): void {
    this.metrics.claimConflicts += 1;
  }

  trackDstAmbiguity(count = 1): void {
    this.metrics.dstAmbiguityCount += count;
  }

  trackCorruptPersistence(count = 1): void {
    this.metrics.corruptPersistenceCount += count;
  }

  trackRecoveryFailure(): void {
    this.metrics.recoveryFailures += 1;
  }

  trackDispatchRetry(count = 1): void {
    this.metrics.dispatchRetryCount += count;
  }

  trackAuditFailure(count = 1): void {
    this.metrics.auditFailureCount += count;
  }

  trackDispatchFailure(): void {
    this.metrics.dispatchFailures += 1;
  }

  trackRecovery(count: number): void {
    this.metrics.recoveryCount += count;
  }

  trackSchedulingDelay(delayMs: number): void {
    this.schedulingDelaySamples += 1;
    this.metrics.averageSchedulingDelayMs = this.weightedAverage(this.metrics.averageSchedulingDelayMs, this.schedulingDelaySamples, delayMs);
  }

  trackDispatchLatency(latencyMs: number): void {
    this.dispatchLatencySamples += 1;
    this.metrics.averageDispatchLatencyMs = this.weightedAverage(this.metrics.averageDispatchLatencyMs, this.dispatchLatencySamples, latencyMs);
  }

  updateOldestOverdueOccurrenceAge(ageMs: number | null): void {
    this.metrics.oldestOverdueOccurrenceAgeMs = ageMs;
  }

  refreshStateGauges(instances: ScheduleInstance[]): void {
    this.metrics.activeSchedules = instances.filter((entry) => entry.state === "ACTIVE").length;
    this.metrics.pausedSchedules = instances.filter((entry) => entry.state === "PAUSED").length;
    this.metrics.completedSchedules = instances.filter((entry) => entry.state === "COMPLETED").length;
    this.metrics.failedSchedules = instances.filter((entry) => entry.state === "FAILED").length;
  }

  private weightedAverage(current: number, samples: number, next: number): number {
    if (samples <= 1) {
      return next;
    }

    return ((current * (samples - 1)) + next) / samples;
  }
}
