jest.mock("server-only", () => ({}));

const originalPersistenceDirectory =
  process.env.GCP_FOUNDATION_PERSISTENCE_DIR;

const testPersistenceDirectory =
  `${process.cwd()}/.gcp-foundation-data-test-${process.env.JEST_WORKER_ID ?? "0"}-site-enrichment`;

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
  certifyGlwSiteEnrichmentPlan,
  getGlwSiteEnrichmentRecord,
  initializeGlwSiteEnrichmentRecord,
  resetGlwSiteEnrichmentRepositoryForTests,
  updateGlwSiteEnrichmentResearch,
  type GlwResearchRequirement,
} from "../site-enrichment-repository";

import {
  buildGlwResearchQueryHints,
  buildGlwStateServiceResearchPlan,
} from "../site-enrichment-research-planner";

function plannerInput() {
  return {
    organizationId:
      "led-display-warehouse",
    siteId:
      "site-led-display-warehouse-production",
    siteDomain:
      "leddisplaywarehouse.com",
    productId:
      "prod-indoor-digital-sphere",
    productTopic:
      "Indoor Digital Sphere",
    campaignId:
      "campaign-test-enrichment-v1",
    stateCode: "CO",
    stateName: "Colorado",
    canonicalPath:
      "/indoor-digital-sphere/colorado/",
    jobId:
      "job-enrichment-colorado-v1",
    wordpressObjectId: "19853",
    upstreamAuthorityDomains: [
      "ssidisplays.com",
    ],
  };
}

function fulfilledRequirements(
  requirements:
    readonly GlwResearchRequirement[],
): GlwResearchRequirement[] {
  return requirements.map(
    (requirement) => {
      if (!requirement.required) {
        return {
          ...requirement,
        };
      }

      if (
        requirement.kind === "source"
      ) {
        return {
          ...requirement,
          fulfilledSourceIds: [
            `source-${requirement.requirementId}`,
          ],
        };
      }

      return {
        ...requirement,
        fulfilledLinkIds: [
          `link-${requirement.requirementId}`,
        ],
      };
    },
  );
}

