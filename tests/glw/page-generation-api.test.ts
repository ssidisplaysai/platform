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
import { GlwCallbackTransactionUnavailableError } from "@/lib/glw/callback-transaction";
import {
  applyGlwJobCallback,
  submitGlwPageGenerationJob,
  retryGlwPageGenerationJob,
} from "@/lib/glw/page-generation";
import {
  createGlwJobInput,
  createGlwJobRecord,
  deriveCitySlugFromCity,
  getGlwJobOperatorSnapshot,
  GLW_JOB_TIMEOUT_MS,
  parsePageGenerationFormData,
  validatePageGenerationRequest,
} from "@/lib/glw/jobs";
import { createGlwN8nExecutionService, createGlwN8nTransport } from "@/lib/glw/n8n";
import * as orchestrationRuntime from "@/platform/gop/runtime/orchestration-runtime";
import { createInMemoryGenesisEventStore } from "@/platform/gop/event-store";
import {
  handleCreatePageGenerationJob,
  handleGetJob,
  handleGetN8nExecutionDiagnostics,
  handleJobCallback,
  handleRetryJob,
  listPageGenerationJobs,
} from "@/lib/glw/page-generation-api";
import { POST as handleCallbackRoute } from "@/app/api/glw/jobs/callback/route";

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
    workspaceId: "glw-led-display-warehouse",
    hierarchyMode: "legacy_city_page",
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

beforeEach(() => {
  process.env = { ...originalEnv };
  setRequiredEnv();
  jest.spyOn(orchestrationRuntime, "getGenesisOrchestrationRuntime").mockReturnValue({
    createGlwExecutionForJob: () => undefined,
    syncGlwExecutionState: () => undefined,
  } as unknown as ReturnType<typeof orchestrationRuntime.getGenesisOrchestrationRuntime>);
});

afterEach(() => {
  process.env = { ...originalEnv };
  jest.restoreAllMocks();
});

