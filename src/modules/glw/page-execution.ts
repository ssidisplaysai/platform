import type { GlwGenerationRequest } from "./page-generation";

export const GLW_APPLICATION_SITE_ID = "site-led-display-warehouse-production";
export const GLW_N8N_ENGINE_SITE_ID = "led-display-warehouse";
export const GLW_INDOOR_LED_VIDEO_WALL_PRODUCT_ID = "prod-indoor-led-video-wall";
export const GLW_N8N_ENGINE_PRODUCT_NAME = "LED Video Walls";
export const GLW_N8N_ENGINE_PRODUCT_SLUG = "direct-view-led-video-walls";

const GLW_N8N_ENGINE_SITE_BY_APPLICATION_SITE: Readonly<Record<string, string>> = {
  [GLW_APPLICATION_SITE_ID]: GLW_N8N_ENGINE_SITE_ID,
};

const GLW_N8N_ENGINE_PRODUCT_BY_APPLICATION_PRODUCT: Readonly<Record<string, {
  name: string;
  slug: string;
}>> = {
  [GLW_INDOOR_LED_VIDEO_WALL_PRODUCT_ID]: {
    name: GLW_N8N_ENGINE_PRODUCT_NAME,
    slug: GLW_N8N_ENGINE_PRODUCT_SLUG,
  },
};

export function resolveGlwN8nEngineSiteId(applicationSiteId: string): string {
  const engineSiteId = GLW_N8N_ENGINE_SITE_BY_APPLICATION_SITE[applicationSiteId];
  if (!engineSiteId) {
    throw new Error(`Unsupported GLW application site: ${applicationSiteId || "MISSING"}`);
  }
  return engineSiteId;
}

export function resolveGlwN8nEngineProduct(applicationProductId: string): string {
  const engineProduct = GLW_N8N_ENGINE_PRODUCT_BY_APPLICATION_PRODUCT[applicationProductId];
  if (!engineProduct) {
    throw new Error(`Unsupported GLW application product: ${applicationProductId || "MISSING"}`);
  }
  return engineProduct.name;
}

export function resolveGlwN8nEngineProductSlug(applicationProductId: string): string {
  const engineProduct = GLW_N8N_ENGINE_PRODUCT_BY_APPLICATION_PRODUCT[applicationProductId];
  if (!engineProduct) {
    throw new Error(`Unsupported GLW application product: ${applicationProductId || "MISSING"}`);
  }
  return engineProduct.slug;
}

export type GlwPageExecutionStatus =
  | "QUEUED"
  | "DISPATCHED"
  | "DISCOVERING_EXECUTION"
  | "RUNNING"
  | "COMPLETE"
  | "FAILED";

export type GlwExecutionTransport = "N8N_WEBHOOK" | "N8N_MCP";

export type GlwPageExecutionRecord = {
  jobId: string;
  correlationId: string;
  executionTransport: GlwExecutionTransport;
  organizationId: string;
  siteId: string;
  productId: string;
  productTopic: string;
  state: string | null;
  city: string | null;
  slug: string;
  title: string;
  seoTitle: string;
  metaDescription: string;
  publicationIntent: "draft";
  status: GlwPageExecutionStatus;
  externalExecutionId: string | null;
  wordpressObjectId: string | null;
  wordpressUrl: string | null;
  wordpressStatus: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  requestedPublicationMode: "draft";
  disposition: string | null;
  qaStatus: string | null;
  qaChecks: Readonly<Record<string, unknown>> | null;
  qaFailureReasons: Readonly<Record<string, unknown>> | null;
  focusKeyphrase: string | null;
  wordCount: number | null;
  featuredImagePresent: boolean | null;
  createdAt: string;
  dispatchedAt: string | null;
  updatedAt: string;
  completedAt: string | null;
};

