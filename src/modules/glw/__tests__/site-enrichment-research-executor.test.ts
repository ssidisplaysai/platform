jest.mock("server-only", () => ({}));

const originalPersistenceDirectory =
  process.env.GCP_FOUNDATION_PERSISTENCE_DIR;

const testPersistenceDirectory =
  `${process.cwd()}/.gcp-foundation-data-test-${process.env.JEST_WORKER_ID ?? "0"}-research-executor`;

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
  type GlwResearchExecutionRequest,
  type GlwResearchProvider,
} from "../site-enrichment-research-executor";

function request():
  GlwResearchExecutionRequest {
  return {
    organizationId:
      "led-display-warehouse",
    siteId:
      "site-led-display-warehouse-production",
    campaignId:
      "campaign-research-executor-test",
    productId:
      "prod-indoor-digital-sphere",
    stateCode: "CO",
    canonicalPath:
      "/indoor-digital-sphere/colorado/",
    jobId:
      "job-colorado-research",
    wordpressObjectId:
      "19853",
  };
}

function initialize() {
  const executionRequest =
    request();

  const planned =
    buildGlwStateServiceResearchPlan({
      organizationId:
        executionRequest.organizationId,
      siteId:
        executionRequest.siteId,
      siteDomain:
        "leddisplaywarehouse.com",
      productId:
        executionRequest.productId,
      productTopic:
        "Indoor Digital Sphere",
      campaignId:
        executionRequest.campaignId,
      stateCode:
        executionRequest.stateCode,
      stateName:
        "Colorado",
      canonicalPath:
        executionRequest.canonicalPath,
      jobId:
        executionRequest.jobId,
      wordpressObjectId:
        executionRequest.wordpressObjectId,
      upstreamAuthorityDomains: [
        "ssidisplays.com",
      ],
    });

  return initializeGlwSiteEnrichmentRecord({
    enrichmentId:
      planned.enrichmentId,
    organizationId:
      planned.organizationId,
    siteId:
      planned.siteId,
    productId:
      planned.productId,
    campaignId:
      planned.campaignId,
    stateCode:
      planned.stateCode,
    canonicalPath:
      planned.canonicalPath,
    jobId:
      planned.jobId,
    wordpressObjectId:
      planned.wordpressObjectId,
    upstreamAuthorityDomains:
      planned.upstreamAuthorityDomains,
    researchRequirements:
      planned.researchRequirements,
    plan:
      planned.emptyPlan,
  });
}

function completeProvider():
  GlwResearchProvider {
  return {
    async research(input) {
      return {
        ...input,
        sources: [
          {
            sourceId:
              "product-source",
            title:
              "Indoor Digital Sphere",
            url:
              "https://ssidisplays.com/digital-spheres/",
            domain:
              "ssidisplays.com",
            tier:
              "first_party",
            publisher:
              "Screen Solutions International",
            retrievedAt:
              "2026-09-01T09:00:00.000Z",
          },
          {
            sourceId:
              "state-source",
            title:
              "State of Colorado",
            url:
              "https://co.colorado.gov/",
            domain:
              "co.colorado.gov",
            tier:
              "government",
            publisher:
              "State of Colorado",
            retrievedAt:
              "2026-09-01T09:00:00.000Z",
          },
          {
            sourceId:
              "tourism-source",
            title:
              "Colorado Tourism",
            url:
              "https://www.colorado.com/",
            domain:
              "colorado.com",
            tier:
              "tourism_board",
            publisher:
              "Colorado Tourism Office",
            retrievedAt:
              "2026-09-01T09:00:00.000Z",
          },
        ],
        claims: [
          {
            claimId:
              "product-claim",
            claimClass:
              "product",
            statement:
              "Indoor digital spheres are available for commercial display applications.",
            evidenceSourceIds: [
              "product-source",
            ],
          },
          {
            claimId:
              "geography-claim",
            claimClass:
              "geography",
            statement:
              "Colorado provides official state and tourism resources.",
            evidenceSourceIds: [
              "state-source",
              "tourism-source",
            ],
          },
        ],
        links: [
          {
            linkId:
              "internal-product",
            kind:
              "internal",
            href:
              "/indoor-digital-sphere/",
            anchorText:
              "Indoor Digital Sphere",
          },
          {
            linkId:
              "external-state",
            kind:
              "external_authority",
            href:
              "https://co.colorado.gov/",
            anchorText:
              "State of Colorado",
            sourceId:
              "state-source",
          },
          {
            linkId:
              "upstream-product",
            kind:
              "upstream_source_of_truth",
            href:
              "https://ssidisplays.com/digital-spheres/",
            anchorText:
              "Indoor Digital Sphere technical information",
            sourceId:
              "product-source",
          },
        ],
        fulfillment: {
          "source-product-first-party": {
            sourceIds: [
              "product-source",
            ],
          },
          "source-state-government": {
            sourceIds: [
              "state-source",
            ],
          },
          "source-state-tourism": {
            sourceIds: [
              "tourism-source",
            ],
          },
          "link-internal-product": {
            linkIds: [
              "internal-product",
            ],
          },
          "link-external-authority": {
            linkIds: [
              "external-state",
            ],
          },
          "link-upstream-source-of-truth": {
            linkIds: [
              "upstream-product",
            ],
          },
        },
      };
    },
  };
}

