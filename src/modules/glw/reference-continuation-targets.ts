import "server-only";

import { listGlwCertifiedStateCampaignTargets } from "@/modules/glw/campaign-certified-state-targets";
import {
  adoptGlwQueuedReferenceTargetContentReadyJob,
  bindGlwQueuedReferenceTargetToRunningJob,
  initializeGlwCampaignTargets,
  initializeGlwCityCampaignTargets,
  listGlwCampaignTargets,
  markGlwCampaignTargetFailed,
  previewGlwCampaignTargets,
  reconcileGlwCampaignTargetContentReady,
  reconcileGlwContentReadyTargetDraft,
  reconcileGlwReferenceTargetContentReadyForContinuation,
  reconcileGlwReferenceTargetQueuedForProduction,
} from "@/modules/glw/campaign-target-repository";
import type { GlwCampaign } from "@/modules/glw/campaign-types";

function normalizeCitySlug(value?: string | null): string | null {
  const normalized = value
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") ?? "";
  return normalized || null;
}

function hasExactTarget(input: {
  campaignId: string;
  stateCode: string;
  citySlug?: string | null;
}): boolean {
  const stateCode = input.stateCode.trim().toUpperCase();
  const citySlug = normalizeCitySlug(input.citySlug);
  return listGlwCampaignTargets(input.campaignId).some((target) =>
    target.stateCode.trim().toUpperCase() === stateCode
    && normalizeCitySlug(target.citySlug) === citySlug,
  );
}

function findExactTarget(input: {
  campaignId: string;
  stateCode: string;
  citySlug?: string | null;
}) {
  const stateCode = input.stateCode.trim().toUpperCase();
  const citySlug = normalizeCitySlug(input.citySlug);
  return listGlwCampaignTargets(input.campaignId).find((target) =>
    target.stateCode.trim().toUpperCase() === stateCode
    && normalizeCitySlug(target.citySlug) === citySlug,
  ) ?? null;
}

function isReferenceJobContinuableFromReferenceComplete(status: string): boolean {
  return status === "CONTENT_READY" || status === "FAILED";
}

