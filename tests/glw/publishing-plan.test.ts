import { describe, expect, it, beforeEach } from "@jest/globals";

import { createGlwJobRecord } from "@/lib/glw/jobs";
import { GLW_PRODUCT_REGISTRY } from "@/lib/glw/product-registry";
import { GLW_SITE_REGISTRY } from "@/lib/glw/site-registry";
import {
  canEnqueueGlwJob,
  createDefaultGlwThrottlePolicy,
  generateGlwDailyPublishPlan,
  summarizeGlwCoverage,
} from "@/lib/glw/publishing-plan";
import {
  getGlwDailyPublishPlan,
  getGlwPublishingControl,
  pauseGlwPublishing,
  resetGlwPlanStoreForTests,
  resumeGlwPublishing,
  storeGlwDailyPublishPlan,
} from "@/lib/glw/publishing-plan-store";

function makeJob(input: {
  siteId?: string;
  status?: "QUEUED" | "STARTING" | "RUNNING" | "COMPLETE" | "FAILED_QA" | "FAILED";
  pageType?: "city_service" | "state_service";
  productTopic?: string;
  state?: string;
  city?: string;
  citySlug?: string;
  hierarchicalSlug?: string;
} = {}) {
  return createGlwJobRecord({
    type: "PAGE_GENERATION",
    status: input.status ?? "COMPLETE",
    retryOfJobId: null,
    siteId: input.siteId ?? "led-display-warehouse",
    title: "Test GLW Job",
    input: {
      type: "page_generation",
      site: { id: input.siteId ?? "led-display-warehouse", name: "LED Display Warehouse" },
      page: {
        workspaceId: "glw-led-display-warehouse",
        pageType: input.pageType ?? "city_service",
        productTopic: input.productTopic ?? "direct_view_led_video_walls",
        state: input.state ?? "Texas",
        city: input.city ?? "Houston",
        citySlug: input.citySlug ?? "houston",
        hierarchicalSlug: input.hierarchicalSlug ?? "direct_view_led_video_walls/texas/houston",
        additionalInstructions: "",
        title: "Test GLW Job",
        targetSlug: input.hierarchicalSlug ?? "direct_view_led_video_walls/texas/houston",
        primaryKeyword: "direct view led video walls houston",
        secondaryKeywords: ["led video walls"],
        wordCount: 1200,
        tone: "Professional",
        audience: "Commercial buyers",
        callToAction: "Request a quote",
        category: "core",
        status: "publish",
      },
      promptData: { tone: "Professional", audience: "Commercial buyers", callToAction: "Request a quote" },
      seoSettings: { targetSlug: input.hierarchicalSlug ?? "direct_view_led_video_walls/texas/houston", citySlug: input.citySlug ?? "houston", primaryKeyword: "direct view led video walls houston", secondaryKeywords: ["led video walls"], category: "core" },
      publishingSettings: { status: "publish", wordCount: 1200 },
      imageSettings: { generateFeaturedImage: true, style: "commercial" },
      callbackUrl: "https://example.test/api/glw/jobs/callback",
    },
    result: input.status === "COMPLETE"
      ? { executionId: "exec_1", status: "COMPLETE", wordpressPageId: 123, wordpressStatus: "publish", requestedPublishingMode: "publish" }
      : null,
    error: null,
    externalExecutionId: null,
    startedAt: null,
    completedAt: null,
  });
}

beforeEach(async () => {
  await resetGlwPlanStoreForTests();
});

describe("GLW publishing plan", () => {
  it("is deterministic and respects throttle limits", () => {
    const jobs = [makeJob({ pageType: "city_service", city: "Houston", citySlug: "houston" })];
    const planA = generateGlwDailyPublishPlan({ siteId: "led-display-warehouse", existingJobs: jobs, limits: { dailyPageLimit: 8, hourlyPageLimit: 5, maxConcurrentJobs: 2, retryLimit: 2, productRotation: ["direct_view_led_video_walls", "led_wall_rental"], stateRotation: ["TX", "CA"], minimumDelaySeconds: 60 } });
    const planB = generateGlwDailyPublishPlan({ siteId: "led-display-warehouse", existingJobs: jobs, limits: { dailyPageLimit: 8, hourlyPageLimit: 5, maxConcurrentJobs: 2, retryLimit: 2, productRotation: ["direct_view_led_video_walls", "led_wall_rental"], stateRotation: ["TX", "CA"], minimumDelaySeconds: 60 } });

    expect(planA.candidates.map((candidate) => candidate.canonicalPath)).toEqual(planB.candidates.map((candidate) => candidate.canonicalPath));
    expect(planA.candidates.length).toBeLessThanOrEqual(8);
    expect(planA.approved.length).toBeLessThanOrEqual(8);
    expect(planA.candidates[0]?.productId).toBe("direct_view_led_video_walls");
    expect(planA.candidates[0]?.stateSlug.toUpperCase()).toBe("TX");
  });

  it("computes coverage math from the 14-product registry and enabled cities", () => {
    const coverage = summarizeGlwCoverage({ siteId: "led-display-warehouse", existingJobs: [] });

    expect(GLW_PRODUCT_REGISTRY).toHaveLength(14);
    expect(coverage.enabledProducts).toBe(14);
    expect(coverage.enabledStates).toBe(50);
    expect(coverage.enabledCities).toBe(12);
    expect(coverage.theoreticalStateTargets).toBe(700);
    expect(coverage.theoreticalTargets).toBe(868);
    expect(coverage.coveragePercent).toBe(0);
  });

  it("prevents duplicate queue targets and keeps SSI disabled", async () => {
    const duplicateJobs = [
      makeJob({ status: "QUEUED" }),
      makeJob({ status: "RUNNING" }),
    ];

    expect(canEnqueueGlwJob(duplicateJobs[0], duplicateJobs).allowed).toBe(false);
    expect((await getGlwPublishingControl("screen-solutions-international", false)).publishingEnabled).toBe(false);

    const ssiPlan = generateGlwDailyPublishPlan({ siteId: "screen-solutions-international", existingJobs: [] });
    expect(GLW_SITE_REGISTRY.find((site) => site.id === "screen-solutions-international")?.publishingEnabled).toBe(false);
    expect(ssiPlan.candidates).toHaveLength(0);
  });

  it("supports pause and resume control state", async () => {
    const initial = await getGlwPublishingControl("led-display-warehouse", true);
    expect(initial.paused).toBe(false);
    expect((await pauseGlwPublishing("led-display-warehouse")).paused).toBe(true);
    expect((await resumeGlwPublishing("led-display-warehouse")).paused).toBe(false);
  });

  it("excludes blocked candidates from approval planning", async () => {
    const plan = generateGlwDailyPublishPlan({
      siteId: "led-display-warehouse",
      existingJobs: [],
      limits: { dailyPageLimit: 5, hourlyPageLimit: 5, maxConcurrentJobs: 2, retryLimit: 2, productRotation: ["direct_view_led_video_walls"], stateRotation: ["TX"], minimumDelaySeconds: 60 },
    });

    expect(plan.blocked.some((candidate) => candidate.desiredAction.startsWith("BLOCKED"))).toBe(true);
    expect(plan.approved.every((candidate) => !candidate.desiredAction.startsWith("BLOCKED"))).toBe(true);
    expect(plan.approved.every((candidate) => candidate.desiredAction !== "SKIP_EXISTING")).toBe(true);

    const stored = await storeGlwDailyPublishPlan(plan);
    expect((await getGlwDailyPublishPlan(stored.planId))?.planId).toBe(stored.planId);
  });
});