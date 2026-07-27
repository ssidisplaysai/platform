import { describe, expect, it, beforeEach, afterEach, jest } from "@jest/globals";

jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set: () => undefined,
    delete: () => undefined,
  }),
}), { virtual: true });

import { createInMemoryGlwJobRepository } from "@/lib/glw/job-repository";
import {
  applyGlwJobCallback,
  submitGlwPageGenerationJob,
  retryGlwPageGenerationJob,
} from "@/lib/glw/page-generation";
import {
  createGlwJobInput,
  createGlwJobRecord,
  parsePageGenerationFormData,
  validatePageGenerationRequest,
} from "@/lib/glw/jobs";
import { createGlwN8nTransport } from "@/lib/glw/n8n";
import {
  handleCreatePageGenerationJob,
  handleJobCallback,
  handleRetryJob,
} from "@/lib/glw/page-generation-api";

const originalEnv = { ...process.env };

function setRequiredEnv() {
  process.env.GLW_APP_URL = "http://localhost:3000";
  process.env.GLW_N8N_PAGE_WEBHOOK_URL = "https://example.test/webhook";
  process.env.GLW_N8N_WEBHOOK_SECRET = "callback-secret";
  process.env.GLW_ADMIN_EMAIL = "admin@example.com";
  process.env.GLW_ADMIN_PASSWORD = "password123";
  process.env.GLW_AUTH_SECRET = "auth-secret";
}

function createSessionLoader(hasSession: boolean) {
  return async () => (hasSession ? { email: "admin@example.com", expiresAt: Date.now() + 1000 } : null);
}

