jest.mock("server-only", () => ({}));

import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { deriveGlwCampaignOperatorReadModel } from "../campaign-operator-read-model";
import { GlwCampaignOperationsOverview } from "../GlwCampaignOperationsOverview";
import type { GlwCampaign } from "../campaign-types";
import type { GlwCampaignTarget } from "../campaign-target-repository";
import type { GlwPageExecutionRecord } from "../page-execution";
import type { GlwCampaignActivationGrant } from "../campaign-activation-authorization";
import type { GlwReferenceImageCandidate } from "../campaign-reference-image-candidate-repository";

const campaign: GlwCampaign = {
  campaignId: "campaign-texas",
  organizationId: "ssi",
  siteId: "site-projector",
  productId: "product-enclosure",
  name: "Fan Cooled Projector Enclosures Texas Cities",
  pageType: "city_service",
  stateCodes: ["TX"],
  cityTargets: [
    { stateCode: "TX", citySlug: "austin", cityName: "Austin" },
    { stateCode: "TX", citySlug: "dallas", cityName: "Dallas" },
    { stateCode: "TX", citySlug: "houston", cityName: "Houston" },
    { stateCode: "TX", citySlug: "san-antonio", cityName: "San Antonio" },
  ],
  pagesPerDay: 10,
  publicationPolicy: "draft_only",
  imageRequired: true,
  status: "active",
  completedTargetCount: 0,
  failedTargetCount: 0,
  createdAt: "2026-09-12T00:00:00.000Z",
  updatedAt: "2026-09-12T00:00:00.000Z",
};

function target(cityName: string, citySlug: string, status: GlwCampaignTarget["status"], jobId: string | null = null, wordpressObjectId: string | null = null): GlwCampaignTarget {
  return {
    targetId: `target-${citySlug}`,
    campaignId: campaign.campaignId,
    organizationId: campaign.organizationId,
    siteId: campaign.siteId,
    productId: campaign.productId,
    pageType: "city_service",
    stateCode: "TX",
    citySlug,
    cityName,
    canonicalPath: `fan-cooled-projector-enclosures/texas/${citySlug}`,
    applicationPath: `fan-cooled-projector-enclosures/texas/${citySlug}`,
    status,
    jobId,
    wordpressObjectId,
    attemptCount: status === "queued" ? 1 : 2,
    lastError: null,
    leaseId: null,
    leasedAt: null,
    leaseExpiresAt: null,
    dispatchDate: status === "reference_complete" ? null : "2026-09-12",
    createdAt: "2026-09-12T00:00:00.000Z",
    updatedAt: "2026-09-12T01:00:00.000Z",
  };
}

const dallasJob = {
  jobId: "2ca74016-252b-4587-bf3c-ec9b7eb839c9",
  externalExecutionId: "579510",
  status: "COMPLETE",
  wordpressObjectId: "13084",
  wordpressStatus: "draft",
  wordpressUrl: "https://projectorenclosure.com/?page_id=13084",
  featuredImagePresent: true,
  updatedAt: "2026-09-12T02:00:00.000Z",
  completedAt: "2026-09-12T02:00:00.000Z",
  errorMessage: null,
} as GlwPageExecutionRecord;

const grant = {
  consumedAt: "2026-09-12T00:00:00.000Z",
  claimedAt: "2026-09-12T00:00:00.000Z",
  expiresAt: "2026-09-12T03:00:00.000Z",
} as GlwCampaignActivationGrant;

const referenceImage = {
  status: "APPROVED",
  revision: 1,
} as GlwReferenceImageCandidate;

function model(overrides: { targets?: GlwCampaignTarget[]; jobs?: GlwPageExecutionRecord[]; mcpConfigured?: boolean } = {}) {
  return deriveGlwCampaignOperatorReadModel({
    campaign,
    targets: overrides.targets ?? [
      target("Austin", "austin", "reference_complete"),
      target("Dallas", "dallas", "draft_ready", dallasJob.jobId, "13084"),
      target("Houston", "houston", "queued"),
      target("San Antonio", "san-antonio", "queued"),
    ],
    jobs: overrides.jobs ?? [dallasJob],
    latestGrant: grant,
    releaseCapability: { status: "READY", ready: true, reason: null, capability: { releaseSha: "a".repeat(40) } } as never,
    mcpConfigured: overrides.mcpConfigured ?? true,
    referenceImage,
  });
}

