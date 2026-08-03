import { randomUUID } from "node:crypto";
import type { MessageEnvelope, Publisher } from "@/platform/messaging";
import { getGenesisMessageBus } from "@/platform/messaging";
import type {
  NextRun,
  ScheduleAuditRecord,
  ScheduleDefinition,
  ScheduleHealth,
  ScheduleInstance,
  ScheduleOccurrence,
  ScheduleResult,
} from "../contracts";
import { FileSchedulingPersistenceCoordinator, type SchedulingPersistenceCoordinator } from "../persistence";
import { ScheduleCalculator } from "./ScheduleCalculator";
import type { Clock } from "./Clock";
import { SystemClock } from "./Clock";
import { MissedRunPolicyService } from "./MissedRunPolicyService";
import { OccurrenceClaimService } from "./OccurrenceClaimService";
import { ScheduleLifecycleService } from "./ScheduleLifecycleService";
import { ScheduleRegistry } from "./ScheduleRegistry";
import { SchedulingAuditWriter } from "./SchedulingAuditWriter";
import { SchedulingHealthService } from "./SchedulingHealthService";
import { SchedulingMetricsService } from "./SchedulingMetricsService";

export type SchedulingCapabilityMetadata = {
  capabilityId: "platform.scheduling";
  capabilityName: "Genesis Scheduling Platform";
  version: string;
  dependencies: {
    messaging: "consumed";
    identity: "consumed";
    authorization: "consumed";
    missionControl: "integrated";
  };
  supports: {
    oneTime: boolean;
    delayed: boolean;
    recurring: boolean;
    interval: boolean;
    cron: boolean;
    calendar: boolean;
    timers: boolean;
    deadlines: boolean;
    retries: boolean;
    deferredCommands: boolean;
    pauseResumeCancel: boolean;
    restartRecovery: boolean;
    missedRunPolicies: boolean;
    health: boolean;
    metrics: boolean;
    audit: boolean;
  };
};

type SchedulingPublisher = Pick<Publisher, "publish"> & {
  healthSnapshot?: () => { status: string };
};

export type SchedulingAuthorizer = (input: {
  action: string;
  scheduleId: string;
  actorId: string;
}) => Promise<boolean> | boolean;

const SYSTEM_ACTOR = "system:scheduling-engine";

type DispatchFailureClassification = "TRANSPORT_UNAVAILABLE" | "DISPATCH_TIMEOUT" | "PERMANENT_FAILURE";

type DispatchOutcome = {
  dispatched: boolean;
  attempts: number;
  classification?: DispatchFailureClassification;
  reason?: string;
};

export class SchedulingEngine {
  private readonly registry = new ScheduleRegistry();
  private readonly lifecycle = new ScheduleLifecycleService();
  private readonly metrics = new SchedulingMetricsService();
  private readonly auditWriter: SchedulingAuditWriter;
  private readonly healthService = new SchedulingHealthService();
  private readonly calculator: ScheduleCalculator;
  private readonly missedRunPolicy = new MissedRunPolicyService();
  private readonly claimService: OccurrenceClaimService;
  private readonly instances = new Map<string, ScheduleInstance>();
  private readonly indexByScheduleId = new Map<string, string>();
  private readonly ready: Promise<void>;
  private persistenceStatus: "HEALTHY" | "DEGRADED" = "HEALTHY";
  private recoveryStatus: "HEALTHY" | "DEGRADED" = "HEALTHY";
  private claimingStatus: "HEALTHY" | "DEGRADED" = "HEALTHY";
  private readonly dispatchRetryLimit: number;
  private readonly dispatchTimeoutMs: number;

  constructor(private readonly options?: {
    clock?: Clock;
    messaging?: SchedulingPublisher;
    persistence?: SchedulingPersistenceCoordinator;
    authorizer?: SchedulingAuthorizer;
    dispatchRetryLimit?: number;
    dispatchTimeoutMs?: number;
  }) {
    this.clock = options?.clock ?? new SystemClock();
    this.auditWriter = new SchedulingAuditWriter(this.clock);
    this.messaging = options?.messaging ?? getGenesisMessageBus();
    this.persistence = options?.persistence ?? new FileSchedulingPersistenceCoordinator();
    this.calculator = new ScheduleCalculator(this.clock);
    this.claimService = new OccurrenceClaimService(this.persistence.claimStore, this.clock);
    this.dispatchRetryLimit = Math.max(1, options?.dispatchRetryLimit ?? 3);
    this.dispatchTimeoutMs = Math.max(100, options?.dispatchTimeoutMs ?? 5_000);
    this.ready = this.recover();
  }

