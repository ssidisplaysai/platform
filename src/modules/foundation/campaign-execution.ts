import type { GlwGenerationRequest } from "../glw/page-generation";
import type { GlwPageExecutionRecord } from "../glw/page-execution";
import type { CampaignApproval } from "./campaign-approval";
import { validateCampaignApproval } from "./campaign-approval";
import type { CampaignPlan, CampaignTargetPreflightResult } from "./campaign-plan";
import { createCanonicalContentHash } from "./canonical-content-hash";
import type { TargetMatrix } from "./target-matrix";

export type CampaignTargetExecutionStatus =
  | "PENDING"
  | "DISPATCHING"
  | "DISPATCHED"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "PAUSED"
  | "CANCELLED"
  | "RETRY_REVIEW_REQUIRED";

export type CampaignExecutionPlanStatus =
  | "APPROVED"
  | "EXECUTING"
  | "PAUSED"
  | "COMPLETE"
  | "FAILED"
  | "CANCELLED";

export type CampaignExecutionFailureClass =
  | "PRE_DISPATCH_VALIDATION"
  | "DISPATCH_REJECTED"
  | "DISPATCH_AMBIGUOUS"
  | "GLW_TERMINAL_FAILURE"
  | "QA_FAILURE"
  | "CALLBACK_FAILURE"
  | "INFRASTRUCTURE_FAILURE"
  | "PREFLIGHT_EXPIRED"
  | "APPROVAL_INVALID"
  | "TARGET_STATE_CHANGED";

export type CampaignExecutionPlan = {
  executionPlanId: string;
  campaignId: string;
  campaignFingerprint: string;
  approvalFingerprint: string;
  matrixFingerprint: string;
  targetIds: readonly string[];
  operations: Readonly<Record<string, "CREATE" | "EXACT_UPDATE">>;
  exactWordpressObjectIds: Readonly<Record<string, string>>;
  operationCounts: Readonly<Record<"CREATE" | "EXACT_UPDATE", number>>;
  concurrency: number;
  batchSize: number;
  dispatchPacingMs: number;
  publicationIntent: "draft";
  createdAt: string;
  status: CampaignExecutionPlanStatus;
  version: number;
};

export type CampaignTargetExecutionRecord = {
  campaignId: string;
  executionPlanId: string;
  targetId: string;
  pageBlueprintId: string;
  productId: string | null;
  stateCode: string | null;
  operation: "CREATE" | "EXACT_UPDATE";
  status: CampaignTargetExecutionStatus;
  attemptCount: number;
  reviewedRetryCount: number;
  glwJobId: string | null;
  glwExternalExecutionId: string | null;
  idempotencyKey: string;
  dispatchedAt: string | null;
  terminalAt: string | null;
  failureClass: CampaignExecutionFailureClass | null;
  failureReason: string | null;
  requiresReview: boolean;
  resultReference: string | null;
  wordpressObjectId: string | null;
  wordpressUrl: string | null;
  wordpressStatus: string | null;
  qaStatus: string | null;
  qaChecks: Readonly<Record<string, unknown>> | null;
  qaFailureReasons: Readonly<Record<string, unknown>> | null;
  featuredImagePresent: boolean | null;
  version: number;
};

export type CampaignExecutionSummary = {
  approved: number;
  pending: number;
  dispatching: number;
  dispatched: number;
  running: number;
  succeeded: number;
  failed: number;
  reviewRequired: number;
  paused: number;
  cancelled: number;
  createSuccessCount: number;
  exactUpdateSuccessCount: number;
  completedCount: number;
  remainingCount: number;
  successPercent: number;
  failurePercent: number;
  byOperation: Readonly<Record<string, number>>;
  byBlueprint: Readonly<Record<string, number>>;
  byProduct: Readonly<Record<string, number>>;
  byState: Readonly<Record<string, number>>;
};

export const CAMPAIGN_EXECUTION_LIMITS = {
  maximumConcurrency: 2,
  batchSize: 20,
  dispatchPacingMs: 5_000,
  maximumConsecutiveInfrastructureFailures: 3,
  failureRateWindow: 10,
  failureRateThreshold: 0.5,
} as const;

export class CampaignExecutionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CampaignExecutionError";
    this.code = code;
  }
}

export class CampaignDispatchRejectedError extends Error {}

export function createExecutionIdempotencyKey(input: {
  campaignFingerprint: string;
  approvalFingerprint: string;
  targetId: string;
  operation: "CREATE" | "EXACT_UPDATE";
}): string {
  return `campaign-dispatch-${createCanonicalContentHash(input).slice(0, 32)}`;
}

