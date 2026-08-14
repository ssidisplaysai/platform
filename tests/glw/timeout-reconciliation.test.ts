import { describe, expect, it } from "@jest/globals";
import { createInMemoryGlwJobRepository } from "@/lib/glw/job-repository";
import { createGlwJobInput, createGlwJobRecord, GLW_JOB_TIMEOUT_MS } from "@/lib/glw/jobs";
import { reconcileGlwTimedOutJob, runGlwTimeoutReconciliation } from "@/lib/glw/timeout-reconciliation";

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

describe("GLW timeout reconciliation service", () => {
  it("reconciles stale non-terminal jobs to FAILED", async () => {
    const staleStart = new Date(Date.now() - GLW_JOB_TIMEOUT_MS - 60_000).toISOString();
    const staleJob = createGlwJobRecord({
      type: "PAGE_GENERATION",
      status: "RUNNING",
      retryOfJobId: null,
      siteId: "led-display-warehouse",
      title: "Stale running job",
      input: createGlwJobInput(buildValidPageRequest(), "http://localhost/api/glw/jobs/callback"),
      result: {
        executionId: "exec_stale_service",
        status: "RUNNING",
        title: "Stale running job",
      },
      error: null,
      externalExecutionId: "exec_stale_service",
      startedAt: staleStart,
      completedAt: null,
    });

    const repository = createInMemoryGlwJobRepository([staleJob]);
    const result = await reconcileGlwTimedOutJob(staleJob, repository);
    const updated = await repository.findById(staleJob.id);

    expect(result.action).toBe("RECONCILED");
    expect(updated?.status).toBe("FAILED");
    expect(updated?.error).toMatchObject({ code: "TIMED_OUT" });
  });

  it("skips fresh jobs without mutating status", async () => {
    const freshJob = createGlwJobRecord({
      type: "PAGE_GENERATION",
      status: "STARTING",
      retryOfJobId: null,
      siteId: "led-display-warehouse",
      title: "Fresh starting job",
      input: createGlwJobInput(buildValidPageRequest(), "http://localhost/api/glw/jobs/callback"),
      result: {
        executionId: "exec_fresh_service",
        status: "STARTING",
        title: "Fresh starting job",
      },
      error: null,
      externalExecutionId: "exec_fresh_service",
      startedAt: new Date().toISOString(),
      completedAt: null,
    });

    const repository = createInMemoryGlwJobRepository([freshJob]);
    const result = await reconcileGlwTimedOutJob(freshJob, repository);
    const updated = await repository.findById(freshJob.id);

    expect(result.action).toBe("SKIPPED_FRESH");
    expect(updated?.status).toBe("STARTING");
  });

  it("is idempotent when reconciliation runs repeatedly", async () => {
    const staleStart = new Date(Date.now() - GLW_JOB_TIMEOUT_MS - 60_000).toISOString();
    const staleJob = createGlwJobRecord({
      type: "PAGE_GENERATION",
      status: "GENERATING_IMAGE",
      retryOfJobId: null,
      siteId: "led-display-warehouse",
      title: "Idempotent stale job",
      input: createGlwJobInput(buildValidPageRequest(), "http://localhost/api/glw/jobs/callback"),
      result: {
        executionId: "exec_idempotent_service",
        status: "GENERATING_IMAGE",
        title: "Idempotent stale job",
      },
      error: null,
      externalExecutionId: "exec_idempotent_service",
      startedAt: staleStart,
      completedAt: null,
    });

    const repository = createInMemoryGlwJobRepository([staleJob]);

    const first = await runGlwTimeoutReconciliation({ repository, limit: 50 });
    const second = await runGlwTimeoutReconciliation({ repository, limit: 50 });

    expect(first.reconciled).toBe(1);
    expect(second.reconciled).toBe(0);

    const updated = await repository.findById(staleJob.id);
    expect(updated?.status).toBe("FAILED");
  });

  it("reports race-terminal when status changes before conditional update", async () => {
    const staleStart = new Date(Date.now() - GLW_JOB_TIMEOUT_MS - 60_000).toISOString();
    const staleJob = createGlwJobRecord({
      type: "PAGE_GENERATION",
      status: "RUNNING",
      retryOfJobId: null,
      siteId: "led-display-warehouse",
      title: "Race terminal job",
      input: createGlwJobInput(buildValidPageRequest(), "http://localhost/api/glw/jobs/callback"),
      result: {
        executionId: "exec_race_terminal",
        status: "RUNNING",
        title: "Race terminal job",
      },
      error: null,
      externalExecutionId: "exec_race_terminal",
      startedAt: staleStart,
      completedAt: null,
    });

    const repository = createInMemoryGlwJobRepository([staleJob]);
    await repository.update(staleJob.id, {
      status: "COMPLETE",
      completedAt: new Date().toISOString(),
    });

    const latest = await repository.findById(staleJob.id);
    const result = await reconcileGlwTimedOutJob(latest!, repository);

    expect(result.action).toBe("SKIPPED_TERMINAL");
  });
});