  private readonly clock: Clock;
  private readonly messaging: SchedulingPublisher;
  private readonly persistence: SchedulingPersistenceCoordinator;

  async waitUntilReady(): Promise<void> {
    await this.ready;
  }

  async registerSchedule(definition: ScheduleDefinition): Promise<ScheduleInstance> {
    await this.ready;
    await this.ensureAuthorized("schedule:create", definition.scheduleId, definition.createdBy);

    this.registry.register(definition);
    this.metrics.trackRegisteredSchedule();
    await this.persistence.definitionStore.save(definition);

    const initialNextRun = definition.state === "ACTIVE" ? this.calculator.nextRun(definition) : { nextRunAt: null, reason: "READY" as const };
    const now = this.clock.nowIso();
    const instance: ScheduleInstance = {
      instanceId: randomUUID(),
      scheduleId: definition.scheduleId,
      scheduleVersion: structuredClone(definition.version),
      state: definition.state,
      nextRunAt: initialNextRun.nextRunAt,
      lastRunAt: null,
      occurrenceCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.instances.set(instance.instanceId, structuredClone(instance));
    this.indexByScheduleId.set(instance.scheduleId, instance.instanceId);
    await this.persistence.instanceStore.create(instance);
    await this.writeAudit({
      scheduleId: definition.scheduleId,
      instanceId: instance.instanceId,
      eventType: "SCHEDULE_CREATED",
      actorId: definition.createdBy,
      message: "Schedule created",
    });
    await this.refreshOperationalMetrics();
    return structuredClone(instance);
  }

  async updateSchedule(definition: ScheduleDefinition, actorId: string): Promise<ScheduleDefinition> {
    await this.ready;
    await this.ensureAuthorized("schedule:update", definition.scheduleId, actorId);
    this.registry.update(definition);
    await this.persistence.definitionStore.save(definition);
    await this.writeAudit({
      scheduleId: definition.scheduleId,
      eventType: "SCHEDULE_UPDATED",
      actorId,
      message: "Schedule updated",
    });
    return structuredClone(definition);
  }

  async activate(scheduleId: string, actorId: string): Promise<ScheduleInstance> {
    await this.ready;
    await this.ensureAuthorized("schedule:activate", scheduleId, actorId);
    const instance = this.requireInstanceByScheduleId(scheduleId);
    const definition = this.registry.get(scheduleId);
    instance.state = this.lifecycle.activate(instance.state);
    const next = this.calculator.nextRun(definition, this.clock.now(), instance.occurrenceCount);
    instance.nextRunAt = next.nextRunAt;
    instance.updatedAt = this.clock.nowIso();
    await this.saveInstance(instance);
    await this.writeAudit({ scheduleId, instanceId: instance.instanceId, eventType: "SCHEDULE_ACTIVATED", actorId, message: "Schedule activated" });
    return structuredClone(instance);
  }

  async pause(scheduleId: string, actorId: string): Promise<ScheduleInstance> {
    await this.ready;
    await this.ensureAuthorized("schedule:pause", scheduleId, actorId);
    const instance = this.requireInstanceByScheduleId(scheduleId);
    instance.state = this.lifecycle.pause(instance.state);
    instance.pausedAt = this.clock.nowIso();
    instance.updatedAt = instance.pausedAt;
    await this.saveInstance(instance);
    await this.writeAudit({ scheduleId, instanceId: instance.instanceId, eventType: "SCHEDULE_PAUSED", actorId, message: "Schedule paused" });
    return structuredClone(instance);
  }

  async resume(scheduleId: string, actorId: string): Promise<ScheduleInstance> {
    await this.ready;
    await this.ensureAuthorized("schedule:resume", scheduleId, actorId);
    const instance = this.requireInstanceByScheduleId(scheduleId);
    const definition = this.registry.get(scheduleId);
    instance.state = this.lifecycle.resume(instance.state);
    instance.nextRunAt = this.calculator.nextRun(definition, this.clock.now(), instance.occurrenceCount).nextRunAt;
    instance.pausedAt = undefined;
    instance.updatedAt = this.clock.nowIso();
    await this.saveInstance(instance);
    await this.writeAudit({ scheduleId, instanceId: instance.instanceId, eventType: "SCHEDULE_RESUMED", actorId, message: "Schedule resumed" });
    return structuredClone(instance);
  }

  async cancel(scheduleId: string, actorId: string): Promise<ScheduleInstance> {
    await this.ready;
    await this.ensureAuthorized("schedule:cancel", scheduleId, actorId);
    const instance = this.requireInstanceByScheduleId(scheduleId);
    instance.state = this.lifecycle.cancel(instance.state);
    instance.cancelledAt = this.clock.nowIso();
    instance.nextRunAt = null;
    instance.updatedAt = instance.cancelledAt;
    await this.saveInstance(instance);
    await this.writeAudit({ scheduleId, instanceId: instance.instanceId, eventType: "SCHEDULE_CANCELLED", actorId, message: "Schedule cancelled" });
    return structuredClone(instance);
  }

  async evaluateDueSchedules(evaluatedAt?: Date): Promise<ScheduleResult[]> {
    await this.ready;
    const now = evaluatedAt ?? this.clock.now();
    const results: ScheduleResult[] = [];

    for (const instance of this.instances.values()) {
      if (instance.state !== "ACTIVE" || !instance.nextRunAt) {
        continue;
      }

      if (new Date(instance.nextRunAt).getTime() > now.getTime()) {
        continue;
      }

      const definition = this.registry.get(instance.scheduleId);
      const dueRuns = this.calculator.calculateDueRuns(definition, instance.nextRunAt, now);
      const occurrences = dueRuns.map((dueAt, index) => this.newOccurrence(instance, dueAt, index < dueRuns.length - 1));

      if (occurrences.length === 0) {
        continue;
      }

      this.metrics.trackMissedOccurrence(Math.max(0, occurrences.length - 1));
      const selected = this.missedRunPolicy.apply(definition.missedRunPolicy, occurrences);
      if (selected.length > 1) {
        this.metrics.trackCatchUpOccurrence(selected.length - 1);
      }

      for (const occurrence of selected) {
        if (occurrence.isDstAmbiguous) {
          this.metrics.trackDstAmbiguity();
          const existing = await this.lookupExistingLogicalRun(instance.instanceId, occurrence.logicalRunKey);
          if (existing) {
            occurrence.status = "SKIPPED";
            this.metrics.trackSkippedOccurrence();
            this.metrics.trackDuplicateClaimRejection();
            await this.writeAudit({
              scheduleId: instance.scheduleId,
              instanceId: instance.instanceId,
              occurrenceId: occurrence.occurrenceId,
              eventType: "OCCURRENCE_SKIPPED",
              actorId: SYSTEM_ACTOR,
              message: "Skipped ambiguous DST duplicate local timestamp",
              details: {
                dueAt: occurrence.dueAt,
                logicalRunKey: occurrence.logicalRunKey,
                policy: "FIRST_LOCAL_TIMESTAMP_WINS",
              },
            });
            continue;
          }
        }

        this.metrics.trackDueOccurrence();
        await this.persistence.occurrenceStore.append(occurrence);
        await this.writeAudit({
          scheduleId: instance.scheduleId,
          instanceId: instance.instanceId,
          occurrenceId: occurrence.occurrenceId,
          eventType: "OCCURRENCE_CALCULATED",
          actorId: SYSTEM_ACTOR,
          message: "Occurrence calculated",
          details: { dueAt: occurrence.dueAt, trigger: occurrence.trigger.triggerType },
        });

        const claim = await this.claimService.claim({
          occurrenceId: occurrence.occurrenceId,
          owner: SYSTEM_ACTOR,
          idempotencyKey: `${occurrence.logicalRunKey ?? occurrence.occurrenceId}:${occurrence.dueAt}`,
          logicalRunKey: occurrence.logicalRunKey,
        });

        if (!claim.claimed || !claim.claim) {
          if (claim.reason === "ALREADY_CLAIMED") {
            this.metrics.trackDuplicateClaimRejection();
          } else {
            this.metrics.trackClaimConflict();
          }
          continue;
        }

        this.metrics.trackClaimedOccurrence();
        occurrence.status = "CLAIMED";
        occurrence.claimId = claim.claim.claimId;
        await this.persistence.occurrenceStore.update(occurrence);
        await this.writeAudit({
          scheduleId: instance.scheduleId,
          instanceId: instance.instanceId,
          occurrenceId: occurrence.occurrenceId,
          eventType: "OCCURRENCE_CLAIMED",
          actorId: SYSTEM_ACTOR,
          message: "Occurrence claimed",
        });

        const schedulingDelay = now.getTime() - new Date(occurrence.dueAt).getTime();
        this.metrics.trackSchedulingDelay(Math.max(0, schedulingDelay));

        const dispatchStarted = this.clock.now();
        const dispatch = await this.dispatchOccurrence(definition, instance, occurrence);
        const latency = this.clock.now().getTime() - dispatchStarted.getTime();
        this.metrics.trackDispatchLatency(Math.max(0, latency));

        if (dispatch.dispatched) {
          this.metrics.trackDispatchedOccurrence();
          occurrence.status = "DISPATCHED";
          occurrence.dispatchedAt = this.clock.nowIso();
          occurrence.completedAt = occurrence.dispatchedAt;
          await this.persistence.occurrenceStore.update(occurrence);
          await this.claimService.markCompleted(occurrence.occurrenceId);
          await this.writeAudit({
            scheduleId: instance.scheduleId,
            instanceId: instance.instanceId,
            occurrenceId: occurrence.occurrenceId,
            eventType: "OCCURRENCE_DISPATCHED",
            actorId: SYSTEM_ACTOR,
            message: "Occurrence dispatched",
          });

          instance.lastRunAt = occurrence.dueAt;
          instance.occurrenceCount += 1;
        } else {
          this.metrics.trackDispatchFailure();
          occurrence.status = "FAILED";
          occurrence.errorCode = dispatch.reason ?? "SCHEDULE_DISPATCH_FAILURE";
          await this.persistence.occurrenceStore.update(occurrence);
          await this.claimService.markFailed(occurrence.occurrenceId, dispatch.reason ?? "dispatch_failed");
          await this.failInstance(instance, dispatch.reason ?? "dispatch_failed");
        }

        results.push({
          instance: structuredClone(instance),
          occurrence: structuredClone(occurrence),
          dispatched: dispatch.dispatched,
          reason: dispatch.dispatched ? "dispatched" : (dispatch.reason ?? "dispatch_failed"),
        });
      }

      const next = this.calculator.nextRun(definition, new Date(now.getTime() + 1000), instance.occurrenceCount);
      await this.applyNextRun(instance, next);
    }

    await this.refreshOperationalMetrics();
    return results;
  }

  getMetrics() {
    return this.metrics.snapshot();
  }

  getAuditRecords(): ScheduleAuditRecord[] {
    return this.auditWriter.list();
  }

  async healthSnapshot(): Promise<ScheduleHealth> {
    const messageHealth = this.messaging.healthSnapshot ? this.messaging.healthSnapshot() : { status: "HEALTHY" };
    return this.healthService.snapshot({
      metrics: this.metrics,
      dependencyHealth: {
        messaging: { status: messageHealth.status },
        persistence: { status: this.persistenceStatus },
        clock: { status: "HEALTHY" },
        calculator: { status: "HEALTHY" },
        claiming: { status: this.claimingStatus },
        recovery: { status: this.recoveryStatus },
        configuration: { status: "HEALTHY" },
      },
    });
  }

  getOperationalReadiness() {
    const snapshot = this.metrics.snapshot();
    return {
      registeredSchedules: snapshot.registeredSchedules,
      activeSchedules: snapshot.activeSchedules,
      pausedSchedules: snapshot.pausedSchedules,
      completedSchedules: snapshot.completedSchedules,
      failedSchedules: snapshot.failedSchedules,
      dueOccurrences: snapshot.dueOccurrences,
      claimedOccurrences: snapshot.claimedOccurrences,
      dispatchedOccurrences: snapshot.dispatchedOccurrences,
      missedOccurrences: snapshot.missedOccurrences,
      catchUpOccurrences: snapshot.catchUpOccurrences,
      duplicateClaimRejections: snapshot.duplicateClaimRejections,
      claimConflicts: snapshot.claimConflicts,
      dstAmbiguityCount: snapshot.dstAmbiguityCount,
      corruptPersistenceCount: snapshot.corruptPersistenceCount,
      recoveryFailures: snapshot.recoveryFailures,
      dispatchRetryCount: snapshot.dispatchRetryCount,
      auditFailureCount: snapshot.auditFailureCount,
      dispatchFailures: snapshot.dispatchFailures,
      recoveryCount: snapshot.recoveryCount,
      oldestOverdueOccurrenceAgeMs: snapshot.oldestOverdueOccurrenceAgeMs,
      averageSchedulingDelayMs: snapshot.averageSchedulingDelayMs,
      averageDispatchLatencyMs: snapshot.averageDispatchLatencyMs,
      durability: "FILE_PERSISTED",
      multiNodeReadiness: "CLAIM_STORE_ABSTRACTION_SINGLE_WRITER",
    } as const;
  }

  capabilityMetadata(): SchedulingCapabilityMetadata {
    return {
      capabilityId: "platform.scheduling",
      capabilityName: "Genesis Scheduling Platform",
      version: "1.0.0",
      dependencies: {
        messaging: "consumed",
        identity: "consumed",
        authorization: "consumed",
        missionControl: "integrated",
      },
      supports: {
        oneTime: true,
        delayed: true,
        recurring: true,
        interval: true,
        cron: true,
        calendar: true,
        timers: true,
        deadlines: true,
        retries: true,
        deferredCommands: true,
        pauseResumeCancel: true,
        restartRecovery: true,
        missedRunPolicies: true,
        health: true,
        metrics: true,
        audit: true,
      },
    };
  }

  private async recover(): Promise<void> {
    try {
      const { snapshot, diagnostics } = await this.persistence.loadRecoverySnapshot();
      this.registry.restore(snapshot.definitions);

      this.instances.clear();
      this.indexByScheduleId.clear();
      for (const instance of snapshot.instances) {
        this.instances.set(instance.instanceId, structuredClone(instance));
        this.indexByScheduleId.set(instance.scheduleId, instance.instanceId);
      }

      this.auditWriter.restore(snapshot.audits);
      if (snapshot.metrics) {
        this.metrics.hydrate(snapshot.metrics);
      }

      if (diagnostics.totalInvalidRecords > 0 || diagnostics.corruptFile) {
        this.metrics.trackCorruptPersistence(Math.max(1, diagnostics.totalInvalidRecords));
        this.persistenceStatus = "DEGRADED";
        await this.writeAudit({
          scheduleId: "system",
          eventType: "CORRUPT_STATE_DETECTED",
          actorId: SYSTEM_ACTOR,
          message: "Corrupt or partial scheduling persistence state detected",
          details: {
            classification: diagnostics.classification,
            missingFile: diagnostics.missingFile,
            corruptFile: diagnostics.corruptFile,
            invalidDefinitions: diagnostics.invalidDefinitions,
            invalidInstances: diagnostics.invalidInstances,
            invalidOccurrences: diagnostics.invalidOccurrences,
            invalidClaims: diagnostics.invalidClaims,
            invalidAudits: diagnostics.invalidAudits,
            invalidMetrics: diagnostics.invalidMetrics,
            totalInvalidRecords: diagnostics.totalInvalidRecords,
          },
        });
      }

      const recoveredClaims = await this.claimService.recoverExpiredClaims();
      this.metrics.trackRecovery(snapshot.instances.length + recoveredClaims);
      await this.refreshOperationalMetrics();
      await this.writeAudit({
        scheduleId: "system",
        eventType: "RECOVERY_PERFORMED",
        actorId: SYSTEM_ACTOR,
        message: "Scheduling recovery completed",
        details: {
          restoredInstances: snapshot.instances.length,
          recoveredClaims,
          classification: diagnostics.classification,
          totalInvalidRecords: diagnostics.totalInvalidRecords,
        },
      });
    } catch (error) {
      this.instances.clear();
      this.indexByScheduleId.clear();
      this.persistenceStatus = "DEGRADED";
      this.recoveryStatus = "DEGRADED";
      this.metrics.trackRecoveryFailure();

      await this.writeAudit({
        scheduleId: "system",
        eventType: "RECOVERY_FAILED",
        actorId: SYSTEM_ACTOR,
        message: "Scheduling recovery failed; engine started in safe degraded mode",
        details: {
          error: error instanceof Error ? error.message : "unknown_recovery_error",
        },
      });
    }
  }

  private requireInstanceByScheduleId(scheduleId: string): ScheduleInstance {
    const instanceId = this.indexByScheduleId.get(scheduleId);
    if (!instanceId) {
      throw new Error(`schedule_instance_not_found:${scheduleId}`);
    }

    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`schedule_instance_not_found:${scheduleId}`);
    }