export function createCampaignExecutionPlan(input: {
  campaign: CampaignPlan;
  approval: CampaignApproval;
  now: string;
  concurrency?: number;
  batchSize?: number;
  dispatchPacingMs?: number;
}): CampaignExecutionPlan {
  validateCampaignApproval({ campaign: input.campaign, approval: input.approval, now: input.now });
  const concurrency = input.concurrency ?? CAMPAIGN_EXECUTION_LIMITS.maximumConcurrency;
  const batchSize = input.batchSize ?? CAMPAIGN_EXECUTION_LIMITS.batchSize;
  const dispatchPacingMs = input.dispatchPacingMs ?? CAMPAIGN_EXECUTION_LIMITS.dispatchPacingMs;
  if (concurrency < 1 || concurrency > CAMPAIGN_EXECUTION_LIMITS.maximumConcurrency) {
    throw new CampaignExecutionError("CONCURRENCY_LIMIT_EXCEEDED", "Execution concurrency exceeds the hard safety limit.");
  }
  if (batchSize < 1 || batchSize > CAMPAIGN_EXECUTION_LIMITS.batchSize) {
    throw new CampaignExecutionError("BATCH_LIMIT_EXCEEDED", "Execution batch size exceeds the hard safety limit.");
  }
  if (dispatchPacingMs < 0) throw new CampaignExecutionError("INVALID_DISPATCH_PACING", "Dispatch pacing cannot be negative.");
  const semantic = {
    campaignFingerprint: input.campaign.fingerprint,
    approvalFingerprint: input.approval.approvalFingerprint,
    targetIds: input.approval.approvedTargetIds,
    operations: Object.entries(input.approval.approvedOperations).sort(([left], [right]) => left.localeCompare(right)),
    exactWordpressObjectIds: input.campaign.preflightResults
      .filter((result) => input.approval.approvedTargetIds.includes(result.targetId) && result.wordpressObjectId)
      .map((result) => [result.targetId, result.wordpressObjectId] as const)
      .sort(([left], [right]) => left.localeCompare(right)),
    concurrency,
    batchSize,
    dispatchPacingMs,
    publicationIntent: "draft",
  };
  const fingerprint = createCanonicalContentHash(semantic);
  const exactWordpressObjectIds = Object.fromEntries(
    input.campaign.preflightResults
      .filter((result) => input.approval.approvedTargetIds.includes(result.targetId) && result.wordpressObjectId)
      .map((result) => [result.targetId, result.wordpressObjectId]),
  ) as Record<string, string>;
  return {
    executionPlanId: `campaign-execution-${fingerprint.slice(0, 24)}`,
    campaignId: input.campaign.campaignId,
    campaignFingerprint: input.campaign.fingerprint,
    approvalFingerprint: input.approval.approvalFingerprint,
    matrixFingerprint: input.campaign.matrixFingerprint,
    targetIds: [...input.approval.approvedTargetIds],
    operations: { ...input.approval.approvedOperations },
    exactWordpressObjectIds,
    operationCounts: { ...input.approval.approvedOperationCounts },
    concurrency,
    batchSize,
    dispatchPacingMs,
    publicationIntent: "draft",
    createdAt: input.now,
    status: "APPROVED",
    version: 1,
  };
}

export function createCampaignTargetExecutionRecords(input: {
  plan: CampaignExecutionPlan;
  matrix: TargetMatrix;
}): readonly CampaignTargetExecutionRecord[] {
  if (input.matrix.fingerprint !== input.plan.matrixFingerprint) {
    throw new CampaignExecutionError("APPROVAL_SCOPE_MISMATCH", "Execution plan matrix fingerprint does not match.");
  }
  const targets = new Map(input.matrix.targets.map((target) => [target.targetId, target]));
  return input.plan.targetIds.map((targetId) => {
    const target = targets.get(targetId);
    const operation = input.plan.operations[targetId];
    if (!target || !operation) throw new CampaignExecutionError("APPROVAL_SCOPE_MISMATCH", `Approved target is missing from matrix: ${targetId}`);
    return {
      campaignId: input.plan.campaignId,
      executionPlanId: input.plan.executionPlanId,
      targetId,
      pageBlueprintId: target.pageBlueprintId,
      productId: target.subject.productId,
      stateCode: target.geography.stateCode,
      operation,
      status: "PENDING",
      attemptCount: 0,
      reviewedRetryCount: 0,
      glwJobId: null,
      glwExternalExecutionId: null,
      idempotencyKey: createExecutionIdempotencyKey({
        campaignFingerprint: input.plan.campaignFingerprint,
        approvalFingerprint: input.plan.approvalFingerprint,
        targetId,
        operation,
      }),
      dispatchedAt: null,
      terminalAt: null,
      failureClass: null,
      failureReason: null,
      requiresReview: false,
      resultReference: null,
      wordpressObjectId: operation === "EXACT_UPDATE" ? input.plan.exactWordpressObjectIds[targetId] ?? null : null,
      wordpressUrl: null,
      wordpressStatus: null,
      qaStatus: null,
      qaChecks: null,
      qaFailureReasons: null,
      featuredImagePresent: null,
      version: 1,
    };
  });
}

