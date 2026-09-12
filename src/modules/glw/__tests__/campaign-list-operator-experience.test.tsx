jest.mock("server-only", () => ({}));

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { deriveGlwCampaignOperatorReadModel } from "../campaign-operator-read-model";
import { deriveGlwCampaignListOperatorSummary, orderGlwCampaignListOperatorSummaries } from "../campaign-list-operator-read-model";
import { GlwCampaignOperationsList, matchesCampaignOperationsFilter } from "../GlwCampaignOperationsList";
import type { GlwCampaign } from "../campaign-types";
import type { GlwCampaignTarget } from "../campaign-target-repository";
import type { GlwPageExecutionRecord } from "../page-execution";

const baseCampaign: GlwCampaign = {
  campaignId: "campaign-texas",
  organizationId: "ssi",
  siteId: "site-projector",
  productId: "product-enclosure",
  name: "Fan Cooled Projector Enclosures Texas Cities",
  pageType: "city_service",
  stateCodes: ["TX"],
  cityTargets: ["Austin", "Dallas", "Houston", "San Antonio"].map((cityName) => ({ stateCode: "TX", cityName, citySlug: cityName.toLowerCase().replaceAll(" ", "-") })),
  pagesPerDay: 10,
  publicationPolicy: "draft_only",
  imageRequired: true,
  status: "active",
  completedTargetCount: 0,
  failedTargetCount: 0,
  createdAt: "2026-09-12T00:00:00.000Z",
  updatedAt: "2026-09-12T04:00:00.000Z",
};

function target(cityName: string, status: GlwCampaignTarget["status"], jobId: string | null = null): GlwCampaignTarget {
  const citySlug = cityName.toLowerCase().replaceAll(" ", "-");
  return {
    targetId: `target-${citySlug}`, campaignId: baseCampaign.campaignId, organizationId: "ssi", siteId: "site-projector", productId: "product-enclosure", pageType: "city_service",
    stateCode: "TX", citySlug, cityName, canonicalPath: `texas/${citySlug}`, applicationPath: `texas/${citySlug}`, status, jobId,
    wordpressObjectId: cityName === "Dallas" ? "13084" : null, attemptCount: 1, lastError: status === "failed" ? "Provider failed" : null,
    leaseId: null, leasedAt: null, leaseExpiresAt: null, dispatchDate: status === "reference_complete" ? null : "2026-09-12",
    createdAt: "2026-09-12T00:00:00.000Z", updatedAt: "2026-09-12T01:00:00.000Z",
  };
}

function summary(options: { campaign?: Partial<GlwCampaign>; targets?: GlwCampaignTarget[]; jobs?: GlwPageExecutionRecord[]; mcpConfigured?: boolean; updatedAt?: string } = {}) {
  const campaign = { ...baseCampaign, ...options.campaign };
  const targets = options.targets ?? [target("Austin", "reference_complete"), target("Dallas", "draft_ready", "job-dallas"), target("Houston", "queued"), target("San Antonio", "queued")];
  const model = deriveGlwCampaignOperatorReadModel({
    campaign,
    targets: targets.map((item) => ({ ...item, campaignId: campaign.campaignId })),
    jobs: options.jobs ?? [{ jobId: "job-dallas", externalExecutionId: "execution-dallas", status: "COMPLETE", wordpressObjectId: "13084", wordpressStatus: "draft", wordpressUrl: "https://projectorenclosure.com/?page_id=13084", featuredImagePresent: true, updatedAt: "2026-09-12T02:00:00.000Z", completedAt: "2026-09-12T02:00:00.000Z", errorMessage: null } as GlwPageExecutionRecord],
    latestGrant: { consumedAt: "2026-09-12T00:00:00.000Z", claimedAt: "2026-09-12T00:00:00.000Z", expiresAt: "2026-09-13T00:00:00.000Z" } as never,
    releaseCapability: { status: "WRONG_RELEASE", ready: false, reason: "Wrong release", capability: { releaseSha: "a".repeat(40) } } as never,
    mcpConfigured: options.mcpConfigured ?? true,
    referenceImage: { status: "APPROVED", revision: 1 } as never,
  });
  return deriveGlwCampaignListOperatorSummary({ model, siteName: "ProjectorEnclosure.com", domain: "projectorenclosure.com", productName: "Fan Cooled Projector Enclosures", updatedAt: options.updatedAt ?? campaign.updatedAt });
}

