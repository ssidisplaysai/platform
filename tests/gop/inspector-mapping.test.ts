import { describe, expect, it } from "@jest/globals";
import { mapGlwJobToInspectorJob } from "@/platform/gop/adapters/glw-inspector";
import type { GlwJobRecord } from "@/lib/glw/jobs";

function makeJob(): GlwJobRecord {
  return {
    id: "glw_inspector",
    type: "PAGE_GENERATION",
    status: "RUNNING",
    retryOfJobId: null,
    siteId: "led-display-warehouse",
    title: "Inspector Job",
    input: {
      type: "page_generation",
      site: { id: "led-display-warehouse", name: "LED Display Warehouse" },
      page: {
        title: "Inspector Job",
        targetSlug: "inspector-job",
        primaryKeyword: "inspector",
        secondaryKeywords: ["timeline"],
        wordCount: 1000,
        tone: "professional",
        audience: "ops",
        callToAction: "cta",
        category: "Testing",
        status: "draft",
      },
      promptData: { tone: "professional", audience: "ops", callToAction: "cta" },
      seoSettings: { targetSlug: "inspector-job", primaryKeyword: "inspector", secondaryKeywords: ["timeline"], category: "Testing" },
      publishingSettings: { status: "draft", wordCount: 1000 },
      imageSettings: { generateFeaturedImage: true, style: "editorial" },
      callbackUrl: "http://localhost/api/glw/jobs/callback",
    },
    result: null,
    error: null,
    externalExecutionId: "exec_1",
    startedAt: "2026-07-26T10:00:00.000Z",
    completedAt: null,
    createdAt: "2026-07-26T10:00:00.000Z",
    updatedAt: "2026-07-26T10:01:00.000Z",
  };
}

describe("glw inspector mapping", () => {
  it("creates inspector job model with fallback projected timeline", () => {
    const mapped = mapGlwJobToInspectorJob(makeJob());
    expect(mapped.jobId).toBe("glw_inspector");
    expect(mapped.events.length).toBeGreaterThan(0);
  });

  it("prefers persisted GOP events when available", () => {
    const mapped = mapGlwJobToInspectorJob(makeJob(), [
      {
        eventId: "evt_1",
        jobId: "glw_inspector",
        moduleId: "glw.core",
        jobType: "PAGE_GENERATION",
        eventType: "STARTED",
        stage: "running",
        status: "RUNNING",
        message: "started",
        source: "glw",
        occurredAt: "2026-07-26T10:00:10.000Z",
        sequence: 1,
        durationMs: null,
        metadata: null,
        actorId: null,
        actorName: null,
        correlationId: null,
        causationId: null,
        idempotencyKey: null,
        createdAt: "2026-07-26T10:00:10.000Z",
      },
    ]);

    expect(mapped.events).toHaveLength(1);
    expect(mapped.events[0]?.eventId).toBe("evt_1");
  });
});
