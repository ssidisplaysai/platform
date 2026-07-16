import type { RuntimeExecutionContext } from "../services";
import type { RuntimeMessagingManager } from "../messaging";
import { RuntimePlanner } from "./RuntimePlanner";
import { RuntimeRetryPolicyEvaluator } from "./RuntimeRetryPolicy";
import { RuntimeScheduleDiagnostics } from "./RuntimeScheduleDiagnostics";
import { RuntimeScheduleEvidence } from "./RuntimeScheduleEvidence";
import { RuntimeScheduleFactory } from "./RuntimeScheduleFactory";
import { RuntimeScheduleSnapshotStore } from "./RuntimeScheduleSnapshotStore";
import { RuntimeScheduleTelemetry } from "./RuntimeScheduleTelemetry";
import type {
  RuntimeExecutionWindowPolicy,
  RuntimePlanRecord,
  RuntimeRetryState,
  RuntimeScheduleDescriptor,
  RuntimeScheduleRecord,
  RuntimeSchedulingMetrics,
  RuntimeSchedulingSnapshot,
  RuntimeSchedulingSnapshotRecord,
} from "./types";
import type { RuntimeTriggerEvaluationContext } from "./RuntimeTriggerRegistry";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child as T);
    }
  }
  return value;
}

export class RuntimeSchedulingManager {
  private readonly scheduleFactory = new RuntimeScheduleFactory();
  private readonly planner = new RuntimePlanner();
  private readonly retryPolicy = new RuntimeRetryPolicyEvaluator();
  private readonly diagnostics = new RuntimeScheduleDiagnostics();
  private readonly evidence = new RuntimeScheduleEvidence();
  private readonly telemetry = new RuntimeScheduleTelemetry();
  private readonly snapshots = new RuntimeScheduleSnapshotStore();
  private readonly schedules = new Map<string, RuntimeScheduleRecord>();
  private readonly plans = new Map<string, RuntimePlanRecord>();
  private readonly retryState = new Map<string, RuntimeRetryState>();
  private planSequence = 1;

  constructor(
    readonly runtimeInstanceId: string,
    readonly runtimeId: string,
  ) {}

  static fromExecutionContext(context: RuntimeExecutionContext): RuntimeSchedulingManager {
    return new RuntimeSchedulingManager(context.runtimeInstanceId, context.runtimeId);
  }

  registerSchedule(descriptor: RuntimeScheduleDescriptor): RuntimeScheduleRecord {
    const record = this.scheduleFactory.create(descriptor).snapshot();
    if (this.schedules.has(record.scheduleId)) {
      throw new Error(`GRT-SCH-MANAGER-001: Duplicate schedule registration: ${record.scheduleId}`);
    }
    this.schedules.set(record.scheduleId, record);
    this.telemetry.increment("schedule.created");
    this.evidence.append(this.runtimeInstanceId, "ScheduleRegistered", { targetId: record.targetId, priority: record.priority }, record.scheduleId);
    return record;
  }

  generatePlan(scheduleId: string, context: RuntimeTriggerEvaluationContext): RuntimePlanRecord {
    const plan = this.planIfDue(scheduleId, context);
    if (!plan) {
      this.diagnostics.log(this.runtimeInstanceId, "Warning", "GRT-SCH-PLAN-001", "Plan generation failed", { currentSequence: context.currentSequence }, scheduleId);
      throw new Error(`GRT-SCH-PLAN-001: Schedule is not due for plan generation: ${scheduleId}`);
    }
    return plan;
  }

