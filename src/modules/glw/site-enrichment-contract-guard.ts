import "server-only";

import type {
  GlwResearchRequirement,
  GlwSiteEnrichmentRecord,
} from "@/modules/glw/site-enrichment-repository";

export const GLW_STATE_SERVICE_RESEARCH_CONTRACT_VERSION =
  "state-service-research-v1" as const;

export const GLW_STATE_SERVICE_RESEARCH_REQUIREMENT_IDS = [
  "source-product-first-party",
  "source-state-government",
  "source-state-tourism",
  "source-reputable-news",
  "link-internal-product",
  "link-external-authority",
  "link-upstream-source-of-truth",
] as const;

export type GlwResearchContractCompatibility = {
  compatible: boolean;
  contractVersion: typeof GLW_STATE_SERVICE_RESEARCH_CONTRACT_VERSION;
  expectedRequirementIds: readonly string[];
  actualRequirementIds: readonly string[];
  missingRequirementIds: readonly string[];
  obsoleteRequirementIds: readonly string[];
  duplicateRequirementIds: readonly string[];
};

function expectedRequirementIds(
  record: Pick<
    GlwSiteEnrichmentRecord,
    "pageType" | "upstreamAuthorityDomains"
  >,
): readonly string[] {
  if (record.pageType !== "state_service") {
    return [];
  }

  return GLW_STATE_SERVICE_RESEARCH_REQUIREMENT_IDS.filter(
    (requirementId) =>
      requirementId !== "link-upstream-source-of-truth"
      || record.upstreamAuthorityDomains.length > 0,
  );
}

function duplicateIds(
  requirements: readonly GlwResearchRequirement[],
): readonly string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const requirement of requirements) {
    if (seen.has(requirement.requirementId)) {
      duplicates.add(requirement.requirementId);
    }
    seen.add(requirement.requirementId);
  }

  return [...duplicates].sort();
}

export function evaluateGlwResearchContractCompatibility(
  record: Pick<
    GlwSiteEnrichmentRecord,
    "pageType" | "upstreamAuthorityDomains" | "researchRequirements"
  >,
): GlwResearchContractCompatibility {
  const expected = expectedRequirementIds(record);
  const actual = record.researchRequirements.map(
    (requirement) => requirement.requirementId,
  );
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);

  const missingRequirementIds = expected.filter(
    (requirementId) => !actualSet.has(requirementId),
  );
  const obsoleteRequirementIds = actual.filter(
    (requirementId) => !expectedSet.has(requirementId),
  );
  const duplicateRequirementIds = duplicateIds(
    record.researchRequirements,
  );

  return {
    compatible:
      expected.length > 0
      && missingRequirementIds.length === 0
      && obsoleteRequirementIds.length === 0
      && duplicateRequirementIds.length === 0
      && actual.length === expected.length,
    contractVersion: GLW_STATE_SERVICE_RESEARCH_CONTRACT_VERSION,
    expectedRequirementIds: expected,
    actualRequirementIds: actual,
    missingRequirementIds,
    obsoleteRequirementIds,
    duplicateRequirementIds,
  };
}

export function assertGlwResearchContractCompatible(
  record: Pick<
    GlwSiteEnrichmentRecord,
    "pageType" | "upstreamAuthorityDomains" | "researchRequirements"
  >,
): void {
  const result = evaluateGlwResearchContractCompatibility(record);

  if (!result.compatible) {
    throw new Error(
      `Research contract mismatch (${result.contractVersion}); provider invocation blocked. Missing: ${result.missingRequirementIds.join(",") || "none"}; obsolete: ${result.obsoleteRequirementIds.join(",") || "none"}; duplicate: ${result.duplicateRequirementIds.join(",") || "none"}.`,
    );
  }
}