export type GlwN8nDraftRequest = {
  jobId: string;
  callbackUrl: string;
  operation: GlwGenerationRequest["plannedOperation"];
  wordpressObjectId: string | null;
  operationKey: string;
  publicationKey: string;
  type: "page_generation";
  workspaceId: string;
  workspace_id: string;
  site: { id: string; name: string };
  page: {
    hierarchyMode: "city_child_target";
    hierarchy_mode: "city_child_target";
    cityParentId: null;
    city_parent_id: null;
    pageType: GlwGenerationRequest["pageType"];
    page_type: GlwGenerationRequest["pageType"];
    productId: string;
    product: string;
    productTopic: string;
    product_topic: string;
    state: string;
    city: string;
    citySlug: string;
    city_slug: string;
    hierarchicalSlug: string;
    hierarchical_slug: string;
    title: string;
    targetSlug: string;
    seoTitle: string;
    metaDescription: string;
    primaryKeyword: string;
    secondaryKeywords: readonly string[];
    wordCount: number;
    tone: string;
    audience: string;
    callToAction: string;
    category: string;
    additionalInstructions: string;
    additional_instructions: string;
    status: "draft";
  };
  promptData: { tone: string; audience: string; callToAction: string };
  seoSettings: {
    targetSlug: string;
    citySlug: string;
    city_slug: string;
    primaryKeyword: string;
    secondaryKeywords: readonly string[];
    category: string;
    seoTitle: string;
    metaDescription: string;
  };
  publishingSettings: { status: "draft"; wordCount: number };
  imageSettings: { generateFeaturedImage: boolean; style: string };
  workflowContext: {
    workspaceId: string;
    hierarchyMode: "city_child_target";
    cityParentId: null;
    pageType: GlwGenerationRequest["pageType"];
    productTopic: string;
    state: string;
    city: string;
    citySlug: string;
    hierarchicalSlug: string;
    additionalInstructions: string;
  };
};

export type GlwN8nDraftResponse =
  | { kind: "accepted"; executionId: string | null; status: "accepted" | "running" }
  | {
      kind: "complete";
      executionId: string;
      status: "complete";
      wordpressObjectId: string;
      wordpressUrl: string;
      wordpressStatus: "draft";
      requestedPublicationMode?: "draft";
      disposition?: string;
      qaStatus?: string;
      qaChecks?: Readonly<Record<string, unknown>>;
      qaFailureReasons?: Readonly<Record<string, unknown>>;
      pageTitle?: string;
      seoTitle?: string;
      focusKeyphrase?: string;
      wordCount?: number;
      featuredImagePresent?: boolean;
    }
  | {
      kind: "failed";
      executionId: string | null;
      status: "failed";
      errorCode: string;
      errorMessage: string;
      qaStatus?: string;
      qaChecks?: Readonly<Record<string, unknown>>;
      qaFailureReasons?: Readonly<Record<string, unknown>>;
    };

export type GlwPageExecutionRepository = {
  create(record: GlwPageExecutionRecord): Promise<GlwPageExecutionRecord>;
  getById(jobId: string): Promise<GlwPageExecutionRecord | null>;
  list(): Promise<readonly GlwPageExecutionRecord[]>;
  update(jobId: string, patch: Partial<GlwPageExecutionRecord>): Promise<GlwPageExecutionRecord>;
};

export type GlwN8nDraftDispatcher = {
  dispatch(request: GlwN8nDraftRequest): Promise<GlwN8nDraftResponse>;
};

export type GlwN8nExecutionSnapshot = {
  executionId: string;
  state: "RUNNING" | "SUCCESS" | "FAILED";
  runData: unknown;
  errorMessage: string | null;
};

export type GlwN8nExecutionReader = {
  readExecution(executionId: string): Promise<GlwN8nExecutionSnapshot>;
  findExecutionIds(input: { jobId: string; startedAt: string }): Promise<readonly string[]>;
};

export const GLW_TERMINAL_READ_POLICY = {
  maximumAttempts: 3,
  intervalMs: 5_000,
} as const;

export class GlwUnknownExecutionError extends Error {}
export class GlwDraftOnlyExecutionError extends Error {}
export class GlwExecutionResultError extends Error {}

export type GlwWordPressIdentityCandidate = {
  wordpressObjectId: string;
  targetSlug: string;
  parentId: string;
  productId: string;
  status: string;
};