  planIfDue(scheduleId: string, context: RuntimeTriggerEvaluationContext): RuntimePlanRecord | undefined {
    const schedule = this.schedule(scheduleId);
    const causationId = context.observedEvent?.messageId ?? context.observedCommand?.messageId;
    const existing = this.listPlans().find((entry) =>
      entry.scheduleId === scheduleId
      && entry.executionSlot.sequence === context.currentSequence
      && entry.causationId === causationId);
    if (existing) {
      return existing;
    }

    const attempt = this.nextAttempt(scheduleId);
    const plan = this.planner.planIfDue(
      this.runtimeInstanceId,
      this.runtimeId,
      schedule,
      this.planSequence,
      attempt,
      context,
      causationId,
    );

    if (!plan) {
      const slot = schedule.trigger.slot ?? {
        slotId: `slot-${context.currentSequence.toString().padStart(6, "0")}`,
        sequence: context.currentSequence,
        window: "observed",
      };
      const retry = this.retryState.get(scheduleId);
      const expired = schedule.expirationPolicy.expiresAfterSequence !== undefined && context.currentSequence > schedule.expirationPolicy.expiresAfterSequence;
      if (expired) {
        this.telemetry.increment("schedule.expired");
        this.evidence.append(this.runtimeInstanceId, "ScheduleExpired", { currentSequence: context.currentSequence }, scheduleId);
        this.diagnostics.log(this.runtimeInstanceId, "Warning", "GRT-SCH-WINDOW-001", "Execution window expired", { currentSequence: context.currentSequence }, scheduleId);
      } else if (retry?.exhausted) {
        this.telemetry.increment("retry.failed");
        this.diagnostics.log(this.runtimeInstanceId, "Warning", "GRT-SCH-RETRY-001", "Retry exhausted", { lastAttempt: retry.lastAttempt }, scheduleId);
      }
      void slot;
      return undefined;
    }

    if (this.plans.has(plan.planId)) {
      return this.plans.get(plan.planId);
    }

    this.planSequence += 1;
    this.plans.set(plan.planId, plan);
    this.telemetry.increment("plan.generated");
    this.evidence.append(this.runtimeInstanceId, "PlanGenerated", {
      plannedSequence: plan.plannedSequence,
      executionSlot: plan.executionSlot.slotId,
      attempt: plan.attempt,
    }, scheduleId, plan.planId);
    return plan;
  }

  generateDuePlans(context: RuntimeTriggerEvaluationContext): readonly RuntimePlanRecord[] {
    const plans = [...this.listSchedules()]
      .sort((a, b) => (b.priority - a.priority) || a.scheduleId.localeCompare(b.scheduleId))
      .map((schedule) => this.planIfDue(schedule.scheduleId, context))
      .filter((entry): entry is RuntimePlanRecord => Boolean(entry));
    return Object.freeze(plans);
  }

  publishPlan(planId: string, messaging: RuntimeMessagingManager) {
    const plan = this.plan(planId);
    try {
      const published = messaging.publish({
        channel: plan.commandChannel,
        topic: plan.commandTopic,
        envelopeType: "Command",
        publisherKind: "Scheduler",
        publisherId: plan.planId,
        payload: plan.commandPayload,
        correlationId: plan.correlationId,
        causationId: plan.causationId,
        schemaVersion: plan.schemaVersion,
        metadata: plan.metadata,
      });
      this.telemetry.increment("plan.published");
      this.evidence.append(this.runtimeInstanceId, "PlanPublished", { messageId: published.envelope.messageId }, plan.scheduleId, plan.planId);
      return published;
    } catch (error) {
      this.diagnostics.log(this.runtimeInstanceId, "Warning", "GRT-SCH-PUBLISH-001", "Publication rejected", {
        message: error instanceof Error ? error.message : String(error),
      }, plan.scheduleId, plan.planId);
      throw error;
    }
  }

  deriveRetryState(scheduleId: string, currentSequence: number): RuntimeRetryState {
    const schedule = this.schedule(scheduleId);
    const slot = schedule.trigger.slot ?? {
      slotId: `slot-${currentSequence.toString().padStart(6, "0")}`,
      sequence: currentSequence,
      window: "retry",
    };
    const state = this.retryPolicy.derive(schedule, currentSequence, slot, this.retryState.get(scheduleId));
    this.retryState.set(scheduleId, state);
    if (state.exhausted) {
      this.telemetry.increment("retry.failed");
      this.diagnostics.log(this.runtimeInstanceId, "Warning", "GRT-SCH-RETRY-001", "Retry exhausted", { lastAttempt: state.lastAttempt }, scheduleId);
    } else {
      this.telemetry.increment("retry.executed");
    }
    this.evidence.append(this.runtimeInstanceId, "RetryDerived", { nextEligibleSequence: state.nextEligibleSequence, exhausted: state.exhausted }, scheduleId);
    return state;
  }

