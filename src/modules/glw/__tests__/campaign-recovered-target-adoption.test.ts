import { planRecoveredCityCampaignTargetAdoption } from "@/modules/glw/campaign-recovered-target-adoption";
import type { GlwPageExecutionRecord } from "@/modules/glw/page-execution";

function execution(
  overrides: Partial<GlwPageExecutionRecord>,
): GlwPageExecutionRecord {
  return {
    jobId: "job-default",
    correlationId: "corr-default",
    executionTransport: "N8N_MCP",
    organizationId: "ssi",
    siteId: "site-ssi-screen-solutions-international",
    productId: "prod-ssi-accent-rear-projection-film",
    productTopic: "Accent Rear Projection Film",
    state: "Texas",
    city: "Austin",
    slug: "accent-rear-projection-film/texas/austin",
    title: "Accent Rear Projection Film in Austin",
    seoTitle: "Accent Rear Projection Film in Austin",
    metaDescription: "Test",
    publicationIntent: "draft",
    status: "COMPLETE",
    externalExecutionId: "execution-default",
    wordpressObjectId: "15283",
    wordpressUrl: "https://ssidisplays.com/?page_id=15283",
    wordpressStatus: "draft",
    generatedDraft: null,
    errorCode: null,
    errorMessage: null,
    requestedPublicationMode: "draft",
    disposition: null,
    qaStatus: "COMPLETE",
    qaChecks: null,
    qaFailureReasons: null,
    focusKeyphrase: null,
    wordCount: 1500,
    featuredImagePresent: false,
    createdAt: "2026-09-01T00:00:00.000Z",
    dispatchedAt: "2026-09-01T00:00:01.000Z",
    updatedAt: "2026-09-01T00:01:00.000Z",
    completedAt: "2026-09-01T00:01:00.000Z",
    ...overrides,
  };
}

const cityTargets = [
  { stateCode: "TX", citySlug: "austin", cityName: "Austin" },
  { stateCode: "TX", citySlug: "plano", cityName: "Plano" },
  { stateCode: "TX", citySlug: "san-antonio", cityName: "San Antonio" },
] as const;

describe("recovered city campaign target adoption", () => {
  test("blocks duplicate generation for recovered drafts that fail current image gates and adopts published targets", () => {
    const dispositions = planRecoveredCityCampaignTargetAdoption({
      organizationId: "ssi",
      siteId: "site-ssi-screen-solutions-international",
      productId: "prod-ssi-accent-rear-projection-film",
      cityTargets,
      referenceTarget: { stateCode: "TX", citySlug: "san-antonio" },
      imageRequired: true,
      executions: [
        execution({
          jobId: "job-austin",
          city: "Austin",
          slug: "accent-rear-projection-film/texas/austin",
          wordpressObjectId: "15283",
          wordpressStatus: "draft",
          featuredImagePresent: false,
        }),
        execution({
          jobId: "job-plano",
          city: "Plano",
          slug: "accent-rear-projection-film/texas/plano",
          wordpressObjectId: "15289",
          wordpressStatus: "publish",
          featuredImagePresent: true,
        }),
      ],
    });

    expect(dispositions).toEqual([
      expect.objectContaining({
        citySlug: "austin",
        status: "skipped",
        wordpressObjectId: "15283",
      }),
      expect.objectContaining({
        citySlug: "plano",
        status: "published",
        wordpressObjectId: "15289",
      }),
    ]);
  });

  test("adopts a recovered complete draft when the current campaign gates are satisfied", () => {
    const dispositions = planRecoveredCityCampaignTargetAdoption({
      organizationId: "ssi",
      siteId: "site-ssi-screen-solutions-international",
      productId: "prod-ssi-accent-rear-projection-film",
      cityTargets,
      referenceTarget: { stateCode: "TX", citySlug: "san-antonio" },
      imageRequired: true,
      executions: [
        execution({
          jobId: "job-austin",
          featuredImagePresent: true,
        }),
      ],
    });

    expect(dispositions).toEqual([
      expect.objectContaining({
        citySlug: "austin",
        status: "draft_ready",
        jobId: "job-austin",
        wordpressObjectId: "15283",
      }),
    ]);
  });

  test("fails closed by skipping a recovered city when complete executions disagree on WordPress identity", () => {
    const dispositions = planRecoveredCityCampaignTargetAdoption({
      organizationId: "ssi",
      siteId: "site-ssi-screen-solutions-international",
      productId: "prod-ssi-accent-rear-projection-film",
      cityTargets,
      referenceTarget: { stateCode: "TX", citySlug: "san-antonio" },
      imageRequired: false,
      executions: [
        execution({ jobId: "job-a", wordpressObjectId: "15283" }),
        execution({
          jobId: "job-b",
          wordpressObjectId: "99999",
          updatedAt: "2026-09-02T00:00:00.000Z",
        }),
      ],
    });

    expect(dispositions).toEqual([
      expect.objectContaining({
        citySlug: "austin",
        status: "skipped",
        wordpressObjectId: "99999",
      }),
    ]);
  });
});
