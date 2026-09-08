import type { GlwCampaignAuthoritySnapshot } from "./campaign-authority";
import { GLW_CITIES } from "./page-generation";

export type GlwTargetIntentIdentity = {
  siteId: string;
  productId: string;
  pageType: "city_service";
  stateCode: string;
  citySlug: string;
  parentGeography: string;
};

export type GlwTargetIntentOwnership = {
  classification:
    | "CLEAR"
    | "EXISTING_INTENT_OWNER"
    | "PARENT_CHILD_CONFLICT"
    | "SAME_PRODUCT_GEO_CONFLICT"
    | "AMBIGUOUS"
    | "UNAVAILABLE";
  identity: GlwTargetIntentIdentity;
  campaignId: string | null;
  targetState: string | null;
  reason: string;
  authoritySource: "GLW_CAMPAIGN_TARGET_INTENT";
};

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function createGlwTargetIntentIdentity(input: {
  siteId: string;
  productId: string;
  stateCode: string;
  citySlug: string;
}): GlwTargetIntentIdentity {
  return {
    siteId: input.siteId.trim(),
    productId: input.productId.trim(),
    pageType: "city_service",
    stateCode: input.stateCode.trim().toUpperCase(),
    citySlug: normalizeSlug(input.citySlug),
    parentGeography: input.stateCode.trim().toUpperCase(),
  };
}

export function evaluateGlwTargetIntentOwnership(input: {
  snapshot: GlwCampaignAuthoritySnapshot | null;
  identity: GlwTargetIntentIdentity;
}): GlwTargetIntentOwnership {
  if (!input.snapshot) {
    return { classification: "UNAVAILABLE", identity: input.identity, campaignId: null, targetState: null, reason: "Campaign target intent persistence is unavailable.", authoritySource: "GLW_CAMPAIGN_TARGET_INTENT" };
  }
  const registryMatches = GLW_CITIES.filter((city) => city.stateCode === input.identity.stateCode && city.slug === input.identity.citySlug);
  if (registryMatches.length !== 1) {
    return { classification: "AMBIGUOUS", identity: input.identity, campaignId: null, targetState: null, reason: "The city identity is not unique in the authoritative GLW geography registry.", authoritySource: "GLW_CAMPAIGN_TARGET_INTENT" };
  }
  const matches = input.snapshot.targets.filter((target) =>
    target.siteId === input.identity.siteId
    && target.productId === input.identity.productId
    && target.stateCode.trim().toUpperCase() === input.identity.stateCode
    && normalizeSlug(target.citySlug ?? "") === input.identity.citySlug,
  );
  if (matches.length > 1) {
    return { classification: "AMBIGUOUS", identity: input.identity, campaignId: null, targetState: null, reason: "Multiple campaign targets own the same deterministic product and city intent.", authoritySource: "GLW_CAMPAIGN_TARGET_INTENT" };
  }
  if (matches.length === 1) {
    return { classification: "EXISTING_INTENT_OWNER", identity: input.identity, campaignId: matches[0].campaignId, targetState: matches[0].status, reason: "A persisted campaign target owns this product and city intent.", authoritySource: "GLW_CAMPAIGN_TARGET_INTENT" };
  }
  const canonicalCityName = registryMatches[0].name.trim().toLowerCase();
  const sameGeoMatches = input.snapshot.targets.filter((target) =>
    target.siteId === input.identity.siteId
    && target.productId === input.identity.productId
    && target.stateCode.trim().toUpperCase() === input.identity.stateCode
    && target.cityName?.trim().toLowerCase() === canonicalCityName
    && normalizeSlug(target.citySlug ?? "") !== input.identity.citySlug,
  );
  if (sameGeoMatches.length > 1) {
    return { classification: "AMBIGUOUS", identity: input.identity, campaignId: null, targetState: null, reason: "Multiple persisted aliases claim the same product and city geography.", authoritySource: "GLW_CAMPAIGN_TARGET_INTENT" };
  }
  if (sameGeoMatches.length === 1) {
    return { classification: "SAME_PRODUCT_GEO_CONFLICT", identity: input.identity, campaignId: sameGeoMatches[0].campaignId, targetState: sameGeoMatches[0].status, reason: "The same product and city geography is persisted under another city slug.", authoritySource: "GLW_CAMPAIGN_TARGET_INTENT" };
  }
  return { classification: "CLEAR", identity: input.identity, campaignId: null, targetState: null, reason: "The checked campaign target index has no owner for this deterministic product and city intent.", authoritySource: "GLW_CAMPAIGN_TARGET_INTENT" };
}