import type { Prisma } from "@prisma/client";
import { getGlwSite, glwSites } from "./sites";

export const glwJobTypes = ["PAGE_GENERATION", "BLOG_GENERATION"] as const;
export type GlwJobType = (typeof glwJobTypes)[number];

export const glwJobStatuses = [
  "QUEUED",
  "STARTING",
  "RUNNING",
  "GENERATING_CONTENT",
  "GENERATING_IMAGE",
  "UPLOADING_IMAGE",
  "PUBLISHING",
  "COMPLETE",
  "FAILED_QA",
  "FAILED",
] as const;
export type GlwJobStatus = (typeof glwJobStatuses)[number];

export const glwBusinessStatuses = ["UNKNOWN", "IN_PROGRESS", "COMPLETE", "FAILED", "FAILED_QA"] as const;
export type GlwBusinessStatus = (typeof glwBusinessStatuses)[number];

export const glwCallbackDeliveryStatuses = ["NOT_READY", "PENDING", "RETRYING", "ACKNOWLEDGED", "DEAD_LETTER"] as const;
export type GlwCallbackDeliveryStatus = (typeof glwCallbackDeliveryStatuses)[number];

export const glwJobStatusOrder: Record<GlwJobStatus, number> = {
  QUEUED: 0,
  STARTING: 1,
  RUNNING: 2,
  GENERATING_CONTENT: 3,
  GENERATING_IMAGE: 4,
  UPLOADING_IMAGE: 5,
  PUBLISHING: 6,
  COMPLETE: 7,
  FAILED_QA: 7,
  FAILED: 7,
};

export type GlwPublishingMode = "draft" | "publish";
export type GlwWordpressWorkflowStatus = GlwPublishingMode | "qa_failed";
export type GlwPageType = "city_service" | "state_service" | "general_service";
export type GlwHierarchyMode = "legacy_city_page" | "city_child_target";
export type GlwQaCheckState = "PASS" | "FAIL" | "PENDING" | "UNKNOWN";
export type GlwQaCheckKey =
  | "pageExists"
  | "hierarchy"
  | "slug"
  | "title"
  | "h1"
  | "uniquePrimaryHeading"
  | "duplicateSectionHeadings"
  | "duplicateSectionContent"
  | "placeholderResourceLinks"
  | "body"
  | "featuredImage"
  | "heroImage"
  | "seo"
  | "internalLinks"
  | "imageAlt"
  | "duplicateCheck";
export type GlwQaChecks = Record<GlwQaCheckKey, GlwQaCheckState>;
export type GlwQaFailureReasons = Partial<Record<GlwQaCheckKey, string>>;
export type GlwResultDisposition = "CREATED" | "UPDATED" | "SKIPPED_DUPLICATE" | "FAILED_QA" | (string & {});

const glwPageTypes: readonly GlwPageType[] = ["city_service", "state_service", "general_service"];
const CANONICAL_GLW_SITE_ID = "led-display-warehouse";

export type GlwPageGenerationRequest = {
  siteId: string;
  workspaceId: string;
  hierarchyMode: GlwHierarchyMode;
  cityParentId?: number;
  pageType: GlwPageType;
  productTopic: string;
  state: string;
  city: string;
  citySlug: string;
  hierarchicalSlug: string;
  additionalInstructions: string;
  title: string;
  targetSlug: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  wordCount: number;
  tone: string;
  audience: string;
  callToAction: string;
  category: string;
  status: GlwPublishingMode;
};

export type GlwPageGenerationJobInput = {
  type: "page_generation";
  site: {
    id: string;
    name: string;
  };
  page: {
    workspaceId: string;
    hierarchyMode: GlwHierarchyMode;
    cityParentId: number | null;
    pageType: GlwPageType;
    productTopic: string;
    state: string;
    city: string;
    citySlug: string;
    hierarchicalSlug: string;
    additionalInstructions: string;
    title: string;
    targetSlug: string;
    primaryKeyword: string;
    secondaryKeywords: string[];
    wordCount: number;
    tone: string;
    audience: string;
    callToAction: string;
    category: string;
    status: GlwPublishingMode;
  };
  promptData: {
    tone: string;
    audience: string;
    callToAction: string;
  };
  seoSettings: {
    targetSlug: string;
    citySlug: string;
    primaryKeyword: string;
    secondaryKeywords: string[];
    category: string;
  };
  publishingSettings: {
    status: GlwPublishingMode;
    wordCount: number;
  };
  imageSettings: {
    generateFeaturedImage: boolean;
    style: string;
  };
  callbackUrl?: string;
};

export type GlwJobError = {
  message: string;
  step?: string;
  code?: string;
};

export type GlwJobResult = {
  executionId: string;
  status: GlwJobStatus;
  hierarchyMode?: GlwHierarchyMode;
  cityParentId?: number;
  targetSlug?: string;
  wordpressParentId?: number;
  wordpressSlug?: string;
  canonicalTargetUrl?: string;
  title?: string;
  wordpressPageId?: string | number;
  wordpressUrl?: string;
  wordpressPostId?: string | number;
  wordpressStatus?: GlwWordpressWorkflowStatus;
  requestedPublishingMode?: GlwPublishingMode;
  n8nExecutionId?: string;
  disposition?: GlwResultDisposition;
  qaChecks?: Partial<GlwQaChecks>;
  qaFailureReasons?: GlwQaFailureReasons;
  featuredImageUrl?: string;
  executionTimeMs?: number;
};