    return instance;
  }

  private newOccurrence(instance: ScheduleInstance, dueAt: string, missed: boolean): ScheduleOccurrence {
    const definition = this.registry.get(instance.scheduleId);
    const time = this.calculator.classifyOccurrenceTime(definition, dueAt);

    return {
      occurrenceId: `${instance.instanceId}:${dueAt}`,
      instanceId: instance.instanceId,
      scheduleId: instance.scheduleId,
      dueAt,
      logicalRunKey: time.isDstAmbiguous ? `${instance.instanceId}:${time.localRunKey}` : `${instance.instanceId}:${dueAt}`,
      utcOffsetMinutes: time.utcOffsetMinutes ?? undefined,
      isDstAmbiguous: time.isDstAmbiguous,
      trigger: {
        triggerType: missed ? "MISSED_RUN_CATCH_UP" : "SCHEDULED",
        evaluatedAt: this.clock.nowIso(),
      },
      status: "PENDING",
    };
  }

  private async dispatchOccurrence(
    definition: ScheduleDefinition,
    instance: ScheduleInstance,
    occurrence: ScheduleOccurrence,
  ): Promise<DispatchOutcome> {
    const envelope: MessageEnvelope<Record<string, unknown>> = {
      messageId: randomUUID(),
      correlationId: definition.command.correlationId ?? occurrence.occurrenceId,
      causationId: definition.command.causationId ?? occurrence.occurrenceId,
      tenant: "genesis-platform",
      workspace: "platform",
      sourceApplication: "genesis-platform",
      sourceCapability: "platform.scheduling",
      timestamp: this.clock.nowIso(),
      version: "1.0.0",
      priority: "NORMAL",
      headers: {
        scheduleId: definition.scheduleId,
        scheduleType: definition.scheduleType,
        occurrenceId: occurrence.occurrenceId,
      },
      payload: {
        commandType: definition.command.commandType,
        dueAt: occurrence.dueAt,
        workflowInstanceId: definition.command.workflowInstanceId ?? null,
        metadata: {
          scheduleId: definition.scheduleId,
          scheduleVersion: definition.version,
          occurrenceId: occurrence.occurrenceId,
          triggerType: occurrence.trigger.triggerType,
        },
        commandPayload: definition.command.payload,
      },
      metadata: {
        orderingKey: definition.scheduleId,
        idempotencyKey: definition.command.idempotencyKey ?? (occurrence.logicalRunKey ?? occurrence.occurrenceId),
      },
    };

    let attempts = 0;
    let lastClassification: DispatchFailureClassification | undefined;
    let lastReason = "dispatch_failed";

    while (attempts < this.dispatchRetryLimit) {
      attempts += 1;

      try {
        await this.publishWithTimeout({
          topic: definition.command.topic,
          mode: "PUBLISH_SUBSCRIBE",
          envelope,
        });
        return { dispatched: true, attempts };
      } catch (error) {
        const classification = this.classifyDispatchFailure(error);
        lastClassification = classification;
        lastReason = classification.toLowerCase();

        const retryable = classification === "TRANSPORT_UNAVAILABLE" || classification === "DISPATCH_TIMEOUT";
        if (!retryable || attempts >= this.dispatchRetryLimit) {
          if (retryable && attempts >= this.dispatchRetryLimit) {
            await this.writeAudit({
              scheduleId: instance.scheduleId,
              instanceId: instance.instanceId,
              occurrenceId: occurrence.occurrenceId,
              eventType: "DISPATCH_RETRY_EXHAUSTED",
              actorId: SYSTEM_ACTOR,
              message: "Dispatch retries exhausted",
              details: { attempts, classification },
            });
          }

          return {
            dispatched: false,
            attempts,
            classification,
            reason: lastReason,
          };
        }

        this.metrics.trackDispatchRetry();
        await this.writeAudit({
          scheduleId: instance.scheduleId,
          instanceId: instance.instanceId,
          occurrenceId: occurrence.occurrenceId,
          eventType: "DISPATCH_RETRY",
          actorId: SYSTEM_ACTOR,
          message: "Retrying occurrence dispatch",
          details: { attempts, classification },
        });
      }
    }

    return {
      dispatched: false,
      attempts,
      classification: lastClassification,
      reason: lastReason,
    };
  }

  private async applyNextRun(instance: ScheduleInstance, next: NextRun): Promise<void> {
    if (!next.nextRunAt) {
      if (instance.state === "ACTIVE") {
        instance.state = this.lifecycle.complete(instance.state);
        instance.completedAt = this.clock.nowIso();
      }
      instance.nextRunAt = null;
      instance.updatedAt = this.clock.nowIso();
      await this.saveInstance(instance);
      return;
    }

    instance.nextRunAt = next.nextRunAt;
    instance.updatedAt = this.clock.nowIso();
    await this.saveInstance(instance);
  }

  private async failInstance(instance: ScheduleInstance, reason: string): Promise<void> {
    if (instance.state === "FAILED") {
      return;
    }

    instance.state = this.lifecycle.fail(instance.state);
    instance.failedAt = this.clock.nowIso();
    instance.failureReason = reason;
    instance.updatedAt = instance.failedAt;
    await this.saveInstance(instance);
    await this.writeAudit({
      scheduleId: instance.scheduleId,
      instanceId: instance.instanceId,
      eventType: "SCHEDULE_FAILED",
      actorId: SYSTEM_ACTOR,
      message: "Schedule failed",
      details: { reason },
    });
  }

  private async saveInstance(instance: ScheduleInstance): Promise<void> {
    this.instances.set(instance.instanceId, structuredClone(instance));
    await this.persistence.instanceStore.update(instance);
  }

  private async refreshOperationalMetrics(): Promise<void> {
    const instances = [...this.instances.values()].map((entry) => structuredClone(entry));
    this.metrics.refreshStateGauges(instances);

    const now = this.clock.now();
    const overdue = instances
      .filter((entry) => entry.state === "ACTIVE" && entry.nextRunAt)
      .map((entry) => now.getTime() - new Date(entry.nextRunAt as string).getTime())
      .filter((age) => age >= 0);
    const oldest = overdue.length > 0 ? Math.max(...overdue) : null;
    this.metrics.updateOldestOverdueOccurrenceAge(oldest);

    await this.persistence.metricsStore.save(this.metrics.snapshot());
  }

  private async writeAudit(input: Omit<ScheduleAuditRecord, "recordId" | "recordedAt">): Promise<void> {
    const record = this.auditWriter.write(input);
    try {
      await this.persistence.auditStore.append(record);
    } catch (error) {
      this.persistenceStatus = "DEGRADED";
      this.metrics.trackAuditFailure();

      // Keep visibility in in-memory audit stream even when durable audit append fails.
      this.auditWriter.write({
        scheduleId: input.scheduleId,
        instanceId: input.instanceId,
        occurrenceId: input.occurrenceId,
        eventType: "AUDIT_PERSISTENCE_FAILURE",
        actorId: SYSTEM_ACTOR,
        message: "Failed to persist schedule audit record",
        details: {
          failedEventType: input.eventType,
          error: error instanceof Error ? error.message : "unknown_audit_persistence_error",
        },
      });
    }
  }

  private async lookupExistingLogicalRun(instanceId: string, logicalRunKey?: string): Promise<ScheduleOccurrence | null> {
    if (!logicalRunKey) {
      return null;
    }

    if (this.persistence.occurrenceStore.findByLogicalRunKey) {
      return this.persistence.occurrenceStore.findByLogicalRunKey(instanceId, logicalRunKey);
    }

    const existing = await this.persistence.occurrenceStore.listByInstance(instanceId);
    return existing.find((entry) => entry.logicalRunKey === logicalRunKey) ?? null;
  }

  private classifyDispatchFailure(error: unknown): DispatchFailureClassification {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("timeout") || message.includes("timed out")) {
      return "DISPATCH_TIMEOUT";
    }

    if (message.includes("unavailable") || message.includes("econn") || message.includes("network")) {
      return "TRANSPORT_UNAVAILABLE";
    }

    return "PERMANENT_FAILURE";
  }

  private async publishWithTimeout(input: Parameters<SchedulingPublisher["publish"]>[0]): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.messaging.publish(input),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("dispatch_timeout")), this.dispatchTimeoutMs);
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private async ensureAuthorized(action: string, scheduleId: string, actorId: string): Promise<void> {
    if (!this.options?.authorizer) {
      return;
    }

    const allowed = await this.options.authorizer({ action, scheduleId, actorId });
    if (!allowed) {
      throw new Error(`schedule_authorization_denied:${action}:${scheduleId}`);
    }
  }
}

let singleton: SchedulingEngine | null = null;

export function getGenesisSchedulingEngine(): SchedulingEngine {
  if (!singleton) {
    singleton = new SchedulingEngine();
  }

  return singleton;
}
