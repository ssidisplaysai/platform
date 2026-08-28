import { createCanonicalContentHash } from "./canonical-content-hash";
import type { TargetEligibility, TargetState } from "./target-inventory";
import type { TargetMatrix } from "./target-matrix";

export type CampaignStatus =
  | "DRAFT"
  | "PREFLIGHTING"
  | "PREFLIGHT_COMPLETE"
  | "REVIEW_REQUIRED"
  | "READY_FOR_APPROVAL"
  | "APPROVED"
  | "EXECUTING"
  | "PAUSED"
  | "COMPLETE"
  | "FAILED"
  | "CANCELLED";

export type CampaignPlannedOperation =
  | "CREATE"
  | "EXACT_UPDATE"
  | "NO_ACTION"
  | "REVIEW_REQUIRED"
  | "BLOCKED";

export type CampaignPreflightReasonCode =
  | "EXACT_ABSENCE_CONFIRMED"
  | "EXACT_DRAFT_FOUND"
  | "EXACT_DRAFT_ID_MISSING"
  | "PUBLISHED_UPDATE_NOT_AUTHORIZED"
  | "PREFLIGHT_READ_FAILED"
  | "PRIVATE_ABSENCE_UNPROVEN"
  | "INVALID_TARGET_IDENTITY"
  | "MISSING_CANONICAL_PARENT"
  | "TARGET_POLICY_BLOCK"
  | "CATALOG_AUTHORITY_INVALID"
  | "BLUEPRINT_VERSION_STALE"
  | "MATRIX_SCOPE_MISMATCH";

export type CampaignTargetPreflightResult = {
  campaignId: string;
  targetId: string;
  pageBlueprintId: string;
  productId: string | null;
  stateCode: string | null;
  targetState: Extract<TargetState, "ABSENT" | "EXISTS_DRAFT" | "EXISTS_PUBLISHED" | "UNKNOWN" | "BLOCKED">;
  eligibility: TargetEligibility;
  plannedOperation: CampaignPlannedOperation;
  wordpressObjectId: string | null;
  wordpressStatus: string | null;
  wordpressUrl: string | null;
  wordpressTitle: string | null;
  canonicalPath: string;
  applicationPath: string;
  canonicalParentId: string | null;
  reasonCodes: readonly CampaignPreflightReasonCode[];
  attemptCount: number;
  checkedAt: string;
  preflightPolicyVersion: string;
};

export type CampaignPreflightSummary = {
  totalTargets: number;
  targetStateCounts: Readonly<Record<CampaignTargetPreflightResult["targetState"], number>>;
  operationCounts: Readonly<Record<CampaignPlannedOperation, number>>;
  eligibilityCounts: Readonly<Record<TargetEligibility, number>>;
  executionEligibleCount: number;
  executionBlockedCount: number;
  byBlueprint: Readonly<Record<string, number>>;
  byProduct: Readonly<Record<string, number>>;
  byState: Readonly<Record<string, number>>;
};

export type CampaignPlan = {
  campaignId: string;
  organizationId: string;
  siteId: string;
  name: string;
  status: CampaignStatus;
  matrixFingerprint: string;
  matrixId: string;
  catalogAuthority: TargetMatrix["catalogAuthority"];
  catalogRevisionId: string | null;
  reconciliationPlanFingerprint: string | null;
  pageBlueprintVersions: Readonly<Record<string, number>>;
  publicationIntent: "draft";
  targetCount: number;
  targetIds: readonly string[];
  preflightPolicyVersion: string;
  preflightSummary: CampaignPreflightSummary | null;
  preflightResults: readonly CampaignTargetPreflightResult[];
  createdBy: string;
  createdAt: string;
  approvedBy: null;
  approvedAt: null;
  version: number;
  fingerprint: string;
};

export type CampaignApprovalPacket = {
  campaignId: string;
  campaignName: string;
  matrixFingerprint: string;
  targetCount: number;
  productIds: readonly string[];
  stateCodes: readonly string[];
  cityKeys: readonly string[];
  pageBlueprintIds: readonly string[];
  createCount: number;
  exactUpdateCount: number;
  publishedExcludedCount: number;
  unknownCount: number;
  blockedCount: number;
  estimatedExecutionCount: number;
  publicationIntent: "draft";
  operatorWarnings: readonly string[];
  approvalRequired: true;
  autoApprovalAllowed: false;
};

export const CAMPAIGN_PREFLIGHT_POLICY = {
  version: "1.0.0",
  resultTtlMs: 30 * 60 * 1_000,
} as const;

export class CampaignPlanError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CampaignPlanError";
    this.code = code;
  }
}

