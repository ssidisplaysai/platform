jest.mock("server-only", () => ({}));

import { readFileSync } from "node:fs";
import { join } from "node:path";

jest.mock("../campaign-repository", () => ({
  listGlwCampaigns: () => [{
    campaignId: "campaign-outdoor",
    organizationId: "led-display-warehouse",
    siteId: "site-led-display-warehouse-production",
    productId: "prod-outdoor-digital-sphere",
    name: "Outdoor Sphere",
    pageType: "state_service",
    stateCodes: ["AL", "AK", "IN", "TX"],
    pagesPerDay: 1,
    publicationPolicy: "publish_after_gates",
    imageRequired: true,
    status: "draft",
    completedTargetCount: 0,
    failedTargetCount: 0,
    createdAt: "2026-09-14T00:00:00.000Z",
    updatedAt: "2026-09-14T00:00:00.000Z",
  }],
}));

jest.mock("../campaign-target-repository", () => {
  const actual = jest.requireActual("../campaign-target-repository");
  return { ...actual, listGlwCampaignTargets: () => [] };
});

jest.mock("../reference-state-selection-repository", () => ({
  getGlwReferenceStateSelection: () => ({ campaignId: "campaign-outdoor", organizationId: "led-display-warehouse", siteId: "site-led-display-warehouse-production", stateCode: "IN", selectedBy: "owner", selectedAt: "2026-09-14T00:00:00.000Z" }),
}));

jest.mock("@/modules/foundation/site-repository", () => ({
  getSiteById: () => ({ siteId: "site-led-display-warehouse-production", organizationId: "led-display-warehouse", displayName: "LED Display Warehouse", slug: "led-display-warehouse", domain: "leddisplaywarehouse.com", canonicalUrl: "https://leddisplaywarehouse.com", environment: "production", enabled: true, integrations: { wordpressApiBaseUrl: "https://leddisplaywarehouse.com/wp-json/wp/v2", wordpressCredentialReference: "credential" }, profiles: {} }),
}));

jest.mock("@/modules/foundation/product-repository", () => ({
  getProductById: () => ({ productId: "prod-outdoor-digital-sphere", organizationId: "led-display-warehouse", productName: "Outdoor Digital Sphere", displayName: "Outdoor Digital Sphere", slug: "outdoor-digital-sphere", assignedSiteIds: ["site-led-display-warehouse-production"], siteAssignments: [] }),
}));

jest.mock("../campaign-reference-repository", () => ({ getGlwCampaignKnowledgePack: () => ({ campaignId: "campaign-outdoor", instructions: "Approved instructions", references: [] }) }));
jest.mock("../reference-generation-authority", () => ({ resolveGlwReferenceGenerationAuthority: () => ({ claimAuthorityFingerprint: "c".repeat(64) }) }));
jest.mock("../page-execution-repository", () => ({ glwPageExecutionRepository: { list: jest.fn(async () => []) } }));
jest.mock("@/modules/foundation/rendered-visual-certification-repository", () => ({ listRenderedVisualCertifications: () => [] }));
jest.mock("../product-media-authority", () => ({
  listProductMediaAuthority: () => [
    { mediaAuthorityId: "hero", hash: "a".repeat(64), ownerApproval: "APPROVED", approvedUsageScopes: ["PRODUCT_AUTHORITY"], heroSelected: true, heroEligible: true, contextualUseAllowed: false, applicationUseAllowed: false, productRepresentationAllowed: true },
    { mediaAuthorityId: "supporting", hash: "b".repeat(64), ownerApproval: "APPROVED", approvedUsageScopes: ["CONTEXTUAL_IN_USE", "APPLICATION_EXPERIENCE"], heroSelected: false, heroEligible: false, contextualUseAllowed: true, applicationUseAllowed: true, productRepresentationAllowed: false },
  ],
  evaluateProductMediaReadiness: () => ({
    contractVersion: "GLW_PRODUCT_MEDIA_AUTHORITY_V1",
    state: "REFERENCE_COMPOSITION_MEDIA_READY",
    ready: true,
    approvedProductAuthorityMediaCount: 1,
    approvedContextualMediaCount: 1,
    approvedApplicationMediaCount: 1,
    approvedLocalAtmosphereMediaCount: 0,
    heroAuthorityReady: true,
    supportingProductMediaReady: true,
    applicationMediaReady: true,
    mediaProvenanceReady: true,
    productFactAuthorityScope: "NAVIGATION_AND_PRODUCT_IDENTITY_ONLY",
    productFactsExpanded: false,
    blockers: [],
  }),
}));

import type { AuthenticatedWordPressReadAuthority } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { resolveTargetParameterizedRichReferenceProduction } from "../target-parameterized-rich-reference-production";