function preflightByTarget(campaign: CampaignPlan): Map<string, CampaignTargetPreflightResult> {
  return new Map(campaign.preflightResults.map((result) => [result.targetId, result]));
}

export function projectApprovedTargetToGlwRequest(input: {
  campaign: CampaignPlan;
  approval: CampaignApproval;
  plan: CampaignExecutionPlan;
  matrix: TargetMatrix;
  targetId: string;
  now: string;
}): GlwGenerationRequest {
  validateCampaignApproval({
    campaign: input.campaign,
    approval: input.approval,
    now: input.now,
    targetIds: [input.targetId],
  });
  if (!input.plan.targetIds.includes(input.targetId)) throw new CampaignExecutionError("APPROVAL_SCOPE_MISMATCH", "Target is outside the approved execution subset.");
  const target = input.matrix.targets.find((candidate) => candidate.targetId === input.targetId);
  const preflight = preflightByTarget(input.campaign).get(input.targetId);
  const operation = input.plan.operations[input.targetId];
  if (!target || !preflight || input.matrix.fingerprint !== input.plan.matrixFingerprint) {
    throw new CampaignExecutionError("APPROVAL_SCOPE_MISMATCH", "Execution target scope does not match the approved campaign.");
  }
  if (operation === "CREATE" && !(preflight.targetState === "ABSENT" && preflight.eligibility === "ELIGIBLE_CREATE")) {
    throw new CampaignExecutionError("TARGET_STATE_CHANGED", "CREATE authority is no longer exact absent.");
  }
  if (operation === "EXACT_UPDATE" && !(preflight.targetState === "EXISTS_DRAFT"
    && preflight.eligibility === "ELIGIBLE_UPDATE"
    && preflight.wordpressObjectId)) {
    throw new CampaignExecutionError("TARGET_STATE_CHANGED", "EXACT_UPDATE requires an exact draft WordPress object ID.");
  }
  const pageType: GlwGenerationRequest["pageType"] = target.geography.cityKey
    ? "city_service"
    : target.geography.stateCode
      ? "state_service"
      : "general_service";
  const suffix = pageType === "city_service" ? "CITY" : pageType === "state_service" ? "STATE" : "GENERAL";
  const productTopic = target.canonicalDimensions.find((dimension) => dimension.dimensionType === "PRODUCT")?.displayValue
    ?? target.subject.productId
    ?? target.targetId;
  const stateName = target.canonicalDimensions.find((dimension) => dimension.dimensionType === "STATE")?.displayValue
    ?? target.geography.stateCode;
  const location = target.geography.cityName ?? stateName;
  const title = location ? `${productTopic} in ${location}` : productTopic;
  return {
    siteId: target.siteId,
    productId: target.subject.productId ?? "",
    pageType,
    stateCode: target.geography.stateCode ?? "",
    citySlug: pageType === "city_service" ? target.canonicalSlug : "",
    slug: target.applicationPath,
    title,
    seoTitle: title,
    metaDescription: `Draft content for ${title}.`.slice(0, 160),
    publicationIntent: "draft",
    organizationId: target.organizationId,
    siteName: target.siteId,
    productTopic,
    stateName,
    cityName: target.geography.cityName,
    canonicalPath: target.applicationPath,
    plannedOperation: `${operation === "CREATE" ? "CREATE" : "UPDATE"}_${suffix}`,
    wordpressObjectId: operation === "EXACT_UPDATE" ? preflight.wordpressObjectId : null,
    externalExecutionAllowed: false,
  };
}