function semanticScope(input: {
  matrix: TargetMatrix;
  preflightPolicyVersion: string;
}): unknown {
  return {
    matrixId: input.matrix.matrixId,
    matrixFingerprint: input.matrix.fingerprint,
    targetIds: [...input.matrix.targets.map((target) => target.targetId)].sort(),
    publicationIntent: input.matrix.publicationIntent,
    blueprintVersions: Object.entries(input.matrix.blueprintVersions).sort(([left], [right]) => left.localeCompare(right)),
    catalogAuthority: input.matrix.catalogAuthority,
    catalogRevisionId: input.matrix.catalogRevisionId,
    reconciliationPlanFingerprint: input.matrix.reconciliationPlanFingerprint,
    preflightPolicyVersion: input.preflightPolicyVersion,
  };
}

export function createCampaignPlan(input: {
  matrix: TargetMatrix;
  organizationId: string;
  siteId: string;
  name: string;
  createdBy: string;
  createdAt?: string;
  preflightPolicyVersion?: string;
}): CampaignPlan {
  if (!input.matrix.matrixId || !input.matrix.fingerprint || input.matrix.targets.length === 0) {
    throw new CampaignPlanError("CERTIFIED_MATRIX_REQUIRED", "Campaign plans require a non-empty certified TargetMatrix.");
  }
  if (input.matrix.targets.some((target) => target.organizationId !== input.organizationId || target.siteId !== input.siteId)) {
    throw new CampaignPlanError("MATRIX_SCOPE_MISMATCH", "Matrix targets must match the campaign organization and site.");
  }
  const preflightPolicyVersion = input.preflightPolicyVersion ?? CAMPAIGN_PREFLIGHT_POLICY.version;
  const fingerprint = createCanonicalContentHash(semanticScope({ matrix: input.matrix, preflightPolicyVersion }));
  return {
    campaignId: `campaign-${fingerprint.slice(0, 24)}`,
    organizationId: input.organizationId,
    siteId: input.siteId,
    name: input.name.trim(),
    status: "DRAFT",
    matrixFingerprint: input.matrix.fingerprint,
    matrixId: input.matrix.matrixId,
    catalogAuthority: input.matrix.catalogAuthority,
    catalogRevisionId: input.matrix.catalogRevisionId,
    reconciliationPlanFingerprint: input.matrix.reconciliationPlanFingerprint,
    pageBlueprintVersions: { ...input.matrix.blueprintVersions },
    publicationIntent: "draft",
    targetCount: input.matrix.targets.length,
    targetIds: [...input.matrix.targets.map((target) => target.targetId)].sort(),
    preflightPolicyVersion,
    preflightSummary: null,
    preflightResults: [],
    createdBy: input.createdBy,
    createdAt: input.createdAt ?? new Date().toISOString(),
    approvedBy: null,
    approvedAt: null,
    version: 1,
    fingerprint,
  };
}

function countBy<T>(values: readonly T[], key: (value: T) => string | null): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    const entry = key(value);
    if (entry) counts[entry] = (counts[entry] ?? 0) + 1;
    return counts;
  }, {});
}

export function summarizeCampaign(
  results: readonly CampaignTargetPreflightResult[],
): CampaignPreflightSummary {
  const states: CampaignTargetPreflightResult["targetState"][] = ["ABSENT", "EXISTS_DRAFT", "EXISTS_PUBLISHED", "UNKNOWN", "BLOCKED"];
  const operations: CampaignPlannedOperation[] = ["CREATE", "EXACT_UPDATE", "NO_ACTION", "REVIEW_REQUIRED", "BLOCKED"];
  const eligibilities: TargetEligibility[] = ["ELIGIBLE_CREATE", "ELIGIBLE_UPDATE", "NOT_ELIGIBLE_PUBLISHED", "NOT_ELIGIBLE_POLICY", "NOT_ELIGIBLE_COLLISION", "REVIEW_REQUIRED", "UNKNOWN_REQUIRES_PREFLIGHT"];
  const operationCounts = Object.fromEntries(operations.map((operation) => [operation, results.filter((result) => result.plannedOperation === operation).length])) as Record<CampaignPlannedOperation, number>;
  return {
    totalTargets: results.length,
    targetStateCounts: Object.fromEntries(states.map((state) => [state, results.filter((result) => result.targetState === state).length])) as Record<CampaignTargetPreflightResult["targetState"], number>,
    operationCounts,
    eligibilityCounts: Object.fromEntries(eligibilities.map((eligibility) => [eligibility, results.filter((result) => result.eligibility === eligibility).length])) as Record<TargetEligibility, number>,
    executionEligibleCount: operationCounts.CREATE + operationCounts.EXACT_UPDATE,
    executionBlockedCount: operationCounts.NO_ACTION + operationCounts.REVIEW_REQUIRED + operationCounts.BLOCKED,
    byBlueprint: countBy(results, (result) => result.pageBlueprintId),
    byProduct: countBy(results, (result) => result.productId),
    byState: countBy(results, (result) => result.stateCode),
  };
}

