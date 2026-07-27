import { describe, expect, it } from "@jest/globals";
import { buildGlwGenesisModuleManifest, toGenesisJob } from "@/platform/gop/adapters/glw";
import type { GlwJobRecord } from "@/lib/glw/jobs";

function createJob(status: GlwJobRecord["status"]): GlwJobRecord {
  return {
    id: "glw_test",
    type: "PAGE_GENERATION",
    status,
    retryOfJobId: null,
    siteId: "led-display-warehouse",
    title: "Test Job",
    input: {
      type: "page_generation",
      site: { id: "led-display-warehouse", name: "LED Display Warehouse" },
      page: {
        title: "Test Job",
        targetSlug: "test-job",
        primaryKeyword: "test",
        secondaryKeywords: ["one"],
        wordCount: 900,
        tone: "professional",
        audience: "ops",
        callToAction: "cta",
        category: "Testing",
        status: "draft",
      },
      promptData: { tone: "professional", audience: "ops", callToAction: "cta" },
      seoSettings: { targetSlug: "test-job", primaryKeyword: "test", secondaryKeywords: ["one"], category: "Testing" },
      publishingSettings: { status: "draft", wordCount: 900 },
      imageSettings: { generateFeaturedImage: true, style: "editorial" },
      callbackUrl: "http://localhost/api/glw/jobs/callback",
    },
    result: null,
    error: null,
    externalExecutionId: null,
    startedAt: "2026-07-26T10:00:00.000Z",
    completedAt: null,
    createdAt: "2026-07-26T10:00:00.000Z",
    updatedAt: "2026-07-26T10:00:00.000Z",
  };
}

describe("glw gop adapter", () => {
  it("maps GLW job into genesis job contract", () => {
    const mapped = toGenesisJob(createJob("RUNNING"));

    expect(mapped.moduleId).toBe("glw.core");
    expect(mapped.type).toBe("PAGE_GENERATION");
    expect(mapped.events[0]?.type).toBe("JOB_CREATED");
  });

  it("provides registered GLW navigation for shell loader", () => {
    const manifest = buildGlwGenesisModuleManifest();

    expect(manifest.navigation.some((item) => item.href === "/glw/pages")).toBe(true);
    expect(manifest.navigation.some((item) => item.href === "/glw/settings")).toBe(true);
  });
});