describe("campaign list operator control surface", () => {
  test("interprets Projector Texas from durable state without treating wrong-release activation as an active-campaign blocker", () => {
    const result = summary();
    expect(result).toMatchObject({ lifecycle: "Dispatch", attention: "ACTION_REQUIRED", nextAction: "Run Next Draft Batch", nextTarget: "Houston, TX", policy: "DRAFT ONLY", imagePackage: "PARTIAL", productAuthorityImage: "NOT_WIRED", contextualInUseImage: "APPROVED" });
    expect(result.counts).toEqual({ referenceComplete: 1, queued: 2, running: 0, contentReady: 0, draftReady: 1, published: 0, failed: 0 });
    expect(result.capabilityDetails).toContain("WordPress READY");
    expect(result.blocker).toBeNull();
    expect(result.href).toContain("organizationId=ssi&siteId=site-projector");
  });

  test("derives blocked, running, draft review, complete, and reference continuation states", () => {
    const blocked = summary({ targets: [target("Austin", "reference_complete"), target("Dallas", "failed", "job-failed")] });
    const running = summary({ targets: [target("Austin", "reference_complete"), target("Dallas", "running", "job-running")], jobs: [{ jobId: "job-running", status: "RUNNING", updatedAt: "2026-09-12" } as GlwPageExecutionRecord] });
    const review = summary({ targets: [target("Austin", "reference_complete"), target("Dallas", "draft_ready", "job-dallas")] });
    const complete = summary({ campaign: { status: "complete" }, targets: [target("Austin", "published")] });
    const reference = summary({ campaign: { status: "draft" }, targets: [target("Austin", "prepared")], jobs: [] });
    expect(blocked).toMatchObject({ lifecycle: "Blocked", attention: "BLOCKED", nextAction: "Resolve Blocker" });
    expect(blocked.blocker?.safeNextStep).toContain("Open campaign");
    expect(running).toMatchObject({ lifecycle: "Executing", attention: "RUNNING", nextAction: "Execution In Progress" });
    expect(review).toMatchObject({ lifecycle: "Draft Review", nextAction: "Review Draft" });
    expect(complete).toMatchObject({ lifecycle: "Complete", attention: "COMPLETE" });
    expect(reference).toMatchObject({ lifecycle: "Reference", attention: "ACTION_REQUIRED", nextAction: "Review Reference" });
  });

  test("orders attention deterministically and supports the bounded operator filters", () => {
    const blocked = summary({ campaign: { campaignId: "blocked" }, targets: [target("Austin", "failed")] });
    const action = summary({ campaign: { campaignId: "action" } });
    const complete = summary({ campaign: { campaignId: "complete", status: "complete" }, targets: [target("Austin", "published")] });
    expect(orderGlwCampaignListOperatorSummaries([complete, action, blocked]).map((item) => item.campaignId)).toEqual(["blocked", "action", "complete"]);
    expect(matchesCampaignOperationsFilter(action, "ACTION_REQUIRED")).toBe(true);
    expect(matchesCampaignOperationsFilter(action, "ACTIVE")).toBe(true);
    expect(matchesCampaignOperationsFilter(blocked, "BLOCKED")).toBe(true);
    expect(matchesCampaignOperationsFilter(complete, "COMPLETE")).toBe(true);
  });

  test("renders operator identity, lifecycle counts, policy, image state, next action, and canonical detail navigation", () => {
    const html = renderToStaticMarkup(<GlwCampaignOperationsList summaries={[summary()]} />);
    expect(html).toContain("Campaign Control Surface");
    expect(html).toContain("Fan Cooled Projector Enclosures Texas Cities");
    expect(html).toContain("ProjectorEnclosure.com");
    expect(html).toContain("projectorenclosure.com");
    expect(html).toContain("1</strong> reference");
    expect(html).toContain("2</strong> queued");
    expect(html).toContain("1</strong> draft ready");
    expect(html).toContain("Run Next Draft Batch");
    expect(html).toContain("Next target: Houston, TX");
    expect(html).toContain("DRAFT ONLY");
    expect(html).toContain("Images partial");
    expect(html).toContain("organizationId=ssi&amp;siteId=site-projector");
    expect(html).not.toContain("Authorize This Campaign");
    expect(html).not.toContain("Activate Campaign</button>");
  });
});