export function completeCampaignPreflight(input: {
  campaign: CampaignPlan;
  matrix: TargetMatrix;
  results: readonly CampaignTargetPreflightResult[];
}): CampaignPlan {
  if (input.campaign.status !== "DRAFT" && input.campaign.status !== "PREFLIGHTING") {
    throw new CampaignPlanError("CAMPAIGN_SCOPE_FROZEN", "Campaign scope cannot change after preflight completion.");
  }
  if (input.matrix.matrixId !== input.campaign.matrixId || input.matrix.fingerprint !== input.campaign.matrixFingerprint) {
    throw new CampaignPlanError("MATRIX_SCOPE_MISMATCH", "Campaign matrix identity changed after scope freeze.");
  }
  const expected = input.campaign.targetIds;
  const actual = [...input.results.map((result) => result.targetId)].sort();
  if (actual.length !== expected.length || actual.some((targetId, index) => targetId !== expected[index])) {
    throw new CampaignPlanError("CAMPAIGN_SCOPE_MISMATCH", "Preflight results do not account for the frozen campaign target set exactly once.");
  }
  const summary = summarizeCampaign(input.results);
  const status: CampaignStatus = summary.targetStateCounts.UNKNOWN > 0 || summary.targetStateCounts.BLOCKED > 0
    ? "REVIEW_REQUIRED"
    : "READY_FOR_APPROVAL";
  return {
    ...input.campaign,
    status,
    preflightSummary: summary,
    preflightResults: [...input.results].sort((left, right) => left.targetId.localeCompare(right.targetId)),
    version: input.campaign.version + 1,
  };
}

export function getCampaignApprovalPacket(
  campaign: CampaignPlan,
  matrix: TargetMatrix,
): CampaignApprovalPacket {
  if (!campaign.preflightSummary) {
    throw new CampaignPlanError("PREFLIGHT_REQUIRED", "Campaign preflight must complete before approval review.");
  }
  const summary = campaign.preflightSummary;
  const warnings: string[] = [];
  if (summary.targetStateCounts.EXISTS_PUBLISHED) warnings.push(`${summary.targetStateCounts.EXISTS_PUBLISHED} published targets are excluded from execution.`);
  if (summary.targetStateCounts.UNKNOWN) warnings.push(`${summary.targetStateCounts.UNKNOWN} targets remain unknown and require review.`);
  if (summary.targetStateCounts.BLOCKED) warnings.push(`${summary.targetStateCounts.BLOCKED} targets are blocked.`);
  return {
    campaignId: campaign.campaignId,
    campaignName: campaign.name,
    matrixFingerprint: campaign.matrixFingerprint,
    targetCount: campaign.targetCount,
    productIds: [...new Set(matrix.targets.map((target) => target.subject.productId).filter((value): value is string => Boolean(value)))].sort(),
    stateCodes: [...new Set(matrix.targets.map((target) => target.geography.stateCode).filter((value): value is string => Boolean(value)))].sort(),
    cityKeys: [...new Set(matrix.targets.map((target) => target.geography.cityKey).filter((value): value is string => Boolean(value)))].sort(),
    pageBlueprintIds: Object.keys(campaign.pageBlueprintVersions).sort(),
    createCount: summary.operationCounts.CREATE,
    exactUpdateCount: summary.operationCounts.EXACT_UPDATE,
    publishedExcludedCount: summary.targetStateCounts.EXISTS_PUBLISHED,
    unknownCount: summary.targetStateCounts.UNKNOWN,
    blockedCount: summary.targetStateCounts.BLOCKED,
    estimatedExecutionCount: summary.executionEligibleCount,
    publicationIntent: "draft",
    operatorWarnings: warnings,
    approvalRequired: true,
    autoApprovalAllowed: false,
  };
}

export function isCampaignPreflightStale(input: {
  result: CampaignTargetPreflightResult;
  now: string;
  ttlMs?: number;
}): boolean {
  const ttlMs = input.ttlMs ?? CAMPAIGN_PREFLIGHT_POLICY.resultTtlMs;
  return new Date(input.now).getTime() - new Date(input.result.checkedAt).getTime() > ttlMs;
}