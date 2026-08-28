import type { GlwGenerationRequest } from "../glw/page-generation";
import type { GlwPageExecutionRecord } from "../glw/page-execution";
import type { CampaignApproval } from "./campaign-approval";
import { validateCampaignApproval } from "./campaign-approval";
import type { CampaignPlan } from "./campaign-plan";
import type { CampaignTargetPreflightResult } from "./campaign-plan";
import {
  CAMPAIGN_EXECUTION_LIMITS,
  CampaignDispatchRejectedError,
  CampaignExecutionError,
  createCampaignTargetExecutionRecords,
  projectApprovedTargetToGlwRequest,
  projectGlwTerminalExecution,
  summarizeCampaignExecution,
  type CampaignExecutionPlan,
  type CampaignExecutionSummary,
  type CampaignTargetExecutionRecord,
} from "./campaign-execution";
import {
  checkpointCampaignExecution,
  createCampaignExecutionRecordSet,
  getCampaignExecutionPlanRecord,
  getCampaignExecutionPersistenceReplacementCount,
  getCampaignExecutionRuntimeState,
  listCampaignTargetExecutionRecords,
  pauseCampaignExecution,
  prepareCampaignExecutionBatch,
} from "./campaign-execution-repository";
import type { TargetMatrix } from "./target-matrix";

export type CampaignGlwDispatcher = (input: {
  request: GlwGenerationRequest;
  idempotencyKey: string;
  campaignId: string;
  executionPlanId: string;
  targetId: string;
}) => Promise<GlwPageExecutionRecord>;

export type CampaignExecutionMetrics = {
  approvedCount: number;
  dispatchedCount: number;
  observedMaximumInFlight: number;
  duplicateDispatchCount: number;
  persistenceReplacementCount: number;
  circuitBreakerTripped: boolean;
  dispatchPacing: readonly CampaignDispatchPacingObservation[];
};

export type CampaignDispatchPacingObservation = {
  targetId: string;
  dispatchEligibleAt: number;
  dispatchReservedAt: number;
  dispatchInvokedAt: number;
  dispatchPacingDelayMs: number;
};

export type CampaignExecutionRun = {
  plan: CampaignExecutionPlan;
  records: readonly CampaignTargetExecutionRecord[];
  summary: CampaignExecutionSummary;
  metrics: CampaignExecutionMetrics;
};

function failureRecord(input: {
  record: CampaignTargetExecutionRecord;
  failureClass: CampaignTargetExecutionRecord["failureClass"];
  reason: string;
  requiresReview: boolean;
  dispatched: boolean;
  now: string;
}): CampaignTargetExecutionRecord {
  return {
    ...input.record,
    status: input.requiresReview ? "RETRY_REVIEW_REQUIRED" : "FAILED",
    attemptCount: input.record.attemptCount + (input.dispatched ? 1 : 0),
    terminalAt: input.now,
    failureClass: input.failureClass,
    failureReason: input.reason.slice(0, 500),
    requiresReview: input.requiresReview,
    version: input.record.version + 1,
  };
}

function isInfrastructureFailure(record: CampaignTargetExecutionRecord): boolean {
  return record.failureClass === "INFRASTRUCTURE_FAILURE"
    || record.failureClass === "DISPATCH_AMBIGUOUS"
    || record.failureClass === "CALLBACK_FAILURE";
}

function planStatus(records: readonly CampaignTargetExecutionRecord[], paused: boolean): CampaignExecutionPlan["status"] {
  if (paused || records.some((record) => record.status === "PENDING" || record.status === "PAUSED")) return "PAUSED";
  if (records.some((record) => record.status === "DISPATCHED" || record.status === "RUNNING" || record.status === "DISPATCHING")) return "EXECUTING";
  if (records.some((record) => record.status === "FAILED" || record.status === "RETRY_REVIEW_REQUIRED")) return "FAILED";
  return "COMPLETE";
}