  snapshot(): RuntimeSchedulingSnapshot {
    const schedules = this.listSchedules();
    const plans = this.listPlans();
    const retryState = this.retryStates();
    const metrics: RuntimeSchedulingMetrics = {
      scheduleCount: schedules.length,
      planCount: plans.length,
      retryStateCount: retryState.length,
      expiredScheduleCount: this.telemetry.snapshot({ scheduleCount: 0, planCount: 0, retryStateCount: 0, expiredScheduleCount: 0, diagnosticsCount: 0, evidenceCount: 0, snapshotCount: 0 }).counters["schedule.expired"] ?? 0,
      diagnosticsCount: this.diagnostics.all().length,
      evidenceCount: this.evidence.all().length,
      snapshotCount: this.snapshots.history(this.runtimeInstanceId).length,
    };

    return deepFreeze({
      runtimeInstanceId: this.runtimeInstanceId,
      runtimeId: this.runtimeId,
      schedules,
      plans,
      retryState,
      executionWindows: this.executionWindows(schedules),
      diagnostics: this.diagnostics.all(),
      evidence: this.evidence.all(),
      telemetry: this.telemetry.snapshot(metrics),
    });
  }

  persistSnapshot(): RuntimeSchedulingSnapshotRecord {
    const record = this.snapshots.save(this.snapshot());
    this.telemetry.increment("schedule.snapshot.persisted");
    this.evidence.append(this.runtimeInstanceId, "SnapshotPersisted", { revision: record.revision });
    return record;
  }

  restoreLatestSnapshot(): RuntimeSchedulingSnapshotRecord {
    return this.snapshots.loadLatest(this.runtimeInstanceId);
  }

  snapshotHistory(): readonly RuntimeSchedulingSnapshotRecord[] {
    return this.snapshots.history(this.runtimeInstanceId);
  }

  listSchedules(): readonly RuntimeScheduleRecord[] {
    return Object.freeze([...this.schedules.values()].sort((a, b) => a.scheduleId.localeCompare(b.scheduleId)));
  }

  listPlans(): readonly RuntimePlanRecord[] {
    return Object.freeze([...this.plans.values()].sort((a, b) => a.planId.localeCompare(b.planId)));
  }

  retryStates(): readonly RuntimeRetryState[] {
    return Object.freeze([...this.retryState.values()].sort((a, b) => a.scheduleId.localeCompare(b.scheduleId)));
  }

  private executionWindows(schedules: readonly RuntimeScheduleRecord[]): readonly RuntimeExecutionWindowPolicy[] {
    return Object.freeze(
      schedules
        .map((schedule) => schedule.executionWindow)
        .sort((a, b) => a.windowId.localeCompare(b.windowId)),
    );
  }

  private schedule(scheduleId: string): RuntimeScheduleRecord {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      throw new Error(`GRT-SCH-MANAGER-002: Unknown schedule: ${scheduleId}`);
    }
    return schedule;
  }

  private plan(planId: string): RuntimePlanRecord {
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error(`GRT-SCH-MANAGER-003: Unknown plan: ${planId}`);
    }
    return plan;
  }

  private nextAttempt(scheduleId: string): number {
    const plannedAttempts = this.listPlans().filter((entry) => entry.scheduleId === scheduleId).map((entry) => entry.attempt);
    const retryAttempt = this.retryState.get(scheduleId)?.lastAttempt ?? 0;
    return Math.max(...plannedAttempts, retryAttempt, 0) + 1;
  }
}