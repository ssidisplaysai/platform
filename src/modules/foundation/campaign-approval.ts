import { createCanonicalContentHash } from "./canonical-content-hash";
import {
  CAMPAIGN_PREFLIGHT_POLICY,
  isCampaignPreflightStale,
  type CampaignPlan,
  type CampaignPlannedOperation,
  type CampaignTargetPreflightResult,
} from "./campaign-plan";

export type CampaignApproval = {
  campaignId: string;
  campaignFingerprint: string;
  matrixFingerprint: string;
  approvedTargetIds: readonly string[];
  excludedTargetIds: readonly string[];
  approvedOperations: Readonly<Record<string, Extract<CampaignPlannedOperation, "CREATE" | "EXACT_UPDATE">>>;
  approvedOperationCounts: Readonly<Record<"CREATE" | "EXACT_UPDATE", number>>;
  publicationIntent: "draft";
  preflightPolicyVersion: string;
  preflightCompletedAt: string;
  approvedBy: string;
  approvedAt: string;
  approvalFingerprint: string;
};

export class CampaignApprovalError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CampaignApprovalError";
    this.code = code;
  }
}

function executable(result: CampaignTargetPreflightResult): boolean {
  return (result.targetState === "ABSENT"
      && result.eligibility === "ELIGIBLE_CREATE"
      && result.plannedOperation === "CREATE")
    || (result.targetState === "EXISTS_DRAFT"
      && result.eligibility === "ELIGIBLE_UPDATE"
      && result.plannedOperation === "EXACT_UPDATE"
      && Boolean(result.wordpressObjectId));
}

function approvalSemantic(input: {
  campaign: CampaignPlan;
  approvedTargetIds: readonly string[];
  approvedOperations: Readonly<Record<string, "CREATE" | "EXACT_UPDATE">>;
}): unknown {
  return {
    campaignFingerprint: input.campaign.fingerprint,
    matrixFingerprint: input.campaign.matrixFingerprint,
    approvedTargetIds: [...input.approvedTargetIds].sort(),
    approvedOperations: Object.entries(input.approvedOperations).sort(([left], [right]) => left.localeCompare(right)),
    publicationIntent: input.campaign.publicationIntent,
    preflightPolicyVersion: input.campaign.preflightPolicyVersion,
  };
}

