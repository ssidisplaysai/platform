import type { WorkflowInstance, WorkflowMetrics } from "../contracts";
import type { WorkflowRetryRecord } from "../persistence";

export class WorkflowMetricsService {
  private executionDurationTotalMs = 0;
  private executionDurationSamples = 0;
  private stepDurationTotalMs = 0;
  private stepDurationSamples = 0;

  private readonly metrics: WorkflowMetrics = {
    registeredWorkflowDefinitions: 0,
    activeWorkflowInstances: 0,
    pausedInstances: 0,
    completedInstances: 0,
    failedInstances: 0,
    cancelledInstances: 0,
    timedOutInstances: 0,
    compensatingInstances: 0,
    retryCount: 0,
    checkpointCount: 0,
    recoveryCount: 0,
    concurrencyConflictCount: 0,
    duplicateCommandCount: 0,
    lifecyclePublishFailureCount: 0,
    auditPersistenceFailureCount: 0,
    contextPersistenceFailureCount: 0,
    averageExecutionDurationMs: 0,
    averageStepDurationMs: 0,
    oldestActiveWorkflowAgeMs: null,
    oldestPendingRetryAgeMs: null,
    createdInstances: 0,
    runningInstances: 0,
    retriedSteps: 0,
    compensatedInstances: 0,
    auditRecords: 0,
  };

  trackRegisteredWorkflowDefinition(): void {
    this.metrics.registeredWorkflowDefinitions += 1;
  }

  trackCreatedInstance(): void {
    this.metrics.createdInstances += 1;
  }

  trackRetry(): void {
    this.metrics.retryCount += 1;
    this.metrics.retriedSteps += 1;
  }

  trackCheckpoint(): void {
    this.metrics.checkpointCount += 1;
  }

  trackRecovery(count = 1): void {
    this.metrics.recoveryCount += count;
  }

  trackConcurrencyConflict(): void {
    this.metrics.concurrencyConflictCount += 1;
  }

  trackDuplicateCommand(): void {
    this.metrics.duplicateCommandCount += 1;
  }

  trackLifecyclePublishFailure(): void {
    this.metrics.lifecyclePublishFailureCount += 1;
  }

  trackAuditPersistenceFailure(): void {
    this.metrics.auditPersistenceFailureCount += 1;
  }

  trackContextPersistenceFailure(): void {
    this.metrics.contextPersistenceFailureCount += 1;
  }

  trackAuditRecord(): void {
    this.metrics.auditRecords += 1;
  }

  trackCompensatedInstance(): void {
    this.metrics.compensatedInstances += 1;
  }

  trackStepDuration(durationMs: number): void {
    this.stepDurationTotalMs += durationMs;
    this.stepDurationSamples += 1;
    this.metrics.averageStepDurationMs = this.stepDurationTotalMs / this.stepDurationSamples;
  }

  trackExecutionDuration(durationMs: number): void {
    this.executionDurationTotalMs += durationMs;
    this.executionDurationSamples += 1;
    this.metrics.averageExecutionDurationMs = this.executionDurationTotalMs / this.executionDurationSamples;
  }

  refreshStateGauges(instances: WorkflowInstance[], retries: WorkflowRetryRecord[]): void {
    const now = Date.now();
    this.metrics.activeWorkflowInstances = instances.filter((instance) => instance.state === "RUNNING").length;
    this.metrics.runningInstances = this.metrics.activeWorkflowInstances;
    this.metrics.pausedInstances = instances.filter((instance) => instance.state === "PAUSED").length;
    this.metrics.completedInstances = instances.filter((instance) => instance.state === "COMPLETED").length;
    this.metrics.failedInstances = instances.filter((instance) => instance.state === "FAILED").length;
    this.metrics.cancelledInstances = instances.filter((instance) => instance.state === "CANCELLED").length;
    this.metrics.timedOutInstances = instances.filter((instance) => instance.state === "TIMED_OUT").length;
    this.metrics.compensatingInstances = instances.filter((instance) => instance.state === "COMPENSATING").length;

    const oldestActive = instances
      .filter((instance) => instance.state === "RUNNING")
      .map((instance) => Date.parse(instance.lastExecutionStartedAt ?? instance.startedAt))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b)[0];

    this.metrics.oldestActiveWorkflowAgeMs = oldestActive ? Math.max(0, now - oldestActive) : null;

    const oldestRetry = retries
      .map((record) => Date.parse(record.recordedAt))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b)[0];

    this.metrics.oldestPendingRetryAgeMs = oldestRetry ? Math.max(0, now - oldestRetry) : null;
  }

  hydrate(metrics: WorkflowMetrics): void {
    Object.assign(this.metrics, { ...metrics });
    this.executionDurationSamples = metrics.averageExecutionDurationMs > 0 ? Math.max(metrics.completedInstances, 1) : 0;
    this.executionDurationTotalMs = metrics.averageExecutionDurationMs * this.executionDurationSamples;
    this.stepDurationSamples = metrics.averageStepDurationMs > 0 ? Math.max(metrics.createdInstances, 1) : 0;
    this.stepDurationTotalMs = metrics.averageStepDurationMs * this.stepDurationSamples;
  }

  snapshot(): WorkflowMetrics {
    return { ...this.metrics };
  }
}