export function projectGlwTerminalExecution(input: {
  record: CampaignTargetExecutionRecord;
  glw: GlwPageExecutionRecord;
  now: string;
}): CampaignTargetExecutionRecord {
  const base = {
    ...input.record,
    glwJobId: input.glw.jobId,
    glwExternalExecutionId: input.glw.externalExecutionId,
    attemptCount: input.record.attemptCount + 1,
    dispatchedAt: input.glw.dispatchedAt ?? input.record.dispatchedAt,
    resultReference: `glw-job:${input.glw.jobId}`,
    version: input.record.version + 1,
  };
  if (input.glw.status === "COMPLETE"
    && input.glw.qaStatus === "COMPLETE"
    && input.glw.wordpressStatus === "draft"
    && input.glw.wordpressObjectId) {
    return {
      ...base,
      status: "SUCCEEDED",
      terminalAt: input.glw.completedAt ?? input.now,
      failureClass: null,
      failureReason: null,
      requiresReview: false,
      wordpressObjectId: input.glw.wordpressObjectId,
      wordpressUrl: input.glw.wordpressUrl,
      wordpressStatus: input.glw.wordpressStatus,
      qaStatus: input.glw.qaStatus,
      qaChecks: input.glw.qaChecks,
      qaFailureReasons: input.glw.qaFailureReasons,
      featuredImagePresent: input.glw.featuredImagePresent,
    };
  }
  if (input.glw.status === "FAILED") {
    return {
      ...base,
      status: "RETRY_REVIEW_REQUIRED",
      terminalAt: input.glw.completedAt ?? input.now,
      failureClass: input.glw.errorCode === "FAILED_QA" ? "QA_FAILURE" : "GLW_TERMINAL_FAILURE",
      failureReason: input.glw.errorMessage ?? input.glw.errorCode ?? "GLW execution failed.",
      requiresReview: true,
      wordpressObjectId: input.glw.wordpressObjectId,
      wordpressUrl: input.glw.wordpressUrl,
      wordpressStatus: input.glw.wordpressStatus,
      qaStatus: input.glw.qaStatus,
      qaChecks: input.glw.qaChecks,
      qaFailureReasons: input.glw.qaFailureReasons,
      featuredImagePresent: input.glw.featuredImagePresent,
    };
  }
  return {
    ...base,
    status: input.glw.status === "RUNNING" ? "RUNNING" : "DISPATCHED",
    terminalAt: null,
    failureClass: null,
    failureReason: null,
    requiresReview: false,
    wordpressObjectId: input.glw.wordpressObjectId,
    wordpressUrl: input.glw.wordpressUrl,
    wordpressStatus: input.glw.wordpressStatus,
    qaStatus: input.glw.qaStatus,
    qaChecks: input.glw.qaChecks,
    qaFailureReasons: input.glw.qaFailureReasons,
    featuredImagePresent: input.glw.featuredImagePresent,
  };
}

function countBy(records: readonly CampaignTargetExecutionRecord[], key: (record: CampaignTargetExecutionRecord) => string | null): Record<string, number> {
  return records.reduce<Record<string, number>>((counts, record) => {
    const value = key(record);
    if (value) counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

export function summarizeCampaignExecution(
  records: readonly CampaignTargetExecutionRecord[],
): CampaignExecutionSummary {
  const count = (status: CampaignTargetExecutionStatus): number => records.filter((record) => record.status === status).length;
  const succeeded = count("SUCCEEDED");
  const failed = count("FAILED");
  const reviewRequired = count("RETRY_REVIEW_REQUIRED");
  const cancelled = count("CANCELLED");
  const completedCount = succeeded + failed + reviewRequired + cancelled;
  return {
    approved: records.length,
    pending: count("PENDING"),
    dispatching: count("DISPATCHING"),
    dispatched: count("DISPATCHED"),
    running: count("RUNNING"),
    succeeded,
    failed,
    reviewRequired,
    paused: count("PAUSED"),
    cancelled,
    createSuccessCount: records.filter((record) => record.status === "SUCCEEDED" && record.operation === "CREATE").length,
    exactUpdateSuccessCount: records.filter((record) => record.status === "SUCCEEDED" && record.operation === "EXACT_UPDATE").length,
    completedCount,
    remainingCount: records.length - completedCount,
    successPercent: records.length ? Number(((succeeded / records.length) * 100).toFixed(2)) : 0,
    failurePercent: records.length ? Number((((failed + reviewRequired) / records.length) * 100).toFixed(2)) : 0,
    byOperation: countBy(records, (record) => record.operation),
    byBlueprint: countBy(records, (record) => record.pageBlueprintId),
    byProduct: countBy(records, (record) => record.productId),
    byState: countBy(records, (record) => record.stateCode),
  };
}