describe("GLW page generation validation", () => {
  it("fails closed when hierarchy mode is absent", () => {
    const request = buildValidPageRequest();
    delete request.hierarchyMode;
    const result = validatePageGenerationRequest(request);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.hierarchyMode).toBe("UNKNOWN_HIERARCHY_MODE");
  });

  it("preserves explicit legacy city-page semantics", () => {
    const result = validatePageGenerationRequest(buildValidPageRequest());

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.hierarchyMode).toBe("legacy_city_page");
  });

  it("requires and preserves separate parent and target identities for city-child mode", () => {
    const result = validatePageGenerationRequest(buildValidPageRequest({
      hierarchyMode: "city_child_target",
      cityParentId: 2565,
      hierarchicalSlug: "direct-view-led-video-walls/texas/austin/hr004-canary",
      city: "Austin",
      citySlug: "austin",
      targetSlug: "hr004-canary",
    }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.cityParentId).toBe(2565);
      expect(result.value.targetSlug).toBe("hr004-canary");
      expect(result.value.status).toBe("draft");
    }
  });

  it("rejects missing or malformed parent identity and target collisions in city-child mode", () => {
    const missingParent = validatePageGenerationRequest(buildValidPageRequest({
      hierarchyMode: "city_child_target",
      hierarchicalSlug: "direct-view-led-video-walls/texas/austin/hr004-canary",
      city: "Austin",
      citySlug: "austin",
      targetSlug: "hr004-canary",
    }));
    const sameTarget = validatePageGenerationRequest(buildValidPageRequest({
      hierarchyMode: "city_child_target",
      cityParentId: 2565,
      hierarchicalSlug: "direct-view-led-video-walls/texas/austin/austin",
      city: "Austin",
      citySlug: "austin",
      targetSlug: "austin",
    }));
    const malformedParent = validatePageGenerationRequest(buildValidPageRequest({
      hierarchyMode: "city_child_target",
      cityParentId: "not-an-id",
      hierarchicalSlug: "direct-view-led-video-walls/texas/austin/hr004-canary",
      city: "Austin",
      citySlug: "austin",
      targetSlug: "hr004-canary",
    }));

    expect(missingParent.ok).toBe(false);
    expect(malformedParent.ok).toBe(false);
    expect(sameTarget.ok).toBe(false);
  });

  it("rejects unknown hierarchy modes, unknown fields, and malformed child hierarchies", () => {
    const unknownMode = validatePageGenerationRequest(buildValidPageRequest({ hierarchyMode: "future_mode" }));
    const unknownField = validatePageGenerationRequest({ ...buildValidPageRequest(), unexpectedField: true });
    const malformedHierarchy = validatePageGenerationRequest(buildValidPageRequest({
      hierarchyMode: "city_child_target",
      cityParentId: 2565,
      city: "Austin",
      citySlug: "austin",
      targetSlug: "hr004-canary",
      hierarchicalSlug: "direct-view-led-video-walls/texas/hr004-canary",
    }));

    expect(unknownMode.ok).toBe(false);
    expect(unknownField.ok).toBe(false);
    expect(malformedHierarchy.ok).toBe(false);
  });

  it("persists child-target identities into durable input and n8n transport", async () => {
    const repository = createInMemoryGlwJobRepository();
    const workflow = { invokePageGeneration: jest.fn(async () => ({ kind: "accepted" as const, executionId: "exec_child", status: "accepted" as const })) };
    const request = buildValidPageRequest({
      hierarchyMode: "city_child_target",
      cityParentId: 2565,
      city: "Austin",
      citySlug: "austin",
      targetSlug: "hr004-canary",
      hierarchicalSlug: "direct-view-led-video-walls/texas/austin/hr004-canary",
    });

    const result = await submitGlwPageGenerationJob(request, {
      repository,
      workflow: workflow as unknown as ReturnType<typeof createGlwN8nTransport>,
      appUrl: "http://localhost:3000",
    });
    const sent = workflow.invokePageGeneration.mock.calls[0][0] as {
      page: { hierarchyMode: string; hierarchy_mode: string; cityParentId: number; city_parent_id: number; targetSlug: string };
      workflowContext: { hierarchyMode: string; cityParentId: number };
    };
    const persisted = await repository.findById(result.job.id);
    const reloaded = JSON.parse(JSON.stringify(persisted)) as typeof persisted;

    expect(result.job.input.page).toMatchObject({ hierarchyMode: "city_child_target", cityParentId: 2565, targetSlug: "hr004-canary", status: "draft" });
    expect(persisted?.input.page).toMatchObject({ hierarchyMode: "city_child_target", cityParentId: 2565 });
    expect(reloaded?.input.page).toMatchObject({ hierarchyMode: "city_child_target", cityParentId: 2565 });
    expect(sent.page).toMatchObject({ hierarchyMode: "city_child_target", hierarchy_mode: "city_child_target", cityParentId: 2565, city_parent_id: 2565, targetSlug: "hr004-canary" });
    expect(sent.workflowContext).toMatchObject({ hierarchyMode: "city_child_target", cityParentId: 2565 });
  });

  it("preserves child-target identity in callback-derived job results", async () => {
    const request = buildValidPageRequest({
      hierarchyMode: "city_child_target",
      cityParentId: 2565,
      city: "Austin",
      citySlug: "austin",
      targetSlug: "hr004-canary",
      hierarchicalSlug: "direct-view-led-video-walls/texas/austin/hr004-canary",
    });
    const job = createGlwJobRecord({
      type: "PAGE_GENERATION", status: "RUNNING", retryOfJobId: null, siteId: request.siteId, title: request.title,
      input: createGlwJobInput(request), result: null, error: null, externalExecutionId: "exec_child_callback", startedAt: new Date().toISOString(), completedAt: null,
    });
    const repository = createInMemoryGlwJobRepository([job]);

    const updated = await applyGlwJobCallback({
      jobId: job.id, executionId: "exec_child_callback", status: "GENERATING_CONTENT",
      hierarchyMode: "city_child_target", cityParentId: 2565, targetSlug: "hr004-canary", wordpressParentId: 2565, wordpressSlug: "hr004-canary", canonicalTargetUrl: "https://leddisplaywarehouse.com/direct-view-led-video-walls/texas/austin/hr004-canary/",
    }, repository, createInMemoryGenesisEventStore());

    expect(updated.result).toMatchObject({ hierarchyMode: "city_child_target", cityParentId: 2565, targetSlug: "hr004-canary", wordpressParentId: 2565, wordpressSlug: "hr004-canary", canonicalTargetUrl: "https://leddisplaywarehouse.com/direct-view-led-video-walls/texas/austin/hr004-canary/" });
  });
  it("rejects incomplete page requests", () => {
    const result = validatePageGenerationRequest({
      siteId: "led-display-warehouse",
      workspaceId: "",
      pageType: "city_service",
      productTopic: "",
      state: "",
      city: "",
      citySlug: "",
      hierarchicalSlug: "",
      additionalInstructions: "",
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
      expect(result.errors.citySlug).toBeDefined();
    }
  });

  it("derives city_slug from city when omitted", () => {
    const result = validatePageGenerationRequest(buildValidPageRequest({ citySlug: "" }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.citySlug).toBe("los-angeles");
    }
  });

  it("rejects city pages when city_slug cannot be derived", () => {
    const result = validatePageGenerationRequest(buildValidPageRequest({ city: "", citySlug: "" }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.citySlug).toContain("required");
    }
  });

  it("slugifies city values consistently", () => {
    expect(deriveCitySlugFromCity("New York City")).toBe("new-york-city");
  });

  it("parses form data into a validated request", () => {
    const formData = new FormData();
    formData.set("siteId", "led-display-warehouse");
    formData.set("workspaceId", "glw-led-display-warehouse");
    formData.set("hierarchyMode", "legacy_city_page");
    formData.set("pageType", "city_service");
    formData.set("productTopic", "LED Wall Rental");
    formData.set("state", "California");
    formData.set("city", "Los Angeles");
    formData.set("citySlug", "");
    formData.set("hierarchicalSlug", "california/los-angeles/led-wall-rental");
    formData.set("additionalInstructions", "Highlight rapid setup windows.");
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
      expect(result.value.citySlug).toBe("los-angeles");
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
      eventStore: createInMemoryGenesisEventStore(),
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
      eventStore: createInMemoryGenesisEventStore(),
      appUrl: "http://localhost:3000",
      sessionLoader: createSessionLoader(true),
    });

    expect(response.status).toBe(201);

    const payload = await response.json() as { job: { status: string; result: { wordpressUrl: string } | null } };
    expect(payload.job.status).toBe("COMPLETE");
    expect(payload.job.result?.wordpressUrl).toBe("https://example.com/wp-admin/post.php?post=123&action=edit");
    expect(workflow.invokePageGeneration).toHaveBeenCalledTimes(1);
  });

  it("sends canonical GLW site identity while preserving workflow workspace identity", async () => {
    const repository = createInMemoryGlwJobRepository();
    const workflow = {
      invokePageGeneration: jest.fn(async () => ({
        kind: "accepted" as const,
        executionId: "exec_canonical_site",
        status: "accepted" as const,
      })),
    };

    const firstRequest = buildValidPageRequest({
      siteId: "sphere-rental-dallas",
      workspaceId: "glw-sphere-rental-dallas",
      city: "Dallas",
      citySlug: "dallas",
      hierarchicalSlug: "texas/dallas/led-wall-rental",
      targetSlug: "led-wall-rental-dallas",
      title: "LED Wall Rental Package - Dallas",
      state: "Texas",
    });
    const firstResult = await submitGlwPageGenerationJob(firstRequest, {
      repository,
      workflow: workflow as unknown as ReturnType<typeof createGlwN8nTransport>,
      appUrl: "http://localhost:3000",
    });

    const secondRequest = buildValidPageRequest({
      siteId: "projection-screen-chicago",
      workspaceId: "glw-projection-screen-chicago",
      city: "Chicago",
      citySlug: "chicago",
      hierarchicalSlug: "illinois/chicago/projection-screen-rental",
      targetSlug: "projection-screen-rental-chicago",
      title: "Projection Screen Rental - Chicago",
      state: "Illinois",
    });
    const secondResult = await submitGlwPageGenerationJob(secondRequest, {
      repository,
      workflow: workflow as unknown as ReturnType<typeof createGlwN8nTransport>,
      appUrl: "http://localhost:3000",
    });

    expect(workflow.invokePageGeneration).toHaveBeenCalledTimes(2);

    const firstPayload = workflow.invokePageGeneration.mock.calls[0][0] as {
      site: { id: string; name: string };
      workspaceId: string;
      workflowContext: { workspaceId: string };
    };
    const secondPayload = workflow.invokePageGeneration.mock.calls[1][0] as {
      site: { id: string; name: string };
      workspaceId: string;
      workflowContext: { workspaceId: string };
    };

    expect(firstPayload.site).toEqual({ id: "led-display-warehouse", name: "LED Display Warehouse" });
    expect(secondPayload.site).toEqual({ id: "led-display-warehouse", name: "LED Display Warehouse" });

    expect(firstPayload.jobId).toBe(firstResult.job.id);
    expect(secondPayload.jobId).toBe(secondResult.job.id);

    expect(firstPayload.callbackUrl).toBe("http://localhost:3000/api/glw/jobs/callback");
    expect(secondPayload.callbackUrl).toBe("http://localhost:3000/api/glw/jobs/callback");

    expect(firstPayload.workspaceId).toBe("glw-sphere-rental-dallas");
    expect(firstPayload.workflowContext.workspaceId).toBe("glw-sphere-rental-dallas");
    expect(secondPayload.workspaceId).toBe("glw-projection-screen-chicago");
    expect(secondPayload.workflowContext.workspaceId).toBe("glw-projection-screen-chicago");

    expect(firstPayload.page.page_type).toBe(firstRequest.pageType);
    expect(firstPayload.page.hierarchyMode).toBe("legacy_city_page");
    expect(firstPayload.page.cityParentId).toBeNull();
    expect(firstPayload.page.product_topic).toBe(firstRequest.productTopic);
    expect(firstPayload.page.state).toBe(firstRequest.state);
    expect(firstPayload.page.city).toBe(firstRequest.city);
    expect(firstPayload.page.citySlug).toBe(firstRequest.citySlug);
    expect(firstPayload.page.city_slug).toBe(firstRequest.citySlug);
    expect(firstPayload.page.hierarchicalSlug).toBe(firstRequest.hierarchicalSlug);
    expect(firstPayload.page.hierarchical_slug).toBe(firstRequest.hierarchicalSlug);

    expect(firstPayload.workflowContext.pageType).toBe(firstRequest.pageType);
    expect(firstPayload.workflowContext.hierarchyMode).toBe("legacy_city_page");
    expect(firstPayload.workflowContext.cityParentId).toBeNull();
    expect(firstPayload.workflowContext.productTopic).toBe(firstRequest.productTopic);
    expect(firstPayload.workflowContext.state).toBe(firstRequest.state);
    expect(firstPayload.workflowContext.city).toBe(firstRequest.city);
    expect(firstPayload.workflowContext.citySlug).toBe(firstRequest.citySlug);
    expect(firstPayload.workflowContext.hierarchicalSlug).toBe(firstRequest.hierarchicalSlug);

    expect(firstPayload.seoSettings).toMatchObject({
      targetSlug: firstRequest.targetSlug,
      citySlug: firstRequest.citySlug,
      city_slug: firstRequest.citySlug,
      primaryKeyword: firstRequest.primaryKeyword,
      secondaryKeywords: firstRequest.secondaryKeywords,
      category: firstRequest.category,
    });

    expect(firstPayload.publishingSettings).toMatchObject({
      status: firstRequest.status,
      wordCount: firstRequest.wordCount,
    });
  });

  it("persists the full callback contract through normalization and API readback", async () => {
    const repository = createInMemoryGlwJobRepository();
    const workflow = {
      invokePageGeneration: jest.fn(async () => ({
        kind: "complete" as const,
        executionId: "exec_callback_contract",
        status: "complete" as const,
        title: "LED Wall Rental Package - Rentals in Los Angeles, CA",
        wordpressUrl: "https://example.com/led-wall-rental-package",
        wordpressPostId: 123,
      })),
    };

    const response = await handleCreatePageGenerationJob(buildRequest(buildValidPageRequest()), {
      repository,
      workflow: workflow as unknown as ReturnType<typeof createGlwN8nTransport>,
      eventStore: createInMemoryGenesisEventStore(),
      appUrl: "http://localhost:3000",
      sessionLoader: createSessionLoader(true),
    });

    expect(response.status).toBe(201);

    const payload = await response.json() as { job: { id: string } };
    const completedJob = await repository.findById(payload.job.id);

    expect(completedJob?.result).toMatchObject({
      executionId: "exec_callback_contract",
      wordpressPageId: 123,
      wordpressPostId: 123,
      wordpressUrl: "https://example.com/wp-admin/post.php?post=123&action=edit",
      wordpressStatus: "draft",
      requestedPublishingMode: "draft",
    });
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
      workspaceId: "glw-led-display-warehouse",
      workspace_id: "glw-led-display-warehouse",
      site: { id: "led-display-warehouse", name: "LED Display Warehouse" },
      page: {
        workspaceId: "glw-led-display-warehouse",
        pageType: "city_service",
        page_type: "city_service",
        productTopic: "LED Wall Rental",
        product_topic: "LED Wall Rental",
        state: "California",
        city: "Los Angeles",
        citySlug: "los-angeles",
        city_slug: "los-angeles",
        hierarchicalSlug: "california/los-angeles/led-wall-rental",
        hierarchical_slug: "california/los-angeles/led-wall-rental",
        additionalInstructions: "Use regional references",
        additional_instructions: "Use regional references",
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
        citySlug: "los-angeles",
        city_slug: "los-angeles",
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
      workflowContext: {
        workspaceId: "glw-led-display-warehouse",
        pageType: "city_service",
        productTopic: "LED Wall Rental",
        state: "California",
        city: "Los Angeles",
        citySlug: "los-angeles",
        hierarchicalSlug: "california/los-angeles/led-wall-rental",
        additionalInstructions: "Use regional references",
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
      eventStore: createInMemoryGenesisEventStore(),
      appUrl: "http://localhost:3000",
      sessionLoader: createSessionLoader(true),
    });

    expect(response.status).toBe(502);
    const payload = await response.json() as { job: { status: string; error: { message: string } | null } };
    expect(payload.job.status).toBe("FAILED");
    expect(payload.job.error?.message).toContain("Webhook failed");
  });

  it("rejects invalid canonical targets before dispatch", async () => {
    const repository = createInMemoryGlwJobRepository();
    const workflow = {
      invokePageGeneration: jest.fn(),
    };

    await expect(submitGlwPageGenerationJob(buildValidPageRequest({
      pageType: "state_service",
      city: "Texas",
      citySlug: "tx",
      hierarchicalSlug: "direct_view_led_video_walls/tx",
      targetSlug: "tx",
      title: "Direct View LED Video Walls in Texas",
      productTopic: "direct view led video walls",
      state: "Texas",
      primaryKeyword: "direct view led video walls texas",
      secondaryKeywords: ["direct view led video walls", "Texas"],
    }), {
      repository,
      workflow: workflow as unknown as ReturnType<typeof createGlwN8nTransport>,
      appUrl: "http://localhost:3000",
    })).rejects.toThrow(/INVALID_CANONICAL_TARGET/);

    expect(workflow.invokePageGeneration).not.toHaveBeenCalled();
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

  it("returns structured APPLIED and normalizes v2 identity for the durable receiver", async () => {
    const job = createGlwJobRecord({
      type: "PAGE_GENERATION",
      status: "FAILED",
      retryOfJobId: null,
      siteId: "test-site",
      title: "Durable callback",
      input: createGlwJobInput(buildValidPageRequest(), "http://localhost/api/glw/jobs/callback"),
      result: null,
      error: { message: "failed" },
      externalExecutionId: "execution-1",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });
    const callbackTransaction = jest.fn(async () => ({ outcome: "APPLIED" as const, receiptId: "receipt-1", job }));
    const response = await handleJobCallback(new Request("http://localhost/api/glw/jobs/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer callback-secret" },
      body: JSON.stringify({
        jobId: job.id,
        executionId: "execution-1",
        status: "FAILED",
        error: { message: "failed" },
        callbackVersion: "2",
        operationKey: " operation-1 ",
        callbackType: "PAGE_GENERATION_TERMINAL",
        idempotencyKey: " idempotency-1 ",
        terminalScopeKey: " terminal-1 ",
        payloadSha256: "ABCDEF",
      }),
    }), {
      repository: createInMemoryGlwJobRepository(),
      webhookSecret: "callback-secret",
      durableCallbackReceiverEnabled: true,
      callbackTransaction,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ outcome: "APPLIED", receiptId: "receipt-1" });
    expect(callbackTransaction).toHaveBeenCalledWith(expect.objectContaining({
      operationKey: "operation-1",
      idempotencyKey: "idempotency-1",
      terminalScopeKey: "terminal-1",
      payloadSha256: "abcdef",
    }));
  });

  it("returns structured 409 for a durable callback conflict", async () => {
    const callbackTransaction = jest.fn(async () => ({ outcome: "TERMINAL_CONFLICT" as const, receiptId: "receipt-1", message: "scope claimed" }));
    const response = await handleJobCallback(new Request("http://localhost/api/glw/jobs/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer callback-secret" },
      body: JSON.stringify({ jobId: "job-1", executionId: "execution-1", status: "FAILED", error: { message: "failed" } }),
    }), { repository: createInMemoryGlwJobRepository(), webhookSecret: "callback-secret", durableCallbackReceiverEnabled: true, callbackTransaction });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ outcome: "TERMINAL_CONFLICT", receiptId: "receipt-1" });
  });

  it("returns structured retryable 503 for an unavailable callback database", async () => {
    const callbackTransaction = jest.fn(async () => {
      throw new GlwCallbackTransactionUnavailableError("DATABASE_UNAVAILABLE");
    });
    const response = await handleJobCallback(new Request("http://localhost/api/glw/jobs/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer callback-secret" },
      body: JSON.stringify({ jobId: "job-1", executionId: "execution-1", status: "FAILED", error: { message: "failed" } }),
    }), { repository: createInMemoryGlwJobRepository(), webhookSecret: "callback-secret", durableCallbackReceiverEnabled: true, callbackTransaction });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ outcome: "RETRYABLE_FAILURE", code: "DATABASE_UNAVAILABLE" });
  });

  it("rejects an unsupported identity envelope before invoking the durable transaction", async () => {
    const callbackTransaction = jest.fn();
    const response = await handleJobCallback(new Request("http://localhost/api/glw/jobs/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer callback-secret" },
      body: JSON.stringify({
        jobId: "job-1",
        executionId: "execution-1",
        status: "FAILED",
        error: { message: "failed" },
        callbackVersion: "3",
      }),
    }), { repository: createInMemoryGlwJobRepository(), webhookSecret: "callback-secret", durableCallbackReceiverEnabled: true, callbackTransaction });
    expect(response.status).toBe(400);
    expect(callbackTransaction).not.toHaveBeenCalled();
  });

  it("routes callback requests through the configured webhook secret", async () => {
    const handleJobCallbackSpy = jest.spyOn(await import("@/lib/glw/page-generation-api"), "handleJobCallback").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    const request = new Request("http://localhost/api/glw/jobs/callback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer callback-secret",
      },
      body: JSON.stringify({ jobId: "job-1", executionId: "exec-1", status: "RUNNING" }),
    });

    await handleCallbackRoute(request);

    expect(handleJobCallbackSpy).toHaveBeenCalledTimes(1);
    expect(handleJobCallbackSpy).toHaveBeenCalledWith(request, {
      webhookSecret: "callback-secret",
    });
  });

  it("normalizes callback aliases and preserves QA fields in response", async () => {
    const runningJob = createGlwJobRecord({
      type: "PAGE_GENERATION",
      status: "RUNNING",
      retryOfJobId: null,
      siteId: "led-display-warehouse",
      title: "Phase 13 Callback Contract",
      input: createGlwJobInput(buildValidPageRequest({
        title: "Phase 13 Callback Contract",
        status: "publish",
      }), "http://localhost/api/glw/jobs/callback"),
      result: {
        executionId: "exec_contract",
        status: "RUNNING",
        title: "Phase 13 Callback Contract",
      },
      error: null,
      externalExecutionId: "exec_contract",
      startedAt: new Date().toISOString(),
      completedAt: null,
    });

    const repository = createInMemoryGlwJobRepository([runningJob]);
    const response = await handleJobCallback(new Request("http://localhost/api/glw/jobs/callback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer callback-secret",
      },
      body: JSON.stringify({
        jobId: runningJob.id,
        executionId: "exec_contract",
        status: "COMPLETE",
        title: "Phase 13 Callback Contract",
        wordpress_page_id: 18847,
        wordpress_post_id: 18847,
        wordpress_url: "https://leddisplaywarehouse.com/direct-view-led-video-walls/texas/houston/",
        wordpress_status: "publish",
        requested_publishing_mode: "publish",
        qa_disposition: "updated",
        qa_checks_json: JSON.stringify({
          pageExists: "PASS",
          hierarchy: "PASS",
          slug: "PASS",
          title: "PASS",
          h1: "PASS",
          uniquePrimaryHeading: "PASS",
          duplicateSectionHeadings: "PASS",
          duplicateSectionContent: "PASS",
          placeholderResourceLinks: "PASS",
          body: "PASS",
          featuredImage: "PASS",
          heroImage: "PASS",
          seo: "PASS",
          internalLinks: "PASS",
          imageAlt: "PASS",
          duplicateCheck: "PASS",
        }),
        qa_failure_reasons_json: JSON.stringify({
          hierarchy: "Hierarchy already exists and matched canonical path.",
          duplicateSectionHeadings: "No duplicate section headings detected.",
        }),
      }),
    }), {
      repository,
      webhookSecret: "callback-secret",
    });

    expect(response.status).toBe(200);
    const payload = await response.json() as { job: { result: Record<string, unknown> | null } };
    expect(payload.job.result).not.toBeNull();
    expect(payload.job.result?.wordpressPostId).toBe(18847);
    expect(payload.job.result?.wordpressPageId).toBe(18847);
    expect(payload.job.result?.wordpressStatus).toBe("publish");
    expect(payload.job.result?.requestedPublishingMode).toBe("publish");
    expect(payload.job.result?.disposition).toBe("UPDATED");
    expect((payload.job.result?.qaChecks as Record<string, unknown> | undefined)?.hierarchy).toBe("PASS");
    expect((payload.job.result?.qaChecks as Record<string, unknown> | undefined)?.uniquePrimaryHeading).toBe("PASS");
    expect((payload.job.result?.qaChecks as Record<string, unknown> | undefined)?.duplicateSectionHeadings).toBe("PASS");
    expect((payload.job.result?.qaChecks as Record<string, unknown> | undefined)?.duplicateSectionContent).toBe("PASS");
    expect((payload.job.result?.qaChecks as Record<string, unknown> | undefined)?.placeholderResourceLinks).toBe("PASS");
    expect((payload.job.result?.qaFailureReasons as Record<string, unknown> | undefined)?.hierarchy).toContain("canonical path");
    expect((payload.job.result?.qaFailureReasons as Record<string, unknown> | undefined)?.duplicateSectionHeadings).toContain("No duplicate section headings");
  });

  it("rejects callback payloads when QA contract version does not match runtime", async () => {
    const runningJob = createGlwJobRecord({
      type: "PAGE_GENERATION",
      status: "RUNNING",
      retryOfJobId: null,
      siteId: "led-display-warehouse",
      title: "Phase 13 Contract Rejection",
      input: createGlwJobInput(buildValidPageRequest({
        title: "Phase 13 Contract Rejection",
        status: "publish",
      }), "http://localhost/api/glw/jobs/callback"),
      result: {
        executionId: "exec_contract_mismatch",
        status: "RUNNING",
        title: "Phase 13 Contract Rejection",
      },
      error: null,
      externalExecutionId: "exec_contract_mismatch",
      startedAt: new Date().toISOString(),
      completedAt: null,
    });

    const repository = createInMemoryGlwJobRepository([runningJob]);
    const response = await handleJobCallback(new Request("http://localhost/api/glw/jobs/callback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer callback-secret",
      },
      body: JSON.stringify({
        jobId: runningJob.id,
        executionId: "exec_contract_mismatch",
        status: "COMPLETE",
        title: "Phase 13 Contract Rejection",
        qa_checks_json: JSON.stringify({
          pageExists: "PASS",
          hierarchy: "PASS",
          slug: "PASS",
        }),
      }),
    }), {
      repository,
      webhookSecret: "callback-secret",
    });

    expect(response.status).toBe(409);
    const payload = await response.json() as {
      code?: string;
      expectedQaContractVersion?: number;
      receivedQaContractVersion?: number;
      missingQaCheckKeys?: string[];
    };
    expect(payload.code).toBe("QA_CONTRACT_VERSION_MISMATCH");
    expect(payload.expectedQaContractVersion).toBe(16);
    expect(payload.receivedQaContractVersion).toBe(3);
    expect(payload.missingQaCheckKeys).toEqual(expect.arrayContaining(["h1", "body", "duplicateCheck"]));
  });

  it("returns unavailable diagnostics when n8n status lookup cannot be completed", async () => {
    const startedJob = createGlwJobRecord({
      type: "PAGE_GENERATION",
      status: "STARTING",
      retryOfJobId: null,
      siteId: "led-display-warehouse",
      title: "Observability Test",
      input: createGlwJobInput(buildValidPageRequest({ title: "Observability Test" }), "http://localhost/api/glw/jobs/callback"),
      result: {
        executionId: "46992",
        status: "RUNNING",
        title: "Observability Test",
      },
      error: null,
      externalExecutionId: "46992",
      startedAt: new Date().toISOString(),
      completedAt: null,
    });

    const repository = createInMemoryGlwJobRepository([startedJob]);
    const n8nExecutionService = {
      getExecutionDiagnostics: jest.fn(async () => ({
        available: false as const,
        reason: "n8n API key was rejected.",
        deepLinkUrl: "https://ssiai.app.n8n.cloud/execution/46992",
        upstreamStatus: 401,
        upstreamContentType: "application/json",
        upstreamMessage: "Unauthorized",
      })),
      getExecutionUrl: jest.fn(() => "https://ssiai.app.n8n.cloud/execution/46992"),
    };

    const response = await handleGetN8nExecutionDiagnostics(
      new Request("http://localhost/api/glw/jobs/obs/execution", { method: "GET" }),
      startedJob.id,
      {
        repository,
        n8nExecutionService: n8nExecutionService as never,
        sessionLoader: createSessionLoader(true),
      },
    );

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      status: string;
      message: string;
      reason?: string;
      upstreamStatus?: number;
      upstreamContentType?: string | null;
      upstreamMessage?: string | null;
      openUrl?: string | null;
    };
    expect(payload.status).toBe("unavailable");
    expect(payload.message).toBe("Execution accepted but status unavailable.");
    expect(payload.reason).toBe("n8n API key was rejected.");
    expect(payload.upstreamStatus).toBe(401);
    expect(payload.upstreamContentType).toBe("application/json");
    expect(payload.upstreamMessage).toBe("Unauthorized");
    expect(payload.openUrl).toBe("https://ssiai.app.n8n.cloud/execution/46992");
  });

  it("returns available diagnostics when n8n execution data is retrievable", async () => {
    const startedJob = createGlwJobRecord({
      type: "PAGE_GENERATION",
      status: "STARTING",
      retryOfJobId: null,
      siteId: "led-display-warehouse",
      title: "Observability Available",
      input: createGlwJobInput(buildValidPageRequest({ title: "Observability Available" }), "http://localhost/api/glw/jobs/callback"),
      result: {
        executionId: "46992",
        status: "RUNNING",
        title: "Observability Available",
      },
      error: null,
      externalExecutionId: "46992",
      startedAt: new Date().toISOString(),
      completedAt: null,
    });

    const repository = createInMemoryGlwJobRepository([startedJob]);
    const n8nExecutionService = {
      getExecutionDiagnostics: jest.fn(async () => ({
        available: true as const,
        diagnostics: {
          executionId: "46992",
          executionState: "RUNNING",
          currentNode: "n_generate_content",
          lastCompletedNode: "n_intake",
          startedAt: "2026-07-29T18:00:00.000Z",
          lastUpdatedAt: "2026-07-29T18:01:00.000Z",
          durationMs: 60000,
          error: null,
          terminal: false,
          deepLinkUrl: "https://ssiai.app.n8n.cloud/execution/46992",
        },
      })),
      getExecutionUrl: jest.fn(() => "https://ssiai.app.n8n.cloud/execution/46992"),
    };

    const response = await handleGetN8nExecutionDiagnostics(
      new Request("http://localhost/api/glw/jobs/obs/execution", { method: "GET" }),
      startedJob.id,
      {
        repository,
        n8nExecutionService: n8nExecutionService as never,
        sessionLoader: createSessionLoader(true),
      },
    );

    expect(response.status).toBe(200);
    const payload = await response.json() as { status: string; execution?: { currentNode?: string; lastCompletedNode?: string; executionState?: string } | null };
    expect(payload.status).toBe("available");
    expect(payload.execution?.executionState).toBe("RUNNING");
    expect(payload.execution?.currentNode).toBe("n_generate_content");
    expect(payload.execution?.lastCompletedNode).toBe("n_intake");
  });
});

