import "server-only";

import type { ProductMediaAuthorityRecord, ProductMediaReadiness } from "./product-media-authority";
import { evaluateProductMediaReadiness } from "./product-media-authority";
import type { GlwCampaign, GlwCampaignMediaPolicy } from "./campaign-types";

function dedupeIds(ids: readonly string[]): string[] {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}

export function resolveGlwCampaignMediaPolicy(campaign: GlwCampaign): GlwCampaignMediaPolicy {
  return {
    mode: campaign.campaignMediaPolicy?.mode === "EXPLICIT_ALLOWLIST" ? "EXPLICIT_ALLOWLIST" : "INHERIT_PRODUCT_MEDIA",
    allowlistMediaAuthorityIds: dedupeIds(campaign.campaignMediaPolicy?.allowlistMediaAuthorityIds ?? []),
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

export function evaluateCampaignProductMediaReadiness(input: {
  campaign: GlwCampaign;
  productMediaRecords: readonly ProductMediaAuthorityRecord[];
  stateCode?: string | null;
}): ProductMediaReadiness {
  const effectiveRecords = resolveEffectiveCampaignMediaRecords({
    campaign: input.campaign,
    productMediaRecords: input.productMediaRecords,
  });
  return evaluateProductMediaReadiness(effectiveRecords, { stateCode: input.stateCode ?? null });
}
