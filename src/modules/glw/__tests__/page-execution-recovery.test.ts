import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FOUNDATION_PRODUCTS } from "@/modules/foundation/catalog-fixtures";
import { FOUNDATION_SITE_FIXTURES } from "@/modules/foundation/site-fixtures";
import {
  adaptProductForGeneration,
  adaptSiteForGeneration,
  buildLocalGlwGenerationPreview,
  createDefaultGlwGenerationInput,
} from "../page-generation";
import {
  GLW_APPLICATION_SITE_ID,
  GLW_INDOOR_LED_VIDEO_WALL_PRODUCT_ID,
  GLW_N8N_ENGINE_PRODUCT_NAME,
  GLW_N8N_ENGINE_SITE_ID,
  GlwExecutionResultError,
  GlwDraftOnlyExecutionError,
  GlwUnknownExecutionError,
  createGlwDraftExecutionService,
  createInMemoryGlwPageExecutionRepository,
  extractGlwJobId,
  mapGenerationRequestToN8nDraft,
  normalizeGlwN8nExecutionResult,
  redactGlwExecutionError,
  resolveGlwWordPressIdentityDecision,
  resolveGlwN8nEngineProduct,
  resolveGlwN8nEngineSiteId,
  type GlwN8nDraftDispatcher,
  type GlwN8nExecutionSnapshot,
  type GlwN8nExecutionReader,
} from "../page-execution";
import { createGlwN8nDraftDispatcher, createGlwN8nExecutionReader } from "../n8n-draft-adapter";

const site = adaptSiteForGeneration(FOUNDATION_SITE_FIXTURES[0]);
const product = adaptProductForGeneration(FOUNDATION_PRODUCTS[0], site.siteId);
const request = buildLocalGlwGenerationPreview({
  form: createDefaultGlwGenerationInput(site, product),
  sites: [site],
  products: [product],
}).request!;

function serviceWith(response: Awaited<ReturnType<GlwN8nDraftDispatcher["dispatch"]>>) {
  const repository = createInMemoryGlwPageExecutionRepository();
  const service = createGlwDraftExecutionService({
    repository,
    dispatcher: { async dispatch() { return response; } },
    createJobId: () => "glw-job-001",
    now: () => "2030-01-01T00:00:00.000Z",
  });
  return { repository, service };
}

function nodeRun(json: Record<string, unknown>) {
  return [{ data: { main: [[{ json }]] } }];
}

function terminalSnapshot(overrides?: {
  executionId?: string;
  qa?: Record<string, unknown>;
  normalized?: Record<string, unknown>;
  generated?: Record<string, unknown>;
}): GlwN8nExecutionSnapshot {
  return {
    executionId: overrides?.executionId ?? "123",
    state: "SUCCESS",
    errorMessage: null,
    runData: {
      "Build Pre-Publish QA Result": nodeRun({
        job_id: "glw-job-001",
        qa_callback_status: "COMPLETE",
        qa_disposition: "CREATED",
        qa_wordpress_status: "draft",
        qa_page_id: 19308,
        qa_wordpress_url: "https://example.test/?page_id=19308",
        qa_checks: { body: "PASS", seo: "PASS" },
        qa_failure_reasons: {},
        qa_title: "Recovered page title",
        qa_meta_title: "Recovered SEO title",
        qa_focus_keyword: "indoor led video wall austin",
        qa_featured_image_url: "https://example.test/media/10.jpg",
        ...overrides?.qa,
      }),
      "Normalize Published City Page": nodeRun({
        job_id: "glw-job-001",
        normalized_city_page_id: 19308,
        normalized_city_page_url: "https://example.test/?page_id=19308",
        normalized_city_page_status: "draft",
        requested_publishing_mode: "draft",
        disposition: "CREATED",
        ...overrides?.normalized,
      }),
      "Code in JavaScript": nodeRun({
        page_title: "Recovered page title",
        seo_title: "Recovered SEO title",
        focus_keyphrase: "indoor led video wall austin",
        article_html: "<p>one two three four five</p>",
        ...overrides?.generated,
      }),
    },
  };
}

function executionEnvironment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    GLW_N8N_PAGE_WEBHOOK_URL: "https://n8n.example.test/webhook/glw-page-generation",
    GLW_N8N_WEBHOOK_SECRET: "webhook-secret",
    GLW_N8N_API_KEY: "diagnostic-key",
    ...overrides,
  };
}