function buildRequest(body: unknown, headers?: HeadersInit): Request {
  return new Request("http://localhost/api/glw/jobs/page", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function buildValidPageRequest(overrides?: Record<string, unknown>) {
  return {
    siteId: "led-display-warehouse",
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

beforeEach(() => {
  process.env = { ...originalEnv };
  setRequiredEnv();
});

afterEach(() => {
  process.env = { ...originalEnv };
  jest.restoreAllMocks();
});

describe("GLW page generation validation", () => {
  it("rejects incomplete page requests", () => {
    const result = validatePageGenerationRequest({
      siteId: "led-display-warehouse",
      title: "",
      targetSlug: "",
      category: "",
      primaryKeyword: "",
      secondaryKeywords: [],
      wordCount: 10,
      tone: "",
      audience: "",
      callToAction: "",
      status: "draft",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.title).toBeDefined();
      expect(result.errors.targetSlug).toBeDefined();
      expect(result.errors.category).toBeDefined();
      expect(result.errors.primaryKeyword).toBeDefined();
    }
  });

  it("parses form data into a validated request", () => {
    const formData = new FormData();
    formData.set("siteId", "led-display-warehouse");
    formData.set("title", "LED Wall Rental Package");
    formData.set("targetSlug", "led-wall-rental-package");
    formData.set("category", "Rentals");
    formData.set("primaryKeyword", "LED wall rental");
    formData.set("secondaryKeywords", "event led wall, mobile led display");
    formData.set("wordCount", "1500");
    formData.set("tone", "Confident");
    formData.set("audience", "Event planners");
    formData.set("callToAction", "Request a same-day quote");
    formData.set("status", "draft");

    const result = parsePageGenerationFormData(formData);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.siteId).toBe("led-display-warehouse");
      expect(result.value.status).toBe("draft");
    }
  });
});

describe("GLW API auth and creation", () => {
  it("rejects unauthorized page-generation requests", async () => {
    const repository = createInMemoryGlwJobRepository();
    const workflow = {
      invokePageGeneration: jest.fn(),
    };

    const response = await handleCreatePageGenerationJob(buildRequest({}), {
      repository,
      workflow: workflow as unknown as ReturnType<typeof createGlwN8nTransport>,
      appUrl: "http://localhost:3000",
      sessionLoader: createSessionLoader(false),
    });

    expect(response.status).toBe(401);
  });

  it("creates a queued job and returns the completed WordPress result", async () => {
    const repository = createInMemoryGlwJobRepository();
    const workflow = {
      invokePageGeneration: jest.fn(async () => ({
        kind: "complete" as const,
        executionId: "exec_123",
        status: "complete" as const,
        title: "LED Wall Rental Package - Rentals in Los Angeles, CA",
        wordpressUrl: "https://example.com/led-wall-rental-package",
        wordpressPostId: 123,
      })),
    };

    const response = await handleCreatePageGenerationJob(buildRequest(buildValidPageRequest()), {
      repository,
      workflow: workflow as unknown as ReturnType<typeof createGlwN8nTransport>,
      appUrl: "http://localhost:3000",
      sessionLoader: createSessionLoader(true),
    });

    expect(response.status).toBe(201);

    const payload = await response.json() as { job: { status: string; result: { wordpressUrl: string } | null } };
    expect(payload.job.status).toBe("COMPLETE");
    expect(payload.job.result?.wordpressUrl).toBe("https://example.com/led-wall-rental-package");
    expect(workflow.invokePageGeneration).toHaveBeenCalledTimes(1);
  });

  it("surfaces n8n non-2xx failures", async () => {
    process.env.GLW_N8N_PAGE_WEBHOOK_URL = "https://example.test/webhook";
    process.env.GLW_N8N_WEBHOOK_SECRET = "callback-secret";

    const transport = createGlwN8nTransport({
      fetchImpl: (async () => new Response("upstream error", { status: 500, statusText: "Internal Server Error" })) as unknown as typeof fetch,
    });

    await expect(transport.invokePageGeneration({
      jobId: "glw_test_job",
      type: "page_generation",
      site: { id: "led-display-warehouse", name: "LED Display Warehouse" },
      page: {
        title: "LED Wall Rental Package",
        targetSlug: "led-wall-rental-package",
        primaryKeyword: "LED wall rental",
        secondaryKeywords: ["event led wall", "mobile led display"],
        wordCount: 1500,
        tone: "Confident",
        audience: "Event planners",
        callToAction: "Request a same-day quote",
        category: "Rentals",
        status: "draft",
      },
      promptData: {
        tone: "Confident",
        audience: "Event planners",
        callToAction: "Request a same-day quote",
      },
      seoSettings: {
        targetSlug: "led-wall-rental-package",
        primaryKeyword: "LED wall rental",
        secondaryKeywords: ["event led wall", "mobile led display"],
        category: "Rentals",
      },
      publishingSettings: {
        status: "draft",
        wordCount: 1500,
      },
      imageSettings: {
        generateFeaturedImage: true,
        style: "editorial",
      },
    })).rejects.toThrow(/returned 500/);

    const repository = createInMemoryGlwJobRepository();
    const workflow = {
      invokePageGeneration: jest.fn(async () => {
        throw new Error("Webhook failed");
      }),
    };

    const response = await handleCreatePageGenerationJob(buildRequest(buildValidPageRequest()), {
      repository,
      workflow: workflow as unknown as ReturnType<typeof createGlwN8nTransport>,
      appUrl: "http://localhost:3000",
      sessionLoader: createSessionLoader(true),
    });

    expect(response.status).toBe(502);
    const payload = await response.json() as { job: { status: string; error: { message: string } | null } };
    expect(payload.job.status).toBe("FAILED");
    expect(payload.job.error?.message).toContain("Webhook failed");
  });

  it("returns an unauthorized response for callbacks without auth", async () => {
    const repository = createInMemoryGlwJobRepository();

    const response = await handleJobCallback(new Request("http://localhost/api/glw/jobs/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: "job-1", executionId: "exec-1", status: "RUNNING" }),
    }), {
      repository,
      webhookSecret: "callback-secret",
    });

    expect(response.status).toBe(401);
  });
});

describe("GLW callback and retry behavior", () => {
  it("applies an idempotent callback update", async () => {
    const existingJob = createGlwJobRecord({
      type: "PAGE_GENERATION",
      status: "RUNNING",
      retryOfJobId: null,
      siteId: "led-display-warehouse",
      title: "LED Wall Rental Package - Rentals in Los Angeles, CA",
      input: createGlwJobInput({
        ...buildValidPageRequest({
          title: "LED Wall Rental Package - Rentals in Los Angeles, CA",
        }),
      }, "http://localhost/api/glw/jobs/callback"),
      result: {
        executionId: "exec_123",
        status: "RUNNING",
        title: "LED Wall Rental Package - Rentals in Los Angeles, CA",
      },
      error: null,
      externalExecutionId: "exec_123",
      startedAt: new Date().toISOString(),
      completedAt: null,
    });

    const repository = createInMemoryGlwJobRepository([existingJob]);

    const payload = {
      jobId: existingJob.id,
      executionId: "exec_123",
      status: "COMPLETE" as const,
      title: "LED Wall Rental Package - Rentals in Los Angeles, CA",
      wordpressUrl: "https://example.com/led-wall-rental-package",
      wordpressPostId: 123,
    };

    const first = await applyGlwJobCallback(payload, repository);
    const second = await applyGlwJobCallback(payload, repository);

    expect(first.status).toBe("COMPLETE");
    expect(second.status).toBe("COMPLETE");
    expect(second.result?.wordpressUrl).toBe("https://example.com/led-wall-rental-package");
  });

  it("rejects invalid callback status transitions", async () => {
    const completeJob = createGlwJobRecord({
      type: "PAGE_GENERATION",
      status: "COMPLETE",
      retryOfJobId: null,
      siteId: "led-display-warehouse",
      title: "LED Wall Rental Package - Rentals in Los Angeles, CA",
      input: createGlwJobInput({
        ...buildValidPageRequest({
          title: "LED Wall Rental Package - Rentals in Los Angeles, CA",
        }),
      }, "http://localhost/api/glw/jobs/callback"),
      result: {
        executionId: "exec_123",
        status: "COMPLETE",
        title: "LED Wall Rental Package - Rentals in Los Angeles, CA",
        wordpressUrl: "https://example.com/led-wall-rental-package",
        wordpressPostId: 123,
      },
      error: null,
      externalExecutionId: "exec_123",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });

    await expect(
      applyGlwJobCallback(
        {
          jobId: completeJob.id,
          executionId: "exec_123",
          status: "RUNNING",
        },
        createInMemoryGlwJobRepository([completeJob]),
      ),
    ).rejects.toThrow(/Invalid GLW job status transition/);
  });

  it("allows retry only for failed jobs", async () => {
    const failedJob = createGlwJobRecord({
      type: "PAGE_GENERATION",
      status: "FAILED",
      retryOfJobId: null,
      siteId: "led-display-warehouse",
      title: "LED Wall Rental Package - Rentals in Los Angeles, CA",
      input: createGlwJobInput({
        ...buildValidPageRequest({
          title: "LED Wall Rental Package - Rentals in Los Angeles, CA",
        }),
      }, "http://localhost/api/glw/jobs/callback"),
      result: null,
      error: { message: "Workflow failed" },
      externalExecutionId: "exec_fail",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });

    const repository = createInMemoryGlwJobRepository([failedJob]);
    const workflow = {
      invokePageGeneration: jest.fn(async () => ({
        kind: "accepted" as const,
        executionId: "exec_retry",
        status: "accepted" as const,
      })),
    };

    const retried = await retryGlwPageGenerationJob(failedJob.id, {
      repository,
      workflow: workflow as unknown as ReturnType<typeof createGlwN8nTransport>,
      appUrl: "http://localhost:3000",
    });

    expect(retried.job.status).toBe("STARTING");
    await expect(retryGlwPageGenerationJob("missing", {
      repository,
      workflow: workflow as unknown as ReturnType<typeof createGlwN8nTransport>,
      appUrl: "http://localhost:3000",
    })).rejects.toThrow(/not found/);
  });

  it("rejects retrying a completed job", async () => {
    const completedJob = createGlwJobRecord({
      type: "PAGE_GENERATION",
      status: "COMPLETE",
      retryOfJobId: null,
      siteId: "led-display-warehouse",
      title: "LED Wall Rental Package - Rentals in Los Angeles, CA",
      input: createGlwJobInput({
        ...buildValidPageRequest({
          title: "LED Wall Rental Package - Rentals in Los Angeles, CA",
        }),
      }, "http://localhost/api/glw/jobs/callback"),
      result: {
        executionId: "exec_done",
        status: "COMPLETE",
        title: "LED Wall Rental Package - Rentals in Los Angeles, CA",
        wordpressUrl: "https://example.com/led-wall-rental-package",
        wordpressPostId: 123,
      },
      error: null,
      externalExecutionId: "exec_done",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });

    await expect(retryGlwPageGenerationJob(completedJob.id, {
      repository: createInMemoryGlwJobRepository([completedJob]),
      workflow: {
        invokePageGeneration: jest.fn(),
      } as unknown as ReturnType<typeof createGlwN8nTransport>,
      appUrl: "http://localhost:3000",
    })).rejects.toThrow(/Only failed GLW jobs can be retried/);
  });

  it("exposes a completed WordPress URL in the stored job result", async () => {
    const repository = createInMemoryGlwJobRepository();
    const workflow = {
      invokePageGeneration: jest.fn(async () => ({
        kind: "complete" as const,
        executionId: "exec_999",
        status: "complete" as const,
        title: "Projection Screen Chicago - Rentals in Chicago, IL",
        wordpressUrl: "https://example.com/projection-screen-chicago",
        wordpressPostId: 999,
      })),
    };

    const result = await submitGlwPageGenerationJob({
      siteId: "led-display-warehouse",
      title: "Projection Screen Chicago - Rentals in Chicago, IL",
      targetSlug: "projection-screen-chicago",
      secondaryKeywords: ["projection screen rental", "led projection screen"],
      wordCount: 1800,
      tone: "Authoritative",
      audience: "Corporate event teams",
      callToAction: "Book your projection screen now",
      category: "Rentals",
      primaryKeyword: "projection screen rental",
      status: "publish",
    }, {
      repository,
      workflow: workflow as unknown as ReturnType<typeof createGlwN8nTransport>,
      appUrl: "http://localhost:3000",
    });

    expect(result.job.status).toBe("COMPLETE");
    expect(result.job.result?.wordpressUrl).toBe("https://example.com/projection-screen-chicago");
  });

  it("rejects callback payloads with unsupported statuses", async () => {
    const repository = createInMemoryGlwJobRepository();

    const response = await handleJobCallback(new Request("http://localhost/api/glw/jobs/callback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer callback-secret",
      },
      body: JSON.stringify({
        jobId: "job-1",
        executionId: "exec-1",
        status: "NOT_A_REAL_STATUS",
      }),
    }), {
      repository,
      webhookSecret: "callback-secret",
    });

    expect(response.status).toBe(400);
  });

  it("blocks retry when a previous retry is still active", async () => {
    const failedJob = createGlwJobRecord({
      type: "PAGE_GENERATION",
      status: "FAILED",
      retryOfJobId: null,
      siteId: "led-display-warehouse",
      title: "LED Wall Rental Package - Rentals in Los Angeles, CA",
      input: createGlwJobInput({
        ...buildValidPageRequest({
          title: "LED Wall Rental Package - Rentals in Los Angeles, CA",
        }),
      }, "http://localhost/api/glw/jobs/callback"),
      result: null,
      error: { message: "Workflow failed" },
      externalExecutionId: "exec_fail",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });

    const activeRetry = createGlwJobRecord({
      type: "PAGE_GENERATION",
      status: "RUNNING",
      retryOfJobId: failedJob.id,
      siteId: "led-display-warehouse",
      title: failedJob.title,
      input: failedJob.input,
      result: {
        executionId: "exec_retry_active",
        status: "RUNNING",
        title: failedJob.title,
      },
      error: null,
      externalExecutionId: "exec_retry_active",
      startedAt: new Date().toISOString(),
      completedAt: null,
    });

    const repository = createInMemoryGlwJobRepository([failedJob, activeRetry]);

    const response = await handleRetryJob(new Request(`http://localhost/api/glw/jobs/${failedJob.id}/retry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }), failedJob.id, {
      repository,
      workflow: {
        invokePageGeneration: jest.fn(),
      } as unknown as ReturnType<typeof createGlwN8nTransport>,
      appUrl: "http://localhost:3000",
      sessionLoader: createSessionLoader(true),
    });

    expect(response.status).toBe(409);
    const payload = await response.json() as { error?: string };
    expect(payload.error).toContain("still in progress");
  });
});