export async function executeApprovedCampaign(input: {
  campaign: CampaignPlan;
  approval: CampaignApproval;
  plan: CampaignExecutionPlan;
  matrix: TargetMatrix;
  dispatcher: CampaignGlwDispatcher;
  now?: () => string;
  monotonicNow?: () => number;
  delay?: (milliseconds: number) => Promise<void>;
  shouldPause?: () => boolean;
  refreshTargetPreflight?: (input: {
    targetId: string;
  }) => Promise<CampaignTargetPreflightResult>;
}): Promise<CampaignExecutionRun> {
  const now = input.now ?? (() => new Date().toISOString());
  const monotonicNow = input.monotonicNow ?? (() => performance.now());
  const delay = input.delay ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  validateCampaignApproval({ campaign: input.campaign, approval: input.approval, now: now(), targetIds: [] });
  if (input.plan.approvalFingerprint !== input.approval.approvalFingerprint
    || input.plan.campaignFingerprint !== input.campaign.fingerprint
    || input.plan.matrixFingerprint !== input.matrix.fingerprint
    || input.plan.publicationIntent !== "draft") {
    throw new CampaignExecutionError("APPROVAL_SCOPE_MISMATCH", "Execution plan does not match campaign approval scope.");
  }
  if (input.plan.concurrency > CAMPAIGN_EXECUTION_LIMITS.maximumConcurrency) {
    throw new CampaignExecutionError("CONCURRENCY_LIMIT_EXCEEDED", "Execution plan exceeds the hard concurrency limit.");
  }
  const initialRecords = createCampaignTargetExecutionRecords({ plan: input.plan, matrix: input.matrix });
  createCampaignExecutionRecordSet({ approval: input.approval, plan: input.plan, records: initialRecords });
  let records = listCampaignTargetExecutionRecords(input.plan.executionPlanId);
  const persistedPlanAtStart = getCampaignExecutionPlanRecord(input.plan.executionPlanId)!;
  const persistedRuntimeAtStart = getCampaignExecutionRuntimeState(input.plan.executionPlanId);
  if (persistedRuntimeAtStart?.circuitState === "OPEN") {
    throw new CampaignExecutionError("CIRCUIT_RECOVERY_REQUIRED", "Open circuit requires explicit recovery before execution may resume.");
  }
  if (persistedPlanAtStart.status === "PAUSED") {
    throw new CampaignExecutionError("EXPLICIT_RESUME_REQUIRED", "Paused execution requires an explicit resume action.");
  }
  validateCampaignApproval({
    campaign: input.campaign,
    approval: input.approval,
    now: now(),
    targetIds: records.filter((record) => record.status === "PENDING").map((record) => record.targetId),
  });
  const beforeReplacements = getCampaignExecutionPersistenceReplacementCount();
  const dispatchedKeys = new Set(records.filter((record) => record.status !== "PENDING").map((record) => record.idempotencyKey));
  let duplicateDispatchCount = 0;
  let dispatchedCount = 0;
  let inFlight = 0;
  let observedMaximumInFlight = 0;
  let consecutiveInfrastructureFailures = 0;
  const failureWindow: boolean[] = [];
  let circuitBreakerTripped = false;
  let paused = false;
  let lastDispatchInvokedAt: number | null = null;
  let dispatchInitiationQueue = Promise.resolve();
  const dispatchPacing: CampaignDispatchPacingObservation[] = [];

  const waitForDispatchSlot = async (reservedAt: number): Promise<void> => {
    let remainingMs = reservedAt - monotonicNow();
    while (remainingMs > 0) {
      await delay(remainingMs);
      remainingMs = reservedAt - monotonicNow();
    }
  };

  const withDispatchInitiationLock = async <T>(operation: () => Promise<T>): Promise<T> => {
    const previous = dispatchInitiationQueue;
    let release!: () => void;
    dispatchInitiationQueue = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  };

  const targetById = new Map(input.matrix.targets.map((target) => [target.targetId, target]));
  const dispatchRecord = async (record: CampaignTargetExecutionRecord): Promise<CampaignTargetExecutionRecord> => {
    if (input.shouldPause?.() || circuitBreakerTripped) {
      paused = true;
      return record;
    }
    if (record.status !== "PENDING") return record;
    if (dispatchedKeys.has(record.idempotencyKey)) {
      duplicateDispatchCount += 1;
      return record;
    }
    if (!targetById.has(record.targetId)) {
      return failureRecord({
        record,
        failureClass: "PRE_DISPATCH_VALIDATION",
        reason: "Approved target failed final dispatch validation.",
        requiresReview: false,
        dispatched: false,
        now: now(),
      });
    }
    const dispatchEligibleAt = monotonicNow();
    const initiation = await withDispatchInitiationLock(async () => {
      const dispatchReservedAt = lastDispatchInvokedAt === null
        ? monotonicNow()
        : Math.max(monotonicNow(), lastDispatchInvokedAt + input.plan.dispatchPacingMs);
      if (dispatchReservedAt > monotonicNow()) await waitForDispatchSlot(dispatchReservedAt);
      if (input.shouldPause?.() || circuitBreakerTripped) {
        paused = true;
        return { kind: "SKIPPED" as const, record };
      }
      try {
        const refreshed = input.refreshTargetPreflight
          ? await input.refreshTargetPreflight({ targetId: record.targetId })
          : null;
        const dispatchCampaign = refreshed
          ? {
              ...input.campaign,
              preflightResults: input.campaign.preflightResults.map((result) =>
                result.targetId === record.targetId ? refreshed : result),
            }
          : input.campaign;
        validateCampaignApproval({
          campaign: dispatchCampaign,
          approval: input.approval,
          now: now(),
          targetIds: [record.targetId],
        });
        const request = projectApprovedTargetToGlwRequest({
          campaign: dispatchCampaign,
          approval: input.approval,
          plan: input.plan,
          matrix: input.matrix,
          targetId: record.targetId,
          now: now(),
        });
        if (request.publicationIntent !== "draft") {
          throw new CampaignExecutionError("PRE_DISPATCH_VALIDATION", "Approved target failed final dispatch validation.");
        }
        if (input.shouldPause?.() || circuitBreakerTripped) {
          paused = true;
          return { kind: "SKIPPED" as const, record };
        }
        const dispatchInvokedAt = monotonicNow();
        lastDispatchInvokedAt = dispatchInvokedAt;
        dispatchPacing.push({
          targetId: record.targetId,
          dispatchEligibleAt,
          dispatchReservedAt,
          dispatchInvokedAt,
          dispatchPacingDelayMs: dispatchInvokedAt - dispatchEligibleAt,
        });
        dispatchedKeys.add(record.idempotencyKey);
        dispatchedCount += 1;
        inFlight += 1;
        observedMaximumInFlight = Math.max(observedMaximumInFlight, inFlight);
        let dispatchPromise: Promise<GlwPageExecutionRecord>;
        try {
          dispatchPromise = input.dispatcher({
            request,
            idempotencyKey: record.idempotencyKey,
            campaignId: record.campaignId,
            executionPlanId: record.executionPlanId,
            targetId: record.targetId,
          });
        } catch (error) {
          dispatchPromise = Promise.reject(error);
        }
        return { kind: "DISPATCHED" as const, dispatchPromise };
      } catch (error) {
        return {
          kind: "FAILED_SAFETY" as const,
          record: failureRecord({
            record,
            failureClass: error instanceof CampaignExecutionError && error.code === "TARGET_STATE_CHANGED"
              ? "TARGET_STATE_CHANGED"
              : "PREFLIGHT_EXPIRED",
            reason: error instanceof Error ? error.message : "Final pre-dispatch safety validation failed.",
            requiresReview: false,
            dispatched: false,
            now: now(),
          }),
        };
      }
    });
    if (initiation.kind !== "DISPATCHED") return initiation.record;
    try {
      const glw = await initiation.dispatchPromise;
      return projectGlwTerminalExecution({ record, glw, now: now() });
    } catch (error) {
      if (error instanceof CampaignDispatchRejectedError) {
        return failureRecord({
          record,
          failureClass: "DISPATCH_REJECTED",
          reason: error.message,
          requiresReview: false,
          dispatched: true,
          now: now(),
        });
      }
      return failureRecord({
        record,
        failureClass: "DISPATCH_AMBIGUOUS",
        reason: error instanceof Error ? error.message : "Dispatch acknowledgement was ambiguous.",
        requiresReview: true,
        dispatched: true,
        now: now(),
      });
    } finally {
      inFlight -= 1;
    }
  };

  const pending = records.filter((record) => record.status === "PENDING");
  for (let offset = 0; offset < pending.length; offset += input.plan.batchSize) {
    if (input.shouldPause?.() || circuitBreakerTripped) {
      paused = true;
      break;
    }
    const batch = pending.slice(offset, offset + input.plan.batchSize);
    prepareCampaignExecutionBatch({
      executionPlanId: input.plan.executionPlanId,
      targetIds: batch.map((record) => record.targetId),
      now: now(),
    });
    let nextIndex = 0;
    const completed: CampaignTargetExecutionRecord[] = [];
    const worker = async (): Promise<void> => {
      while (nextIndex < batch.length && !circuitBreakerTripped && !input.shouldPause?.()) {
        const record = batch[nextIndex];
        nextIndex += 1;
        const result = await dispatchRecord(record);
        completed.push(result);
        const infrastructureFailure = isInfrastructureFailure(result);
        consecutiveInfrastructureFailures = infrastructureFailure ? consecutiveInfrastructureFailures + 1 : 0;
        failureWindow.push(infrastructureFailure);
        if (failureWindow.length > CAMPAIGN_EXECUTION_LIMITS.failureRateWindow) failureWindow.shift();
        const failureRate = failureWindow.filter(Boolean).length / failureWindow.length;
        if (consecutiveInfrastructureFailures >= CAMPAIGN_EXECUTION_LIMITS.maximumConsecutiveInfrastructureFailures
          || (failureWindow.length === CAMPAIGN_EXECUTION_LIMITS.failureRateWindow
            && failureRate >= CAMPAIGN_EXECUTION_LIMITS.failureRateThreshold)) {
          circuitBreakerTripped = true;
          paused = true;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(input.plan.concurrency, batch.length) }, () => worker()));
    if (input.shouldPause?.()) paused = true;
    const completedTargetIds = new Set(completed.map((record) => record.targetId));
    const unacquired = batch
      .filter((record) => !completedTargetIds.has(record.targetId))
      .map((record) => ({
        ...record,
        status: "PENDING" as const,
        dispatchedAt: null,
      }));
    const byTarget = new Map(records.map((record) => [record.targetId, record]));
    completed.forEach((record) => byTarget.set(record.targetId, record));
    unacquired.forEach((record) => byTarget.set(record.targetId, record));
    records = [...byTarget.values()].sort((left, right) => left.targetId.localeCompare(right.targetId));
    const checkpoint = checkpointCampaignExecution({
      executionPlanId: input.plan.executionPlanId,
      planStatus: planStatus(records, paused),
      records: [...completed, ...unacquired],
      runtimeState: {
        circuitState: circuitBreakerTripped ? "OPEN" : "CLOSED",
        consecutiveInfrastructureFailures,
        failureWindow,
        pauseReason: circuitBreakerTripped ? "CIRCUIT_BREAKER" : paused ? "OPERATOR_PAUSE" : null,
        updatedAt: now(),
      },
    });
    records = checkpoint.records;
    if (paused) break;
  }
  if (paused) pauseCampaignExecution(input.plan.executionPlanId);
  const persistedPlan = getCampaignExecutionPlanRecord(input.plan.executionPlanId)!;
  return {
    plan: persistedPlan,
    records: listCampaignTargetExecutionRecords(input.plan.executionPlanId),
    summary: summarizeCampaignExecution(listCampaignTargetExecutionRecords(input.plan.executionPlanId)),
    metrics: {
      approvedCount: input.plan.targetIds.length,
      dispatchedCount,
      observedMaximumInFlight,
      duplicateDispatchCount,
      persistenceReplacementCount: getCampaignExecutionPersistenceReplacementCount() - beforeReplacements,
      circuitBreakerTripped,
      dispatchPacing,
    },
  };
}

export function createExistingGlwCampaignDispatcher(service: {
  execute(request: GlwGenerationRequest): Promise<GlwPageExecutionRecord>;
}): CampaignGlwDispatcher {
  return async ({ request }) => service.execute(request);
}