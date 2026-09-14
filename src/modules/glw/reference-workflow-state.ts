import { createHash } from "node:crypto";
import type { GlwCampaign } from "./campaign-types";
import type { GlwPageExecutionRecord } from "./page-execution";
import { GLW_CAMPAIGN_US_STATES } from "./campaign-geography";

export type GlwReferenceWorkflowState =
  | "READY_TO_GENERATE_REFERENCE"
  | "REFERENCE_GENERATION_IN_PROGRESS"
  | "REFERENCE_DRAFT_READY"
  | "REFERENCE_RECOVERY_REQUIRED"
  | "REFERENCE_GENERATION_FAILED"
  | "REFERENCE_BLOCKED";

export type GlwReferenceWorkflowProjection = {
  state: GlwReferenceWorkflowState;
  operationId: string | null;
  targetStateCode: string | null;
  targetStateName: string | null;
  lastUpdatedAt: string | null;
  durable: boolean;
  safeOwnerAction:
    | "GENERATE_REFERENCE"
    | "WAIT_FOR_EXISTING_GENERATION"
    | "OPEN_REFERENCE_DRAFT_FOR_REVIEW"
    | "CONTINUE_EXISTING_REFERENCE"
    | "DO_NOT_RETRY_ESCALATE";
  errorCode: string | null;
  errorMessage: string | null;
  artifactSha256: string | null;
  qaFailures: ReadonlyArray<{
    predicateId: string;
    predicateName: string;
    expected: string;
    observed: string;
    evidence: string;
    severity: "BLOCKING";
  }>;
  proposedRecoveryAction: "REQUEST_NEW_EXACT_RETRY_AUTHORIZATION_AFTER_QA_REPAIR" | null;
};

function artifactSha256(job: GlwPageExecutionRecord): string | null {
  const html = job.generatedDraft?.contentHtml;
  return html ? createHash("sha256").update(html).digest("hex") : null;
}

function qaFailures(job: GlwPageExecutionRecord): GlwReferenceWorkflowProjection["qaFailures"] {
  return Object.entries(job.qaFailureReasons ?? {}).map(([predicateId, evidence]) => ({
    predicateId,
    predicateName:
      predicateId === "stateProductAuthorityLink"
        ? "Required state-page product authority link"
        : predicateId.replace(/([a-z])([A-Z])/g, "$1 $2"),
    expected:
      predicateId === "stateProductAuthorityLink"
        ? "Visible exact anchor Outdoor Digital Sphere linking to /outdoor-digital-sphere/."
        : "Predicate passes.",
    observed:
      predicateId === "stateProductAuthorityLink"
        ? "No anchor elements were present in the persisted artifact."
        : "Predicate failed.",
    evidence: String(evidence),
    severity: "BLOCKING" as const,
  }));
}

function stateCodeForName(name: string | null): string | null {
  return GLW_CAMPAIGN_US_STATES.find((state) => state.name === name)?.code ?? null;
}

export function projectGlwReferenceWorkflow(
  job: GlwPageExecutionRecord | null,
): GlwReferenceWorkflowProjection {
  if (!job) {
    return {
      state: "READY_TO_GENERATE_REFERENCE",
      operationId: null,
      targetStateCode: null,
      targetStateName: null,
      lastUpdatedAt: null,
      durable: false,
      safeOwnerAction: "GENERATE_REFERENCE",
      errorCode: null,
      errorMessage: null,
      artifactSha256: null,
      qaFailures: [],
      proposedRecoveryAction: null,
    };
  }
  const targetStateCode = stateCodeForName(job.state);
  if (job.status === "COMPLETE") {
    return {
      state: "REFERENCE_DRAFT_READY",
      operationId: job.jobId,
      targetStateCode,
      targetStateName: job.state,
      lastUpdatedAt: job.updatedAt,
      durable: true,
      safeOwnerAction: "OPEN_REFERENCE_DRAFT_FOR_REVIEW",
      errorCode: null,
      errorMessage: null,
      artifactSha256: artifactSha256(job),
      qaFailures: [],
      proposedRecoveryAction: null,
    };
  }
  if (job.status === "CONTENT_READY") {
    return {
      state: "REFERENCE_RECOVERY_REQUIRED",
      operationId: job.jobId,
      targetStateCode,
      targetStateName: job.state,
      lastUpdatedAt: job.updatedAt,
      durable: true,
      safeOwnerAction: "CONTINUE_EXISTING_REFERENCE",
      errorCode: job.errorCode,
      errorMessage: job.errorMessage,
      artifactSha256: artifactSha256(job),
      qaFailures: qaFailures(job),
      proposedRecoveryAction: null,
    };
  }
  if (job.status === "FAILED") {
    const failures = qaFailures(job);
    return {
      state:
        job.errorCode === "GENERATED_CONTENT_QA_FAILED" && failures.length > 0
          ? "REFERENCE_BLOCKED"
          : "REFERENCE_GENERATION_FAILED",
      operationId: job.jobId,
      targetStateCode,
      targetStateName: job.state,
      lastUpdatedAt: job.updatedAt,
      durable: true,
      safeOwnerAction: "DO_NOT_RETRY_ESCALATE",
      errorCode: job.errorCode,
      errorMessage: job.errorMessage,
      artifactSha256: artifactSha256(job),
      qaFailures: failures,
      proposedRecoveryAction:
        job.errorCode === "GENERATED_CONTENT_QA_FAILED" && failures.length > 0
          ? "REQUEST_NEW_EXACT_RETRY_AUTHORIZATION_AFTER_QA_REPAIR"
          : null,
    };
  }
  return {
    state: "REFERENCE_GENERATION_IN_PROGRESS",
    operationId: job.jobId,
    targetStateCode,
    targetStateName: job.state,
    lastUpdatedAt: job.updatedAt,
    durable: true,
    safeOwnerAction: "WAIT_FOR_EXISTING_GENERATION",
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    artifactSha256: artifactSha256(job),
    qaFailures: qaFailures(job),
    proposedRecoveryAction: null,
  };
}

export function findEvidenceBoundLegacyReferenceJob(input: {
  campaign: GlwCampaign;
  campaigns: readonly GlwCampaign[];
  records: readonly GlwPageExecutionRecord[];
}): GlwPageExecutionRecord | null {
  const owners = input.campaigns.filter(
    (campaign) =>
      campaign.organizationId === input.campaign.organizationId &&
      campaign.siteId === input.campaign.siteId &&
      campaign.productId === input.campaign.productId,
  );
  if (owners.length !== 1 || owners[0].campaignId !== input.campaign.campaignId)
    return null;
  const createdAt = new Date(input.campaign.createdAt).getTime();
  return (
    input.records
      .filter((record) => {
        const stateCode = stateCodeForName(record.state);
        return (
          record.campaignId == null &&
          record.organizationId === input.campaign.organizationId &&
          record.siteId === input.campaign.siteId &&
          record.productId === input.campaign.productId &&
          Boolean(stateCode && input.campaign.stateCodes.includes(stateCode)) &&
          new Date(record.createdAt).getTime() >= createdAt
        );
      })
      .sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
      )[0] ?? null
  );
}