export type GlwJobRecord = {
  id: string;
  type: GlwJobType;
  status: GlwJobStatus;
  retryOfJobId: string | null;
  siteId: string;
  title: string;
  input: GlwPageGenerationJobInput;
  result: GlwJobResult | null;
  error: GlwJobError | null;
  externalExecutionId: string | null;
  operationKey: string | null;
  businessStatus: GlwBusinessStatus | null;
  callbackDeliveryStatus: GlwCallbackDeliveryStatus | null;
  terminalReceiptId: string | null;
  publicationKey: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GlwJobFieldErrors = Partial<Record<keyof GlwPageGenerationRequest, string>>;

export type GlwValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: GlwJobFieldErrors; message: string };

export type GlwPageGenerationCallbackPayload = {
  jobId: string;
  executionId: string;
  status: GlwJobStatus;
  hierarchyMode?: GlwHierarchyMode;
  cityParentId?: number;
  targetSlug?: string;
  wordpressParentId?: number;
  wordpressSlug?: string;
  canonicalTargetUrl?: string;
  callbackVersion?: "2";
  operationKey?: string;
  idempotencyKey?: string;
  terminalScopeKey?: string;
  callbackType?: "PAGE_GENERATION_TERMINAL";
  payloadSha256?: string;
  title?: string;
  wordpressPageId?: string | number;
  wordpressUrl?: string;
  wordpressPostId?: string | number;
  wordpressStatus?: GlwWordpressWorkflowStatus;
  requestedPublishingMode?: GlwPublishingMode;
  disposition?: GlwResultDisposition;
  qaChecks?: Partial<GlwQaChecks>;
  qaFailureReasons?: GlwQaFailureReasons;
  featuredImageUrl?: string;
  executionTimeMs?: number;
  error?: GlwJobError;
};

export type GlwJobRepository = {
  create(data: GlwJobRecord): Promise<GlwJobRecord>;
  update(id: string, changes: Partial<GlwJobRecord>): Promise<GlwJobRecord>;
  findById(id: string): Promise<GlwJobRecord | null>;
  findByOperationKey(operationKey: string): Promise<GlwJobRecord | null>;
  findRecentPageGenerationJobs(limit: number): Promise<GlwJobRecord[]>;
  findPageGenerationJobs(limit: number): Promise<GlwJobRecord[]>;
  findLatestRetryForJob(jobId: string): Promise<GlwJobRecord | null>;
};