describe("campaign operator experience", () => {
  test("derives the Texas lifecycle, canonical action, capabilities, and exact target identities", () => {
    const result = model();
    expect(result.currentStage).toBe("Dispatch");
    expect(result.nextStage).toBe("Dispatch the next deterministic target");
    expect(result.canonicalAction).toMatchObject({ kind: "DISPATCH", label: "Run Next Draft Batch", enabled: true });
    expect(result.canonicalAction.label).not.toContain("Continue to WordPress Draft");
    expect(result.counts).toEqual({ referenceComplete: 1, queued: 2, running: 0, contentReady: 0, draftReady: 1, published: 0, failed: 0 });
    expect(result.capabilities).toMatchObject({ release: { state: "READY" }, mcp: { state: "READY" }, scheduler: { state: "READY" }, publication: { state: "DRAFT_ONLY" } });
    expect(result.targets.map((entry) => entry.identity)).toEqual(["Austin, TX", "Dallas, TX", "Houston, TX", "San Antonio, TX"]);
    expect(result.targets.find((entry) => entry.identity === "Dallas, TX")).toMatchObject({
      lifecycleState: "draft_ready",
      jobId: dallasJob.jobId,
      executionId: "579510",
      executionState: "COMPLETE",
      wordpressObjectId: "13084",
      wordpressStatus: "draft",
      canonicalPath: "fan-cooled-projector-enclosures/texas/dallas",
      applicationPath: "fan-cooled-projector-enclosures/texas/dallas",
      visualCertificationCurrentPass: false,
      productAuthorityImage: { state: "NOT_WIRED" },
      contextualInUseImage: { state: "READY" },
    });
  });

  test("blocks dispatch presentation when MCP is unavailable", () => {
    const result = model({ mcpConfigured: false });
    expect(result.canonicalAction).toMatchObject({ kind: "DISPATCH", enabled: false, reason: "MCP execution capability is unavailable." });
    expect(result.capabilities.mcp.state).toBe("BLOCKED");
    expect(result.capabilities.scheduler.state).toBe("BLOCKED");
  });

  test("prioritizes reconciliation over another dispatch for content-ready execution", () => {
    const runningDallas = target("Dallas", "dallas", "running", dallasJob.jobId);
    const contentReadyJob = { ...dallasJob, status: "CONTENT_READY", wordpressObjectId: null, wordpressStatus: null } as GlwPageExecutionRecord;
    const result = model({ targets: [target("Austin", "austin", "reference_complete"), runningDallas, target("Houston", "houston", "queued"), target("San Antonio", "san-antonio", "queued")], jobs: [contentReadyJob] });
    expect(result.currentStage).toBe("Reconciliation");
    expect(result.canonicalAction).toMatchObject({ kind: "CONTINUE_DRAFT", label: "Continue to WordPress Draft", enabled: true });
    expect(result.counts.contentReady).toBe(1);
    expect(result.targets.find((entry) => entry.identity === "Dallas, TX")?.lifecycleState).toBe("content_ready");
  });

  test("treats exact failed ZERO_AUTHORITY_CANONICALIZATION_BLOCKED with generated draft as content_ready lifecycle", () => {
    const failedDallas = target("Dallas", "dallas", "failed", dallasJob.jobId);
    const recoverableFailedJob = {
      ...dallasJob,
      status: "FAILED",
      errorCode: "ZERO_AUTHORITY_CANONICALIZATION_BLOCKED",
      generatedDraft: { title: "x", contentHtml: "<p>x</p>", slug: "dallas", excerpt: "x" },
      wordpressObjectId: null,
      wordpressStatus: null,
    } as GlwPageExecutionRecord;
    const result = model({
      targets: [target("Austin", "austin", "reference_complete"), failedDallas, target("Houston", "houston", "queued")],
      jobs: [recoverableFailedJob],
    });
    expect(result.currentStage).toBe("Reconciliation");
    expect(result.canonicalAction).toMatchObject({ kind: "CONTINUE_DRAFT", enabled: true });
    expect(result.counts.contentReady).toBe(1);
    expect(result.targets.find((entry) => entry.identity === "Dallas, TX")?.lifecycleState).toBe("content_ready");
  });

  test("treats failed OUTDOOR_SPHERE rich-composition partial draft as content_ready lifecycle only for draft WordPress state", () => {
    const failedDallas = target("Dallas", "dallas", "failed", dallasJob.jobId);
    const recoverablePartialDraftJob = {
      ...dallasJob,
      externalExecutionId: "703853",
      status: "CONTENT_READY",
      errorCode: "OUTDOOR_SPHERE_RICH_COMPOSITION_REQUIRED",
      generatedDraft: { title: "x", contentHtml: "<p>x</p>", slug: "outdoor-digital-sphere/georgia", excerpt: "x" },
      wordpressObjectId: "20169",
      wordpressStatus: "draft",
      wordpressUrl: "https://leddisplaywarehouse.com/?page_id=20169",
    } as GlwPageExecutionRecord;

    const unrelatedFailed = target("Houston", "houston", "failed", "job-houston-failed");
    const unrelatedFailedJob = {
      ...dallasJob,
      jobId: "job-houston-failed",
      externalExecutionId: "703854",
      status: "CONTENT_READY",
      errorCode: "UNRELATED_FAILURE",
      generatedDraft: { title: "y", contentHtml: "<p>y</p>", slug: "outdoor-digital-sphere/houston", excerpt: "y" },
      wordpressObjectId: "20170",
      wordpressStatus: "draft",
      wordpressUrl: "https://leddisplaywarehouse.com/?page_id=20170",
    } as GlwPageExecutionRecord;

    const publishedTarget = target("San Antonio", "san-antonio", "published", dallasJob.jobId, "20171");
    const result = model({
      targets: [target("Austin", "austin", "reference_complete"), failedDallas, unrelatedFailed, publishedTarget],
      jobs: [recoverablePartialDraftJob, unrelatedFailedJob],
    });

    expect(result.counts.contentReady).toBe(1);
    expect(result.targets.find((entry) => entry.identity === "Dallas, TX")?.lifecycleState).toBe("content_ready");
    expect(result.targets.find((entry) => entry.identity === "Dallas, TX")?.continuationEligible).toBe(true);
    expect(result.targets.find((entry) => entry.identity === "Dallas, TX")?.wordpressObjectId).toBe("20169");
    expect(result.targets.find((entry) => entry.identity === "Dallas, TX")?.executionId).toBe("703853");

    expect(result.targets.find((entry) => entry.identity === "Houston, TX")?.lifecycleState).toBe("failed");
    expect(result.targets.find((entry) => entry.identity === "Houston, TX")?.continuationEligible).toBe(false);
    expect(result.targets.find((entry) => entry.identity === "San Antonio, TX")?.lifecycleState).toBe("published");
    expect(result.targets.find((entry) => entry.identity === "San Antonio, TX")?.continuationEligible).toBe(false);
  });

  test("keeps ordinary content_ready targets eligible and arbitrary WordPress-object content_ready targets blocked", () => {
    const contentReadyNoWp = target("Dallas", "dallas", "running", dallasJob.jobId);
    const noWpJob = {
      ...dallasJob,
      status: "CONTENT_READY",
      externalExecutionId: "703860",
      wordpressObjectId: null,
      wordpressStatus: null,
      errorCode: null,
    } as GlwPageExecutionRecord;

    const arbitraryWpTarget = target("Houston", "houston", "content_ready", "job-houston-content-ready", "20172");
    const arbitraryWpJob = {
      ...dallasJob,
      jobId: "job-houston-content-ready",
      status: "CONTENT_READY",
      externalExecutionId: "703861",
      wordpressObjectId: "20172",
      wordpressStatus: "draft",
      errorCode: "SOME_OTHER_STATE",
      generatedDraft: { title: "h", contentHtml: "<p>h</p>", slug: "outdoor-digital-sphere/houston", excerpt: "h" },
    } as GlwPageExecutionRecord;

    const result = model({
      targets: [target("Austin", "austin", "reference_complete"), contentReadyNoWp, arbitraryWpTarget],
      jobs: [noWpJob, arbitraryWpJob],
    });

    expect(result.targets.find((entry) => entry.identity === "Dallas, TX")?.lifecycleState).toBe("content_ready");
    expect(result.targets.find((entry) => entry.identity === "Dallas, TX")?.continuationEligible).toBe(true);

    expect(result.targets.find((entry) => entry.identity === "Houston, TX")?.lifecycleState).toBe("content_ready");
    expect(result.targets.find((entry) => entry.identity === "Houston, TX")?.continuationEligible).toBe(false);
  });

  test("renders lifecycle, exact WordPress and execution identity, image roles, and draft-only policy", () => {
    const html = renderToStaticMarkup(<GlwCampaignOperationsOverview model={model()} />);
    expect(html).toContain("Current Stage");
    expect(html).toContain("Run Next Draft Batch");
    expect(html).toContain("Publication blocked by campaign policy");
    expect(html).toContain("Dallas, TX");
    expect(html).toContain("#13084");
    expect(html).toContain("579510");
    expect(html).toContain("Product Authority");
    expect(html).toContain("Contextual In-Use");
    expect(html).toContain("NOT WIRED");
    expect(html).toContain(`/glw/pages/${dallasJob.jobId}/review?organizationId=ssi&amp;siteId=site-projector`);
  });

  test("refreshes server state after every successful mutation and demotes policy-blocked publication", () => {
    const source = readFileSync(join(process.cwd(), "src/modules/glw/GlwCampaignOperatorControls.tsx"), "utf8");
    expect((source.match(/await refreshWorkspace\(\)/g) ?? []).length).toBeGreaterThanOrEqual(5);
    expect(source).toContain("router.refresh()");
    expect(source).toContain("publishPreview?.policyBlocked");
    expect(source).toContain("Publication Blocked by Policy");
    expect(source).toContain("Continue to WordPress Draft");
    expect(source).toContain("content-ready-target");
    expect((source.match(/target\.continuationEligible === true/g) ?? []).length).toBe(2);
    expect(source).toContain("targetId: target.targetId");
    expect(source).toContain("executionId: target.executionId");
    expect(source).toContain("runOperatorFreeProgression");
    expect(source).toContain("/api/glw/campaigns/${campaignId}/reconcile");
    expect(source).toContain("/api/glw/pages/${encodeURIComponent(result.jobId)}/visual-certification");
    expect(source).toContain("Operator-free progression reached READY FOR OWNER REVIEW");
    expect(source).toContain("const [autoTargetLock, setAutoTargetLock]");
    expect(source).toContain("targetId: exactTarget.targetId");
    expect(source).toContain("jobId: exactTarget.jobId");
    expect(source).toContain("executionId: exactTarget.executionId");
    expect(source).toContain("if (!exactTarget.jobId || !exactTarget.executionId)");
    expect(source).toContain("EXACT_TARGET_PROTOCOL_RESULT_MISSING");
    expect(source).not.toContain("reconcilePayload.results[0]");
  });

  test("campaign detail page passes continuationEligible into controls target summaries", () => {
    const pageSource = readFileSync(join(process.cwd(), "src/app/glw/campaigns/[campaignId]/page.tsx"), "utf8");
    expect(pageSource).toContain("continuationEligible: target.continuationEligible");
    expect(pageSource).toContain("canonicalPath: target.canonicalPath");
    expect(pageSource).toContain("visualCertificationCurrentPass: target.visualCertificationCurrentPass");
  });
});