function discoveryReader(input?: {
  executionIds?: readonly string[];
  snapshot?: GlwN8nExecutionSnapshot;
}): GlwN8nExecutionReader {
  return {
    async findExecutionIds() { return input?.executionIds ?? []; },
    async readExecution(executionId) {
      return input?.snapshot ?? { executionId, state: "RUNNING", runData: null, errorMessage: null };
    },
  };
}

describe("GLW one-draft execution recovery", () => {
  test("maps a validated local request to the historical n8n contract", () => {
    const mapped = mapGenerationRequestToN8nDraft("glw-job-001", request);
    expect(request.siteId).toBe(GLW_APPLICATION_SITE_ID);
    expect(mapped.site.id).toBe(GLW_N8N_ENGINE_SITE_ID);
    expect(mapped.publicationKey).toContain(GLW_APPLICATION_SITE_ID);
    expect(mapped.page.productId).toBe(GLW_INDOOR_LED_VIDEO_WALL_PRODUCT_ID);
    expect(mapped.page.product).toBe(GLW_N8N_ENGINE_PRODUCT_NAME);
    expect(mapped.page.productTopic).toBe(request.productTopic);
    expect(mapped.operation).toBe("CREATE_CITY");
    expect(mapped.wordpressObjectId).toBeNull();
    expect(mapped.page.product_topic).toBe(request.productTopic);
    expect(mapped.page.hierarchical_slug).toBe(request.canonicalPath);
    expect(mapped.publishingSettings.status).toBe("draft");
  });

  test("maps the exact sanitized 004G request to the child engine site contract", () => {
    const jobId = "12a099f9-0f42-4f01-a707-30b3b8f3a29c";
    const mapped = mapGenerationRequestToN8nDraft(jobId, {
      ...request,
      siteId: "site-led-display-warehouse-production",
      stateName: "Texas",
      cityName: "Austin",
      canonicalPath: "indoor-led-video-wall/texas/austin-recovery-draft-20260826",
    });

    expect(mapped).toMatchObject({
      jobId,
      callbackUrl: "",
      operation: "CREATE_CITY",
      site: { id: "led-display-warehouse", name: "LEDDisplayWarehouse.com" },
      page: {
        productId: "prod-indoor-led-video-wall",
        product: "LED Video Walls",
        productTopic: "Indoor LED Video Wall",
        state: "Texas",
        city: "Austin",
        status: "draft",
      },
      publishingSettings: { status: "draft" },
    });
    expect(mapped.operationKey).toBe(`${jobId}:draft`);
    expect(mapped.publicationKey).toBe(
      "site-led-display-warehouse-production:indoor-led-video-wall/texas/austin-recovery-draft-20260826:draft",
    );
  });

  test("rejects unknown or wrong-layer site identities at the engine boundary", () => {
    expect(() => resolveGlwN8nEngineSiteId("site-unknown")).toThrow("Unsupported GLW application site");
    expect(() => resolveGlwN8nEngineSiteId(GLW_N8N_ENGINE_SITE_ID)).toThrow(
      "Unsupported GLW application site",
    );
    expect(() => mapGenerationRequestToN8nDraft("glw-job-001", { ...request, siteId: "site-unknown" }))
      .toThrow("Unsupported GLW application site");
  });

  test("rejects unknown product identities at the engine boundary", () => {
    expect(() => resolveGlwN8nEngineProduct("prod-unknown"))
      .toThrow("Unsupported GLW application product");
    expect(() => mapGenerationRequestToN8nDraft("glw-job-001", {
      ...request,
      productId: "prod-unknown",
    })).toThrow("Unsupported GLW application product");
  });

  test("allows explicit draft execution", async () => {
    const { service } = serviceWith({ kind: "accepted", executionId: "execution-1", status: "accepted" });
    await expect(service.execute(request)).resolves.toMatchObject({ status: "DISPATCHED" });
  });

  test("blocks publish execution during this gate", async () => {
    const { service } = serviceWith({ kind: "accepted", executionId: "execution-1", status: "accepted" });
    await expect(service.execute({ ...request, publicationIntent: "publish" })).rejects.toBeInstanceOf(GlwDraftOnlyExecutionError);
  });

  test("never puts credentials into the dispatch payload", () => {
    const serialized = JSON.stringify(mapGenerationRequestToN8nDraft("glw-job-001", request));
    expect(serialized).not.toMatch(/password|secret|credential|authorization/i);
  });

  test("captures an accepted external execution identifier", async () => {
    const { service } = serviceWith({ kind: "accepted", executionId: "execution-1", status: "running" });
    await expect(service.execute(request)).resolves.toMatchObject({ status: "RUNNING", externalExecutionId: "execution-1" });
  });

  test("captures the WordPress object identifier on success", async () => {
    const { service } = serviceWith({ kind: "complete", executionId: "execution-1", status: "complete", wordpressObjectId: "19308", wordpressUrl: "https://example.test/?page_id=19308", wordpressStatus: "draft" });
    await expect(service.execute(request)).resolves.toMatchObject({ wordpressObjectId: "19308" });
  });

  test("captures WordPress draft status and URL on success", async () => {
    const { service } = serviceWith({ kind: "complete", executionId: "execution-1", status: "complete", wordpressObjectId: "19308", wordpressUrl: "https://example.test/?page_id=19308", wordpressStatus: "draft" });
    await expect(service.execute(request)).resolves.toMatchObject({ status: "COMPLETE", wordpressStatus: "draft", wordpressUrl: "https://example.test/?page_id=19308" });
  });

  test("redacts secrets from failed execution results", async () => {
    const { service } = serviceWith({ kind: "failed", executionId: "execution-1", status: "failed", errorCode: "UPSTREAM", errorMessage: "authorization=real-token secret=unsafe" });
    const result = await service.execute(request);
    expect(result.errorMessage).toBe("authorization=[REDACTED] secret=[REDACTED]");
    expect(redactGlwExecutionError("Bearer abc.def.ghi")).toBe("Bearer [REDACTED]");
  });

  test("rejects terminal correlation for an unknown job", async () => {
    const { service } = serviceWith({ kind: "accepted", executionId: "execution-1", status: "accepted" });
    await expect(service.applyTerminalResult("missing", { kind: "complete", executionId: "execution-1", status: "complete", wordpressObjectId: "1", wordpressUrl: "https://example.test/1", wordpressStatus: "draft" })).rejects.toBeInstanceOf(GlwUnknownExecutionError);
  });

  test("does not let a duplicate terminal result corrupt a completed job", async () => {
    const { service } = serviceWith({ kind: "complete", executionId: "execution-1", status: "complete", wordpressObjectId: "19308", wordpressUrl: "https://example.test/?page_id=19308", wordpressStatus: "draft" });
    const completed = await service.execute(request);
    const duplicate = await service.applyTerminalResult(completed.jobId, { kind: "failed", executionId: "execution-1", status: "failed", errorCode: "LATE", errorMessage: "late failure" });
    expect(duplicate).toMatchObject({ status: "COMPLETE", wordpressObjectId: "19308", errorMessage: null });
  });

  test("retains WordPress identity for a future update of the same object", async () => {
    const { service } = serviceWith({ kind: "complete", executionId: "execution-1", status: "complete", wordpressObjectId: "19308", wordpressUrl: "https://example.test/?page_id=19308", wordpressStatus: "draft" });
    const completed = await service.execute(request);
    expect(completed.wordpressObjectId).toBe("19308");
    expect(completed.wordpressUrl).toContain("19308");
  });

  test("keeps the matrix planner free of external execution", () => {
    const source = readFileSync(resolve(process.cwd(), "src/modules/glw/matrix-planner.ts"), "utf8");
    expect(source).not.toMatch(/fetch\(|n8n|wordpress|callback|child_process/i);
  });
});

describe("GLW async n8n result recovery", () => {
  test("persists local correlation and dispatch time with immediate acceptance", async () => {
    const { service } = serviceWith({ kind: "accepted", executionId: "123", status: "accepted" });
    await expect(service.execute(request)).resolves.toMatchObject({
      jobId: "glw-job-001",
      correlationId: "glw-job-001",
      externalExecutionId: "123",
      status: "DISPATCHED",
      dispatchedAt: "2030-01-01T00:00:00.000Z",
    });
  });

  test("treats a running execution as non-terminal", () => {
    expect(normalizeGlwN8nExecutionResult({
      snapshot: { executionId: "123", state: "RUNNING", runData: null, errorMessage: null },
      expectedJobId: "glw-job-001",
    })).toBeNull();
  });

  test("normalizes a failed n8n execution with redaction", () => {
    expect(normalizeGlwN8nExecutionResult({
      snapshot: { executionId: "123", state: "FAILED", runData: null, errorMessage: "token=unsafe" },
      expectedJobId: "glw-job-001",
    })).toMatchObject({ kind: "failed", errorCode: "N8N_EXECUTION_FAILED", errorMessage: "token=[REDACTED]" });
  });

  test("extracts WordPress, SEO, image, disposition, and QA data", () => {
    expect(normalizeGlwN8nExecutionResult({ snapshot: terminalSnapshot(), expectedJobId: "glw-job-001" }))
      .toMatchObject({
        kind: "complete",
        wordpressObjectId: "19308",
        wordpressStatus: "draft",
        requestedPublicationMode: "draft",
        disposition: "CREATED",
        qaStatus: "COMPLETE",
        qaChecks: { body: "PASS", seo: "PASS" },
        pageTitle: "Recovered page title",
        seoTitle: "Recovered SEO title",
        focusKeyphrase: "indoor led video wall austin",
        wordCount: 5,
        featuredImagePresent: true,
      });
  });

  test("rejects terminal success without required result nodes", () => {
    expect(() => normalizeGlwN8nExecutionResult({
      snapshot: { ...terminalSnapshot(), runData: {} },
      expectedJobId: "glw-job-001",
    })).toThrow(GlwExecutionResultError);
  });

  test("rejects terminal data correlated to another local job", () => {
    expect(() => normalizeGlwN8nExecutionResult({
      snapshot: terminalSnapshot({ qa: { job_id: "other-job" }, normalized: { job_id: "other-job" } }),
      expectedJobId: "glw-job-001",
    })).toThrow("does not match");
  });

  test("normalizes failed QA with structured diagnostics", () => {
    expect(normalizeGlwN8nExecutionResult({
      snapshot: terminalSnapshot({ qa: {
        qa_callback_status: "FAILED_QA",
        qa_failure_summary: "body: too short",
        qa_checks: { body: "FAIL" },
        qa_failure_reasons: { body: "too short" },
      } }),
      expectedJobId: "glw-job-001",
    })).toMatchObject({
      kind: "failed",
      errorCode: "FAILED_QA",
      qaStatus: "FAILED_QA",
      qaChecks: { body: "FAIL" },
      qaFailureReasons: { body: "too short" },
    });
  });

  test("rejects a terminal public WordPress result", () => {
    expect(() => normalizeGlwN8nExecutionResult({
      snapshot: terminalSnapshot({
        qa: { qa_wordpress_status: "publish" },
        normalized: { normalized_city_page_status: "publish", requested_publishing_mode: "publish" },
      }),
      expectedJobId: "glw-job-001",
    })).toThrow("WordPress draft identity");
  });

  test("rejects a terminal result without WordPress identity", () => {
    expect(() => normalizeGlwN8nExecutionResult({
      snapshot: terminalSnapshot({ qa: { qa_page_id: "" }, normalized: { normalized_city_page_id: "" } }),
      expectedJobId: "glw-job-001",
    })).toThrow("WordPress draft identity");
  });

  test("polls running state to terminal completion and persists the result", async () => {
    const { service } = serviceWith({ kind: "accepted", executionId: "123", status: "accepted" });
    await service.execute(request);
    const readExecution = jest.fn()
      .mockResolvedValueOnce({ executionId: "123", state: "RUNNING", runData: null, errorMessage: null })
      .mockResolvedValueOnce(terminalSnapshot());
    const result = await service.pollToTerminal("glw-job-001", { readExecution }, { intervalMs: 0 });
    expect(readExecution).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ status: "COMPLETE", wordpressObjectId: "19308", qaStatus: "COMPLETE" });
  });

  test("stops at the bounded polling limit without redispatch", async () => {
    const dispatch = jest.fn().mockResolvedValue({ kind: "accepted", executionId: "123", status: "accepted" });
    const repository = createInMemoryGlwPageExecutionRepository();
    const service = createGlwDraftExecutionService({ repository, dispatcher: { dispatch }, createJobId: () => "glw-job-001" });
    await service.execute(request);
    const readExecution = jest.fn().mockResolvedValue({ executionId: "123", state: "RUNNING", runData: null, errorMessage: null });
    const result = await service.pollToTerminal("glw-job-001", { readExecution }, { maxAttempts: 3, intervalMs: 0 });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(readExecution).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({ status: "RUNNING", errorCode: "POLL_TIMEOUT", completedAt: null });
  });

  test("rejects a mismatched execution identity returned by the reader", async () => {
    const { service } = serviceWith({ kind: "accepted", executionId: "123", status: "accepted" });
    await service.execute(request);
    await expect(service.pollToTerminal("glw-job-001", {
      async readExecution() { return { executionId: "999", state: "RUNNING", runData: null, errorMessage: null }; },
    }, { maxAttempts: 1 })).rejects.toBeInstanceOf(GlwExecutionResultError);
  });

  test("persists structured failed-QA data as terminal FAILED", async () => {
    const { service } = serviceWith({ kind: "accepted", executionId: "123", status: "accepted" });
    await service.execute(request);
    const snapshot = terminalSnapshot({ qa: {
      qa_callback_status: "FAILED_QA",
      qa_checks: { seo: "FAIL" },
      qa_failure_reasons: { seo: "missing" },
    } });
    const result = await service.pollToTerminal("glw-job-001", { async readExecution() { return snapshot; } });
    expect(result).toMatchObject({
      status: "FAILED",
      qaStatus: "FAILED_QA",
      qaChecks: { seo: "FAIL" },
      qaFailureReasons: { seo: "missing" },
    });
  });

  test("execution reader uses only the read-only detail endpoint and API key", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "123", status: "running", data: { resultData: { runData: {} } } }),
    });
    const reader = createGlwN8nExecutionReader({ environment: executionEnvironment(), fetchImpl });
    await expect(reader.readExecution("123")).resolves.toMatchObject({ executionId: "123", state: "RUNNING" });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://n8n.example.test/api/v1/executions/123?includeData=true",
      expect.objectContaining({ method: "GET", headers: expect.objectContaining({ "X-N8N-API-KEY": "diagnostic-key" }) }),
    );
    expect(fetchImpl.mock.calls[0][1]).not.toHaveProperty("body");
    expect(fetchImpl.mock.calls[0][1].headers).not.toHaveProperty("Authorization");
  });

  test("execution reader rejects non-numeric identity before fetch", async () => {
    const fetchImpl = jest.fn();
    const reader = createGlwN8nExecutionReader({ environment: executionEnvironment(), fetchImpl });
    await expect(reader.readExecution("not-an-id")).rejects.toThrow("must be numeric");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("execution reader requires diagnostics configuration", async () => {
    const reader = createGlwN8nExecutionReader({
      environment: executionEnvironment({ GLW_N8N_API_KEY: "" }),
      fetchImpl: jest.fn(),
    });
    await expect(reader.readExecution("123")).rejects.toThrow("diagnostics are not configured");
  });

  test("execution reader exposes successful runData for terminal normalization", async () => {
    const runData = { node: nodeRun({ value: true }) };
    const reader = createGlwN8nExecutionReader({
      environment: executionEnvironment(),
      fetchImpl: jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 123, status: "success", data: { resultData: { runData } } }),
      }),
    });
    await expect(reader.readExecution("123")).resolves.toMatchObject({ state: "SUCCESS", runData });
  });

  test("execution reader normalizes and redacts terminal API errors", async () => {
    const reader = createGlwN8nExecutionReader({
      environment: executionEnvironment(),
      fetchImpl: jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: "123", status: "error", data: { resultData: { error: { message: "secret=unsafe" } } } }),
      }),
    });
    await expect(reader.readExecution("123")).resolves.toMatchObject({
      state: "FAILED",
      errorMessage: "secret=[REDACTED]",
    });
  });
});

