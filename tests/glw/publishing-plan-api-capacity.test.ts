import { describe, expect, it, jest } from "@jest/globals";

jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => ({ value: "mocked.session.token" }),
    set: () => undefined,
    delete: () => undefined,
  }),
}), { virtual: true });

import { createGlwJobRecord, type GlwJobRecord } from "@/lib/glw/jobs";
import {
  computeDispatchConcurrency,
  shouldJobConsumeDispatchCapacity,
} from "@/lib/glw/publishing-plan-api";

function makeJob(input: {
  status: GlwJobRecord["status"];
  startedAt?: string | null;
  createdAt?: string;
}): GlwJobRecord {
  const now = input.createdAt ?? new Date().toISOString();

  return {
    ...createGlwJobRecord({
      type: "PAGE_GENERATION",
      status: input.status,
      retryOfJobId: null,
      siteId: "led-display-warehouse",
      title: "Capacity test",
      input: {
        type: "page_generation",
        site: { id: "led-display-warehouse", name: "LED Display Warehouse" },
        page: {
          workspaceId: "glw-led-display-warehouse",
          pageType: "city_service",
          productTopic: "direct_view_led_video_walls",
          state: "Texas",
          city: "Houston",
          citySlug: "houston",
          hierarchicalSlug: "direct_view_led_video_walls/texas/houston",
          additionalInstructions: "",
          title: "Capacity test",
          targetSlug: "direct_view_led_video_walls/texas/houston",
          primaryKeyword: "direct view led video walls houston",
          secondaryKeywords: ["led video walls"],
          wordCount: 1200,
          tone: "Professional",
          audience: "Commercial buyers",
          callToAction: "Request a quote",
          category: "core",
          status: "publish",
        },
        promptData: {
          tone: "Professional",
          audience: "Commercial buyers",
          callToAction: "Request a quote",
        },
        seoSettings: {
          targetSlug: "direct_view_led_video_walls/texas/houston",
          citySlug: "houston",
          primaryKeyword: "direct view led video walls houston",
          secondaryKeywords: ["led video walls"],
          category: "core",
        },
        publishingSettings: {
          status: "publish",
          wordCount: 1200,
        },
        imageSettings: {
          generateFeaturedImage: true,
          style: "editorial",
        },
      },
      result: null,
      error: null,
      externalExecutionId: null,
      startedAt: input.startedAt === undefined ? null : input.startedAt,
      completedAt: null,
    }),
    createdAt: now,
    updatedAt: now,
  };
}

describe("publishing plan dispatch capacity", () => {
  const fixedNow = new Date("2026-08-10T22:00:00.000Z");
  const oneMinuteAgo = new Date(fixedNow.getTime() - 60_000).toISOString();
  const twoHoursAgo = new Date(fixedNow.getTime() - (2 * 60 * 60 * 1000)).toISOString();
  const timeoutMs = 30 * 60 * 1000;

  it("counts fresh STARTING as capacity-consuming", () => {
    const job = makeJob({ status: "STARTING", startedAt: oneMinuteAgo });
    expect(shouldJobConsumeDispatchCapacity(job, { now: fixedNow, startingTimeoutMs: timeoutMs })).toBe(true);
  });

  it("excludes stale STARTING from capacity", () => {
    const job = makeJob({ status: "STARTING", startedAt: twoHoursAgo });
    expect(shouldJobConsumeDispatchCapacity(job, { now: fixedNow, startingTimeoutMs: timeoutMs })).toBe(false);
  });

  it("counts RUNNING as capacity-consuming", () => {
    const job = makeJob({ status: "RUNNING", startedAt: oneMinuteAgo });
    expect(shouldJobConsumeDispatchCapacity(job, { now: fixedNow, startingTimeoutMs: timeoutMs })).toBe(true);
  });

  it("excludes COMPLETE from capacity", () => {
    const job = makeJob({ status: "COMPLETE" });
    expect(shouldJobConsumeDispatchCapacity(job, { now: fixedNow, startingTimeoutMs: timeoutMs })).toBe(false);
  });

  it("excludes FAILED from capacity", () => {
    const job = makeJob({ status: "FAILED" });
    expect(shouldJobConsumeDispatchCapacity(job, { now: fixedNow, startingTimeoutMs: timeoutMs })).toBe(false);
  });

  it("excludes FAILED_QA from capacity", () => {
    const job = makeJob({ status: "FAILED_QA" });
    expect(shouldJobConsumeDispatchCapacity(job, { now: fixedNow, startingTimeoutMs: timeoutMs })).toBe(false);
  });

  it("returns concurrencyRemaining 0 for two fresh active jobs at maxConcurrentJobs=2", () => {
    const siteJobs = [
      makeJob({ status: "STARTING", startedAt: oneMinuteAgo }),
      makeJob({ status: "RUNNING", startedAt: oneMinuteAgo }),
    ];

    const result = computeDispatchConcurrency({
      siteJobs,
      maxConcurrentJobs: 2,
      now: fixedNow,
      startingTimeoutMs: timeoutMs,
    });

    expect(result.activeCount).toBe(2);
    expect(result.concurrencyRemaining).toBe(0);
  });

  it("returns concurrencyRemaining 2 for twenty-five stale STARTING jobs and maxConcurrentJobs=2", () => {
    const siteJobs = Array.from({ length: 25 }, () => makeJob({ status: "STARTING", startedAt: twoHoursAgo }));

    const result = computeDispatchConcurrency({
      siteJobs,
      maxConcurrentJobs: 2,
      now: fixedNow,
      startingTimeoutMs: timeoutMs,
    });

    expect(result.activeCount).toBe(0);
    expect(result.concurrencyRemaining).toBe(2);
  });

  it("returns concurrencyRemaining 1 for one fresh STARTING plus many stale STARTING", () => {
    const staleJobs = Array.from({ length: 25 }, () => makeJob({ status: "STARTING", startedAt: twoHoursAgo }));
    const siteJobs = [makeJob({ status: "STARTING", startedAt: oneMinuteAgo }), ...staleJobs];

    const result = computeDispatchConcurrency({
      siteJobs,
      maxConcurrentJobs: 2,
      now: fixedNow,
      startingTimeoutMs: timeoutMs,
    });

    expect(result.activeCount).toBe(1);
    expect(result.concurrencyRemaining).toBe(1);
  });

  it("treats recovery-unverified STARTING with missing startedAt as active (conservative)", () => {
    const job = makeJob({ status: "STARTING", startedAt: null });
    expect(shouldJobConsumeDispatchCapacity(job, { now: fixedNow, startingTimeoutMs: timeoutMs })).toBe(true);
  });
});
