import type { ProductConfiguration, SiteConfiguration } from "@/modules/foundation/types";
import {
  GLW_CITIES,
  GLW_STATES,
  createDefaultGlwGenerationInput,
  createGlwCanonicalPath,
  getGlwCitiesForState,
  type GlwGenerationProduct,
  type GlwGenerationSite,
} from "./page-generation";
import type { GlwTargetPreflightResult } from "./target-preflight";
import { resolveGlwN8nEngineProductSlug } from "./page-execution";

export type GlwCampaignReach =
  | "NATIONWIDE"
  | "STATE"
  | "MULTI_STATE_REGION"
  | "METRO_LOCAL"
  | "CUSTOM";

export type GlwCampaignReadiness =
  | "READY"
  | "READY_WITH_REVIEW"
  | "AUTHORITY_REQUIRED"
  | "TARGET_CONFLICTS"
  | "UNSUPPORTED"
  | "ANALYSIS_FAILED";

export type GlwCampaignLaunchpadInput = {
  reach: GlwCampaignReach;
  productUrl: string;
  stateCodes?: readonly string[];
  metro?: string;
};

export type GlwCampaignLaunchpadTarget = {
  stateCode: string;
  stateName: string;
  citySlug: string;
  cityName: string;
  canonicalPath: string;
};

export type GlwCampaignLaunchpadPreflight = {
  site: { id: string; name: string };
  product: { id: string; name: string } | null;
  canonicalProductUrl: string;
  productAuthorityState: "READY" | "REQUIRES_AUTHORITY";
  sourceAuthorityState: "READY" | "REQUIRES_AUTHORITY";
  desiredReach: GlwCampaignReach;
  existingCoverage: number;
  existingCampaignConflicts: number | "UNAVAILABLE";
  duplicateTargetsExcluded: number;
  cannibalizationConflicts: number | "UNAVAILABLE";
  availableEligibleTargets: number;
  authorityBlockedTargets: number;
  potentialReach: number;
  recommendedInitialBatch: number;
  maximumSafeReach: number;
  publicationPolicy: string;
  readiness: GlwCampaignReadiness;
  blockers: readonly string[];
  targets: readonly GlwCampaignLaunchpadTarget[];
  technicalDetails: {
    targetAuthority: "AUTHORITATIVE" | "PARTIAL" | "UNAVAILABLE";
    sourceMode: "PRODUCT_CANONICAL";
  };
};

export type GlwCampaignLaunchpadValidation = {
  valid: boolean;
  issues: readonly { field: "productUrl" | "reach" | "stateCodes" | "metro"; message: string }[];
};

export function validateGlwCampaignLaunchpadInput(
  input: GlwCampaignLaunchpadInput,
): GlwCampaignLaunchpadValidation {
  const issues: { field: "productUrl" | "reach" | "stateCodes" | "metro"; message: string }[] = [];
  try {
    const url = new URL(input.productUrl);
    if (!(["http:", "https:"] as string[]).includes(url.protocol) || url.username || url.password) {
      issues.push({ field: "productUrl", message: "Enter a public HTTP or HTTPS product URL without credentials." });
    }
  } catch {
    issues.push({ field: "productUrl", message: "Enter a valid product URL." });
  }

  const stateCodes = input.stateCodes ?? [];
  if ((input.reach === "STATE" || input.reach === "MULTI_STATE_REGION") && stateCodes.length === 0) {
    issues.push({ field: "stateCodes", message: "Select at least one supported state." });
  }
  if (stateCodes.some((code) => !GLW_STATES.some((state) => state.code === code))) {
    issues.push({ field: "stateCodes", message: "One or more selected states are not supported." });
  }
  if (input.reach === "METRO_LOCAL" && !input.metro?.trim()) {
    issues.push({ field: "metro", message: "Select a supported metro." });
  }
  if (input.reach === "CUSTOM") {
    issues.push({ field: "reach", message: "Custom reach is not yet supported by the current campaign target authority." });
  }
  return { valid: issues.length === 0, issues };
}

