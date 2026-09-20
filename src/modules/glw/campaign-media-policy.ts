import "server-only";

import type { ProductMediaAuthorityRecord, ProductMediaReadiness } from "./product-media-authority";
import { evaluateProductMediaReadiness } from "./product-media-authority";
import type { GlwCampaign, GlwCampaignMediaPolicy } from "./campaign-types";

export type CampaignMediaReadiness = ProductMediaReadiness & {
  campaignHeroReady: boolean;
  campaignHeroMediaAuthorityId: string | null;
  productAuthorityReady: boolean;
};

function dedupeIds(ids: readonly string[]): string[] {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}

export function resolveGlwCampaignMediaPolicy(campaign: GlwCampaign): GlwCampaignMediaPolicy {
  return {
    mode: campaign.campaignMediaPolicy?.mode === "EXPLICIT_ALLOWLIST" ? "EXPLICIT_ALLOWLIST" : "INHERIT_PRODUCT_MEDIA",
    allowlistMediaAuthorityIds: dedupeIds(campaign.campaignMediaPolicy?.allowlistMediaAuthorityIds ?? []),
    campaignHeroMediaAuthorityId: campaign.campaignMediaPolicy?.campaignHeroMediaAuthorityId?.trim() || null,
  };
}

export function resolveEffectiveCampaignMediaRecords(input: {
  campaign: GlwCampaign;
  productMediaRecords: readonly ProductMediaAuthorityRecord[];
}): readonly ProductMediaAuthorityRecord[] {
  const policy = resolveGlwCampaignMediaPolicy(input.campaign);
  if (policy.mode === "INHERIT_PRODUCT_MEDIA") {
    return input.productMediaRecords;
  }

  const allowlist = new Set(policy.allowlistMediaAuthorityIds);
  return input.productMediaRecords.filter((record) => allowlist.has(record.mediaAuthorityId));
}

function resolveGlobalProductHero(records: readonly ProductMediaAuthorityRecord[]): ProductMediaAuthorityRecord | null {
  return records.find((record) => record.ownerApproval === "APPROVED" && record.heroSelected && record.heroEligible) ?? null;
}

export function resolveCampaignPresentationHero(input: {
  campaign: GlwCampaign;
  effectiveMediaRecords: readonly ProductMediaAuthorityRecord[];
}): {
  hero: ProductMediaAuthorityRecord | null;
  campaignHeroMediaAuthorityId: string | null;
} {
  const policy = resolveGlwCampaignMediaPolicy(input.campaign);
  const campaignHero = policy.campaignHeroMediaAuthorityId
    ? input.effectiveMediaRecords.find((record) =>
      record.mediaAuthorityId === policy.campaignHeroMediaAuthorityId
      && record.ownerApproval === "APPROVED"
      && record.heroEligible) ?? null
    : null;
  if (campaignHero) {
    return { hero: campaignHero, campaignHeroMediaAuthorityId: campaignHero.mediaAuthorityId };
  }
  return {
    hero: resolveGlobalProductHero(input.effectiveMediaRecords),
    campaignHeroMediaAuthorityId: policy.campaignHeroMediaAuthorityId ?? null,
  };
}

export function evaluateCampaignProductMediaReadiness(input: {
  campaign: GlwCampaign;
  productMediaRecords: readonly ProductMediaAuthorityRecord[];
  stateCode?: string | null;
}): CampaignMediaReadiness {
  const effectiveRecords = resolveEffectiveCampaignMediaRecords({
    campaign: input.campaign,
    productMediaRecords: input.productMediaRecords,
  });
  const productReadiness = evaluateProductMediaReadiness(effectiveRecords, { stateCode: input.stateCode ?? null });
  const { hero, campaignHeroMediaAuthorityId } = resolveCampaignPresentationHero({
    campaign: input.campaign,
    effectiveMediaRecords: effectiveRecords,
  });
  const campaignHeroReady = Boolean(hero);
  const productAuthorityReady = productReadiness.approvedProductAuthorityMediaCount > 0;
  const blockers = [
    ...(!campaignHeroReady ? ["CAMPAIGN_HERO_REQUIRED"] : []),
    ...(!productAuthorityReady ? ["PRODUCT_MEDIA_AUTHORITY_REQUIRED"] : []),
    ...(productReadiness.applicationMediaReady ? [] : ["APPLICATION_EXPERIENCE_MEDIA_REQUIRED"]),
    ...(productReadiness.supportingProductMediaReady ? [] : ["SUPPORTING_PRODUCT_OR_CONTEXTUAL_MEDIA_REQUIRED"]),
    ...(productReadiness.mediaProvenanceReady ? [] : ["MEDIA_PROVENANCE_REQUIRED"]),
  ];
  return {
    ...productReadiness,
    state: blockers.length ? "PRODUCT_MEDIA_AUTHORITY_REQUIRED" : "REFERENCE_COMPOSITION_MEDIA_READY",
    ready: blockers.length === 0,
    heroAuthorityReady: campaignHeroReady,
    blockers,
    campaignHeroReady,
    campaignHeroMediaAuthorityId,
    productAuthorityReady,
  };
}
