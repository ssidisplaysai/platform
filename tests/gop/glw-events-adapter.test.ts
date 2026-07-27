import { describe, expect, it } from "@jest/globals";
import { createGlwEventFromJob } from "@/platform/gop/adapters/glw-events";
import type { GlwJobRecord } from "@/lib/glw/jobs";

function makeJob(status: GlwJobRecord["status"]): GlwJobRecord {
  return {
    id: "glw_evt",
    type: "PAGE_GENERATION",
    status,
    retryOfJobId: null,
    siteId: "led-display-warehouse",
    title: "Event Adapter",
    input: {
      type: "page_generation",
      site: { id: "led-display-warehouse", name: "LED Display Warehouse" },
      page: {
        title: "Event Adapter",
        targetSlug: "event-adapter",
        primaryKeyword: "event",
        secondaryKeywords: ["adapter"],
        wordCount: 800,
        tone: "professional",
        audience: "ops",
        callToAction: "cta",
        category: "Testing",
        status: "draft",
      },
      promptData: { tone: "professional", audience: "ops", callToAction: "cta" },
      seoSettings: { targetSlug: "event-adapter", primaryKeyword: "event", secondaryKeywords: ["adapter"], category: "Testing" },
      publishingSettings: { status: "draft", wordCount: 800 },
      imageSettings: { generateFeaturedImage: true, style: "editorial" },
      callbackUrl: "http://localhost/api/glw/jobs/callback",
    },
    result: null,
    error: null,
    externalExecutionId: "exec_evt",
    startedAt: "2026-07-26T10:00:00.000Z",
    completedAt: status === "COMPLETE" ? "2026-07-26T10:01:00.000Z" : null,
    createdAt: "2026-07-26T10:00:00.000Z",
    updatedAt: "2026-07-26T10:01:00.000Z",
  };
}

describe("glw event adapter", () => {
  it("maps failed jobs to failed lifecycle event", () => {
    const event = createGlwEventFromJob(makeJob("FAILED"));
    expect(event.type).toBe("FAILED");
    expect(event.status).toBe("FAILED");
  });

  it("maps complete jobs to succeeded lifecycle event", () => {
    const event = createGlwEventFromJob(makeJob("COMPLETE"));
    expect(event.type).toBe("SUCCEEDED");
    expect(event.status).toBe("COMPLETE");
    expect(event.durationMs).toBeGreaterThan(0);
  });
});
