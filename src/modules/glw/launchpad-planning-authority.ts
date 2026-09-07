import type { GlwPageExecutionRecord } from "./page-execution";
import type { GlwPlannedPage } from "./matrix-planner";
import type { GlwTargetPreflightResult } from "./target-preflight";

export type GlwExecutionOwnershipClassification =
  | "NO_EXECUTION"
  | "ACTIVE_EXECUTION"
  | "COMPLETED_EXECUTION"
  | "FAILED_EXECUTION"
  | "UNRECONCILED"
  | "UNKNOWN";

export type GlwCampaignOwnershipClassification =
  | "AVAILABLE"
  | "OWNED_BY_ACTIVE_CAMPAIGN"
  | "OWNED_BY_COMPLETED_CAMPAIGN"
  | "UNRECONCILED"
  | "UNKNOWN";

export type GlwCannibalizationClassification =
  | "CLEAR"
  | "EXACT_CANONICAL_EXISTS"
  | "PARENT_CHILD_CONFLICT"
  | "SAME_PRODUCT_GEO_CONFLICT"
  | "EXISTING_INTENT_OWNER"
  | "AMBIGUOUS"
  | "UNAVAILABLE";

export type GlwExecutionAuthority =
  | { status: "CHECKED"; records: readonly GlwPageExecutionRecord[] }
  | { status: "UNAVAILABLE" };

export type GlwCampaignOwnershipAssessment = {
  classification: GlwCampaignOwnershipClassification;
  campaignId: string | null;
  campaignState: string | null;
  targetState: string | null;
  reason: string;
  authoritySource: "CAMPAIGN_PERSISTENCE";
};

export type GlwCampaignAuthority =
  | { status: "CHECKED"; targets: Readonly<Record<string, GlwCampaignOwnershipAssessment>> }
  | { status: "UNAVAILABLE" };

export type GlwIntentAuthority =
  | { status: "CHECKED_CLEAR" }
  | { status: "UNAVAILABLE" };

export type GlwExecutionOwnershipAssessment = {
  classification: GlwExecutionOwnershipClassification;
  jobId: string | null;
  executionId: string | null;
  executionState: string | null;
  reason: string;
  authoritySource: "GLW_PAGE_EXECUTION_JOURNAL";
};

export type GlwCannibalizationAssessment = {
  classification: GlwCannibalizationClassification;
  existingOwner: string | null;
  reason: string;
  checks: readonly {
    authority: "EXACT_CANONICAL" | "GLW_MATRIX_PARENT_CHILD" | "BROADER_INTENT";
    state: "CLEAR" | "CONFLICT" | "UNAVAILABLE";
  }[];
  authoritySource: "GLW_CANONICAL_PLANNING";
};

const ACTIVE_EXECUTION_STATES = new Set<GlwPageExecutionRecord["status"]>([
  "QUEUED",
  "DISPATCHED",
  "DISCOVERING_EXECUTION",
  "RUNNING",
]);

export function classifyGlwExecutionOwnership(input: {
  siteId: string;
  productId: string;
  canonicalPath: string;
  authority: GlwExecutionAuthority;
}): GlwExecutionOwnershipAssessment {
  if (input.authority.status === "UNAVAILABLE") {
    return {
      classification: "UNKNOWN",
      jobId: null,
      executionId: null,
      executionState: null,
      reason: "GLW execution persistence was not available for this preflight.",
      authoritySource: "GLW_PAGE_EXECUTION_JOURNAL",
    };
  }

  const matches = input.authority.records.filter((record) =>
    record.siteId === input.siteId
    && record.productId === input.productId
    && record.slug === input.canonicalPath,
  );
  if (matches.length === 0) {
    return {
      classification: "NO_EXECUTION",
      jobId: null,
      executionId: null,
      executionState: null,
      reason: "The checked GLW execution journal has no record for this exact target.",
      authoritySource: "GLW_PAGE_EXECUTION_JOURNAL",
    };
  }

  const claims = matches.filter((record) =>
    ACTIVE_EXECUTION_STATES.has(record.status)
    || record.status === "COMPLETE"
    || Boolean(record.wordpressObjectId),
  );
  if (claims.length > 1) {
    return {
      classification: "UNRECONCILED",
      jobId: null,
      executionId: null,
      executionState: null,
      reason: "Multiple durable execution records claim this exact target.",
      authoritySource: "GLW_PAGE_EXECUTION_JOURNAL",
    };
  }
  if (claims.length === 0) {
    const failed = matches[0];
    return {
      classification: "FAILED_EXECUTION",
      jobId: failed.jobId,
      executionId: failed.externalExecutionId,
      executionState: failed.status,
      reason: "Only failed executions without durable page ownership exist for this target.",
      authoritySource: "GLW_PAGE_EXECUTION_JOURNAL",
    };
  }

  const owner = claims[0];
  if (!owner.jobId || !owner.correlationId) {
    return {
      classification: "UNRECONCILED",
      jobId: owner.jobId || null,
      executionId: owner.externalExecutionId,
      executionState: owner.status,
      reason: "Execution ownership is missing durable correlation identity.",
      authoritySource: "GLW_PAGE_EXECUTION_JOURNAL",
    };
  }
  return {
    classification: ACTIVE_EXECUTION_STATES.has(owner.status) ? "ACTIVE_EXECUTION" : "COMPLETED_EXECUTION",
    jobId: owner.jobId,
    executionId: owner.externalExecutionId,
    executionState: owner.status,
    reason: ACTIVE_EXECUTION_STATES.has(owner.status)
      ? "An active GLW execution owns this exact target."
      : "A completed GLW execution owns this exact target.",
    authoritySource: "GLW_PAGE_EXECUTION_JOURNAL",
  };
}

