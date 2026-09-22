import "server-only";

import { GLW_CAMPAIGN_US_STATES } from "@/modules/glw/campaign-geography";
import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import { listGlwCampaignTargets, type GlwCampaignTarget } from "@/modules/glw/campaign-target-repository";
import { glwPageExecutionRepository } from "@/modules/glw/page-execution-repository";
import {
  GLW_REFERENCE_EXECUTION_RETIRED_DISPOSITION,
  isGlwExecutionQuarantined,
  isGlwReferenceExecutionRetiredForProjection,
} from "@/modules/glw/page-execution";

export const GLW_REFERENCE_EXECUTION_RETIRE_OPERATION = "RETIRE_REFERENCE_EXECUTION" as const;

export type RetireGlwReferenceExecutionInput = {
  organizationId: string;
  siteId: string;
  campaignId: string;
  stateCode: string;
  citySlug?: string | null;
  expectedJobId: string;
  expectedExecutionId: string;
  expectedCanonicalPath: string;
  principalId: string;
  reason: string;
  operationId?: string;
  now?: Date;
};

export type RetireGlwReferenceExecutionResult = {
  operationType: typeof GLW_REFERENCE_EXECUTION_RETIRE_OPERATION;
  alreadyRetired: boolean;
  jobId: string;
  targetId: string;
  retiredAt: string;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCitySlug(value?: string | null): string | null {
  const normalized = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || null;
}

function normalizePath(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "");
}

function findTarget(input: {
  campaignId: string;
  stateCode: string;
  citySlug?: string | null;
}): GlwCampaignTarget | null {
  const expectedStateCode = input.stateCode.trim().toUpperCase();
  const expectedCitySlug = normalizeCitySlug(input.citySlug);
  return listGlwCampaignTargets(input.campaignId).find((target) =>
    target.stateCode.trim().toUpperCase() === expectedStateCode
    && normalizeCitySlug(target.citySlug) === expectedCitySlug,
  ) ?? null;
}

function assertRetireableTarget(target: GlwCampaignTarget): void {
  if (target.status !== "queued") throw new Error("REFERENCE_RETIRE_TARGET_STATUS_INVALID");
  if (target.jobId !== null) throw new Error("REFERENCE_RETIRE_TARGET_JOB_BINDING_PRESENT");
  if (target.wordpressObjectId !== null) throw new Error("REFERENCE_RETIRE_TARGET_WORDPRESS_BINDING_PRESENT");
  if (target.leaseId || target.leasedAt || target.leaseExpiresAt) throw new Error("REFERENCE_RETIRE_TARGET_ACTIVE_LEASE_FORBIDDEN");
}

export async function retireGlwReferenceExecutionForProjection(input: RetireGlwReferenceExecutionInput): Promise<RetireGlwReferenceExecutionResult> {
  const campaign = listGlwCampaigns().find((candidate) =>
    candidate.campaignId === input.campaignId
    && candidate.organizationId === input.organizationId
    && candidate.siteId === input.siteId,
  ) ?? null;
  if (!campaign) throw new Error("REFERENCE_RETIRE_CAMPAIGN_NOT_FOUND");

  const target = findTarget({ campaignId: campaign.campaignId, stateCode: input.stateCode, citySlug: input.citySlug });
  if (!target) throw new Error("REFERENCE_RETIRE_TARGET_NOT_FOUND");
  assertRetireableTarget(target);

  const job = await glwPageExecutionRepository.getById(input.expectedJobId);
  if (!job) throw new Error("REFERENCE_RETIRE_JOB_NOT_FOUND");

  const expectedStateCode = input.stateCode.trim().toUpperCase();
  const expectedState = GLW_CAMPAIGN_US_STATES.find((state) => state.code === expectedStateCode);
  if (!expectedState) throw new Error("REFERENCE_RETIRE_STATE_INVALID");
  const expectedCitySlug = normalizeCitySlug(input.citySlug);
  const jobCitySlug = normalizeCitySlug(job.city);

  if (
    job.organizationId !== campaign.organizationId
    || job.siteId !== campaign.siteId
    || job.productId !== campaign.productId
    || text(job.state) !== expectedState.name
    || normalizePath(job.slug) !== normalizePath(input.expectedCanonicalPath)
    || text(job.externalExecutionId) !== input.expectedExecutionId.trim()
    || (campaign.pageType === "city_service" && jobCitySlug !== expectedCitySlug)
  ) {
    throw new Error("REFERENCE_RETIRE_JOB_IDENTITY_MISMATCH");
  }

  if (job.campaignId && job.campaignId !== campaign.campaignId) {
    throw new Error("REFERENCE_RETIRE_JOB_CAMPAIGN_SCOPE_MISMATCH");
  }

  if (isGlwExecutionQuarantined(job)) {
    throw new Error("REFERENCE_RETIRE_QUARANTINED_EXECUTION_FORBIDDEN");
  }

  if (job.status !== "FAILED") {
    throw new Error("REFERENCE_RETIRE_JOB_STATUS_INVALID");
  }

  if (job.wordpressObjectId || text(job.wordpressStatus) || text(job.wordpressUrl)) {
    throw new Error("REFERENCE_RETIRE_WORDPRESS_MUTATION_FORBIDDEN");
  }

  const retiredAt = (input.now ?? new Date()).toISOString();
  if (isGlwReferenceExecutionRetiredForProjection(job)) {
    return {
      operationType: GLW_REFERENCE_EXECUTION_RETIRE_OPERATION,
      alreadyRetired: true,
      jobId: job.jobId,
      targetId: target.targetId,
      retiredAt,
    };
  }

  const checks = job.qaChecks && typeof job.qaChecks === "object" && !Array.isArray(job.qaChecks)
    ? job.qaChecks
    : {};
  const operationId = input.operationId?.trim() || `retire-reference-execution:${job.jobId}`;

  await glwPageExecutionRepository.update(job.jobId, {
    disposition: GLW_REFERENCE_EXECUTION_RETIRED_DISPOSITION,
    qaChecks: {
      ...checks,
      referenceExecutionRetirement: {
        operationType: GLW_REFERENCE_EXECUTION_RETIRE_OPERATION,
        operationId,
        reason: input.reason.trim(),
        retiredBy: input.principalId.trim(),
        retiredAt,
        previousDisposition: job.disposition,
        preservedStatus: job.status,
        preservedErrorCode: job.errorCode,
        preservedExternalExecutionId: job.externalExecutionId,
      },
    },
    updatedAt: retiredAt,
  });

  return {
    operationType: GLW_REFERENCE_EXECUTION_RETIRE_OPERATION,
    alreadyRetired: false,
    jobId: job.jobId,
    targetId: target.targetId,
    retiredAt,
  };
}