export type GlwWordPressIdentityDecision =
  | { operation: "CREATE"; targetSlug: string; wordpressObjectId: null }
  | { operation: "UPDATE"; targetSlug: string; wordpressObjectId: string };

export function resolveGlwWordPressIdentityDecision(input: {
  operation: GlwGenerationRequest["plannedOperation"];
  targetSlug: string;
  parentId: string;
  productId: string;
  wordpressObjectId: string | null;
  candidates: readonly GlwWordPressIdentityCandidate[];
}): GlwWordPressIdentityDecision {
  const exactTarget = input.candidates.find((candidate) =>
    candidate.targetSlug === input.targetSlug
    && candidate.parentId === input.parentId
    && candidate.productId === input.productId);

  if (input.operation.startsWith("CREATE_")) {
    if (input.wordpressObjectId) {
      throw new GlwExecutionResultError("Create operations cannot carry WordPress update authority.");
    }
    if (exactTarget) {
      throw new GlwExecutionResultError("The exact requested WordPress target already exists.");
    }
    return { operation: "CREATE", targetSlug: input.targetSlug, wordpressObjectId: null };
  }

  if (!input.wordpressObjectId) {
    throw new GlwExecutionResultError("Update operations require an exact persisted WordPress object ID.");
  }
  const exactObject = input.candidates.find(
    (candidate) => candidate.wordpressObjectId === input.wordpressObjectId,
  );
  if (!exactObject) {
    throw new GlwExecutionResultError("The authorized WordPress object was not found.");
  }
  if (exactObject.parentId !== input.parentId || exactObject.productId !== input.productId) {
    throw new GlwExecutionResultError("The authorized WordPress object does not match the requested hierarchy.");
  }
  return {
    operation: "UPDATE",
    targetSlug: input.targetSlug,
    wordpressObjectId: exactObject.wordpressObjectId,
  };
}