export type GlwJobCreateInput = {
  type: GlwJobType;
  status: GlwJobStatus;
  retryOfJobId: string | null;
  siteId: string;
  title: string;
  input: GlwPageGenerationJobInput;
  result: GlwJobResult | null;
  error: GlwJobError | null;
  externalExecutionId: string | null;
  operationKey?: string | null;
  businessStatus?: GlwBusinessStatus | null;
  callbackDeliveryStatus?: GlwCallbackDeliveryStatus | null;
  terminalReceiptId?: string | null;
  publicationKey?: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

export function createGlwJobRecord(input: GlwJobCreateInput): GlwJobRecord {
  const now = new Date().toISOString();

  return {
    id: `glw_${Math.random().toString(36).slice(2, 10)}`,
    ...input,
    retryOfJobId: input.retryOfJobId ?? null,
    result: input.result ?? null,
    error: input.error ?? null,
    externalExecutionId: input.externalExecutionId ?? null,
    operationKey: input.operationKey ?? null,
    businessStatus: input.businessStatus ?? null,
    callbackDeliveryStatus: input.callbackDeliveryStatus ?? null,
    terminalReceiptId: input.terminalReceiptId ?? null,
    publicationKey: input.publicationKey ?? null,
    startedAt: input.startedAt ?? null,
    completedAt: input.completedAt ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

function trimOptional(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizePublishingMode(value: string | undefined): GlwPublishingMode | null {
  if (value === "draft" || value === "publish") {
    return value;
  }

  return null;
}

function normalizeQaCheckState(value: unknown): GlwQaCheckState | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();

  if (normalized === "PASS" || normalized === "FAIL" || normalized === "PENDING" || normalized === "UNKNOWN") {
    return normalized;
  }

  return null;
}

export const GLW_QA_CHECK_KEYS: readonly GlwQaCheckKey[] = [
  "pageExists",
  "hierarchy",
  "slug",
  "title",
  "h1",
  "uniquePrimaryHeading",
  "duplicateSectionHeadings",
  "duplicateSectionContent",
  "placeholderResourceLinks",
  "body",
  "featuredImage",
  "heroImage",
  "seo",
  "internalLinks",
  "imageAlt",
  "duplicateCheck",
];

export const GLW_QA_CONTRACT_VERSION = GLW_QA_CHECK_KEYS.length;
export const GLW_CALLBACK_CONTRACT_VERSION = GLW_QA_CONTRACT_VERSION;

export function normalizeGlwQaChecks(input: unknown): Partial<GlwQaChecks> | undefined {
  if (typeof input !== "object" || input === null) {
    return undefined;
  }

  const source = input as Record<string, unknown>;
  const normalized: Partial<GlwQaChecks> = {};

  for (const key of GLW_QA_CHECK_KEYS) {
    const state = normalizeQaCheckState(source[key]);
    if (state) {
      normalized[key] = state;
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function normalizeGlwQaFailureReasons(input: unknown): GlwQaFailureReasons | undefined {
  if (typeof input !== "object" || input === null) {
    return undefined;
  }

  const source = input as Record<string, unknown>;
  const normalized: GlwQaFailureReasons = {};

  for (const key of GLW_QA_CHECK_KEYS) {
    const value = source[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        normalized[key] = trimmed;
      }
    }
  }

  return normalized;
}

export function getGlwQaChecksForDisplay(result: GlwJobResult | null): GlwQaChecks {
  const checks: GlwQaChecks = {
    pageExists: "UNKNOWN",
    hierarchy: "UNKNOWN",
    slug: "UNKNOWN",
    title: "UNKNOWN",
    h1: "UNKNOWN",
    uniquePrimaryHeading: "UNKNOWN",
    duplicateSectionHeadings: "UNKNOWN",
    duplicateSectionContent: "UNKNOWN",
    placeholderResourceLinks: "UNKNOWN",
    body: "UNKNOWN",
    featuredImage: "UNKNOWN",
    heroImage: "UNKNOWN",
    seo: "UNKNOWN",
    internalLinks: "UNKNOWN",
    imageAlt: "UNKNOWN",
    duplicateCheck: "UNKNOWN",
  };

  const incoming = result?.qaChecks;
  if (!incoming) {
    return checks;
  }

  for (const key of GLW_QA_CHECK_KEYS) {
    const state = normalizeQaCheckState(incoming[key]);
    if (state) {
      checks[key] = state;
    }
  }

  return checks;
}

export function getGlwQaFailureReasonsForDisplay(result: GlwJobResult | null): GlwQaFailureReasons {
  return normalizeGlwQaFailureReasons(result?.qaFailureReasons) ?? {};
}

export function resolveGlwPublishingStatus(job: GlwJobRecord): GlwPublishingMode | null {
  const explicitResultStatus = normalizePublishingMode(job.result?.wordpressStatus);
  if (explicitResultStatus) {
    return explicitResultStatus;
  }

  if (job.status === "COMPLETE") {
    const explicitRequestedStatus = normalizePublishingMode(job.result?.requestedPublishingMode);
    if (explicitRequestedStatus) {
      return explicitRequestedStatus;
    }

    return normalizePublishingMode(job.input?.page?.status);
  }

  return null;
}

function normalizeHierarchicalPath(value: string): string {
  return value
    .trim()
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/")
    .toLowerCase();
}

function normalizeWordpressPageIdentifier(value: string | number | undefined): string | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return String(Math.trunc(value));
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
      return trimmed;
    }
  }

  return null;
}

function isQueryPageUrl(url: URL): boolean {
  return url.searchParams.has("page_id");
}

function buildCanonicalFromHierarchicalSlug(baseUrl: URL, hierarchicalSlug: string): string | null {
  const normalizedPath = normalizeHierarchicalPath(hierarchicalSlug);
  if (!normalizedPath) {
    return null;
  }

  const canonical = new URL(baseUrl.origin);
  canonical.pathname = `/${normalizedPath}/`;
  canonical.search = "";
  canonical.hash = "";
  return canonical.toString();
}

function buildWordpressEditUrl(baseUrl: URL, pageId: string): string {
  const editUrl = new URL(baseUrl.origin);
  editUrl.pathname = "/wp-admin/post.php";
  editUrl.searchParams.set("post", pageId);
  editUrl.searchParams.set("action", "edit");
  return editUrl.toString();
}

export function normalizeGlwWordpressUrlForDisplay(input: {
  wordpressUrl?: string;
  wordpressStatus?: GlwWordpressWorkflowStatus;
  requestedPublishingMode?: GlwPublishingMode;
  wordpressPageId?: string | number;
  hierarchicalSlug?: string;
}): string | null {
  const rawUrl = typeof input.wordpressUrl === "string" ? input.wordpressUrl.trim() : "";
  if (!rawUrl) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  const resolvedStatus = normalizePublishingMode(input.wordpressStatus)
    ?? normalizePublishingMode(input.requestedPublishingMode)
    ?? null;
  const pageId = normalizeWordpressPageIdentifier(input.wordpressPageId);

  if (resolvedStatus === "draft") {
    if (pageId) {
      return buildWordpressEditUrl(parsed, pageId);
    }
    return rawUrl;
  }

  if (resolvedStatus === "publish") {
    if (!isQueryPageUrl(parsed)) {
      return rawUrl;
    }

    const canonical = buildCanonicalFromHierarchicalSlug(parsed, input.hierarchicalSlug ?? "");
    return canonical ?? rawUrl;
  }

  return rawUrl;
}

export function resolveGlwPrimaryOpenUrl(job: GlwJobRecord): string | null {
  return normalizeGlwWordpressUrlForDisplay({
    wordpressUrl: job.result?.wordpressUrl,
    wordpressStatus: job.result?.wordpressStatus,
    requestedPublishingMode: job.result?.requestedPublishingMode,
    wordpressPageId: job.result?.wordpressPageId ?? job.result?.wordpressPostId,
    hierarchicalSlug: job.input.page.hierarchicalSlug,
  });
}

export function resolveGlwPrimaryOpenLabel(job: GlwJobRecord): "Open Page" | "Open Draft" | null {
  const publishingStatus = resolveGlwPublishingStatus(job);
  if (publishingStatus === "publish") {
    return "Open Page";
  }

  if (publishingStatus === "draft") {
    return "Open Draft";
  }

  return null;
}

function normalizePageType(value: string | undefined): GlwPageType | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase().replace(/-/g, "_");

  return glwPageTypes.includes(normalized as GlwPageType)
    ? normalized as GlwPageType
    : null;
}

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function deriveCitySlugFromCity(city: string): string {
  return normalizeSlug(city);
}

export function pageTypeRequiresCity(pageType: GlwPageType): boolean {
  return pageType === "city_service";
}

export function validatePageGenerationRequest(
  input: Partial<GlwPageGenerationRequest> | Record<string, unknown>,
): GlwValidationResult<GlwPageGenerationRequest> {
  const errors: GlwJobFieldErrors = {};
  const allowedFields = new Set([
    "siteId", "workspaceId", "hierarchyMode", "cityParentId", "pageType", "productTopic", "state", "city",
    "citySlug", "hierarchicalSlug", "additionalInstructions", "title", "targetSlug", "primaryKeyword",
    "secondaryKeywords", "wordCount", "tone", "audience", "callToAction", "category", "status", "publishingMode",
  ]);
  const unknownFields = Object.keys(input).filter((field) => !allowedFields.has(field));

  if (unknownFields.length > 0) {
    return {
      ok: false,
      errors,
      message: `Unknown request fields: ${unknownFields.sort().join(", ")}`,
    };
  }

  const siteId = typeof input.siteId === "string" ? input.siteId.trim() : "";
  const workspaceId = typeof input.workspaceId === "string" ? input.workspaceId.trim() : "";
  const hierarchyModeInput = typeof input.hierarchyMode === "string" ? input.hierarchyMode.trim() : "";
  const hierarchyMode: GlwHierarchyMode | null = hierarchyModeInput === "legacy_city_page"
    ? "legacy_city_page"
    : hierarchyModeInput === "city_child_target"
      ? "city_child_target"
      : null;
  const cityParentId = typeof input.cityParentId === "number"
    ? input.cityParentId
    : typeof input.cityParentId === "string"
      ? Number(input.cityParentId)
      : Number.NaN;
  const pageType = normalizePageType(typeof input.pageType === "string" ? input.pageType : undefined);
  const productTopic = typeof input.productTopic === "string" ? input.productTopic.trim() : "";
  const state = typeof input.state === "string" ? input.state.trim() : "";
  const city = typeof input.city === "string" ? input.city.trim() : "";
  const citySlugInput = typeof input.citySlug === "string" ? input.citySlug.trim() : "";
  const hierarchicalSlug = typeof input.hierarchicalSlug === "string" ? input.hierarchicalSlug.trim() : "";
  const additionalInstructions = typeof input.additionalInstructions === "string" ? input.additionalInstructions.trim() : "";
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const targetSlugInput = typeof input.targetSlug === "string" ? input.targetSlug.trim() : "";
  const targetSlug = targetSlugInput || hierarchicalSlug;
  const citySlug = citySlugInput || deriveCitySlugFromCity(city);
  const primaryKeyword = typeof input.primaryKeyword === "string" ? input.primaryKeyword.trim() : "";
  const secondaryKeywords = Array.isArray(input.secondaryKeywords)
    ? input.secondaryKeywords
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean)
    : typeof input.secondaryKeywords === "string"
      ? input.secondaryKeywords.split(",").map((value) => value.trim()).filter(Boolean)
      : [];
  const wordCount = typeof input.wordCount === "number"
    ? input.wordCount
    : typeof input.wordCount === "string"
      ? Number(input.wordCount)
      : NaN;
  const tone = typeof input.tone === "string" ? input.tone.trim() : "";
  const audience = typeof input.audience === "string" ? input.audience.trim() : "";
  const callToAction = typeof input.callToAction === "string" ? input.callToAction.trim() : "";
  const category = typeof input.category === "string" ? input.category.trim() : "";
  const status = normalizePublishingMode(
    typeof input.status === "string"
      ? input.status.trim()
      : typeof (input as { publishingMode?: unknown }).publishingMode === "string"
        ? ((input as { publishingMode: string }).publishingMode).trim()
        : undefined,
  );

  if (!siteId) {
    errors.siteId = "Site is required.";
  } else if (!getGlwSite(siteId)) {
    errors.siteId = "Select a valid GLW site.";
  }

  if (!workspaceId) {
    errors.workspaceId = "Workspace is required.";
  }

  if (!hierarchyMode) {
    errors.hierarchyMode = "UNKNOWN_HIERARCHY_MODE";
  }

  if (hierarchyMode === "legacy_city_page" && input.cityParentId !== undefined && input.cityParentId !== "") {
    errors.cityParentId = "Legacy city-page requests must not provide cityParentId.";
  }

  if (hierarchyMode === "city_child_target" && (!Number.isInteger(cityParentId) || cityParentId <= 0)) {
    errors.cityParentId = "MISSING_CITY_PARENT_IDENTITY";
  }

  if (!pageType) {
    errors.pageType = "Page type is required.";
  }

  if (!productTopic) {
    errors.productTopic = "Product or topic is required.";
  }

  if (!state) {
    errors.state = "State is required.";
  }

  if (!hierarchicalSlug) {
    errors.hierarchicalSlug = "Desired hierarchical slug is required.";
  }

  if (hierarchicalSlug && !/^[-a-z0-9/]+$/.test(hierarchicalSlug)) {
    errors.hierarchicalSlug = "Hierarchical slug must use lowercase letters, numbers, hyphens, and slashes only.";
  }

  if (citySlug && !/^[-a-z0-9]+$/.test(citySlug)) {
    errors.citySlug = "City slug must use lowercase letters, numbers, and hyphens only.";
  }

  const normalizedStateSlug = normalizeSlug(state);
  if (state && city && normalizeSlug(city) === normalizedStateSlug) {
    errors.city = "INVALID_CANONICAL_TARGET: City must differ from state for production targets.";
    errors.citySlug = "INVALID_CANONICAL_TARGET: City slug must differ from the state slug for production targets.";
  }

  if (citySlug && normalizedStateSlug && citySlug === normalizedStateSlug) {
    errors.citySlug = "INVALID_CANONICAL_TARGET: City slug must differ from the state slug for production targets.";
  }

  if (pageType && pageTypeRequiresCity(pageType)) {
    if (!city) {
      errors.city = "City is required for city pages.";
    }

    if (!citySlug) {
      errors.citySlug = "City slug is required for city pages.";
    }
  }

  if (!title) {
    errors.title = "Title is required.";
  }

  if (!targetSlug) {
    errors.targetSlug = "Target URL slug is required.";
  }

  if (!/^[-a-z0-9]+$/.test(targetSlug)) {
    errors.targetSlug = "Slug must contain only lowercase letters, numbers, and hyphens.";
  }

  if (hierarchyMode === "city_child_target" && citySlug && targetSlug === citySlug) {
    errors.targetSlug = "City-child targetSlug must differ from citySlug.";
  }

  const hierarchyParts = hierarchicalSlug.split("/").filter(Boolean);
  if (hierarchyMode === "city_child_target" && (hierarchyParts.length !== 4 || hierarchyParts[2] !== citySlug || hierarchyParts[3] !== targetSlug)) {
    errors.hierarchicalSlug = "City-child hierarchy must contain product/state/city/target with matching citySlug and targetSlug.";
  }

  if (!category) {
    errors.category = "Category is required.";
  }

  if (!primaryKeyword) {
    errors.primaryKeyword = "Primary keyword is required.";
  }

  if (secondaryKeywords.length === 0) {
    errors.secondaryKeywords = "At least one secondary keyword is required.";
  }

  if (!Number.isFinite(wordCount) || wordCount < 300 || wordCount > 5000) {
    errors.wordCount = "Word count must be between 300 and 5000.";
  }

  if (!tone) {
    errors.tone = "Tone is required.";
  }

  if (!audience) {
    errors.audience = "Audience is required.";
  }

  if (!callToAction) {
    errors.callToAction = "Call-to-action is required.";
  }

  if (!status) {
    errors.status = "Status is required.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      ok: false,
      errors,
      message: Object.values(errors).some((value) => typeof value === "string" && value.includes("INVALID_CANONICAL_TARGET"))
        ? "INVALID_CANONICAL_TARGET"
        : "Please fix the highlighted fields and try again.",
    };
  }

  return {
    ok: true,
    value: {
      siteId,
      workspaceId,
      hierarchyMode: hierarchyMode as GlwHierarchyMode,
      cityParentId: hierarchyMode === "city_child_target" ? cityParentId : undefined,
      pageType: pageType as GlwPageType,
      productTopic,
      state,
      city,
      citySlug,
      hierarchicalSlug,
      additionalInstructions,
      title,
      targetSlug,
      primaryKeyword,
      secondaryKeywords,
      wordCount,
      tone,
      audience,
      callToAction,
      category,
      status: status as GlwPublishingMode,
    },
  };
}

