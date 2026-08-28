import type { GlwGenerationRequest } from "../glw/page-generation";
import type { GlwPageExecutionRecord } from "../glw/page-execution";
import type { CampaignApproval } from "./campaign-approval";
import { validateCampaignApproval } from "./campaign-approval";
import type { CampaignPlan } from "./campaign-plan";
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
  listCampaignTargetExecutionRecords,
  pauseCampaignExecution,
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
  delay?: (milliseconds: number) => Promise<void>;
  shouldPause?: () => boolean;
}): Promise<CampaignExecutionRun> {
  const now = input.now ?? (() => new Date().toISOString());
  const delay = input.delay ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  validateCampaignApproval({ campaign: input.campaign, approval: input.approval, now: now() });
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
  const beforeReplacements = getCampaignExecutionPersistenceReplacementCount();
  const dispatchedKeys = new Set(records.filter((record) => record.attemptCount > 0).map((record) => record.idempotencyKey));
  let duplicateDispatchCount = 0;
  let dispatchedCount = 0;
  let inFlight = 0;
  let observedMaximumInFlight = 0;
  let consecutiveInfrastructureFailures = 0;
  const failureWindow: boolean[] = [];
  let circuitBreakerTripped = false;
  let paused = false;
  let nextDispatchAt = 0;

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
    let request: GlwGenerationRequest;
    try {
      request = projectApprovedTargetToGlwRequest({
        campaign: input.campaign,
        approval: input.approval,
        plan: input.plan,
        matrix: input.matrix,
        targetId: record.targetId,
        now: now(),
      });
      if (!targetById.has(record.targetId) || request.publicationIntent !== "draft") {
        throw new CampaignExecutionError("PRE_DISPATCH_VALIDATION", "Approved target failed final dispatch validation.");
      }
    } catch (error) {
      return failureRecord({
        record,
        failureClass: error instanceof CampaignExecutionError && error.code === "PREFLIGHT_REFRESH_REQUIRED"
          ? "PREFLIGHT_EXPIRED"
          : "PRE_DISPATCH_VALIDATION",
        reason: error instanceof Error ? error.message : "Pre-dispatch validation failed.",
        requiresReview: false,
        dispatched: false,
        now: now(),
      });
    }
    const currentTime = Date.now();
    const waitMs = Math.max(0, nextDispatchAt - currentTime);
    nextDispatchAt = Math.max(nextDispatchAt, currentTime) + input.plan.dispatchPacingMs;
    if (waitMs > 0) await delay(waitMs);
    if (input.shouldPause?.() || circuitBreakerTripped) {
      paused = true;
      return record;
    }
    dispatchedKeys.add(record.idempotencyKey);
    dispatchedCount += 1;
    inFlight += 1;
    observedMaximumInFlight = Math.max(observedMaximumInFlight, inFlight);
    try {
      const glw = await input.dispatcher({
        request,
        idempotencyKey: record.idempotencyKey,
        campaignId: record.campaignId,
        executionPlanId: record.executionPlanId,
        targetId: record.targetId,
      });
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
    const byTarget = new Map(records.map((record) => [record.targetId, record]));
    completed.forEach((record) => byTarget.set(record.targetId, record));
    records = [...byTarget.values()].sort((left, right) => left.targetId.localeCompare(right.targetId));
    const checkpoint = checkpointCampaignExecution({
      executionPlanId: input.plan.executionPlanId,
      planStatus: planStatus(records, paused),
      records: completed,
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
    },
  };
}

export function createExistingGlwCampaignDispatcher(service: {
  execute(request: GlwGenerationRequest): Promise<GlwPageExecutionRecord>;
}): CampaignGlwDispatcher {
  return async ({ request }) => service.execute(request);
}