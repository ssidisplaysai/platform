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
    expect(mapped.site.id).toBe(GLW_APPLICATION_SITE_ID);
    expect(mapped.publicationKey).toContain(GLW_APPLICATION_SITE_ID);
    expect(mapped.page.productId).toBe(GLW_INDOOR_LED_VIDEO_WALL_PRODUCT_ID);
    expect(mapped.page.product).toBe(request.productTopic);
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
      site: { id: "site-led-display-warehouse-production", name: "LEDDisplayWarehouse.com" },
      page: {
        productId: "prod-indoor-led-video-wall",
        product: "Indoor LED Video Wall",
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

  test("preserves generalized canonical site identity while legacy resolver remains strict", () => {
    expect(() => resolveGlwN8nEngineSiteId("site-unknown")).toThrow("Unsupported GLW application site");
    expect(() => resolveGlwN8nEngineSiteId(GLW_N8N_ENGINE_SITE_ID)).toThrow(
      "Unsupported GLW application site",
    );

    const mapped = mapGenerationRequestToN8nDraft("glw-job-001", {
      ...request,
      siteId: "site-generalized-example",
      siteName: "Generalized Example",
    });

    expect(mapped.site).toEqual({
      id: "site-generalized-example",
      name: "Generalized Example",
      domain: "LEDDisplayWarehouse.com",
      canonicalUrl: "https://leddisplaywarehouse.com",
      wordpressApiBaseUrl: "https://leddisplaywarehouse.com/wp-json/wp/v2",
    });
  });

  test("preserves generalized canonical product identity while legacy resolver remains strict", () => {
    expect(() => resolveGlwN8nEngineProduct("prod-unknown"))
      .toThrow("Unsupported GLW application product");

    const mapped = mapGenerationRequestToN8nDraft("glw-job-001", {
      ...request,
      productId: "prod-generalized-example",
      productTopic: "Generalized Product",
    });

    expect(mapped.page.productId).toBe("prod-generalized-example");
    expect(mapped.page.product).toBe("Generalized Product");
    expect(mapped.page.productTopic).toBe("Generalized Product");
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

  test("normalizes known mojibake in generated draft content", () => {
    const normalized = normalizeGlwN8nExecutionResult({
      snapshot: terminalSnapshot({
        generated: {
          article_html: "<p>AlaskaÃ¢â‚¬â„¢s viewing range is 360Ã‚Â° Ã¢â‚¬â€œ 180Ã‚Â°.</p>",
        },
      }),
      expectedJobId: "glw-job-001",
    });

    expect(normalized).toMatchObject({ kind: "complete" });
    if (!normalized || normalized.kind !== "complete") throw new Error("Expected complete result.");
    expect(normalized.generatedDraft?.contentHtml).toContain("Alaska’s viewing range is 360° – 180°.");
    expect(normalized.generatedDraft?.contentHtml).not.toMatch(/[âÃÂ\uFFFD]/);
  });

  test("fails closed when generated draft retains unknown encoding corruption", () => {
    expect(() => normalizeGlwN8nExecutionResult({
      snapshot: terminalSnapshot({
        generated: { article_html: "<p>Unknown corruption Ãxyz remains.</p>" },
      }),
      expectedJobId: "glw-job-001",
    })).toThrow(GlwExecutionResultError);
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

  test.each([
    { name: "explicit true", qa: { qa_featured_image_present: true }, generated: {}, expected: true },
    { name: "explicit false", qa: { qa_featured_image_present: false }, generated: {}, expected: false },
    { name: "explicit false overrides URL", qa: { qa_featured_image_present: false, qa_featured_image_url: "https://example.test/image.jpg" }, generated: {}, expected: false },
    { name: "URL fallback", qa: { qa_featured_image_url: "https://example.test/image.jpg" }, generated: {}, expected: true },
    { name: "media ID fallback", qa: {}, generated: { featured_media: 88 }, expected: true },
  ])("normalizes featured image presence: $name", ({ qa, generated, expected }) => {
    expect(normalizeGlwN8nExecutionResult({
      snapshot: terminalSnapshot({ qa, generated }),
      expectedJobId: "glw-job-001",
    })).toMatchObject({ featuredImagePresent: expected });
  });
});
