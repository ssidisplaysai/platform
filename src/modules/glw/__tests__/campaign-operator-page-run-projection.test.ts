jest.mock("server-only", () => ({}));

import { projectTargetFromActivePageRun } from "../campaign-operator-read-model";
import { createGlwPageRun, advanceGlwPageRun } from "../page-run";
import type { GlwCampaignTarget } from "../campaign-target-repository";

const target: GlwCampaignTarget = {
  targetId: "target-arlington",
  campaignId: "campaign-arlington",
  organizationId: "ssi",
  siteId: "site-ssi-projectorenclosure",
  productId: "prod-ssi-fan-cooled-projector-enclosures",
  pageType: "city_service",
  stateCode: "TX",
  citySlug: "arlington",
  cityName: "Arlington",
  canonicalPath: "fan-cooled-projector-enclosures/texas/arlington",
  applicationPath: "fan-cooled-projector-enclosures/texas/arlington",
  canonicalParentId: null,
  status: "queued",
  jobId: null,
  wordpressObjectId: null,
  attemptCount: 0,
  lastError: null,
  leaseId: null,
  leasedAt: null,
  leaseExpiresAt: null,
  dispatchDate: null,
  createdAt: "2030-01-01T00:00:00.000Z",
  updatedAt: "2030-01-01T00:00:00.000Z",
};

function baseRun() {
  return createGlwPageRun({
    runId: "run-1",
    identity: {
      targetId: target.targetId,
      campaignId: target.campaignId,
      organizationId: target.organizationId,
      siteId: target.siteId,
      productId: target.productId,
      stateCode: target.stateCode,
      citySlug: target.citySlug ?? null,
      cityName: target.cityName ?? null,
      canonicalPath: target.canonicalPath!,
    },
    now: "2030-01-01T00:00:01.000Z",
  });
}

describe("campaign operator PageRun projection", () => {
  test("shows the active run instead of stale queued target state", () => {
    let run = baseRun();
    run = advanceGlwPageRun(run, {
      to: "DISPATCHED",
      generationJobId: "job-1",
      externalExecutionId: "764999",
    }, "2030-01-01T00:00:02.000Z");

    const projected = projectTargetFromActivePageRun(target, run);
    expect(projected).toMatchObject({
      status: "running",
      jobId: "job-1",
      wordpressObjectId: null,
      updatedAt: "2030-01-01T00:00:02.000Z",
    });
  });

  test("projects generated content as content_ready without mutating stored target truth", () => {
    let run = baseRun();
    run = advanceGlwPageRun(run, {
      to: "DISPATCHED",
      generationJobId: "job-1",
      externalExecutionId: "764999",
    });
    run = advanceGlwPageRun(run, {
      to: "GENERATED",
      generationJobId: "job-1",
      externalExecutionId: "764999",
      generatedDraft: {
        title: "Arlington",
        contentHtml: "<p>Draft</p>",
        slug: target.canonicalPath!,
        excerpt: null,
        seoTitle: null,
        metaDescription: null,
        focusKeyphrase: null,
      },
    });

    const projected = projectTargetFromActivePageRun(target, run);
    expect(projected.status).toBe("content_ready");
    expect(target.status).toBe("queued");
  });

  test("projects a WordPress draft from PageRun even when legacy target remains queued", () => {
    let run = baseRun();
    run = advanceGlwPageRun(run, {
      to: "DISPATCHED",
      generationJobId: "job-1",
      externalExecutionId: "764999",
    });
    run = advanceGlwPageRun(run, {
      to: "GENERATED",
      generationJobId: "job-1",
      externalExecutionId: "764999",
      generatedDraft: {
        title: "Arlington",
        contentHtml: "<p>Draft</p>",
        slug: target.canonicalPath!,
        excerpt: null,
        seoTitle: null,
        metaDescription: null,
        focusKeyphrase: null,
      },
    });
    run = advanceGlwPageRun(run, {
      to: "QA_PASSED",
      qaChecks: { content: "PASS" },
    });
    run = advanceGlwPageRun(run, {
      to: "WORDPRESS_DRAFT",
      wordpressObjectId: "13150",
      wordpressUrl: "https://projectorenclosure.com/?page_id=13150",
    });

    const projected = projectTargetFromActivePageRun(target, run);
    expect(projected).toMatchObject({
      status: "draft_ready",
      jobId: "job-1",
      wordpressObjectId: "13150",
    });
  });
});