export function redactGlwExecutionError(value: unknown): string {
  const message = value instanceof Error ? value.message : String(value ?? "Execution failed.");
  return message
    .replace(/\bBearer\s+[A-Za-z0-9._+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/(authorization|password|token|secret|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .replace(/https?:\/\/[^\s/@:]+:[^\s/@]+@/gi, "https://[REDACTED]@")
    .slice(0, 500);
}

export function mapGenerationRequestToN8nDraft(
  jobId: string,
  request: GlwGenerationRequest,
): GlwN8nDraftRequest {
  const primaryKeyword = [request.productTopic, request.cityName, request.stateName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const tone = "Confident";
  const audience = "Commercial display buyers";
  const callToAction = "Request a quote";
  const category = "LED Displays";
  const additionalInstructions = "Create a factual draft for editorial review. Do not publish publicly.";
  const wordCount = 1500;

  return {
    jobId,
    callbackUrl: "",
    operation: request.plannedOperation,
    wordpressObjectId: request.wordpressObjectId,
    operationKey: `${jobId}:draft`,
    publicationKey: `${request.siteId}:${request.canonicalPath}:draft`,
    type: "page_generation",
    workspaceId: request.organizationId,
    workspace_id: request.organizationId,
    site: { id: resolveGlwN8nEngineSiteId(request.siteId), name: request.siteName },
    page: {
      hierarchyMode: "city_child_target",
      hierarchy_mode: "city_child_target",
      cityParentId: null,
      city_parent_id: null,
      pageType: request.pageType,
      page_type: request.pageType,
      productId: request.productId,
      product: resolveGlwN8nEngineProduct(request.productId),
      productTopic: request.productTopic,
      product_topic: request.productTopic,
      state: request.stateName ?? "",
      city: request.cityName ?? "",
      citySlug: request.citySlug,
      city_slug: request.citySlug,
      hierarchicalSlug: request.canonicalPath,
      hierarchical_slug: request.canonicalPath,
      title: request.title,
      targetSlug: request.canonicalPath,
      seoTitle: request.seoTitle,
      metaDescription: request.metaDescription,
      primaryKeyword,
      secondaryKeywords: [],
      wordCount,
      tone,
      audience,
      callToAction,
      category,
      additionalInstructions,
      additional_instructions: additionalInstructions,
      status: "draft",
    },
    promptData: { tone, audience, callToAction },
    seoSettings: {
      targetSlug: request.canonicalPath,
      citySlug: request.citySlug,
      city_slug: request.citySlug,
      primaryKeyword,
      secondaryKeywords: [],
      category,
      seoTitle: request.seoTitle,
      metaDescription: request.metaDescription,
    },
    publishingSettings: { status: "draft", wordCount },
    imageSettings: { generateFeaturedImage: true, style: "commercial product photography" },
    workflowContext: {
      workspaceId: request.organizationId,
      hierarchyMode: "city_child_target",
      cityParentId: null,
      pageType: request.pageType,
      productTopic: request.productTopic,
      state: request.stateName ?? "",
      city: request.cityName ?? "",
      citySlug: request.citySlug,
      hierarchicalSlug: request.canonicalPath,
      additionalInstructions,
    },
  };
}

export function createInMemoryGlwPageExecutionRepository(
  initial: readonly GlwPageExecutionRecord[] = [],
): GlwPageExecutionRepository {
  const records = new Map(initial.map((record) => [record.jobId, structuredClone(record)]));

  return {
    async create(record) {
      records.set(record.jobId, structuredClone(record));
      return structuredClone(record);
    },
    async getById(jobId) {
      const record = records.get(jobId);
      return record ? structuredClone(record) : null;
    },
    async list() {
      return Array.from(records.values(), (record) => structuredClone(record));
    },
    async update(jobId, patch) {
      const record = records.get(jobId);
      if (!record) throw new GlwUnknownExecutionError(`Unknown GLW job: ${jobId}`);
      const updated = { ...record, ...structuredClone(patch), jobId };
      records.set(jobId, updated);
      return structuredClone(updated);
    },
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function extractNodeJson(runData: unknown, nodeName: string): Record<string, unknown> | null {
  const runs = asRecord(runData)?.[nodeName];
  if (!Array.isArray(runs) || runs.length === 0) return null;
  const data = asRecord(asRecord(runs[runs.length - 1])?.data);
  const main = data?.main;
  if (!Array.isArray(main) || !Array.isArray(main[0]) || main[0].length === 0) return null;
  return asRecord(asRecord(main[0][0])?.json);
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalIdentifier(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return optionalString(value);
}

function optionalNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalBoolean(value: unknown): boolean | null {
  if (value === undefined || value === null || value === "") return null;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return false;
}

function countHtmlWords(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const text = value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.split(" ").length : null;
}
export function normalizeGlwN8nExecutionResult(input: {
  snapshot: GlwN8nExecutionSnapshot;
  expectedJobId: string;
}): Extract<GlwN8nDraftResponse, { kind: "complete" | "failed" }> | null {
  if (input.snapshot.state === "RUNNING") return null;
  if (input.snapshot.state === "FAILED") {
    return {
      kind: "failed",
      executionId: input.snapshot.executionId,
      status: "failed",
      errorCode: "N8N_EXECUTION_FAILED",
      errorMessage: redactGlwExecutionError(input.snapshot.errorMessage ?? "n8n execution failed."),
    };
  }

  const qa = extractNodeJson(input.snapshot.runData, "Build Pre-Publish QA Result");
  const normalized = extractNodeJson(input.snapshot.runData, "Normalize Published City Page");
  const generated = extractNodeJson(input.snapshot.runData, "Code in JavaScript");
  if (!qa || !normalized) {
    throw new GlwExecutionResultError("Terminal n8n execution is missing required GLW result nodes.");
  }

  const jobId = optionalString(qa.job_id ?? qa.jobId ?? normalized.job_id ?? normalized.jobId);
  if (jobId !== input.expectedJobId) {
    throw new GlwExecutionResultError("Terminal n8n execution does not match the tracked GLW job.");
  }

  const qaStatus = optionalString(qa.qa_callback_status ?? qa.qaCallbackStatus) ?? "FAILED_QA";
  if (qaStatus !== "COMPLETE") {
    return {
      kind: "failed",
      executionId: input.snapshot.executionId,
      status: "failed",
      errorCode: "FAILED_QA",
      errorMessage: redactGlwExecutionError(qa.qa_failure_summary ?? "Pre-publish QA failed."),
      qaStatus,
      qaChecks: asRecord(qa.qa_checks ?? qa.qaChecks) ?? {},
      qaFailureReasons: asRecord(qa.qa_failure_reasons ?? qa.qaFailureReasons) ?? {},
    };
  }

  const wordpressObjectId = optionalIdentifier(
    qa.qa_page_id ?? qa.wordpressPageId ?? normalized.normalized_city_page_id,
  );
  const wordpressUrl = optionalString(
    qa.qa_wordpress_url ?? qa.wordpressUrl ?? normalized.normalized_city_page_url,
  );
  const wordpressStatus = optionalString(
    qa.qa_wordpress_status ?? qa.wordpressStatus ?? normalized.normalized_city_page_status,
  );
  const requestedPublicationMode = optionalString(
    normalized.requested_publishing_mode ?? qa.requestedPublishingMode,
  );
  if (!wordpressObjectId || !wordpressUrl || wordpressStatus !== "draft" || requestedPublicationMode !== "draft") {
    throw new GlwExecutionResultError("Terminal n8n execution did not produce the expected WordPress draft identity.");
  }

  const featuredImagePresent = optionalBoolean(
    qa.qa_featured_image_present
      ?? qa.featuredImagePresent
      ?? normalized.featured_image_present
      ?? normalized.featuredImagePresent,
  );
  const featuredImageUrl = optionalString(qa.qa_featured_image_url);
  const featuredImageId = optionalNumber(generated?.featured_media);
  return {
    kind: "complete",
    executionId: input.snapshot.executionId,
    status: "complete",
    wordpressObjectId,
    wordpressUrl,
    wordpressStatus: "draft",
    requestedPublicationMode: "draft",
    disposition: optionalString(qa.qa_disposition ?? normalized.disposition) ?? undefined,
    qaStatus,
    qaChecks: asRecord(qa.qa_checks ?? qa.qaChecks) ?? {},
    qaFailureReasons: asRecord(qa.qa_failure_reasons ?? qa.qaFailureReasons) ?? {},
    pageTitle: optionalString(qa.qa_title ?? generated?.page_title) ?? undefined,
    seoTitle: optionalString(qa.qa_meta_title ?? generated?.seo_title) ?? undefined,
    focusKeyphrase: optionalString(qa.qa_focus_keyword ?? generated?.focus_keyphrase) ?? undefined,
    wordCount: optionalNumber(qa.qa_word_count) ?? countHtmlWords(generated?.article_html) ?? undefined,
    featuredImagePresent: featuredImagePresent
      ?? (Boolean(featuredImageUrl) || (featuredImageId !== null && featuredImageId > 0)),
  };
}

export function createGlwDraftExecutionService(input: {
  repository: GlwPageExecutionRepository;
  dispatcher: GlwN8nDraftDispatcher;
  executionTransport?: GlwExecutionTransport;
  createJobId?: () => string;
  now?: () => string;
}) {
  const createJobId = input.createJobId ?? (() => crypto.randomUUID());
  const now = input.now ?? (() => new Date().toISOString());

  async function applyTerminalResult(
    jobId: string,
    result: Extract<GlwN8nDraftResponse, { kind: "complete" | "failed" }>,
  ): Promise<GlwPageExecutionRecord> {
    const existing = await input.repository.getById(jobId);
    if (!existing) throw new GlwUnknownExecutionError(`Unknown GLW job: ${jobId}`);
    if (existing.status === "COMPLETE" || existing.status === "FAILED") return existing;
    if (existing.externalExecutionId && result.executionId && existing.externalExecutionId !== result.executionId) {
      throw new GlwUnknownExecutionError("Execution identity does not match the tracked GLW job.");
    }

    const timestamp = now();
    if (result.kind === "complete") {
      return input.repository.update(jobId, {
        status: "COMPLETE",
        externalExecutionId: result.executionId,
        wordpressObjectId: result.wordpressObjectId,
        wordpressUrl: result.wordpressUrl,
        wordpressStatus: result.wordpressStatus,
        requestedPublicationMode: result.requestedPublicationMode ?? "draft",
        disposition: result.disposition ?? null,
        qaStatus: result.qaStatus ?? "COMPLETE",
        qaChecks: result.qaChecks ?? null,
        qaFailureReasons: result.qaFailureReasons ?? null,
        title: result.pageTitle ?? existing.title,
        seoTitle: result.seoTitle ?? existing.seoTitle,
        focusKeyphrase: result.focusKeyphrase ?? null,
        wordCount: result.wordCount ?? null,
        featuredImagePresent: result.featuredImagePresent ?? null,
        errorCode: null,
        errorMessage: null,
        updatedAt: timestamp,
        completedAt: timestamp,
      });
    }

    return input.repository.update(jobId, {
      status: "FAILED",
      externalExecutionId: result.executionId,
      errorCode: result.errorCode,
      errorMessage: redactGlwExecutionError(result.errorMessage),
      qaStatus: result.qaStatus ?? (result.errorCode === "FAILED_QA" ? "FAILED_QA" : null),
      qaChecks: result.qaChecks ?? null,
      qaFailureReasons: result.qaFailureReasons ?? null,
      updatedAt: timestamp,
      completedAt: timestamp,
    });
  }

  return {
    applyTerminalResult,
    async discoverExecution(
      jobId: string,
      reader: GlwN8nExecutionReader,
      options?: {
        maxAttempts?: number;
        intervalMs?: number;
        delay?: (milliseconds: number) => Promise<void>;
      },
    ): Promise<GlwPageExecutionRecord> {
      const maxAttempts = Math.min(Math.max(options?.maxAttempts ?? 15, 1), 30);
      const intervalMs = Math.min(Math.max(options?.intervalMs ?? 2_000, 0), 5_000);
      const delay = options?.delay ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
      let current = await input.repository.getById(jobId);
      if (!current) throw new GlwUnknownExecutionError(`Unknown GLW job: ${jobId}`);
      if (current.externalExecutionId) return current;
      if (!current.dispatchedAt) {
        throw new GlwExecutionResultError("Tracked GLW job has no dispatch boundary.");
      }

      current = await input.repository.update(jobId, {
        status: "DISCOVERING_EXECUTION",
        updatedAt: now(),
      });
      try {
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          const executionIds = [...new Set(await reader.findExecutionIds({
            jobId: current.correlationId,
            startedAt: current.dispatchedAt,
          }))];
          if (executionIds.length > 1) {
            const timestamp = now();
            return input.repository.update(jobId, {
              status: "FAILED",
              errorCode: "EXECUTION_DISCOVERY_AMBIGUOUS",
              errorMessage: "Multiple n8n executions matched the exact GLW correlation identity.",
              updatedAt: timestamp,
              completedAt: timestamp,
            });
          }
          if (executionIds.length === 1) {
            return input.repository.update(jobId, {
              status: "RUNNING",
              externalExecutionId: executionIds[0],
              errorCode: null,
              errorMessage: null,
              updatedAt: now(),
            });
          }
          if (attempt < maxAttempts - 1) await delay(intervalMs);
        }
      } catch (error) {
        const timestamp = now();
        return input.repository.update(jobId, {
          status: "FAILED",
          errorCode: "EXECUTION_DISCOVERY_FAILED",
          errorMessage: redactGlwExecutionError(error),
          updatedAt: timestamp,
          completedAt: timestamp,
        });
      }

      const timestamp = now();
      return input.repository.update(jobId, {
        status: "FAILED",
        errorCode: "EXECUTION_DISCOVERY_TIMEOUT",
        errorMessage: "No n8n execution matched the exact GLW correlation identity within the bounded discovery window.",
        updatedAt: timestamp,
        completedAt: timestamp,
      });
    },
    async pollToTerminal(
      jobId: string,
      reader: GlwN8nExecutionReader,
      options?: {
        maxAttempts?: number;
        intervalMs?: number;
        delay?: (milliseconds: number) => Promise<void>;
      },
    ): Promise<GlwPageExecutionRecord> {
      const maxAttempts = Math.min(Math.max(options?.maxAttempts ?? GLW_TERMINAL_READ_POLICY.maximumAttempts, 1), GLW_TERMINAL_READ_POLICY.maximumAttempts);
      const intervalMs = Math.min(Math.max(options?.intervalMs ?? GLW_TERMINAL_READ_POLICY.intervalMs, 0), GLW_TERMINAL_READ_POLICY.intervalMs);
      const delay = options?.delay ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
      let current = await input.repository.getById(jobId);
      if (!current) throw new GlwUnknownExecutionError(`Unknown GLW job: ${jobId}`);
      if (current.status === "COMPLETE" || current.status === "FAILED") return current;
      if (!current.externalExecutionId) {
        throw new GlwExecutionResultError("Tracked GLW job has no n8n execution identity.");
      }

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const snapshot = await reader.readExecution(current.externalExecutionId);
        if (snapshot.executionId !== current.externalExecutionId) {
          throw new GlwExecutionResultError("n8n execution reader returned a mismatched identity.");
        }
        const terminal = normalizeGlwN8nExecutionResult({ snapshot, expectedJobId: current.jobId });
        if (terminal) return applyTerminalResult(current.jobId, terminal);
        current = await input.repository.update(current.jobId, {
          status: "RUNNING",
          updatedAt: now(),
        });
        if (attempt < maxAttempts - 1) await delay(intervalMs);
      }

      return input.repository.update(current.jobId, {
        errorCode: "POLL_TIMEOUT",
        errorMessage: "n8n execution did not reach a terminal state within the bounded polling window.",
        updatedAt: now(),
      });
    },
    async execute(request: GlwGenerationRequest): Promise<GlwPageExecutionRecord> {
      if (request.publicationIntent !== "draft") {
        throw new GlwDraftOnlyExecutionError("External execution is limited to WordPress drafts in this gate.");
      }

      const timestamp = now();
      const jobId = createJobId();
      const queued = await input.repository.create({
        jobId,
        correlationId: jobId,
        executionTransport: input.executionTransport ?? "N8N_WEBHOOK",
        organizationId: request.organizationId,
        siteId: request.siteId,
        productId: request.productId,
        productTopic: request.productTopic,
        state: request.stateName,
        city: request.cityName,
        slug: request.canonicalPath,
        title: request.title,
        seoTitle: request.seoTitle,
        metaDescription: request.metaDescription,
        publicationIntent: "draft",
        status: "QUEUED",
        externalExecutionId: null,
        wordpressObjectId: null,
        wordpressUrl: null,
        wordpressStatus: null,
        errorCode: null,
        errorMessage: null,
        requestedPublicationMode: "draft",
        disposition: null,
        qaStatus: null,
        qaChecks: null,
        qaFailureReasons: null,
        focusKeyphrase: null,
        wordCount: null,
        featuredImagePresent: null,
        createdAt: timestamp,
        dispatchedAt: null,
        updatedAt: timestamp,
        completedAt: null,
      });

      try {
        const dispatchStartedAt = now();
        const response = await input.dispatcher.dispatch(mapGenerationRequestToN8nDraft(jobId, request));
        if (response.kind === "complete" || response.kind === "failed") {
          return applyTerminalResult(jobId, response);
        }
        return input.repository.update(jobId, {
          status: response.executionId && response.status === "running" ? "RUNNING" : "DISPATCHED",
          externalExecutionId: response.executionId,
          dispatchedAt: dispatchStartedAt,
          updatedAt: now(),
        });
      } catch (error) {
        return input.repository.update(queued.jobId, {
          status: "FAILED",
          errorCode: "DISPATCH_FAILED",
          errorMessage: redactGlwExecutionError(error),
          updatedAt: now(),
          completedAt: now(),
        });
      }
    },
  };
}

export function extractGlwJobId(runData: unknown): string | null {
  const normalized = extractNodeJson(runData, "Get row(s) in sheet");
  return optionalString(normalized?.job_id ?? normalized?.jobId);
}