export function parsePageGenerationFormData(formData: FormData): GlwValidationResult<GlwPageGenerationRequest> {
  return validatePageGenerationRequest({
    siteId: trimOptional(formData.get("siteId")) ?? "",
    workspaceId: trimOptional(formData.get("workspaceId")) ?? "",
    hierarchyMode: trimOptional(formData.get("hierarchyMode")) ?? "",
    cityParentId: trimOptional(formData.get("cityParentId")) ?? "",
    pageType: trimOptional(formData.get("pageType")) ?? "",
    productTopic: trimOptional(formData.get("productTopic")) ?? "",
    state: trimOptional(formData.get("state")) ?? "",
    city: trimOptional(formData.get("city")) ?? "",
    citySlug: trimOptional(formData.get("citySlug")) ?? "",
    hierarchicalSlug: trimOptional(formData.get("hierarchicalSlug")) ?? "",
    additionalInstructions: trimOptional(formData.get("additionalInstructions")) ?? "",
    title: trimOptional(formData.get("title")) ?? "",
    targetSlug: trimOptional(formData.get("targetSlug")) ?? "",
    primaryKeyword: trimOptional(formData.get("primaryKeyword")) ?? "",
    secondaryKeywords: trimOptional(formData.get("secondaryKeywords")) ?? "",
    wordCount: trimOptional(formData.get("wordCount")) ?? "",
    tone: trimOptional(formData.get("tone")) ?? "",
    audience: trimOptional(formData.get("audience")) ?? "",
    callToAction: trimOptional(formData.get("callToAction")) ?? "",
    category: trimOptional(formData.get("category")) ?? "",
    status: trimOptional(formData.get("status")) ?? "",
  });
}