describe(
  "GLW site enrichment research planner",
  () => {
    beforeEach(() => {
      resetGlwSiteEnrichmentRepositoryForTests();
    });

    test(
      "builds deterministic state-service research requirements",
      () => {
        const plan =
          buildGlwStateServiceResearchPlan(
            plannerInput(),
          );

        expect(plan.stateCode)
          .toBe("CO");

        expect(plan.researchRequirements)
          .toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                requirementId:
                  "source-product-first-party",
                required: true,
                sourceTier:
                  "first_party",
              }),
              expect.objectContaining({
                requirementId:
                  "source-state-government",
                required: true,
                sourceTier:
                  "government",
              }),
              expect.objectContaining({
                requirementId:
                  "source-state-tourism",
                required: true,
                sourceTier:
                  "tourism_board",
              }),
              expect.objectContaining({
                requirementId:
                  "source-reputable-news",
                required: false,
                sourceTier:
                  "reputable_news",
              }),
              expect.objectContaining({
                requirementId:
                  "link-internal-product",
                kind: "internal_link",
                required: true,
              }),
              expect.objectContaining({
                requirementId:
                  "link-upstream-source-of-truth",
                required: true,
              }),
            ]),
          );

        expect(
          plan.researchRequirements.some(
            (requirement) =>
              requirement.requirementId
              === "link-internal-geography",
          ),
        ).toBe(false);
      },
    );

    test(
      "does not force a news link when news is not materially relevant",
      () => {
        const plan =
          buildGlwStateServiceResearchPlan(
            plannerInput(),
          );

        const news =
          plan.researchRequirements.find(
            (requirement) =>
              requirement.requirementId
              === "source-reputable-news",
          );

        expect(news?.required)
          .toBe(false);
      },
    );

    test(
      "omits upstream requirement when no upstream authority exists",
      () => {
        const plan =
          buildGlwStateServiceResearchPlan({
            ...plannerInput(),
            upstreamAuthorityDomains: [],
          });

        expect(
          plan.researchRequirements.some(
            (requirement) =>
              requirement.requirementId
              === "link-upstream-source-of-truth",
          ),
        ).toBe(false);
      },
    );

    test(
      "provides research query hints without performing research",
      () => {
        const queries =
          buildGlwResearchQueryHints(
            plannerInput(),
          );

        expect(queries.length)
          .toBeGreaterThanOrEqual(5);

        expect(
          queries.join(" "),
        ).toContain("Colorado");

        expect(
          queries.join(" "),
        ).toContain(
          "Indoor Digital Sphere",
        );
      },
    );

    test(
      "persists an initial page enrichment record as research pending",
      () => {
        const planned =
          buildGlwStateServiceResearchPlan(
            plannerInput(),
          );

        const record =
          initializeGlwSiteEnrichmentRecord({
            ...planned,
            now:
              new Date(
                "2026-09-01T05:00:00.000Z",
              ),
          });

        expect(record.status)
          .toBe("research_pending");

        expect(record.jobId)
          .toBe(
            "job-enrichment-colorado-v1",
          );

        expect(record.wordpressObjectId)
          .toBe("19853");

        expect(
          getGlwSiteEnrichmentRecord({
            siteId:
              record.siteId,
            canonicalPath:
              record.canonicalPath,
          }),
        ).toEqual(record);
      },
    );

    test(
      "initialization is idempotent for the exact same page identity",
      () => {
        const planned =
          buildGlwStateServiceResearchPlan(
            plannerInput(),
          );

        const first =
          initializeGlwSiteEnrichmentRecord({
            ...planned,
            now:
              new Date(
                "2026-09-01T05:01:00.000Z",
              ),
          });

        const second =
          initializeGlwSiteEnrichmentRecord({
            ...planned,
            now:
              new Date(
                "2026-09-01T05:02:00.000Z",
              ),
          });

        expect(second.enrichmentId)
          .toBe(first.enrichmentId);

        expect(second.createdAt)
          .toBe(first.createdAt);
      },
    );

    test(
      "moves to research ready only after all required slots are fulfilled",
      () => {
        const planned =
          buildGlwStateServiceResearchPlan(
            plannerInput(),
          );

        initializeGlwSiteEnrichmentRecord({
          ...planned,
        });

        const updated =
          updateGlwSiteEnrichmentResearch({
            siteId:
              planned.siteId,
            canonicalPath:
              planned.canonicalPath,
            researchRequirements:
              fulfilledRequirements(
                planned.researchRequirements,
              ),
          });

        expect(updated.status)
          .toBe("research_ready");
      },
    );

    test(
      "remains research pending when a required slot is missing",
      () => {
        const planned =
          buildGlwStateServiceResearchPlan(
            plannerInput(),
          );

        initializeGlwSiteEnrichmentRecord({
          ...planned,
        });

        const fulfilled =
          fulfilledRequirements(
            planned.researchRequirements,
          );

        const incomplete =
          fulfilled.map(
            (requirement) =>
              requirement.requirementId
                ===
                "source-state-government"
                ? {
                    ...requirement,
                    fulfilledSourceIds: [],
                  }
                : requirement,
          );

        const updated =
          updateGlwSiteEnrichmentResearch({
            siteId:
              planned.siteId,
            canonicalPath:
              planned.canonicalPath,
            researchRequirements:
              incomplete,
          });

        expect(updated.status)
          .toBe("research_pending");
      },
    );

    test(
      "fails closed when certification plan lacks evidence",
      () => {
        const planned =
          buildGlwStateServiceResearchPlan(
            plannerInput(),
          );

        initializeGlwSiteEnrichmentRecord({
          ...planned,
        });

        updateGlwSiteEnrichmentResearch({
          siteId:
            planned.siteId,
          canonicalPath:
            planned.canonicalPath,
          researchRequirements:
            fulfilledRequirements(
              planned.researchRequirements,
            ),
        });

        const certified =
          certifyGlwSiteEnrichmentPlan({
            siteId:
              planned.siteId,
            canonicalPath:
              planned.canonicalPath,
            plan:
              planned.emptyPlan,
          });

        expect(certified.status)
          .toBe("qa_failed");

        expect(certified.qa?.ok)
          .toBe(false);
      },
    );
  },
);
