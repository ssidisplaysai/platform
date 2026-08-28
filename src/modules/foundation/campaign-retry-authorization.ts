import { createCanonicalContentHash } from "./canonical-content-hash";
import type { CampaignTargetExecutionRecord } from "./campaign-execution";

export type MutationReconciliationState = "ABSENT" | "EXISTS_DRAFT" | "EXISTS_PUBLISHED" | "UNKNOWN";

export type CampaignMutationReconciliation = {
  targetId: string;
  originalOperation: CampaignTargetExecutionRecord["operation"];
  state: MutationReconciliationState;
  exactWordpressObjectId: string | null;
  exactTargetIdentityMatched: boolean;
  checkedAt: string;
};

export type CampaignTargetRetryAuthorization = {
  campaignId: string;
  executionPlanId: string;
  targetId: string;
  originalOperation: CampaignTargetExecutionRecord["operation"];
  originalAttempt: number;
  authorizedAttempt: number;
  failureClass: CampaignTargetExecutionRecord["failureClass"];
  mutationReconciliation: CampaignMutationReconciliation;
  authorizedOperation: CampaignTargetExecutionRecord["operation"];
  wordpressObjectId: string | null;
  authorizedBy: string;
  authorizedAt: string;
  fingerprint: string;
};

export type CampaignRetryEligibility =
  | "ELIGIBLE_FOR_EXPLICIT_REVIEWED_RETRY"
  | "NOT_ELIGIBLE";

export const MAX_REVIEWED_RETRY_ATTEMPTS_PER_TARGET = 1;

export class CampaignRetryAuthorizationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CampaignRetryAuthorizationError";
    this.code = code;
  }
}

function retrySemantic(
  input: Omit<CampaignTargetRetryAuthorization, "authorizedBy" | "authorizedAt" | "fingerprint">,
): unknown {
  return input;
}

function authorizationSemantic(
  authorization: CampaignTargetRetryAuthorization,
): Omit<CampaignTargetRetryAuthorization, "authorizedBy" | "authorizedAt" | "fingerprint"> {
  return {
    campaignId: authorization.campaignId,
    executionPlanId: authorization.executionPlanId,
    targetId: authorization.targetId,
    originalOperation: authorization.originalOperation,
    originalAttempt: authorization.originalAttempt,
    authorizedAttempt: authorization.authorizedAttempt,
    failureClass: authorization.failureClass,
    mutationReconciliation: authorization.mutationReconciliation,
    authorizedOperation: authorization.authorizedOperation,
    wordpressObjectId: authorization.wordpressObjectId,
  };
}

export function evaluateMutationReconciliation(input: {
  record: CampaignTargetExecutionRecord;
  state: MutationReconciliationState;
  exactWordpressObjectId: string | null;
  exactTargetIdentityMatched: boolean;
  checkedAt: string;
}): CampaignMutationReconciliation {
  if (input.record.operation === "EXACT_UPDATE"
    && input.exactWordpressObjectId !== input.record.wordpressObjectId) {
    throw new CampaignRetryAuthorizationError("EXACT_UPDATE_ID_MISMATCH", "UPDATE reconciliation must retain the same exact WordPress object ID.");
  }
  return {
    targetId: input.record.targetId,
    originalOperation: input.record.operation,
    state: input.state,
    exactWordpressObjectId: input.exactWordpressObjectId,
    exactTargetIdentityMatched: input.exactTargetIdentityMatched,
    checkedAt: input.checkedAt,
  };
}

