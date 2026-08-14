import { describe, expect, it } from "@jest/globals";
import {
  createGlwJobInput,
  createGlwJobRecord,
  getGlwJobOperatorSnapshot,
  GLW_JOB_TIMEOUT_MS,
} from "@/lib/glw/jobs";

function buildValidPageRequest(overrides?: Record<string, unknown>) {
  return {
    siteId: "led-display-warehouse",
    workspaceId: "glw-led-display-warehouse",
    pageType: "city_service",
    productTopic: "LED wall rental",
    state: "California",
    city: "Los Angeles",
    citySlug: "los-angeles",
    hierarchicalSlug: "california/los-angeles/led-wall-rental",
    additionalInstructions: "Focus on same-day deployment for venue operators.",
    title: "LED Wall Rental Package",
    targetSlug: "led-wall-rental-package",
    primaryKeyword: "led wall rental",
    secondaryKeywords: ["event led wall", "mobile led display"],
    wordCount: 1500,
    tone: "Confident",
    audience: "Event planners",
    callToAction: "Request a same-day quote",
    category: "Rentals",
    status: "draft",
    ...overrides,
  };
}

describe("GLW job operator snapshot", () => {
  it("renders terminal COMPLETE jobs as completed with 100 percent progress", () => {
    const completedJob = createGlwJobRecord({
      type: "PAGE_GENERATION",
      status: "COMPLETE",
      retryOfJobId: null,
      siteId: "led-display-warehouse",
      title: "LED Wall Rental Package",
      input: createGlwJobInput(buildValidPageRequest(), "http://localhost/api/glw/jobs/callback"),
      result: {
        executionId: "exec_complete",
        n8nExecutionId: "exec_complete",
        status: "COMPLETE",
        title: "LED Wall Rental Package",
        wordpressUrl: "https://example.com/led-wall-rental-package",
        wordpressPostId: 123,
        wordpressPageId: 123,
        wordpressStatus: "draft",
        requestedPublishingMode: "draft",
      },
      error: null,
      externalExecutionId: "exec_complete",
      startedAt: new Date(Date.now() - 120_000).toISOString(),
      completedAt: new Date().toISOString(),
    });

    const snapshot = getGlwJobOperatorSnapshot(completedJob);

    expect(snapshot.displayStatus).toBe("COMPLETE");
    expect(snapshot.currentStage).toBe("Completed");
    expect(snapshot.progressPercent).toBe(100);
    expect(snapshot.timedOut).toBe(false);
  });

  it("renders stale non-terminal jobs as timed out until API reconciliation persists failure", () => {
    const staleJob = createGlwJobRecord({
      type: "PAGE_GENERATION",
      status: "STARTING",
      retryOfJobId: null,
      siteId: "led-display-warehouse",
      title: "Stale Starting Job",
      input: createGlwJobInput(buildValidPageRequest({ title: "Stale Starting Job" }), "http://localhost/api/glw/jobs/callback"),
      result: {
        executionId: "exec_stale",
        status: "STARTING",
        title: "Stale Starting Job",
      },
      error: null,
      externalExecutionId: "exec_stale",
      startedAt: new Date(Date.now() - GLW_JOB_TIMEOUT_MS - 60_000).toISOString(),
      completedAt: null,
    });

    const snapshot = getGlwJobOperatorSnapshot(staleJob);

    expect(snapshot.displayStatus).toBe("Timed Out");
    expect(snapshot.currentStage).toBe("Timed Out");
    expect(snapshot.progressPercent).toBe(92);
    expect(snapshot.timedOut).toBe(true);
  });
});