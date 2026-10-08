import {
  createGlwPageRun,
  createInMemoryGlwPageRunRepository,
  type GlwPageRunIdentity,
} from "../page-run";
import type { GlwPageExecutionRecord } from "../page-execution";
import type { GlwGenerationRequest } from "../page-generation";
import {
  assertGlwPageRunMatchesGenerationRequest,
  isRecoverableGlwPageRunFinalizationFailure,
  recoverGlwPageRunForFinalization,
  synchronizeGlwPageRunWithExecution,
} from "../page-run-coordinator";

const identity: GlwPageRunIdentity = {
  targetId: "target-arlington",
  campaignId: "campaign-arlington",
  organizationId: "ssi",
  siteId: "site-ssi-projectorenclosure",
  productId: "prod-ssi-fan-cooled-projector-enclosures",
  stateCode: "TX",
  citySlug: "arlington",
  cityName: "Arlington",
  canonicalPath: "fan-cooled-projector-enclosures/texas/arlington",
};

function job(overrides: Partial<GlwPageExecutionRecord> = {}): GlwPageExecutionRecord {
  return {
    jobId: "job-1",
    correlationId: "job-1",
    executionTransport: "N8N_MCP",
    organizationId: identity.organizationId,
    siteId: identity.siteId,
    productId: identity.productId,
    productTopic: "Fan Cooled Projector Enclosures",
    state: "Texas",
    city: "Arlington",
    slug: identity.canonicalPath,
    title: "Fan Cooled Projector Enclosures in Arlington",
    seoTitle: "Fan Cooled Projector Enclosures in Arlington | SSI",
    metaDescription: "Draft",
    publicationIntent: "draft",
    status: "CONTENT_READY",
    externalExecutionId: "764999",
    wordpressObjectId: null,
    wordpressUrl: null,
    wordpressStatus: null,
    generatedDraft: {
      title: "Fan Cooled Projector Enclosures in Arlington",
      contentHtml: "<p>Generated content.</p>",
      slug: identity.canonicalPath,
      excerpt: null,
      seoTitle: "Fan Cooled Projector Enclosures in Arlington | SSI",
      metaDescription: "Draft",
      focusKeyphrase: "fan cooled projector enclosures arlington",
    },
    errorCode: null,
    errorMessage: null,
    requestedPublicationMode: "draft",
    disposition: null,
    qaStatus: "CONTENT_READY",
    qaChecks: null,
    qaFailureReasons: null,
    focusKeyphrase: "fan cooled projector enclosures arlington",
    wordCount: 1500,
    featuredImagePresent: true,
    createdAt: "2030-01-01T00:00:00.000Z",
    dispatchedAt: "2030-01-01T00:00:01.000Z",
    updatedAt: "2030-01-01T00:01:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

describe("GLW PageRun coordinator", () => {
  test("binds one fresh content-ready execution directly to GENERATED", async () => {
    const repository = createInMemoryGlwPageRunRepository();
    await repository.create(createGlwPageRun({ runId: "run-1", identity }));

    const run = await synchronizeGlwPageRunWithExecution({
      runId: "run-1",
      job: job(),
      repository,
    });

    expect(run).toMatchObject({
      status: "GENERATED",
      generationJobId: "job-1",
      externalExecutionId: "764999",
    });
  });

  test("carries a complete execution through QA to WordPress draft", async () => {
    const repository = createInMemoryGlwPageRunRepository();
    await repository.create(createGlwPageRun({ runId: "run-1", identity }));

    const run = await synchronizeGlwPageRunWithExecution({
      runId: "run-1",
      job: job({
        status: "COMPLETE",
        qaStatus: "COMPLETE",
        qaChecks: { content: "PASS" },
        wordpressObjectId: "13150",
        wordpressUrl: "https://example.test/?page_id=13150",
        wordpressStatus: "draft",
        completedAt: "2030-01-01T00:02:00.000Z",
      }),
      repository,
    });

    expect(run).toMatchObject({
      status: "WORDPRESS_DRAFT",
      generationJobId: "job-1",
      externalExecutionId: "764999",
      wordpressObjectId: "13150",
      wordpressStatus: "draft",
    });
  });

  test("fails closed when execution identity drifts", async () => {
    const repository = createInMemoryGlwPageRunRepository();
    await repository.create(createGlwPageRun({ runId: "run-1", identity }));
    await synchronizeGlwPageRunWithExecution({
      runId: "run-1",
      job: job({ status: "RUNNING" }),
      repository,
    });

    await expect(synchronizeGlwPageRunWithExecution({
      runId: "run-1",
      job: job({ externalExecutionId: "765000" }),
      repository,
    })).rejects.toThrow("external execution identity");
  });

  test("recovers the exact failed PageRun when the same job already owns a WordPress draft", async () => {
    const repository = createInMemoryGlwPageRunRepository();
    await repository.create(createGlwPageRun({ runId: "run-1", identity }));

    await synchronizeGlwPageRunWithExecution({
      runId: "run-1",
      job: job(),
      repository,
    });

    await repository.transition("run-1", "GENERATED", {
      to: "FAILED",
      code: "PAGE_RUN_EXECUTION_EXCEPTION",
      message: "themePrimaryFeaturedImage is not defined",
    });

    const draftJob = job({
      qaStatus: "PASSED",
      wordpressObjectId: "13167",
      wordpressUrl: "https://example.test/?page_id=13167",
      wordpressStatus: "draft",
    });
    const failedRun = await repository.getById("run-1");

    expect(isRecoverableGlwPageRunFinalizationFailure({
      run: failedRun!,
      job: draftJob,
    })).toBe(true);

    const recovered = await recoverGlwPageRunForFinalization({
      runId: "run-1",
      job: draftJob,
      repository,
    });

    expect(recovered).toMatchObject({
      status: "GENERATED",
      generationJobId: "job-1",
      externalExecutionId: "764999",
      failure: null,
      wordpressObjectId: null,
    });
  });

  test("does not reopen unrelated terminal PageRun failures", async () => {
    const repository = createInMemoryGlwPageRunRepository();
    await repository.create(createGlwPageRun({ runId: "run-1", identity }));

    await synchronizeGlwPageRunWithExecution({
      runId: "run-1",
      job: job(),
      repository,
    });

    await repository.transition("run-1", "GENERATED", {
      to: "FAILED",
      code: "GENERATED_CONTENT_QA_FAILED",
      message: "QA failed.",
    });

    await expect(recoverGlwPageRunForFinalization({
      runId: "run-1",
      job: job({
        qaStatus: "PASSED",
        wordpressObjectId: "13167",
        wordpressStatus: "draft",
      }),
      repository,
    })).rejects.toThrow("not eligible");
  });

  test("validates immutable generation target identity", () => {
    const run = createGlwPageRun({ runId: "run-1", identity });
    const request = {
      organizationId: identity.organizationId,
      siteId: identity.siteId,
      siteName: "ProjectorEnclosure.com",
      siteDomain: "projectorenclosure.com",
      siteCanonicalUrl: "https://projectorenclosure.com",
      wordpressApiBaseUrl: "https://projectorenclosure.com/wp-json/wp/v2",
      productId: identity.productId,
      productTopic: "Fan Cooled Projector Enclosures",
      pageType: "city_service",
      stateCode: "TX",
      stateName: "Texas",
      citySlug: "arlington",
      cityName: "Arlington",
      slug: identity.canonicalPath,
      canonicalPath: identity.canonicalPath,
      title: "Fan Cooled Projector Enclosures in Arlington",
      seoTitle: "Fan Cooled Projector Enclosures in Arlington | SSI",
      metaDescription: "Draft",
      publicationIntent: "draft",
      plannedOperation: "CREATE_CITY",
      wordpressObjectId: null,
      additionalInstructions: "",
      imageDirection: "",
      campaignId: identity.campaignId,
      externalExecutionAllowed: false,
    } as GlwGenerationRequest;

    expect(() => assertGlwPageRunMatchesGenerationRequest({
      run,
      request,
    })).not.toThrow();
  });
});
