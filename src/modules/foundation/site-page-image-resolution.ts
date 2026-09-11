import type { SitePageImageRequirement, SitePageImageRequirementPurpose } from "./site-page-generation";

export type SitePageImageResolutionPolicy = "GENERATED_OR_OWNER_ASSET" | "OWNER_ASSET_ONLY";

export function resolveSitePageImageRequirement(requirement: SitePageImageRequirement): {
  purpose: SitePageImageRequirementPurpose;
  policy: SitePageImageResolutionPolicy;
  generatedVisualAllowed: boolean;
  ownerAssetAllowed: true;
} {
  const purpose = requirement.purpose ?? requirement.source;
  const policy = requirement.resolutionPolicy ?? "GENERATED_OR_OWNER_ASSET";
  return {
    purpose,
    policy,
    generatedVisualAllowed: policy === "GENERATED_OR_OWNER_ASSET",
    ownerAssetAllowed: true,
  };
}