export function classifyGlwCampaignOwnership(input: {
  canonicalPath: string;
  authority: GlwCampaignAuthority;
}): GlwCampaignOwnershipAssessment {
  if (input.authority.status === "UNAVAILABLE") {
    return {
      classification: "UNKNOWN",
      campaignId: null,
      campaignState: null,
      targetState: null,
      reason: "Authoritative campaign persistence is not available on this upstream.",
      authoritySource: "CAMPAIGN_PERSISTENCE",
    };
  }
  return input.authority.targets[input.canonicalPath] ?? {
    classification: "AVAILABLE",
    campaignId: null,
    campaignState: null,
    targetState: null,
    reason: "Checked campaign persistence has no owner for this exact target.",
    authoritySource: "CAMPAIGN_PERSISTENCE",
  };
}

export function classifyGlwCannibalization(input: {
  target: GlwTargetPreflightResult;
  matrixPlan: GlwPlannedPage | null;
  intentAuthority: GlwIntentAuthority;
}): GlwCannibalizationAssessment {
  const exactCheck = input.target.state === "EXISTS_DRAFT" || input.target.state === "EXISTS_PUBLISHED"
    ? "CONFLICT"
    : input.target.state === "ABSENT" && input.target.confidence === "AUTHORITATIVE"
      ? "CLEAR"
      : "UNAVAILABLE";
  const matrixCheck = input.matrixPlan?.action === "CREATE_CITY"
    ? "CLEAR"
    : input.matrixPlan?.action === "BLOCKED_PARENT_STATE" || input.matrixPlan?.action === "BLOCKED_DUPLICATE"
      ? "CONFLICT"
      : "UNAVAILABLE";
  const broaderCheck = input.intentAuthority.status === "CHECKED_CLEAR" ? "CLEAR" : "UNAVAILABLE";
  const checks: GlwCannibalizationAssessment["checks"] = [
    { authority: "EXACT_CANONICAL", state: exactCheck },
    { authority: "GLW_MATRIX_PARENT_CHILD", state: matrixCheck },
    { authority: "BROADER_INTENT", state: broaderCheck },
  ];

  if (exactCheck === "CONFLICT") {
    return { classification: "EXACT_CANONICAL_EXISTS", existingOwner: input.target.wordpressUrl ?? input.target.wordpressObjectId, reason: "An exact canonical page already owns this product and geographic target.", checks, authoritySource: "GLW_CANONICAL_PLANNING" };
  }
  if (input.matrixPlan?.action === "BLOCKED_PARENT_STATE") {
    return { classification: "PARENT_CHILD_CONFLICT", existingOwner: null, reason: input.matrixPlan.reason, checks, authoritySource: "GLW_CANONICAL_PLANNING" };
  }
  if (input.matrixPlan?.action === "BLOCKED_DUPLICATE") {
    return { classification: "AMBIGUOUS", existingOwner: null, reason: input.matrixPlan.reason, checks, authoritySource: "GLW_CANONICAL_PLANNING" };
  }
  if (checks.every((check) => check.state === "CLEAR")) {
    return { classification: "CLEAR", existingOwner: null, reason: "Exact canonical, parent-child matrix, and broader intent checks are authoritatively clear.", checks, authoritySource: "GLW_CANONICAL_PLANNING" };
  }
  return { classification: "UNAVAILABLE", existingOwner: null, reason: "One or more required canonical or intent checks are unavailable.", checks, authoritySource: "GLW_CANONICAL_PLANNING" };
}
