import { buildGlwStateCoverage, createSpinOffDraftInput, projectGlwCampaign, recommendGlwCampaignContinuation } from "../campaign-manager";
import type { GlwCampaign } from "../campaign-types";
import type { GlwCampaignTarget } from "../campaign-target-repository";

const campaign: GlwCampaign = {
  campaignId: "campaign-1", organizationId: "org-1", siteId: "site-1", productId: "product-1",
  name: "Indoor LED Sphere 50 States", pageType: "state_service", stateCodes: ["CA", "TX"],
  pagesPerDay: 10, publicationPolicy: "draft_only", imageRequired: true, status: "active",
  completedTargetCount: 0, failedTargetCount: 0, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-02T00:00:00.000Z",
};
function target(stateCode: string, status: GlwCampaignTarget["status"], updatedAt = "2026-09-11T00:00:00.000Z", overrides: Partial<GlwCampaignTarget> = {}): GlwCampaignTarget {
  return { targetId: `target-${stateCode}`, campaignId: campaign.campaignId, organizationId: campaign.organizationId, siteId: campaign.siteId, productId: campaign.productId, stateCode, status, jobId: null, wordpressObjectId: null, attemptCount: 0, lastError: null, createdAt: campaign.createdAt, updatedAt, ...overrides };
}

describe("GLW campaign manager projections", () => {
  it("derives a terminal completed state and timestamp from canonical targets", () => {
    const record = projectGlwCampaign(campaign, [target("CA", "published"), target("TX", "draft_ready", "2026-09-11T12:00:00.000Z")]);
    expect(record.displayState).toBe("COMPLETED"); expect(record.summary.running).toBe(0); expect(record.completedAt).toBe("2026-09-11T12:00:00.000Z");
  });
  it("keeps active, failed, and draft campaigns non-terminal", () => {
    expect(projectGlwCampaign(campaign, [target("CA", "running")]).displayState).toBe("ACTIVE");
    const failed = projectGlwCampaign(campaign, [target("CA", "failed")]); expect(failed.displayState).toBe("ACTIVE"); expect(failed.summary.failed).toBe(1);
    const skipped = projectGlwCampaign(campaign, [target("CA", "skipped")]); expect(skipped.displayState).toBe("ACTIVE"); expect(skipped.unresolvedCount).toBe(1);
    expect(projectGlwCampaign({ ...campaign, status: "draft" }, []).displayState).toBe("DRAFT");
  });
  it("proposes but does not create a deterministic draft spin-off with lineage", () => {
    const record = projectGlwCampaign(campaign, [target("CA", "published"), target("TX", "published")]);
    const proposal = recommendGlwCampaignContinuation({ record, campaigns: [campaign] });
    expect(proposal).toMatchObject({ parentCampaignId: campaign.campaignId, name: "Indoor LED Sphere Major Cities", pageType: "city_service", stateCodes: ["CA", "TX"] });
    expect(createSpinOffDraftInput({ parent: campaign, proposal: proposal! })).toMatchObject({ parentCampaignId: campaign.campaignId, pageType: "city_service" });
    expect(campaign.status).toBe("active");
  });
  it("maps completed, active, incomplete, and uncovered states with org/site isolation", () => {
    const foreign = { ...campaign, campaignId: "foreign", organizationId: "org-2" };
    const foreignSite = { ...campaign, campaignId: "foreign-site", siteId: "site-2" };
    const coverage = buildGlwStateCoverage({ campaigns: [campaign, foreign, foreignSite], targets: [target("CA", "published"), target("TX", "running"), target("AZ", "failed"), target("CA", "failed", undefined, { campaignId: "foreign", organizationId: "org-2" }), target("TX", "failed", undefined, { campaignId: "foreign-site", siteId: "site-2" })], organizationId: "org-1", siteId: "site-1" });
    expect(coverage.find((state) => state.code === "CA")?.state).toBe("completed");
    expect(coverage.find((state) => state.code === "TX")?.state).toBe("active");
    expect(coverage.find((state) => state.code === "AZ")?.state).toBe("incomplete");
    expect(coverage.find((state) => state.code === "NY")?.state).toBe("uncovered");
  });
  it("does not derive coverage from a draft campaign without canonical targets", () => {
    const coverage = buildGlwStateCoverage({ campaigns: [{ ...campaign, status: "draft" }], targets: [], organizationId: "org-1", siteId: "site-1" });
    expect(coverage.every((state) => state.state === "uncovered")).toBe(true);
  });
  it("aggregates overlapping campaign targets with failed then active priority", () => {
    const second = { ...campaign, campaignId: "campaign-2" };
    const failed = buildGlwStateCoverage({ campaigns: [campaign, second], targets: [target("CA", "published"), target("CA", "failed", undefined, { campaignId: second.campaignId })], organizationId: "org-1", siteId: "site-1" });
    expect(failed.find((state) => state.code === "CA")).toMatchObject({ state: "incomplete", completedCount: 1, failedCount: 1, campaignIds: ["campaign-1", "campaign-2"] });
    const active = buildGlwStateCoverage({ campaigns: [campaign, second], targets: [target("CA", "published"), target("CA", "running", undefined, { campaignId: second.campaignId })], organizationId: "org-1", siteId: "site-1" });
    expect(active.find((state) => state.code === "CA")?.state).toBe("active");
  });
});