describe("GLW n8n execution diagnostics transport", () => {
  it("uses the n8n execution API endpoint with API key auth and classifies 401", async () => {
    process.env.GLW_N8N_PAGE_WEBHOOK_URL = "https://ssiai.app.n8n.cloud/webhook/glw-page";

    const fetchSpy = jest.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.method).toBe("GET");
      const headers = init?.headers as Record<string, string>;
      expect(headers["X-N8N-API-KEY"]).toBe("test-key");
      expect(headers.Accept).toBe("application/json");
      return new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const service = createGlwN8nExecutionService({
      fetchImpl: fetchSpy,
      apiKey: "test-key",
    });

    const result = await service.getExecutionDiagnostics("46992");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://ssiai.app.n8n.cloud/api/v1/executions/46992?includeData=true",
      expect.objectContaining({ method: "GET" }),
    );
    expect(result.available).toBe(false);
    if (!result.available) {
      expect(result.reason).toBe("n8n API key was rejected.");
      expect(result.upstreamStatus).toBe(401);
      expect(result.upstreamContentType).toBe("application/json");
      expect(result.upstreamMessage).toBe("Unauthorized");
      expect(result.deepLinkUrl).toBe("https://ssiai.app.n8n.cloud/execution/46992");
    }
  });

  it("classifies non-JSON upstream responses as non-API", async () => {
    process.env.GLW_N8N_PAGE_WEBHOOK_URL = "https://ssiai.app.n8n.cloud/webhook/glw-page";

    const service = createGlwN8nExecutionService({
      fetchImpl: (async () => new Response("<html>login</html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      })) as unknown as typeof fetch,
      apiKey: "test-key",
    });

    const result = await service.getExecutionDiagnostics("46992");
    expect(result.available).toBe(false);
    if (!result.available) {
      expect(result.reason).toBe("n8n returned a non-API response; verify the API base URL and path.");
      expect(result.upstreamStatus).toBe(200);
      expect(result.upstreamContentType).toBe("text/html");
      expect(result.upstreamMessage).toContain("login");
    }
  });

  it("summarizes unexpected JSON response structures", async () => {
    process.env.GLW_N8N_PAGE_WEBHOOK_URL = "https://ssiai.app.n8n.cloud/webhook/glw-page";

    const service = createGlwN8nExecutionService({
      fetchImpl: (async () => new Response(JSON.stringify({ foo: "bar" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as unknown as typeof fetch,
      apiKey: "test-key",
    });

    const result = await service.getExecutionDiagnostics("46992");
    expect(result.available).toBe(false);
    if (!result.available) {
      expect(result.reason).toBe("Unexpected JSON response from n8n execution API.");
      expect(result.upstreamStatus).toBe(200);
      expect(result.upstreamContentType).toBe("application/json");
      expect(result.upstreamMessage).toContain("json:object(keys=foo)");
    }
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
    expect(second.result?.wordpressUrl).toBe("https://example.com/wp-admin/post.php?post=123&action=edit");
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

  it("accepts FAILED_QA callbacks and persists deterministic QA details", async () => {
    const runningJob = createGlwJobRecord({
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
        executionId: "exec_qa",
        status: "RUNNING",
        title: "LED Wall Rental Package - Rentals in Los Angeles, CA",
      },
      error: null,
      externalExecutionId: "exec_qa",
      startedAt: new Date().toISOString(),
      completedAt: null,
    });

    const updated = await applyGlwJobCallback({
      jobId: runningJob.id,
      executionId: "exec_qa",
      status: "FAILED_QA",
      title: runningJob.title,
      wordpressPageId: 456,
      wordpressPostId: 456,
      wordpressUrl: "https://example.com/led-wall-rental-package",
      wordpressStatus: "qa_failed",
      disposition: "FAILED_QA",
      qaChecks: {
        pageExists: "PASS",
        body: "FAIL",
        uniquePrimaryHeading: "FAIL",
        duplicateSectionHeadings: "FAIL",
        duplicateSectionContent: "FAIL",
        placeholderResourceLinks: "FAIL",
        duplicateCheck: "PASS",
      },
      qaFailureReasons: {
        body: "Body contains placeholder token {{city}}.",
        uniquePrimaryHeading: "Multiple H1 tags found in rendered content.",
        duplicateSectionHeadings: "Duplicate H2 heading found: Planning a Reliable Project.",
        duplicateSectionContent: "Repeated section body content detected.",
        placeholderResourceLinks: "Related resource placeholder labels are not allowed.",
      },
      error: {
        code: "FAILED_QA",
        step: "Pre-Publish QA Gate",
        message: "Pre-publish QA gate failed.",
      },
    }, createInMemoryGlwJobRepository([runningJob]));

    expect(updated.status).toBe("FAILED_QA");
    expect(updated.result?.disposition).toBe("FAILED_QA");
    expect(updated.result?.wordpressStatus).toBe("qa_failed");
    expect(updated.result?.qaChecks?.body).toBe("FAIL");
    expect(updated.result?.qaChecks?.uniquePrimaryHeading).toBe("FAIL");
    expect(updated.result?.qaChecks?.duplicateSectionHeadings).toBe("FAIL");
    expect(updated.result?.qaChecks?.duplicateSectionContent).toBe("FAIL");
    expect(updated.result?.qaChecks?.placeholderResourceLinks).toBe("FAIL");
    expect(updated.result?.qaFailureReasons?.body).toContain("placeholder");
    expect(updated.result?.qaFailureReasons?.uniquePrimaryHeading).toContain("Multiple H1");
    expect(updated.result?.qaFailureReasons?.duplicateSectionHeadings).toContain("Duplicate H2");
    expect(updated.result?.qaFailureReasons?.duplicateSectionContent).toContain("Repeated section body content");
    expect(updated.result?.qaFailureReasons?.placeholderResourceLinks).toContain("placeholder labels");
  });

  it("accepts FAILED callbacks and preserves a deterministic terminal failure", async () => {
    const runningJob = createGlwJobRecord({
      type: "PAGE_GENERATION",
      status: "RUNNING",
      retryOfJobId: null,
      siteId: "led-display-warehouse",
      title: "LED Wall Rental Package - Rentals in Los Angeles, CA",
      input: createGlwJobInput(buildValidPageRequest(), "http://localhost/api/glw/jobs/callback"),
      result: {
        executionId: "exec_failure",
        status: "RUNNING",
        title: "LED Wall Rental Package - Rentals in Los Angeles, CA",
      },
      error: null,
      externalExecutionId: "exec_failure",
      startedAt: new Date().toISOString(),
      completedAt: null,
    });

    const updated = await applyGlwJobCallback({
      jobId: runningJob.id,
      executionId: "exec_failure",
      status: "FAILED",
      error: {
        code: "N8N_FAILURE",
        step: "publish",
        message: "n8n reported a terminal publish failure.",
      },
    }, createInMemoryGlwJobRepository([runningJob]));

    expect(updated.status).toBe("FAILED");
    expect(updated.completedAt).not.toBeNull();
    expect(updated.error).toMatchObject({
      code: "N8N_FAILURE",
      step: "publish",
      message: "n8n reported a terminal publish failure.",
    });
  });

  it("rejects callbacks that do not match the tracked execution id", async () => {
    const runningJob = createGlwJobRecord({
      type: "PAGE_GENERATION",
      status: "RUNNING",
      retryOfJobId: null,
      siteId: "led-display-warehouse",
      title: "LED Wall Rental Package - Rentals in Los Angeles, CA",
      input: createGlwJobInput(buildValidPageRequest(), "http://localhost/api/glw/jobs/callback"),
      result: {
        executionId: "exec_tracked",
        status: "RUNNING",
        title: "LED Wall Rental Package - Rentals in Los Angeles, CA",
      },
      error: null,
      externalExecutionId: "exec_tracked",
      startedAt: new Date().toISOString(),
      completedAt: null,
    });

    await expect(applyGlwJobCallback({
      jobId: runningJob.id,
      executionId: "exec_other",
      status: "FAILED",
      error: {
        code: "N8N_FAILURE",
        step: "callback",
        message: "Unexpected execution id.",
      },
    }, createInMemoryGlwJobRepository([runningJob]))).rejects.toThrow(/execution identifier does not match/);
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

  it("preserves persisted child-target identities when retrying", async () => {
    const request = buildValidPageRequest({
      hierarchyMode: "city_child_target",
      cityParentId: 2565,
      city: "Austin",
      citySlug: "austin",
      targetSlug: "hr004-canary",
      hierarchicalSlug: "direct-view-led-video-walls/texas/austin/hr004-canary",
    });
    const failedJob = createGlwJobRecord({
      type: "PAGE_GENERATION", status: "FAILED", retryOfJobId: null, siteId: request.siteId, title: request.title,
      input: createGlwJobInput(request), result: null, error: { message: "Workflow failed" },
      externalExecutionId: "exec_child_failed", startedAt: new Date().toISOString(), completedAt: new Date().toISOString(),
    });
    const repository = createInMemoryGlwJobRepository([failedJob]);
    const workflow = { invokePageGeneration: jest.fn(async () => ({ kind: "accepted" as const, executionId: "exec_child_retry", status: "accepted" as const })) };

    const retried = await retryGlwPageGenerationJob(failedJob.id, {
      repository,
      workflow: workflow as unknown as ReturnType<typeof createGlwN8nTransport>,
      appUrl: "http://localhost:3000",
    });
    const sent = workflow.invokePageGeneration.mock.calls[0][0] as {
      page: { hierarchyMode: string; cityParentId: number };
    };

    expect(retried.job.input.page).toMatchObject({ hierarchyMode: "city_child_target", cityParentId: 2565 });
    expect(sent.page).toMatchObject({ hierarchyMode: "city_child_target", cityParentId: 2565 });
  });

  it("allows retry for QA-failed jobs", async () => {
    const failedQaJob = createGlwJobRecord({
      type: "PAGE_GENERATION",
      status: "FAILED_QA",
      retryOfJobId: null,
      siteId: "led-display-warehouse",
      title: "LED Wall Rental Package - Rentals in Los Angeles, CA",
      input: createGlwJobInput({
        ...buildValidPageRequest({
          title: "LED Wall Rental Package - Rentals in Los Angeles, CA",
        }),
      }, "http://localhost/api/glw/jobs/callback"),
      result: null,
      error: { message: "QA gate failed", code: "FAILED_QA" },
      externalExecutionId: "exec_failed_qa",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });

    const repository = createInMemoryGlwJobRepository([failedQaJob]);
    const workflow = {
      invokePageGeneration: jest.fn(async () => ({
        kind: "accepted" as const,
        executionId: "exec_retry_qa",
        status: "accepted" as const,
      })),
    };

    const retried = await retryGlwPageGenerationJob(failedQaJob.id, {
      repository,
      workflow: workflow as unknown as ReturnType<typeof createGlwN8nTransport>,
      appUrl: "http://localhost:3000",
    });

    expect(retried.job.status).toBe("STARTING");
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
      workspaceId: "glw-led-display-warehouse",
      hierarchyMode: "legacy_city_page",
      pageType: "city_service",
      productTopic: "Projection screen rental",
      state: "Illinois",
      city: "Chicago",
      citySlug: "chicago",
      hierarchicalSlug: "illinois/chicago/projection-screen-rental",
      additionalInstructions: "Position copy for corporate events.",
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

  it("generates callback URL from GLW_APP_URL host", async () => {
    const repository = createInMemoryGlwJobRepository();
    const workflow = {
      invokePageGeneration: jest.fn(async () => ({
        kind: "accepted" as const,
        executionId: "exec_callback",
        status: "accepted" as const,
      })),
    };

    await submitGlwPageGenerationJob(buildValidPageRequest(), {
      repository,
      workflow: workflow as unknown as ReturnType<typeof createGlwN8nTransport>,
      appUrl: "https://fighters-mistress-executives-symposium.trycloudflare.com",
    });

    expect(workflow.invokePageGeneration).toHaveBeenCalledTimes(1);
    const payload = workflow.invokePageGeneration.mock.calls[0][0] as { callbackUrl?: string; page?: { city_slug?: string } };
    expect(payload.callbackUrl).toBe("https://fighters-mistress-executives-symposium.trycloudflare.com/api/glw/jobs/callback");
    expect(payload.page?.city_slug).toBe("los-angeles");
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

  it("rejects a stale nonterminal callback after the job is terminal", async () => {
    const terminalJob = createGlwJobRecord({
      type: "PAGE_GENERATION",
      status: "COMPLETE",
      retryOfJobId: null,
      siteId: "led-display-warehouse",
      title: "Terminal callback guard",
      input: createGlwJobInput(buildValidPageRequest(), "http://localhost/api/glw/jobs/callback"),
      result: { executionId: "exec-terminal", status: "COMPLETE", title: "Terminal callback guard" },
      error: null,
      externalExecutionId: "exec-terminal",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });
    const response = await handleJobCallback(new Request("http://localhost/api/glw/jobs/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer callback-secret" },
      body: JSON.stringify({ jobId: terminalJob.id, executionId: "exec-terminal", status: "RUNNING" }),
    }), {
      repository: createInMemoryGlwJobRepository([terminalJob]),
      eventStore: null,
      webhookSecret: "callback-secret",
    });
    expect(response.status).toBe(409);
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

  it("reconciles stale in-progress jobs to terminal FAILED state on API reads", async () => {
    const staleStart = new Date(Date.now() - GLW_JOB_TIMEOUT_MS - 60_000).toISOString();
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
      startedAt: staleStart,
      completedAt: null,
    });

    const repository = createInMemoryGlwJobRepository([staleJob]);

    const listResponse = await listPageGenerationJobs(new Request("http://localhost/api/glw/jobs?filter=all&limit=10"), {
      repository,
      sessionLoader: createSessionLoader(true),
    });
    expect(listResponse.status).toBe(200);

    const listPayload = await listResponse.json() as { jobs: Array<{ id: string; status: string; error?: { code?: string } | null }> };
    expect(listPayload.jobs[0]).toMatchObject({
      id: staleJob.id,
      status: "FAILED",
      error: { code: "TIMED_OUT" },
    });

    const getResponse = await handleGetJob(new Request(`http://localhost/api/glw/jobs/${staleJob.id}`), staleJob.id, {
      repository,
      sessionLoader: createSessionLoader(true),
    });
    expect(getResponse.status).toBe(200);

    const getPayload = await getResponse.json() as { job: ReturnType<typeof createGlwJobRecord> };
    expect(getPayload.job.status).toBe("FAILED");

    const snapshot = getGlwJobOperatorSnapshot(getPayload.job);
    expect(snapshot.displayStatus).toBe("FAILED");
    expect(snapshot.progressPercent).toBe(100);
    expect(snapshot.currentStage).toBe("Failed");
  });
});