describe("GLW static acceptance correlation recovery", () => {
  test("accepts a static webhook response without an execution identifier", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ accepted: true, status: "accepted" }),
    });
    const dispatcher = createGlwN8nDraftDispatcher({ environment: executionEnvironment(), fetchImpl });
    await expect(dispatcher.dispatch(mapGenerationRequestToN8nDraft("glw-job-001", request)))
      .resolves.toEqual({ kind: "accepted", executionId: null, status: "accepted" });
  });

  test("persists DISPATCHED when static acceptance has no execution identifier", async () => {
    const { service } = serviceWith({ kind: "accepted", executionId: null, status: "accepted" });
    await expect(service.execute(request)).resolves.toMatchObject({
      status: "DISPATCHED",
      externalExecutionId: null,
      correlationId: "glw-job-001",
      dispatchedAt: "2030-01-01T00:00:00.000Z",
    });
  });

  test("extracts correlation only from the normalized GLW node", () => {
    const runData = {
      "GLW Page Webhook": nodeRun({ jobId: "untrusted-webhook-value" }),
      "Get row(s) in sheet": nodeRun({ job_id: "glw-job-001" }),
    };
    expect(extractGlwJobId(runData)).toBe("glw-job-001");
    expect(extractGlwJobId({ "GLW Page Webhook": nodeRun({ jobId: "glw-job-001" }) })).toBeNull();
  });

  test("execution discovery matches exact job ID and ignores unrelated newest execution", async () => {
    const fetchImpl = jest.fn(async (url: string | URL) => {
      const value = String(url);
      if (value.includes("/api/v1/executions?")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [
            { id: "999", mode: "webhook", startedAt: "2030-01-01T00:00:02.000Z" },
            { id: "123", mode: "webhook", startedAt: "2030-01-01T00:00:01.000Z" },
            { id: "777", mode: "trigger", startedAt: "2030-01-01T00:00:03.000Z" },
          ] }),
        };
      }
      const executionId = value.includes("/999?") ? "999" : "123";
      const jobId = executionId === "123" ? "glw-job-001" : "other-job";
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: executionId,
          status: "running",
          data: { resultData: { runData: { "Get row(s) in sheet": nodeRun({ job_id: jobId }) } } },
        }),
      };
    });
    const reader = createGlwN8nExecutionReader({ environment: executionEnvironment(), fetchImpl: fetchImpl as typeof fetch });
    await expect(reader.findExecutionIds({
      jobId: "glw-job-001",
      startedAt: "2030-01-01T00:00:00.000Z",
    })).resolves.toEqual(["123"]);
    expect(fetchImpl.mock.calls.some(([url]) => String(url).includes("/777?"))).toBe(false);
  });

  test("execution discovery excludes executions before the dispatch boundary", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: "123", mode: "webhook", startedAt: "2029-12-31T23:59:59.999Z" }] }),
    });
    const reader = createGlwN8nExecutionReader({ environment: executionEnvironment(), fetchImpl });
    await expect(reader.findExecutionIds({
      jobId: "glw-job-001",
      startedAt: "2030-01-01T00:00:00.000Z",
    })).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test("multiple exact execution matches fail closed", async () => {
    const { service } = serviceWith({ kind: "accepted", executionId: null, status: "accepted" });
    await service.execute(request);
    const result = await service.discoverExecution(
      "glw-job-001",
      discoveryReader({ executionIds: ["123", "456"] }),
      { maxAttempts: 1 },
    );
    expect(result).toMatchObject({ status: "FAILED", errorCode: "EXECUTION_DISCOVERY_AMBIGUOUS" });
  });

  test("missing normalized job ID produces no execution match", async () => {
    const fetchImpl = jest.fn(async (url: string | URL) => {
      const value = String(url);
      return value.includes("/api/v1/executions?")
        ? { ok: true, status: 200, json: async () => ({ data: [{ id: "123", mode: "webhook", startedAt: "2030-01-01T00:00:01.000Z" }] }) }
        : { ok: true, status: 200, json: async () => ({ id: "123", status: "running", data: { resultData: { runData: {} } } }) };
    });
    const reader = createGlwN8nExecutionReader({ environment: executionEnvironment(), fetchImpl: fetchImpl as typeof fetch });
    await expect(reader.findExecutionIds({
      jobId: "glw-job-001",
      startedAt: "2030-01-01T00:00:00.000Z",
    })).resolves.toEqual([]);
  });

  test("discovery timeout fails without redispatch", async () => {
    const dispatch = jest.fn().mockResolvedValue({ kind: "accepted", executionId: null, status: "accepted" });
    const repository = createInMemoryGlwPageExecutionRepository();
    const service = createGlwDraftExecutionService({
      repository,
      dispatcher: { dispatch },
      createJobId: () => "glw-job-001",
      now: () => "2030-01-01T00:00:00.000Z",
    });
    await service.execute(request);
    const findExecutionIds = jest.fn().mockResolvedValue([]);
    const result = await service.discoverExecution(
      "glw-job-001",
      { ...discoveryReader(), findExecutionIds },
      { maxAttempts: 3, intervalMs: 0 },
    );
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(findExecutionIds).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({ status: "FAILED", errorCode: "EXECUTION_DISCOVERY_TIMEOUT" });
  });

  test("persists a uniquely discovered execution identifier", async () => {
    const { service } = serviceWith({ kind: "accepted", executionId: null, status: "accepted" });
    await service.execute(request);
    await expect(service.discoverExecution(
      "glw-job-001",
      discoveryReader({ executionIds: ["123"] }),
      { maxAttempts: 1 },
    )).resolves.toMatchObject({ status: "RUNNING", externalExecutionId: "123" });
  });

  test("existing terminal polling succeeds after execution discovery", async () => {
    const { service } = serviceWith({ kind: "accepted", executionId: null, status: "accepted" });
    await service.execute(request);
    const reader = discoveryReader({ executionIds: ["123"], snapshot: terminalSnapshot() });
    const discovered = await service.discoverExecution("glw-job-001", reader, { maxAttempts: 1 });
    expect(discovered).toMatchObject({ status: "RUNNING", externalExecutionId: "123" });
    await expect(service.pollToTerminal("glw-job-001", reader, { maxAttempts: 1 }))
      .resolves.toMatchObject({ status: "COMPLETE", wordpressObjectId: "19308" });
  });
});