export function buildGlwPageTitle(request: GlwPageGenerationRequest): string {
  return request.title;
}

export function getGlwLocationLabel(request: { targetSlug?: string }): string {
  return request.targetSlug || "Unspecified";
}

export function createGlwJobInput(
  request: GlwPageGenerationRequest,
  callbackUrl?: string,
): GlwPageGenerationJobInput {
  const site = getGlwSite(CANONICAL_GLW_SITE_ID);

  if (!site) {
    throw new Error(`Unknown GLW site: ${CANONICAL_GLW_SITE_ID}`);
  }

  return {
    type: "page_generation",
    site: {
      id: site.id,
      name: site.name,
    },
    page: {
      workspaceId: request.workspaceId,
      hierarchyMode: request.hierarchyMode,
      cityParentId: request.cityParentId ?? null,
      pageType: request.pageType,
      productTopic: request.productTopic,
      state: request.state,
      city: request.city,
      citySlug: request.citySlug,
      hierarchicalSlug: request.hierarchicalSlug,
      additionalInstructions: request.additionalInstructions,
      title: request.title,
      targetSlug: request.targetSlug,
      primaryKeyword: request.primaryKeyword,
      secondaryKeywords: request.secondaryKeywords,
      wordCount: request.wordCount,
      tone: request.tone,
      audience: request.audience,
      callToAction: request.callToAction,
      category: request.category,
      status: request.status,
    },
    promptData: {
      tone: request.tone,
      audience: request.audience,
      callToAction: request.callToAction,
    },
    seoSettings: {
      targetSlug: request.targetSlug,
      citySlug: request.citySlug,
      primaryKeyword: request.primaryKeyword,
      secondaryKeywords: request.secondaryKeywords,
      category: request.category,
    },
    publishingSettings: {
      status: request.status,
      wordCount: request.wordCount,
    },
    imageSettings: {
      generateFeaturedImage: true,
      style: "editorial",
    },
    callbackUrl,
  };
}

