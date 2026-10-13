import "server-only";

import type {
  GlwEnrichmentClaim,
  GlwEnrichmentSource,
} from "@/modules/glw/site-enrichment-authority";

export type GlwResearchContentSufficiency = {
  sufficient: boolean;
  productClaimCount: number;
  geographicClaimCount: number;
  failureReasons: readonly string[];
};

const GEOGRAPHIC_AUTHORITY_TIERS = new Set([
  "government",
  "tourism_board",
  "institutional",
  "reputable_news",
]);

export function evaluateGlwResearchContentSufficiency(input: {
  sources: readonly GlwEnrichmentSource[];
  claims: readonly GlwEnrichmentClaim[];
}): GlwResearchContentSufficiency {
  const sourcesById = new Map(
    input.sources.map((source) => [source.sourceId, source]),
  );

  const validProductClaims = input.claims.filter(
    (claim) =>
      claim.claimClass === "product"
      && claim.evidenceSourceIds.some(
        (sourceId) => sourcesById.get(sourceId)?.tier === "first_party",
      ),
  );

  const validGeographicClaims = input.claims.filter(
    (claim) =>
      claim.claimClass === "geography"
      && claim.evidenceSourceIds.some((sourceId) => {
        const tier = sourcesById.get(sourceId)?.tier;
        return Boolean(tier && GEOGRAPHIC_AUTHORITY_TIERS.has(tier));
      }),
  );

  const failureReasons: string[] = [];
  if (validProductClaims.length < 1) {
    failureReasons.push(
      "At least one evidence-backed product claim with first-party authority is required.",
    );
  }
  if (validGeographicClaims.length < 1) {
    failureReasons.push(
      "At least one evidence-backed geographic claim with qualified geographic authority is required.",
    );
  }

  return {
    sufficient: failureReasons.length === 0,
    productClaimCount: validProductClaims.length,
    geographicClaimCount: validGeographicClaims.length,
    failureReasons,
  };
}