type ReferenceExecutionProjection = {
  jobId: string;
  status: string;
  externalExecutionId: string | null;
  wordpressObjectId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

function isRecoverableInFlightReferenceStatus(status: string): boolean {
  return status === "QUEUED"
    || status === "DISPATCHED"
    || status === "DISCOVERING_EXECUTION"
    || status === "RUNNING";
}

export function ensureDraftCampaignContinuationTarget(input: {
  campaign: GlwCampaign;
  targetStateCode: string;
  targetCitySlug?: string | null;
  referenceJobId: string;
  referenceJobStatus: string;
  referenceWordpressObjectId: string | null;
}): boolean {
  const existingTarget = findExactTarget({
    campaignId: input.campaign.campaignId,
    stateCode: input.targetStateCode,
    citySlug: input.targetCitySlug,
  });

  if (!existingTarget) {
    if (input.campaign.pageType === "city_service") {
      const targetCitySlug = normalizeCitySlug(input.targetCitySlug);
      const targetIncluded = input.campaign.cityTargets?.some((target) =>
        target.stateCode.trim().toUpperCase() === input.targetStateCode.trim().toUpperCase()
        && normalizeCitySlug(target.citySlug) === targetCitySlug,
      ) ?? false;
      if (!targetIncluded || !targetCitySlug) return false;

      initializeGlwCityCampaignTargets({
        campaignId: input.campaign.campaignId,
        organizationId: input.campaign.organizationId,
        siteId: input.campaign.siteId,
        productId: input.campaign.productId,
        cityTargets: input.campaign.cityTargets ?? [],
        referenceTarget: {
          stateCode: input.targetStateCode,
          citySlug: targetCitySlug,
        },
        referenceJobId: input.referenceJobId,
        referenceWordpressObjectId: input.referenceWordpressObjectId,
      });
    } else {
      const preview = previewGlwCampaignTargets({
        campaignId: input.campaign.campaignId,
        organizationId: input.campaign.organizationId,
        siteId: input.campaign.siteId,
        productId: input.campaign.productId,
        stateCodes: input.campaign.stateCodes,
        referenceStateCode: input.targetStateCode,
        referenceJobId: input.referenceJobId,
        referenceWordpressObjectId: input.referenceWordpressObjectId,
        certifiedTargets: listGlwCertifiedStateCampaignTargets(input.campaign),
      });

      const targetIncluded = preview.some((target) =>
        target.stateCode.trim().toUpperCase() === input.targetStateCode.trim().toUpperCase()
        && normalizeCitySlug(target.citySlug) === normalizeCitySlug(input.targetCitySlug),
      );
      if (!targetIncluded) return false;

      initializeGlwCampaignTargets({
        campaignId: input.campaign.campaignId,
        organizationId: input.campaign.organizationId,
        siteId: input.campaign.siteId,
        productId: input.campaign.productId,
        stateCodes: input.campaign.stateCodes,
        referenceStateCode: input.targetStateCode,
        referenceJobId: input.referenceJobId,
        referenceWordpressObjectId: input.referenceWordpressObjectId,
        certifiedTargets: listGlwCertifiedStateCampaignTargets(input.campaign),
      });
    }
  }

  const target = findExactTarget({
    campaignId: input.campaign.campaignId,
    stateCode: input.targetStateCode,
    citySlug: input.targetCitySlug,
  });

  if (!target) {
    return false;
  }
  if (target.jobId !== input.referenceJobId) {
    return false;
  }

  if (
    isReferenceJobContinuableFromReferenceComplete(input.referenceJobStatus)
    && target.status === "reference_complete"
  ) {
    reconcileGlwReferenceTargetContentReadyForContinuation({
      campaignId: input.campaign.campaignId,
      stateCode: input.targetStateCode,
      citySlug: input.targetCitySlug,
      expectedJobId: input.referenceJobId,
    });
  }

  const finalTarget = findExactTarget({
    campaignId: input.campaign.campaignId,
    stateCode: input.targetStateCode,
    citySlug: input.targetCitySlug,
  });

  return Boolean(finalTarget && finalTarget.jobId === input.referenceJobId);
}

export function reconcileReferenceTargetExecutionProjection(input: {
  campaign: GlwCampaign;
  stateCode: string;
  citySlug?: string | null;
  execution: ReferenceExecutionProjection;
}): boolean {
  const target = findExactTarget({
    campaignId: input.campaign.campaignId,
    stateCode: input.stateCode,
    citySlug: input.citySlug,
  });

  if (!target) {
    return false;
  }

  const executionJobId = input.execution.jobId.trim();
  if (!executionJobId) {
    return false;
  }

  if (
    target.status === "queued"
    && !target.jobId
    && !target.wordpressObjectId
    && !target.leaseId
  ) {
    if (isRecoverableInFlightReferenceStatus(input.execution.status)) {
      bindGlwQueuedReferenceTargetToRunningJob({
        campaignId: input.campaign.campaignId,
        stateCode: input.stateCode,
        citySlug: input.citySlug,
        jobId: executionJobId,
      });
      return true;
    }

    if (input.execution.status === "CONTENT_READY" && !input.execution.wordpressObjectId) {
      adoptGlwQueuedReferenceTargetContentReadyJob({
        campaignId: input.campaign.campaignId,
        stateCode: input.stateCode,
        citySlug: input.citySlug,
        jobId: executionJobId,
      });
      return true;
    }

    if (input.execution.status === "FAILED") {
      markGlwCampaignTargetFailed({
        campaignId: input.campaign.campaignId,
        stateCode: input.stateCode,
        citySlug: input.citySlug,
        jobId: executionJobId,
        error: input.execution.errorCode ?? input.execution.errorMessage ?? "REFERENCE_GENERATION_FAILED",
      });
      return true;
    }
  }

  if (
    target.status === "content_ready"
    && target.jobId === executionJobId
    && input.execution.status === "COMPLETE"
    && input.execution.wordpressObjectId
  ) {
    if (
      target.wordpressObjectId
      && target.wordpressObjectId !== input.execution.wordpressObjectId
    ) {
      return false;
    }

    reconcileGlwContentReadyTargetDraft({
      campaignId: input.campaign.campaignId,
      stateCode: input.stateCode,
      citySlug: input.citySlug,
      targetId: target.targetId,
      jobId: executionJobId,
      wordpressObjectId: input.execution.wordpressObjectId,
    });
    return true;
  }

  if (target.status === "running" && target.jobId === executionJobId) {
    if (
      input.execution.status === "CONTENT_READY"
      && !target.wordpressObjectId
      && input.execution.externalExecutionId
    ) {
      reconcileGlwCampaignTargetContentReady({
        campaignId: input.campaign.campaignId,
        targetId: target.targetId,
        stateCode: input.stateCode,
        citySlug: input.citySlug,
        jobId: executionJobId,
        externalExecutionId: input.execution.externalExecutionId,
      });
      return true;
    }

    if (input.execution.status === "FAILED") {
      markGlwCampaignTargetFailed({
        campaignId: input.campaign.campaignId,
        stateCode: input.stateCode,
        citySlug: input.citySlug,
        jobId: executionJobId,
        error: input.execution.errorCode ?? input.execution.errorMessage ?? "REFERENCE_GENERATION_FAILED",
      });
      return true;
    }
  }

  return false;
}

export function promoteDrainedActiveReferenceTargetForProduction(input: {
  campaign: GlwCampaign;
}): boolean {
  if (input.campaign.status !== "active") {
    return false;
  }

  const targets = listGlwCampaignTargets(input.campaign.campaignId);
  if (targets.length === 0) {
    return false;
  }

  const inFlightExists = targets.some((target) =>
    target.status === "queued"
    || target.status === "running"
    || target.status === "content_ready"
    || target.status === "draft_ready",
  );
  if (inFlightExists) {
    return false;
  }

  const promotable = targets.filter((target) =>
    target.status === "reference_complete"
    && !target.jobId
    && !target.wordpressObjectId
    && !target.leaseId
    && !target.leasedAt
    && !target.leaseExpiresAt,
  );

  if (promotable.length !== 1) {
    return false;
  }

  const candidate = promotable[0];
  reconcileGlwReferenceTargetQueuedForProduction({
    campaignId: input.campaign.campaignId,
    stateCode: candidate.stateCode,
    citySlug: candidate.citySlug,
  });
  return true;
}
