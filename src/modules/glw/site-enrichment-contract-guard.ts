import "server-only";

import type {
  GlwResearchRequirement,
  GlwResearchRequirementKind,
  GlwSiteEnrichmentRecord,
} from "@/modules/glw/site-enrichment-repository";
import type {
  GlwEnrichmentSourceTier,
} from "@/modules/glw/site-enrichment-authority";

export const GLW_STATE_SERVICE_RESEARCH_CONTRACT_VERSION =
  "state-service-research-v1" as const;

type RequirementContract = {
  requirementId: string;
  kind: GlwResearchRequirementKind;
  required: boolean;
  sourceTier: GlwEnrichmentSourceTier | null;
  minimumCount: number;
};

const BASE_STATE_SERVICE_REQUIREMENTS:
  readonly RequirementContract[] = [
    {
      requirementId: "source-product-first-party",
      kind: "source",
      required: true,
      sourceTier: "first_party",
      minimumCount: 1,
    },
    {
      requirementId: "source-state-government",
      kind: "source",
      required: true,
      sourceTier: "government",
      minimumCount: 1,
    },
    {
      requirementId: "source-state-tourism",
      kind: "source",
      required: true,
      sourceTier: "tourism_board",
      minimumCount: 1,
    },
    {
      requirementId: "source-reputable-news",
      kind: "source",
      required: false,
      sourceTier: "reputable_news",
      minimumCount: 1,
    },
    {
      requirementId: "link-internal-product",
      kind: "internal_link",
      required: true,
      sourceTier: null,
      minimumCount: 1,
    },
    {
      requirementId: "link-external-authority",
      kind: "external_link",
      required: true,
      sourceTier: "government",
      minimumCount: 1,
    },
  ];

const UPSTREAM_REQUIREMENT:
  RequirementContract = {
    requirementId: "link-upstream-source-of-truth",
    kind: "upstream_link",
    required: true,
    sourceTier: "first_party",
    minimumCount: 1,
  };

export const GLW_STATE_SERVICE_RESEARCH_REQUIREMENT_IDS = [
  ...BASE_STATE_SERVICE_REQUIREMENTS.map(
    (requirement) => requirement.requirementId,
  ),
  UPSTREAM_REQUIREMENT.requirementId,
] as const;

export type GlwResearchContractCompatibility = {
  compatible: boolean;
  contractVersion: typeof GLW_STATE_SERVICE_RESEARCH_CONTRACT_VERSION;
  expectedRequirementIds: readonly string[];
  actualRequirementIds: readonly string[];
  missingRequirementIds: readonly string[];
  obsoleteRequirementIds: readonly string[];
  duplicateRequirementIds: readonly string[];
  malformedRequirementIds: readonly string[];
};

function expectedRequirements(
  record: Pick<
    GlwSiteEnrichmentRecord,
    "pageType" | "upstreamAuthorityDomains"
  >,
): readonly RequirementContract[] {
  if (record.pageType !== "state_service") {
    return [];
  }

  return record.upstreamAuthorityDomains.length > 0
    ? [
        ...BASE_STATE_SERVICE_REQUIREMENTS,
        UPSTREAM_REQUIREMENT,
      ]
    : BASE_STATE_SERVICE_REQUIREMENTS;
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

function normalizedSourceTier(
  requirement: GlwResearchRequirement,
): GlwEnrichmentSourceTier | null {
  return requirement.sourceTier ?? null;
}

export function evaluateGlwResearchContractCompatibility(
  record: Pick<
    GlwSiteEnrichmentRecord,
    "pageType" | "upstreamAuthorityDomains" | "researchRequirements"
  >,
): GlwResearchContractCompatibility {
  const expectedContracts = expectedRequirements(record);
  const expected = expectedContracts.map(
    (requirement) => requirement.requirementId,
  );
  const expectedById = new Map(
    expectedContracts.map((requirement) => [
      requirement.requirementId,
      requirement,
    ]),
  );
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
  const malformedRequirementIds =
    record.researchRequirements
      .filter((requirement) => {
        const expectedRequirement = expectedById.get(
          requirement.requirementId,
        );
        if (!expectedRequirement) return false;

        return (
          requirement.kind !== expectedRequirement.kind
          || requirement.required !== expectedRequirement.required
          || normalizedSourceTier(requirement)
            !== expectedRequirement.sourceTier
          || requirement.minimumCount
            !== expectedRequirement.minimumCount
        );
      })
      .map((requirement) => requirement.requirementId);

  return {
    compatible:
      expected.length > 0
      && missingRequirementIds.length === 0
      && obsoleteRequirementIds.length === 0
      && duplicateRequirementIds.length === 0
      && malformedRequirementIds.length === 0
      && actual.length === expected.length,
    contractVersion: GLW_STATE_SERVICE_RESEARCH_CONTRACT_VERSION,
    expectedRequirementIds: expected,
    actualRequirementIds: actual,
    missingRequirementIds,
    obsoleteRequirementIds,
    duplicateRequirementIds,
    malformedRequirementIds,
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
      `Research contract mismatch (${result.contractVersion}); provider invocation blocked. Missing: ${result.missingRequirementIds.join(",") || "none"}; obsolete: ${result.obsoleteRequirementIds.join(",") || "none"}; duplicate: ${result.duplicateRequirementIds.join(",") || "none"}; malformed: ${result.malformedRequirementIds.join(",") || "none"}.`,
    );
  }
}