describe(
  "GLW research executor",
  () => {
    beforeEach(() => {
      resetGlwSiteEnrichmentRepositoryForTests();
    });

    test(
      "moves a fully evidenced work item to research_ready",
      async () => {
        initialize();

        const result =
          await executeGlwSiteEnrichmentResearch({
            request:
              request(),
            provider:
              completeProvider(),
          });

        expect(result.record.status)
          .toBe("research_ready");

        expect(result.researchReady)
          .toBe(true);

        expect(
          result.record.plan.sources.length,
        ).toBe(3);

        expect(
          result.record.plan.claims.length,
        ).toBe(2);

        expect(
          result.record.plan.links.length,
        ).toBe(3);

        expect(
          result.wordpressMutationPerformed,
        ).toBe(false);

        expect(
          result.generationPerformed,
        ).toBe(false);

        expect(
          result.publicationPerformed,
        ).toBe(false);

        expect(
          result.certificationPerformed,
        ).toBe(false);
      },
    );

    test.each([
      ["zero claims", []],
      ["product only", [
        {
          claimId: "product-claim",
          claimClass: "product" as const,
          statement: "Product claim.",
          evidenceSourceIds: ["product-source"],
        },
      ]],
      ["geography only", [
        {
          claimId: "geography-claim",
          claimClass: "geography" as const,
          statement: "Geography claim.",
          evidenceSourceIds: ["state-source"],
        },
      ]],
      ["product without first-party authority", [
        {
          claimId: "product-claim",
          claimClass: "product" as const,
          statement: "Product claim.",
          evidenceSourceIds: ["state-source"],
        },
        {
          claimId: "geography-claim",
          claimClass: "geography" as const,
          statement: "Geography claim.",
          evidenceSourceIds: ["state-source"],
        },
      ]],
      ["geography without qualified authority", [
        {
          claimId: "product-claim",
          claimClass: "product" as const,
          statement: "Product claim.",
          evidenceSourceIds: ["product-source"],
        },
        {
          claimId: "geography-claim",
          claimClass: "geography" as const,
          statement: "Geography claim.",
          evidenceSourceIds: ["product-source"],
        },
      ]],
    ])("remains research_pending with fulfilled requirements but insufficient content: %s", async (_label, claims) => {
      initialize();
      const baseProvider = completeProvider();
      const provider: GlwResearchProvider = {
        async research(input) {
          const acquisition = await baseProvider.research(input);
          return {
            ...acquisition,
            claims,
          };
        },
      };

      const result =
        await executeGlwSiteEnrichmentResearch({
          request: request(),
          provider,
        });

      expect(result.record.status)
        .toBe("research_pending");
      expect(result.researchReady)
        .toBe(false);
    });

    test(
      "remains research_pending when required evidence is incomplete",
      async () => {
        initialize();

        const provider =
          completeProvider();

        const incomplete:
          GlwResearchProvider = {
          async research(input) {
            const result =
              await provider.research(
                input,
              );

            return {
              ...result,
              fulfillment: {
                ...result.fulfillment,
                "source-state-tourism": {
                  sourceIds: [],
                },
              },
            };
          },
        };

        const result =
          await executeGlwSiteEnrichmentResearch({
            request:
              request(),
            provider:
              incomplete,
          });

        expect(result.record.status)
          .toBe("research_pending");

        expect(result.researchReady)
          .toBe(false);
      },
    );

    test(
      "rejects evidence returned for another page identity",
      async () => {
        initialize();

        const provider:
          GlwResearchProvider = {
          async research(input) {
            const result =
              await completeProvider()
                .research(input);

            return {
              ...result,
              stateCode: "CA",
            };
          },
        };

        await expect(
          executeGlwSiteEnrichmentResearch({
            request:
              request(),
            provider,
          }),
        ).rejects.toThrow(
          /different page identity/i,
        );
      },
    );

    test(
      "rejects a mismatched source domain",
      async () => {
        initialize();

        const provider:
          GlwResearchProvider = {
          async research(input) {
            const result =
              await completeProvider()
                .research(input);

            return {
              ...result,
              sources:
                result.sources.map(
                  (source) =>
                    source.sourceId
                      === "state-source"
                      ? {
                          ...source,
                          domain:
                            "example.com",
                        }
                      : source,
                ),
            };
          },
        };

        await expect(
          executeGlwSiteEnrichmentResearch({
            request:
              request(),
            provider,
          }),
        ).rejects.toThrow(
          /URL\/domain identity/i,
        );
      },
    );

    test(
      "rejects a source requirement fulfilled with the wrong tier",
      async () => {
        initialize();

        const provider:
          GlwResearchProvider = {
          async research(input) {
            const result =
              await completeProvider()
                .research(input);

            return {
              ...result,
              fulfillment: {
                ...result.fulfillment,
                "source-state-government": {
                  sourceIds: [
                    "product-source",
                  ],
                },
              },
            };
          },
        };

        await expect(
          executeGlwSiteEnrichmentResearch({
            request:
              request(),
            provider,
          }),
        ).rejects.toThrow(
          /invalid source tier/i,
        );
      },
    );

    test(
      "rejects an upstream fulfillment outside configured authority domains",
      async () => {
        initialize();

        const provider:
          GlwResearchProvider = {
          async research(input) {
            const result =
              await completeProvider()
                .research(input);

            return {
              ...result,
              sources: [
                ...result.sources,
                {
                  sourceId:
                    "wrong-upstream",
                  title:
                    "Wrong upstream",
                  url:
                    "https://example.com/product/",
                  domain:
                    "example.com",
                  tier:
                    "first_party",
                  publisher:
                    "Example",
                  retrievedAt:
                    "2026-09-01T09:00:00.000Z",
                },
              ],
              links:
                result.links.map(
                  (link) =>
                    link.linkId
                      === "upstream-product"
                      ? {
                          ...link,
                          href:
                            "https://example.com/product/",
                          sourceId:
                            "wrong-upstream",
                        }
                      : link,
                ),
            };
          },
        };

        await expect(
          executeGlwSiteEnrichmentResearch({
            request:
              request(),
            provider,
          }),
        ).rejects.toThrow(
          /invalid link/i,
        );
      },
    );

    test(
      "does not execute research for work already research_ready",
      async () => {
        initialize();

        await executeGlwSiteEnrichmentResearch({
          request:
            request(),
          provider:
            completeProvider(),
        });

        let providerCalls = 0;

        const provider:
          GlwResearchProvider = {
          async research(input) {
            providerCalls += 1;

            return completeProvider()
              .research(input);
          },
        };

        await expect(
          executeGlwSiteEnrichmentResearch({
            request:
              request(),
            provider,
          }),
        ).rejects.toThrow(
          /research_pending status/i,
        );

        expect(providerCalls)
          .toBe(0);
      },
    );
  },
);