function normalizeOrigin(url: string): string | null {
  try {
    return new URL(url).origin.toLowerCase();
  } catch {
    return null;
  }
}

export function resolveGlwLaunchpadSite(
  productUrl: string,
  sites: readonly SiteConfiguration[],
  organizationId: string,
): SiteConfiguration | null {
  const origin = normalizeOrigin(productUrl);
  if (!origin) return null;
  return sites.find((site) =>
    site.organizationId === organizationId
    && [site.canonicalUrl, site.domain ? `https://${site.domain}` : null]
      .some((candidate) => candidate && normalizeOrigin(candidate) === origin)) ?? null;
}

export function resolveGlwLaunchpadProduct(
  productUrl: string,
  site: SiteConfiguration,
  products: readonly ProductConfiguration[],
): ProductConfiguration | null {
  const segments = new URL(productUrl).pathname.split("/").filter(Boolean);
  return products.find((product) => {
    const assignment = product.siteAssignments.find((item) => item.siteId === site.siteId);
    let engineSlug: string | null = null;
    try {
      engineSlug = resolveGlwN8nEngineProductSlug(product.productId);
    } catch {
      engineSlug = null;
    }
    const slugs = [assignment?.siteSpecificSlug, product.slug, engineSlug].filter(Boolean);
    return product.organizationId === site.organizationId
      && product.assignedSiteIds.includes(site.siteId)
      && slugs.some((slug) => segments.includes(slug!));
  }) ?? null;
}

export function selectGlwLaunchpadTargets(input: GlwCampaignLaunchpadInput): readonly Omit<GlwCampaignLaunchpadTarget, "canonicalPath">[] {
  if (input.reach === "NATIONWIDE") return GLW_CITIES.map((city) => ({
    stateCode: city.stateCode,
    stateName: GLW_STATES.find((state) => state.code === city.stateCode)?.name ?? city.stateCode,
    citySlug: city.slug,
    cityName: city.name,
  }));
  if (input.reach === "STATE" || input.reach === "MULTI_STATE_REGION") {
    return (input.stateCodes ?? []).flatMap((code) => getGlwCitiesForState(code).map((city) => ({
      stateCode: city.stateCode,
      stateName: GLW_STATES.find((state) => state.code === city.stateCode)?.name ?? city.stateCode,
      citySlug: city.slug,
      cityName: city.name,
    })));
  }
  if (input.reach === "METRO_LOCAL") {
    const metro = input.metro?.trim().toLowerCase();
    return GLW_CITIES.filter((city) => city.metro.toLowerCase() === metro).map((city) => ({
      stateCode: city.stateCode,
      stateName: GLW_STATES.find((state) => state.code === city.stateCode)?.name ?? city.stateCode,
      citySlug: city.slug,
      cityName: city.name,
    }));
  }
  return [];
}

