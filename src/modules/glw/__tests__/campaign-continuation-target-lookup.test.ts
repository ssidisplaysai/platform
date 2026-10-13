import { resolveExactContinuationCampaignTarget } from "@/modules/glw/campaign-continuation-target-lookup";
import type { GlwCampaignTarget } from "@/modules/glw/campaign-target-repository";

const campaignId = "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview";
const organizationId = "led-display-warehouse";
const siteId = "site-led-display-warehouse-production";
const productId = "prod-outdoor-digital-sphere";
const targetId = "target-campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview-fl";
const jobId = "5d877113-638a-40d0-9252-6390ec97c837";
const executionId = "691948";

function createTarget(overrides: Partial<GlwCampaignTarget> = {}): GlwCampaignTarget {
  return {
    targetId,
    campaignId,
    organizationId,
    siteId,
    productId,
    pageType: "state_service",
    stateCode: "FL",
    citySlug: null,
    cityName: null,
    status: "content_ready",
    jobId,
    wordpressObjectId: null,
    attemptCount: 1,
    lastError: null,
    leaseId: null,
    leasedAt: null,
    leaseExpiresAt: null,
    dispatchDate: "2026-09-17",
    createdAt: "2026-09-16T16:29:06.970Z",
    updatedAt: "2026-09-18T02:16:06.420Z",
    ...overrides,
  };
}

function lookup(overrides: Partial<Parameters<typeof resolveExactContinuationCampaignTarget>[0]> = {}) {
  return resolveExactContinuationCampaignTarget({
    targets: [createTarget()],
    campaignId,
    organizationId,
    siteId,
    productId,
    expectedStateCode: "FL",
    expectedCitySlug: "",
    expectedTargetId: targetId,
    expectedJobId: jobId,
    expectedExecutionId: executionId,
    actualExecutionId: executionId,
    ...overrides,
  });
}

describe("resolveExactContinuationCampaignTarget", () => {
  test("A: resolves exact FL campaign/state/job/execution target identity", () => {
    const result = lookup();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.target.targetId).toBe(targetId);
    expect(result.target.stateCode).toBe("FL");
    expect(result.target.jobId).toBe(jobId);
  });

  test("B: accepts null and empty city slug parity used by operator read-model state targets", () => {
    const result = lookup({ expectedTargetId: null });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.target.citySlug).toBeNull();
    expect(result.target.targetId).toBe(targetId);
  });

  test("C: wrong campaign fails closed", () => {
    const result = lookup({ campaignId: "campaign-other" });
    expect(result).toMatchObject({ ok: false, error: "Selected target does not belong to the exact campaign." });
  });

  test("D: wrong state identity fails closed", () => {
    const result = lookup({ expectedTargetId: null, expectedStateCode: "GA" });
    expect(result).toMatchObject({ ok: false, error: "Exact campaign target was not found for continuation." });
  });

  test("E: wrong job fails closed", () => {
    const result = lookup({ expectedJobId: "job-mismatch" });
    expect(result).toMatchObject({ ok: false, error: "Campaign target does not match the exact existing job." });
  });

  test("F: wrong execution fails closed", () => {
    const result = lookup({ expectedExecutionId: "999999" });
    expect(result).toMatchObject({ ok: false, error: "Continuation request executionId does not match the exact existing execution." });
  });

  test("G: cross-scope target fails closed", () => {
    const result = lookup({
      targets: [createTarget({ siteId: "site-other" })],
    });
    expect(result).toMatchObject({ ok: false, error: "Selected target does not match the exact campaign scope." });
  });

  test("H: content-ready target proceeds past lookup", () => {
    const result = lookup({ targets: [createTarget({ status: "content_ready" })] });
    expect(result.ok).toBe(true);
  });

  test("I: lookup consumes no additional dispatch and preserves target counters", () => {
    const target = createTarget({ attemptCount: 1 });
    const result = lookup({ targets: [target] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.target.attemptCount).toBe(1);
    expect(result.target.dispatchDate).toBe("2026-09-17");
  });

  test("J: lookup creates no replacement job or execution identity", () => {
    const result = lookup();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.target.jobId).toBe(jobId);
    expect(result.target.wordpressObjectId).toBeNull();
  });
});
