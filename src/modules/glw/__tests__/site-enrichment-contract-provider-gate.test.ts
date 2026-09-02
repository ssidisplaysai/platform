jest.mock("server-only", () => ({}));

const originalPersistenceDirectory =
  process.env.GCP_FOUNDATION_PERSISTENCE_DIR;

const testPersistenceDirectory =
  `${process.cwd()}/.gcp-foundation-data-test-${process.env.JEST_WORKER_ID ?? "0"}-contract-provider-gate`;

beforeAll(() => {
  process.env.GCP_FOUNDATION_PERSISTENCE_DIR =
    testPersistenceDirectory;
});

afterAll(() => {
  if (originalPersistenceDirectory === undefined) {
    delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
    return;
  }
  process.env.GCP_FOUNDATION_PERSISTENCE_DIR =
    originalPersistenceDirectory;
});

import {
  initializeGlwSiteEnrichmentRecord,
  resetGlwSiteEnrichmentRepositoryForTests,
} from "../site-enrichment-repository";
import {
  buildGlwStateServiceResearchPlan,
} from "../site-enrichment-research-planner";
import {
  executeGlwSiteEnrichmentResearch,
  type GlwResearchProvider,
} from "../site-enrichment-research-executor";

beforeEach(() => {
  resetGlwSiteEnrichmentRepositoryForTests();
});

describe("GLW research provider contract gate", () => {
  it("blocks the provider before invocation when a persisted record has the obsolete geography requirement", async () => {
    const planned = buildGlwStateServiceResearchPlan({
      organizationId: "led-display-warehouse",
      siteId: "site-led-display-warehouse-production",
      siteDomain: "leddisplaywarehouse.com",
      productId: "prod-indoor-digital-sphere",
      productTopic: "Indoor Digital Sphere",
      campaignId: "campaign-contract-provider-gate",
      stateCode: "CO",
      stateName: "Colorado",
      canonicalPath: "/indoor-digital-sphere/colorado/",
      jobId: "job-contract-provider-gate",
      wordpressObjectId: "19853",
      upstreamAuthorityDomains: ["ssidisplays.com"],
    });

    const productIndex = planned.researchRequirements.findIndex(
      (requirement) =>
        requirement.requirementId === "link-internal-product",
    );

    const staleRequirements = [
      ...planned.researchRequirements.slice(0, productIndex + 1),
      {
        requirementId: "link-internal-geography",
        kind: "internal_link" as const,
        label: "Internal geography link",
        description: "Legacy requirement from the pre-repair contract.",
        required: true,
        sourceTier: null,
        minimumCount: 1,
        fulfilledSourceIds: [],
        fulfilledLinkIds: [],
      },
      ...planned.researchRequirements.slice(productIndex + 1),
    ];

    initializeGlwSiteEnrichmentRecord({
      enrichmentId: planned.enrichmentId,
      organizationId: planned.organizationId,
      siteId: planned.siteId,
      productId: planned.productId,
      campaignId: planned.campaignId,
      stateCode: planned.stateCode,
      canonicalPath: planned.canonicalPath,
      jobId: planned.jobId,
      wordpressObjectId: planned.wordpressObjectId,
      upstreamAuthorityDomains: planned.upstreamAuthorityDomains,
      researchRequirements: staleRequirements,
      plan: planned.emptyPlan,
    });

    let providerInvocations = 0;
    const provider: GlwResearchProvider = {
      async research() {
        providerInvocations += 1;
        throw new Error("provider must never be called");
      },
    };

    await expect(
      executeGlwSiteEnrichmentResearch({
        request: {
          organizationId: planned.organizationId,
          siteId: planned.siteId,
          campaignId: planned.campaignId,
          productId: planned.productId,
          stateCode: planned.stateCode,
          canonicalPath: planned.canonicalPath,
          jobId: planned.jobId,
          wordpressObjectId: planned.wordpressObjectId,
        },
        provider,
      }),
    ).rejects.toThrow(/provider invocation blocked/i);

    expect(providerInvocations).toBe(0);
  });
});