function wordpressAuthority(): AuthenticatedWordPressReadAuthority {
  const bodies = [
    [{ id: 20114, slug: "outdoor-digital-sphere", parent: 0, status: "draft" }],
    [],
  ];
  return { getJson: jest.fn(async () => ({ ok: true as const, body: bodies.shift(), pagination: { total: null, totalPages: null } })) };
}

describe("target-parameterized rich-reference production", () => {
  test("resolves Alaska as the next state and proves Boundary A without creating artifacts", async () => {
    const result = await resolveTargetParameterizedRichReferenceProduction({ campaignId: "campaign-outdoor", wordpressReadAuthority: wordpressAuthority() });

    expect(result).toMatchObject({
      targetSource: "PROJECTED_CAMPAIGN_AUTHORITY",
      target: { targetId: "target-campaign-outdoor-ak", stateCode: "AK", stateName: "Alaska", status: "queued" },
      identity: { siteId: "site-led-display-warehouse-production", productId: "prod-outdoor-digital-sphere", canonicalSlug: "alaska", canonicalPath: "/outdoor-digital-sphere/alaska/", wordpressParentId: "20114", wordpressObjectId: null },
      authority: { campaignResolved: true, siteResolved: true, productResolved: true, parentResolved: true, mediaResolved: true, claimResolved: true, hostIntegrationProfileResolved: true, heroMediaAuthorityId: "hero", supportingMediaAuthorityId: "supporting", candidateArtifactIdentity: null, candidateArtifactSha: null, certificationIdentity: null, expectedStoredContentSha: null },
      mediaPolicy: { existingProductMediaReusable: true, generatedContextualMediaSupported: true, generatedMediaCannotProveProductFacts: true, localAtmosphereRequired: false },
      hostPolicy: { integrationPolicy: "GENESIS_RICH_PAGE_HOST_CONTAINMENT_V1", suppressNativeTitle: true, suppressFeaturedMedia: false },
      targetRequiresNewArchitecture: false,
      targetRequiresNewCode: false,
      draftProductionReady: true,
      publicationProductionReady: true,
      generationAttempted: false,
      wordpressMutation: false,
    });
    expect(Object.values(result.stages).every(Boolean)).toBe(true);
    expect(result.awaitingProductionInputs).toEqual(["SEMANTIC_GENERATION_ARTIFACT", "CANDIDATE_ARTIFACT_IDENTITY", "ACTUAL_HOST_VISUAL_CERTIFICATION", "WORDPRESS_STORED_CONTENT_SHA", "OWNER_CANDIDATE_REVIEW"]);
  });

  test("resolves Indiana through the same target-parameterized coordinator", async () => {
    const result = await resolveTargetParameterizedRichReferenceProduction({ campaignId: "campaign-outdoor", targetId: "target-campaign-outdoor-in", wordpressReadAuthority: wordpressAuthority() });
    expect(result.target).toMatchObject({ stateCode: "IN", stateName: "Indiana", status: "reference_complete" });
    expect(result.hostPolicy.suppressNativeTitle).toBe(true);
    expect(result.targetRequiresNewCode).toBe(false);
  });

  test("keeps target literals out of the reusable orchestration path and publication fail-closed", () => {
    const files = [
      "src/modules/glw/target-parameterized-rich-reference-production.ts",
      "src/modules/glw/target-rich-reference-artifact-producer.ts",
      "src/modules/glw/target-rich-reference-production-operation.ts",
      "src/app/api/glw/campaigns/[campaignId]/rich-reference-production/route.ts",
      "src/app/api/glw/campaigns/[campaignId]/reference-page/route.ts",
      "src/modules/glw/reference-owner-review-readiness.ts",
      "src/modules/glw/rich-reference-composition.ts",
      "src/modules/glw/rich-reference-composition-resolver.ts",
    ].map((path) => readFileSync(join(process.cwd(), path), "utf8"));
    const forbidden = [/Indiana/, /\bIN\b/, /20115/, /20114/, /\/outdoor-digital-sphere\/indiana\//, /visual-certification-67380ab5-6516-4e96-ad87-d367f86ca99b/, /b20cf87b147b2dfbc77dcbabdb29e7b2754eade283dc8e692e358ddc89d38bac/];

    for (const source of files) for (const pattern of forbidden) expect(source).not.toMatch(pattern);
    expect(files[3]).toContain("export async function POST");
    expect(files[3]).toContain("runTargetRichReferenceProductionOperation");
    expect(files[3]).not.toContain("execute_workflow");
    expect(files[0]).toContain("publicationProductionReady: true");
  });
});