export async function buildGlwCampaignLaunchpadPreflight(input: {
  request: GlwCampaignLaunchpadInput;
  organizationId: string;
  sites: readonly SiteConfiguration[];
  products: readonly ProductConfiguration[];
  readTarget: (target: GlwCampaignLaunchpadTarget, site: SiteConfiguration, product: ProductConfiguration) => Promise<GlwTargetPreflightResult>;
}): Promise<GlwCampaignLaunchpadPreflight> {
  const validation = validateGlwCampaignLaunchpadInput(input.request);
  if (!validation.valid) throw new Error(validation.issues[0]?.message ?? "Campaign input is invalid.");
  const site = resolveGlwLaunchpadSite(input.request.productUrl, input.sites, input.organizationId);
  if (!site) throw new Error("This URL does not match a registered site in the current workspace.");
  const product = resolveGlwLaunchpadProduct(input.request.productUrl, site, input.products);
  const selectedTargets = selectGlwLaunchpadTargets(input.request);
  if (selectedTargets.length === 0) throw new Error("No supported targets match the selected reach.");

  const targets = selectedTargets.map((target) => ({
    ...target,
    canonicalPath: createGlwCanonicalPath({
      productSlug: product?.siteAssignments.find((item) => item.siteId === site.siteId)?.siteSpecificSlug ?? product?.slug ?? "unknown-product",
      stateCode: target.stateCode,
      citySlug: target.citySlug,
    }),
  }));
  const productAssignment = product?.siteAssignments.find((item) => item.siteId === site.siteId);
  const siteAuthorityReady = site.enabled && site.publishingStatus === "ready";
  const productAuthorityReady = Boolean(
    product?.enabled
    && product.catalogStatus === "ready"
    && productAssignment?.enabledForSite
    && ["ready", "published"].includes(productAssignment.publicationStatus),
  );
  const sourceAuthorityReady = Boolean(product?.sourceEvidenceReference);
  const blockers: string[] = [];
  if (!siteAuthorityReady) blockers.push("Site publication authority is not ready for campaign launch.");
  if (!product) blockers.push("The product URL does not match an existing Genesis product assigned to this site.");
  else {
    if (!productAuthorityReady) blockers.push("Product authority requires review before campaign launch.");
    if (!sourceAuthorityReady) blockers.push("Source authority is not available for this product.");
  }

  const targetResults = product
    ? await Promise.all(targets.map((target) => input.readTarget(target, site, product)))
    : [];
  const existingCoverage = targetResults.filter((target) => target.state === "EXISTS_PUBLISHED" || target.state === "EXISTS_DRAFT").length;
  const unknownTargets = targetResults.filter((target) => target.state === "UNKNOWN").length;
  const availableEligibleTargets = siteAuthorityReady && productAuthorityReady && sourceAuthorityReady
    ? targetResults.filter((target) => target.state === "ABSENT").length
    : 0;
  const authorityBlockedTargets = siteAuthorityReady && productAuthorityReady && sourceAuthorityReady ? unknownTargets : targets.length - existingCoverage;
  if (unknownTargets > 0) blockers.push(`${unknownTargets} targets lack authoritative duplicate verification.`);
  const readiness: GlwCampaignReadiness = blockers.some((blocker) => blocker.includes("authority") || blocker.includes("Authority"))
    ? "AUTHORITY_REQUIRED"
    : unknownTargets > 0
      ? "READY_WITH_REVIEW"
      : availableEligibleTargets > 0
        ? "READY"
        : "TARGET_CONFLICTS";
  const policy = site.defaultPublicationStatus === "draft" ? "Draft Only" : "Existing Site Policy";

  return {
    site: { id: site.siteId, name: site.displayName },
    product: product ? { id: product.productId, name: product.displayName } : null,
    canonicalProductUrl: new URL(input.request.productUrl).toString(),
    productAuthorityState: productAuthorityReady ? "READY" : "REQUIRES_AUTHORITY",
    sourceAuthorityState: sourceAuthorityReady ? "READY" : "REQUIRES_AUTHORITY",
    desiredReach: input.request.reach,
    existingCoverage,
    existingCampaignConflicts: "UNAVAILABLE",
    duplicateTargetsExcluded: existingCoverage,
    cannibalizationConflicts: "UNAVAILABLE",
    availableEligibleTargets,
    authorityBlockedTargets,
    potentialReach: targets.length,
    recommendedInitialBatch: Math.min(25, availableEligibleTargets),
    maximumSafeReach: availableEligibleTargets,
    publicationPolicy: policy,
    readiness,
    blockers,
    targets,
    technicalDetails: {
      targetAuthority: unknownTargets > 0 ? "PARTIAL" : targetResults.length > 0 ? "AUTHORITATIVE" : "UNAVAILABLE",
      sourceMode: "PRODUCT_CANONICAL",
    },
  };
}

export function createGlwLaunchpadGenerationForm(
  target: GlwCampaignLaunchpadTarget,
  site: GlwGenerationSite,
  product: GlwGenerationProduct,
) {
  return createDefaultGlwGenerationInput(site, product, "city_service", target.stateCode, target.citySlug);
}