export function createCampaignApproval(input: {
  campaign: CampaignPlan;
  approvedTargetIds?: readonly string[];
  approvedBy: string;
  approvedAt: string;
  preflightTtlMs?: number;
}): CampaignApproval {
  if (input.campaign.status !== "READY_FOR_APPROVAL" || !input.campaign.preflightSummary) {
    throw new CampaignApprovalError("CAMPAIGN_NOT_READY", "Campaign must be ready for approval after completed preflight.");
  }
  if (input.campaign.publicationIntent !== "draft") {
    throw new CampaignApprovalError("PUBLICATION_NOT_ALLOWED", "Campaign execution approval is draft-only.");
  }
  const byTarget = new Map(input.campaign.preflightResults.map((result) => [result.targetId, result]));
  const eligibleIds = input.campaign.preflightResults.filter(executable).map((result) => result.targetId);
  const approvedTargetIds = [...new Set(input.approvedTargetIds ?? eligibleIds)].sort();
  if (approvedTargetIds.length === 0) {
    throw new CampaignApprovalError("EMPTY_APPROVAL", "Approval requires at least one executable target.");
  }
  const unknownTarget = approvedTargetIds.find((targetId) => !byTarget.has(targetId));
  if (unknownTarget) throw new CampaignApprovalError("APPROVAL_SCOPE_MISMATCH", `Target is outside campaign scope: ${unknownTarget}`);
  const unsafeTarget = approvedTargetIds.find((targetId) => !executable(byTarget.get(targetId)!));
  if (unsafeTarget) throw new CampaignApprovalError("UNSAFE_TARGET_APPROVAL", `Target is not executable: ${unsafeTarget}`);
  const staleTarget = approvedTargetIds.find((targetId) => isCampaignPreflightStale({
    result: byTarget.get(targetId)!,
    now: input.approvedAt,
    ttlMs: input.preflightTtlMs ?? CAMPAIGN_PREFLIGHT_POLICY.resultTtlMs,
  }));
  if (staleTarget) throw new CampaignApprovalError("PREFLIGHT_REFRESH_REQUIRED", `Target preflight is stale: ${staleTarget}`);
  const approvedOperations = Object.fromEntries(approvedTargetIds.map((targetId) => {
    const operation = byTarget.get(targetId)!.plannedOperation;
    return [targetId, operation as "CREATE" | "EXACT_UPDATE"];
  }));
  const approvalFingerprint = createCanonicalContentHash(approvalSemantic({
    campaign: input.campaign,
    approvedTargetIds,
    approvedOperations,
  }));
  return {
    campaignId: input.campaign.campaignId,
    campaignFingerprint: input.campaign.fingerprint,
    matrixFingerprint: input.campaign.matrixFingerprint,
    approvedTargetIds,
    excludedTargetIds: input.campaign.targetIds.filter((targetId) => !approvedTargetIds.includes(targetId)),
    approvedOperations,
    approvedOperationCounts: {
      CREATE: Object.values(approvedOperations).filter((operation) => operation === "CREATE").length,
      EXACT_UPDATE: Object.values(approvedOperations).filter((operation) => operation === "EXACT_UPDATE").length,
    },
    publicationIntent: "draft",
    preflightPolicyVersion: input.campaign.preflightPolicyVersion,
    preflightCompletedAt: [...input.campaign.preflightResults.map((result) => result.checkedAt)].sort().at(-1)!,
    approvedBy: input.approvedBy,
    approvedAt: input.approvedAt,
    approvalFingerprint,
  };
}

export function validateCampaignApproval(input: {
  campaign: CampaignPlan;
  approval: CampaignApproval;
  now: string;
  targetIds?: readonly string[];
}): void {
  if (input.approval.campaignId !== input.campaign.campaignId
    || input.approval.campaignFingerprint !== input.campaign.fingerprint
    || input.approval.matrixFingerprint !== input.campaign.matrixFingerprint
    || input.approval.publicationIntent !== "draft") {
    throw new CampaignApprovalError("APPROVAL_SCOPE_MISMATCH", "Approval does not match the frozen campaign scope.");
  }
  const expectedFingerprint = createCanonicalContentHash(approvalSemantic({
    campaign: input.campaign,
    approvedTargetIds: input.approval.approvedTargetIds,
    approvedOperations: input.approval.approvedOperations,
  }));
  if (expectedFingerprint !== input.approval.approvalFingerprint) {
    throw new CampaignApprovalError("APPROVAL_SCOPE_MISMATCH", "Approval fingerprint is invalid.");
  }
  const byTarget = new Map(input.campaign.preflightResults.map((result) => [result.targetId, result]));
  const targetIds = input.targetIds ?? input.approval.approvedTargetIds;
  targetIds.forEach((targetId) => {
    if (!input.approval.approvedTargetIds.includes(targetId)) {
      throw new CampaignApprovalError("APPROVAL_SCOPE_MISMATCH", `Target is outside the approved subset: ${targetId}`);
    }
    const result = byTarget.get(targetId);
    if (!result || !executable(result) || result.plannedOperation !== input.approval.approvedOperations[targetId]) {
      throw new CampaignApprovalError("APPROVAL_SCOPE_MISMATCH", `Approved target operation changed: ${targetId}`);
    }
    if (isCampaignPreflightStale({ result, now: input.now })) {
      throw new CampaignApprovalError("PREFLIGHT_REFRESH_REQUIRED", `Target preflight is stale: ${targetId}`);
    }
  });
}