export function isTerminalGlwJobStatus(status: GlwJobStatus): boolean {
  return status === "COMPLETE" || status === "FAILED_QA" || status === "FAILED";
}

export function canTransitionGlwJobStatus(current: GlwJobStatus, next: GlwJobStatus): boolean {
  if (current === next) {
    return true;
  }

  if (current === "COMPLETE") {
    return false;
  }

  if (current === "FAILED_QA" || current === "FAILED") {
    return false;
  }

  if (next === "FAILED_QA" || next === "FAILED") {
    return true;
  }

  if (next === "COMPLETE") {
    return true;
  }

  return glwJobStatusOrder[next] >= glwJobStatusOrder[current];
}

export function normalizeGlwJobStatus(value: string): GlwJobStatus | null {
  const normalized = value.trim().toUpperCase();

  return glwJobStatuses.includes(normalized as GlwJobStatus)
    ? (normalized as GlwJobStatus)
    : null;
}

export function normalizeGlwWordpressWorkflowStatus(value: unknown): GlwWordpressWorkflowStatus | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "draft" || normalized === "publish" || normalized === "qa_failed") {
    return normalized;
  }

  return undefined;
}

export function normalizeGlwJobError(error: unknown, fallbackStep = "workflow"): GlwJobError {
  if (typeof error === "object" && error !== null) {
    const maybeError = error as Partial<GlwJobError> & { message?: unknown };

    if (typeof maybeError.message === "string" && maybeError.message.trim().length > 0) {
      return {
        message: maybeError.message,
        step: typeof maybeError.step === "string" ? maybeError.step : fallbackStep,
        code: typeof maybeError.code === "string" ? maybeError.code : undefined,
      };
    }
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      step: fallbackStep,
    };
  }

  return {
    message: "The page generation workflow failed.",
    step: fallbackStep,
  };
}

