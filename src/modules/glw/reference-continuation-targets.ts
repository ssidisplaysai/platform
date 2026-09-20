import "server-only";

import { listGlwCertifiedStateCampaignTargets } from "@/modules/glw/campaign-certified-state-targets";
import {
  initializeGlwCampaignTargets,
  initializeGlwCityCampaignTargets,
  listGlwCampaignTargets,
  previewGlwCampaignTargets,
  reconcileGlwReferenceTargetContentReadyForContinuation,
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

  if (input.referenceJobStatus === "CONTENT_READY" && target.status === "reference_complete") {
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