export function createCampaignTargetRetryAuthorization(input: {
  record: CampaignTargetExecutionRecord;
  mutationReconciliation: CampaignMutationReconciliation;
  previousReviewedRetryCount?: number;
  authorizedBy: string;
  authorizedAt: string;
}): CampaignTargetRetryAuthorization {
  if (input.record.status === "SUCCEEDED") {
    throw new CampaignRetryAuthorizationError("SUCCESSFUL_TARGET_RETRY_PROHIBITED", "Successful targets cannot be retried.");
  }
  if (input.record.status !== "RETRY_REVIEW_REQUIRED" && input.record.status !== "FAILED") {
    throw new CampaignRetryAuthorizationError("RETRY_REVIEW_REQUIRED", "Target must require explicit retry review.");
  }
  if (input.previousReviewedRetryCount !== undefined
    && input.previousReviewedRetryCount !== input.record.reviewedRetryCount) {
    throw new CampaignRetryAuthorizationError("RETRY_COUNT_MISMATCH", "Reviewed retry count does not match durable execution state.");
  }
  if (input.record.reviewedRetryCount >= MAX_REVIEWED_RETRY_ATTEMPTS_PER_TARGET) {
    throw new CampaignRetryAuthorizationError("RETRY_LIMIT_EXCEEDED", "Reviewed retry limit has been reached.");
  }
  if (input.mutationReconciliation.targetId !== input.record.targetId
    || input.mutationReconciliation.originalOperation !== input.record.operation
    || !input.mutationReconciliation.exactTargetIdentityMatched) {
    throw new CampaignRetryAuthorizationError("RETRY_IDENTITY_MISMATCH", "Retry reconciliation does not match the exact target identity.");
  }
  if (input.record.operation === "CREATE" && input.mutationReconciliation.state !== "ABSENT") {
    throw new CampaignRetryAuthorizationError(
      input.mutationReconciliation.state === "EXISTS_PUBLISHED" ? "PUBLISHED_TARGET_BLOCKED" : "CREATE_RETRY_NOT_ABSENT",
      "CREATE retry requires authenticated exact absence.",
    );
  }
  if (input.record.operation === "EXACT_UPDATE"
    && (input.mutationReconciliation.state !== "EXISTS_DRAFT"
      || !input.mutationReconciliation.exactWordpressObjectId
      || input.mutationReconciliation.exactWordpressObjectId !== input.record.wordpressObjectId)) {
    throw new CampaignRetryAuthorizationError("EXACT_UPDATE_AUTHORITY_REQUIRED", "UPDATE retry requires the same exact draft WordPress object ID.");
  }
  const semantic = {
    campaignId: input.record.campaignId,
    executionPlanId: input.record.executionPlanId,
    targetId: input.record.targetId,
    originalOperation: input.record.operation,
    originalAttempt: input.record.attemptCount,
    authorizedAttempt: input.record.attemptCount + 1,
    failureClass: input.record.failureClass,
    mutationReconciliation: input.mutationReconciliation,
    authorizedOperation: input.record.operation,
    wordpressObjectId: input.record.operation === "EXACT_UPDATE" ? input.record.wordpressObjectId : null,
  };
  return {
    ...semantic,
    authorizedBy: input.authorizedBy,
    authorizedAt: input.authorizedAt,
    fingerprint: createCanonicalContentHash(retrySemantic(semantic)),
  };
}

export function prepareReviewedRetry(input: {
  record: CampaignTargetExecutionRecord;
  authorization: CampaignTargetRetryAuthorization;
}): CampaignTargetExecutionRecord {
  if (input.authorization.targetId !== input.record.targetId
    || input.authorization.originalAttempt !== input.record.attemptCount
    || input.authorization.authorizedOperation !== input.record.operation) {
    throw new CampaignRetryAuthorizationError("RETRY_IDENTITY_MISMATCH", "Retry authorization does not match the execution record.");
  }
  if (createCanonicalContentHash(retrySemantic(authorizationSemantic(input.authorization))) !== input.authorization.fingerprint) {
    throw new CampaignRetryAuthorizationError("RETRY_AUTHORIZATION_INVALID", "Retry authorization fingerprint is invalid.");
  }
  return {
    ...input.record,
    status: "PENDING",
    reviewedRetryCount: input.record.reviewedRetryCount + 1,
    idempotencyKey: `campaign-retry-${input.authorization.fingerprint.slice(0, 32)}`,
    failureClass: null,
    failureReason: null,
    requiresReview: false,
    terminalAt: null,
    version: input.record.version + 1,
  };
}

export function determineCampaignRetryEligibility(input: {
  record: CampaignTargetExecutionRecord;
  mutationReconciliation: CampaignMutationReconciliation;
}): CampaignRetryEligibility {
  const { record, mutationReconciliation } = input;
  if (record.status !== "RETRY_REVIEW_REQUIRED"
    || record.reviewedRetryCount >= MAX_REVIEWED_RETRY_ATTEMPTS_PER_TARGET
    || mutationReconciliation.targetId !== record.targetId
    || mutationReconciliation.originalOperation !== record.operation
    || !mutationReconciliation.exactTargetIdentityMatched) {
    return "NOT_ELIGIBLE";
  }
  if (record.operation === "CREATE") {
    return mutationReconciliation.state === "ABSENT" && !record.glwExternalExecutionId
      ? "ELIGIBLE_FOR_EXPLICIT_REVIEWED_RETRY"
      : "NOT_ELIGIBLE";
  }
  return mutationReconciliation.state === "EXISTS_DRAFT"
    && mutationReconciliation.exactWordpressObjectId === record.wordpressObjectId
    ? "ELIGIBLE_FOR_EXPLICIT_REVIEWED_RETRY"
    : "NOT_ELIGIBLE";
}