export function toJsonValue<T>(value: T): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function parseGlwJobRecord(record: {
  id: string;
  type: GlwJobType;
  status: GlwJobStatus;
  retryOfJobId: string | null;
  siteId: string;
  title: string;
  input: Prisma.JsonValue;
  result: Prisma.JsonValue | null;
  error: Prisma.JsonValue | null;
  externalExecutionId: string | null;
  operationKey?: string | null;
  businessStatus?: GlwBusinessStatus | null;
  callbackDeliveryStatus?: GlwCallbackDeliveryStatus | null;
  terminalReceiptId?: string | null;
  publicationKey?: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): GlwJobRecord {
  return {
    id: record.id,
    type: record.type,
    status: record.status,
    retryOfJobId: record.retryOfJobId,
    siteId: record.siteId,
    title: record.title,
    input: record.input as GlwPageGenerationJobInput,
    result: record.result ? (record.result as GlwJobResult) : null,
    error: record.error ? (record.error as GlwJobError) : null,
    externalExecutionId: record.externalExecutionId,
    operationKey: record.operationKey ?? null,
    businessStatus: record.businessStatus ?? null,
    callbackDeliveryStatus: record.callbackDeliveryStatus ?? null,
    terminalReceiptId: record.terminalReceiptId ?? null,
    publicationKey: record.publicationKey ?? null,
    startedAt: record.startedAt?.toISOString() ?? null,
    completedAt: record.completedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function formatGlwJobDuration(job: GlwJobRecord, now = new Date()): string {
  if (!job.startedAt) {
    return "--";
  }

  const startedAt = new Date(job.startedAt).getTime();
  const endAt = job.completedAt ? new Date(job.completedAt).getTime() : now.getTime();
  const elapsedMs = Math.max(0, endAt - startedAt);

  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export const GLW_JOB_TIMEOUT_MS = 30 * 60 * 1000;

export type GlwJobTimelineState = "complete" | "active" | "pending" | "failed";

export type GlwJobTimelineEntry = {
  key: string;
  label: string;
  state: GlwJobTimelineState;
  timestamp: string | null;
  duration: string;
};

export type GlwJobOperatorSnapshot = {
  displayStatus: string;
  currentStage: string;
  currentWorkflowStep: string;
  progressPercent: number;
  estimatedRemainingText: string | null;
  timedOut: boolean;
  timeline: GlwJobTimelineEntry[];
};

const glwTimelineStages = [
  "Request Accepted",
  "Job Created",
  "Prompt Built",
  "AI Content Generated",
  "SEO Generated",
  "Images Generated",
  "Images Uploaded",
  "Draft Created",
  "Yoast Updated",
  "Callback Received",
  "Database Updated",
  "Completed",
] as const;

function formatGlwDurationMs(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return "--";
  }

  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function formatGlwTimestamp(timestampMs: number): string {
  return new Date(timestampMs).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function isGlwJobTimedOut(job: GlwJobRecord, now: Date, timeoutMs: number): boolean {
  if (job.status === "COMPLETE" || job.status === "FAILED_QA" || job.status === "FAILED") {
    return false;
  }

  if (!job.startedAt) {
    return false;
  }

  return now.getTime() - new Date(job.startedAt).getTime() > timeoutMs;
}

function statusToProgressPercent(job: GlwJobRecord, timedOut: boolean): number {
  if (timedOut) {
    return 92;
  }

  switch (job.status) {
    case "QUEUED":
      return 12;
    case "STARTING":
      return 22;
    case "RUNNING":
      return 34;
    case "GENERATING_CONTENT":
      return 46;
    case "GENERATING_IMAGE":
      return 60;
    case "UPLOADING_IMAGE":
      return 74;
    case "PUBLISHING":
      return 86;
    case "COMPLETE":
      return 100;
    case "FAILED_QA":
    case "FAILED":
    default:
      return 100;
  }
}

function statusToCurrentStage(job: GlwJobRecord, timedOut: boolean): string {
  if (timedOut) {
    return "Timed Out";
  }

  switch (job.status) {
    case "QUEUED":
      return "Queued";
    case "STARTING":
      return "Preparing Prompt";
    case "RUNNING":
      return "Generating Content";
    case "GENERATING_CONTENT":
      return "Generating Content";
    case "GENERATING_IMAGE":
      return "Generating Images";
    case "UPLOADING_IMAGE":
      return "Uploading Media";
    case "PUBLISHING":
      return "Publishing Draft";
    case "COMPLETE":
      return "Completed";
    case "FAILED_QA":
      return "QA Failed";
    case "FAILED":
    default:
      return "Failed";
  }
}

function statusToWorkflowStep(job: GlwJobRecord, timedOut: boolean): string {
  if (timedOut) {
    return "Waiting beyond the running timeout window.";
  }

  switch (job.status) {
    case "QUEUED":
      return "Waiting to start the page workflow.";
    case "STARTING":
      return "Building the generation prompt.";
    case "RUNNING":
      return "Generating the main page content.";
    case "GENERATING_CONTENT":
      return "Generating the main page content.";
    case "GENERATING_IMAGE":
      return "Creating the page imagery.";
    case "UPLOADING_IMAGE":
      return "Uploading the generated media.";
    case "PUBLISHING":
      return "Publishing the page and metadata.";
    case "COMPLETE":
      {
        const publishingStatus = resolveGlwPublishingStatus(job);

        if (publishingStatus === "publish") {
          return "Published";
        }

        if (publishingStatus === "draft") {
          return "Draft Created";
        }

        return "Workflow completed successfully.";
      }
    case "FAILED_QA":
      return job.error?.message ?? "Pre-publish QA gate failed.";
    case "FAILED":
    default:
      return job.error?.step ?? "Workflow failed.";
  }
}

function statusToTimelineIndex(job: GlwJobRecord, timedOut: boolean): number {
  if (timedOut) {
    return glwTimelineStages.length - 1;
  }

  switch (job.status) {
    case "QUEUED":
      return 2;
    case "STARTING":
      return 3;
    case "RUNNING":
      return 4;
    case "GENERATING_CONTENT":
      return 4;
    case "GENERATING_IMAGE":
      return 5;
    case "UPLOADING_IMAGE":
      return 6;
    case "PUBLISHING":
      return 8;
    case "COMPLETE":
      return glwTimelineStages.length - 1;
    case "FAILED_QA":
    case "FAILED":
    default:
      if (job.error?.step) {
        const step = job.error.step.toLowerCase();

        if (step.includes("prompt")) return 2;
        if (step.includes("content") || step.includes("copy")) return 3;
        if (step.includes("seo")) return 4;
        if (step.includes("image") && step.includes("upload")) return 6;
        if (step.includes("image")) return 5;
        if (step.includes("draft") || step.includes("publish")) return 7;
        if (step.includes("yoast") || step.includes("metadata")) return 8;
        if (step.includes("callback")) return 9;
        if (step.includes("database") || step.includes("persist")) return 10;
      }

      return 4;
  }
}

function buildGlwTimeline(job: GlwJobRecord, now: Date, timedOut: boolean): GlwJobTimelineEntry[] {
  const startMs = new Date(job.startedAt ?? job.createdAt).getTime();
  const endMs = job.completedAt ? new Date(job.completedAt).getTime() : now.getTime();
  const totalMs = Math.max(0, endMs - startMs);
  const stageCount = glwTimelineStages.length;
  const stageDuration = stageCount > 1 ? totalMs / (stageCount - 1) : 0;
  const activeIndex = statusToTimelineIndex(job, timedOut);

  return glwTimelineStages.map((label, index) => {
    const timestampMs = stageCount > 1 ? startMs + stageDuration * index : startMs;
    const timestamp = index <= activeIndex || job.status === "COMPLETE" || job.status === "FAILED_QA" || job.status === "FAILED" || timedOut
      ? formatGlwTimestamp(timestampMs)
      : null;

    let state: GlwJobTimelineState = "pending";

    if (index < activeIndex) {
      state = "complete";
    } else if (index === activeIndex) {
      state = job.status === "FAILED_QA" || job.status === "FAILED" || timedOut ? "failed" : index === stageCount - 1 ? "complete" : "active";
    }

    return {
      key: `${job.id}-${label}`,
      label,
      state,
      timestamp,
      duration: index === 0 || !timestamp ? "--" : formatGlwDurationMs(stageDuration),
    };
  });
}

export function getGlwJobOperatorSnapshot(
  job: GlwJobRecord,
  now = new Date(),
  timeoutMs = GLW_JOB_TIMEOUT_MS,
): GlwJobOperatorSnapshot {
  const timedOut = isGlwJobTimedOut(job, now, timeoutMs);

  return {
    displayStatus: timedOut ? "Timed Out" : job.status.replaceAll("_", " "),
    currentStage: statusToCurrentStage(job, timedOut),
    currentWorkflowStep: statusToWorkflowStep(job, timedOut),
    progressPercent: statusToProgressPercent(job, timedOut),
    estimatedRemainingText: timedOut || job.status === "COMPLETE" || job.status === "FAILED_QA" || job.status === "FAILED" || !job.startedAt
      ? null
      : (() => {
          const elapsedMs = now.getTime() - new Date(job.startedAt).getTime();
          const progress = Math.max(0.05, Math.min(0.95, statusToProgressPercent(job, timedOut) / 100));
          const remainingMs = Math.max(0, Math.round((elapsedMs / progress) - elapsedMs));

          if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
            return null;
          }

          return `~${formatGlwDurationMs(remainingMs)} left`;
        })(),
    timedOut,
    timeline: buildGlwTimeline(job, now, timedOut),
  };
}

export function getGlwJobTimeline(job: GlwJobRecord, now = new Date(), timeoutMs = GLW_JOB_TIMEOUT_MS): GlwJobTimelineEntry[] {
  return getGlwJobOperatorSnapshot(job, now, timeoutMs).timeline;
}

export function formatGlwJobCreatedTime(job: GlwJobRecord): string {
  return new Date(job.createdAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function toRecentPageGenerationJobRow(job: GlwJobRecord, now = new Date()) {
  return {
    id: job.id,
    status: job.status,
    type: job.input.type === "page_generation" ? "Page" : "Blog",
    product: job.input.page.title,
    primaryKeyword: job.input.page.primaryKeyword,
    site: job.input.site.name,
    location: job.input.page.targetSlug,
    title: job.title,
    created: formatGlwJobCreatedTime(job),
    duration: formatGlwJobDuration(job, now),
    actionLabel: job.status === "FAILED" || job.status === "FAILED_QA" ? "Retry" : job.status === "COMPLETE" ? "Open" : "View",
  };
}

export function getPageGenerationJobsSubtitle(count: number): string {
  return count === 1 ? "1 recent page-generation job" : `${count} recent page-generation jobs`;
}

export function siteOptions(): Array<{ value: string; label: string; region: string }> {
  return glwSites.map((site) => ({ value: site.id, label: site.name, region: site.region }));
}

export function isActiveGlwStatus(status: GlwJobStatus): boolean {
  return (
    status === "QUEUED" ||
    status === "STARTING" ||
    status === "RUNNING" ||
    status === "GENERATING_CONTENT" ||
    status === "GENERATING_IMAGE" ||
    status === "UPLOADING_IMAGE" ||
    status === "PUBLISHING"
  );
}

export type GlwJobFilter = "all" | "active" | "complete" | "failed";

export function matchesGlwJobFilter(status: GlwJobStatus, filter: GlwJobFilter): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "active") {
    return isActiveGlwStatus(status);
  }

  if (filter === "complete") {
    return status === "COMPLETE";
  }

  return status === "FAILED_QA" || status === "FAILED";
}

export function describeOperatorSafeError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}