describe("GLW exact WordPress identity safety", () => {
  const targetSlug = "austin-recovery-draft-20260826";
  const parentId = "2563";
  const productId = GLW_INDOOR_LED_VIDEO_WALL_PRODUCT_ID;
  const austinPage = {
    wordpressObjectId: "2565",
    targetSlug: "austin",
    parentId,
    productId,
    status: "publish",
  };
  const exactTarget = { ...austinPage, wordpressObjectId: "3001", targetSlug };

  function decide(overrides: Partial<Parameters<typeof resolveGlwWordPressIdentityDecision>[0]> = {}) {
    return resolveGlwWordPressIdentityDecision({
      operation: "CREATE_CITY",
      targetSlug,
      parentId,
      productId,
      wordpressObjectId: null,
      candidates: [austinPage],
      ...overrides,
    });
  }

  test("creates an absent exact target instead of adopting a fuzzy city match", () => {
    expect(decide()).toEqual({ operation: "CREATE", targetSlug, wordpressObjectId: null });
  });

  test("fails closed when a create target has an exact collision", () => {
    expect(() => decide({ candidates: [austinPage, exactTarget] })).toThrow("exact requested");
  });

  test("updates exactly the persisted WordPress object ID", () => {
    expect(decide({ operation: "UPDATE_CITY", wordpressObjectId: "3001", candidates: [austinPage, exactTarget] }))
      .toEqual({ operation: "UPDATE", targetSlug, wordpressObjectId: "3001" });
  });

  test("fails closed when an update has no WordPress object ID", () => {
    expect(() => decide({ operation: "UPDATE_CITY" })).toThrow("exact persisted");
  });

  test("does not demote a published fuzzy city match during create", () => {
    expect(decide().wordpressObjectId).toBeNull();
    expect(austinPage.status).toBe("publish");
  });

  test("applies exact identity protection to state creates", () => {
    expect(decide({ operation: "CREATE_STATE" })).toMatchObject({ operation: "CREATE" });
  });

  test("requires exact object authority for state updates", () => {
    expect(decide({ operation: "UPDATE_STATE", wordpressObjectId: "3001", candidates: [exactTarget] }))
      .toMatchObject({ operation: "UPDATE", wordpressObjectId: "3001" });
  });

  test("never adopts a page under the wrong parent", () => {
    expect(decide({ candidates: [{ ...exactTarget, parentId: "9999" }] })).toMatchObject({ operation: "CREATE" });
  });

  test("never adopts a page for the wrong product", () => {
    expect(decide({ candidates: [{ ...exactTarget, productId: "prod-other" }] })).toMatchObject({ operation: "CREATE" });
  });

  test("fails closed for an unknown product before identity resolution", () => {
    expect(() => resolveGlwN8nEngineProduct("prod-unknown")).toThrow("Unsupported GLW application product");
  });
});