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
  "FAILED",
] as const;
export type GlwJobStatus = (typeof glwJobStatuses)[number];

export const glwJobStatusOrder: Record<GlwJobStatus, number> = {
  QUEUED: 0,
  STARTING: 1,
  RUNNING: 2,
  GENERATING_CONTENT: 3,
  GENERATING_IMAGE: 4,
  UPLOADING_IMAGE: 5,
  PUBLISHING: 6,
  COMPLETE: 7,
  FAILED: 7,
};

export type GlwPublishingMode = "draft" | "publish";

export type GlwPageGenerationRequest = {
  siteId: string;
  product: string;
  category: string;
  state?: string;
  city?: string;
  primaryKeyword: string;
  additionalInstructions?: string;
  publishingMode: GlwPublishingMode;
};

export type GlwPageGenerationJobInput = {
  type: "page_generation";
  site: {
    id: string;
    name: string;
  };
  page: {
    product: string;
    category: string;
    state?: string;
    city?: string;
    primaryKeyword: string;
    additionalInstructions?: string;
    publishingMode: GlwPublishingMode;
    wordCount: number;
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
  title?: string;
  wordpressUrl?: string;
  wordpressPostId?: string | number;
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
  title?: string;
  wordpressUrl?: string;
  wordpressPostId?: string | number;
  error?: GlwJobError;
};

export type GlwJobRepository = {
  create(data: GlwJobRecord): Promise<GlwJobRecord>;
  update(id: string, changes: Partial<GlwJobRecord>): Promise<GlwJobRecord>;
  findById(id: string): Promise<GlwJobRecord | null>;
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

export function validatePageGenerationRequest(
  input: Partial<GlwPageGenerationRequest> | Record<string, unknown>,
): GlwValidationResult<GlwPageGenerationRequest> {
  const errors: GlwJobFieldErrors = {};

  const siteId = typeof input.siteId === "string" ? input.siteId.trim() : "";
  const product = typeof input.product === "string" ? input.product.trim() : "";
  const category = typeof input.category === "string" ? input.category.trim() : "";
  const state = typeof input.state === "string" ? input.state.trim() : undefined;
  const city = typeof input.city === "string" ? input.city.trim() : undefined;
  const primaryKeyword = typeof input.primaryKeyword === "string" ? input.primaryKeyword.trim() : "";
  const additionalInstructions = typeof input.additionalInstructions === "string"
    ? input.additionalInstructions.trim()
    : undefined;
  const publishingMode = normalizePublishingMode(
    typeof input.publishingMode === "string" ? input.publishingMode.trim() : undefined,
  );

  if (!siteId) {
    errors.siteId = "Site is required.";
  } else if (!getGlwSite(siteId)) {
    errors.siteId = "Select a valid GLW site.";
  }

  if (!product) {
    errors.product = "Product is required.";
  }

  if (!category) {
    errors.category = "Category is required.";
  }

  if (!primaryKeyword) {
    errors.primaryKeyword = "Primary keyword is required.";
  }

  if (!publishingMode) {
    errors.publishingMode = "Publishing mode is required.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      ok: false,
      errors,
      message: "Please fix the highlighted fields and try again.",
    };
  }

  return {
    ok: true,
    value: {
      siteId,
      product,
      category,
      state,
      city,
      primaryKeyword,
      additionalInstructions,
      publishingMode: publishingMode as GlwPublishingMode,
    },
  };
}

export function parsePageGenerationFormData(formData: FormData): GlwValidationResult<GlwPageGenerationRequest> {
  return validatePageGenerationRequest({
    siteId: trimOptional(formData.get("siteId")) ?? "",
    product: trimOptional(formData.get("product")) ?? "",
    category: trimOptional(formData.get("category")) ?? "",
    state: trimOptional(formData.get("state")),
    city: trimOptional(formData.get("city")),
    primaryKeyword: trimOptional(formData.get("primaryKeyword")) ?? "",
    additionalInstructions: trimOptional(formData.get("additionalInstructions")),
    publishingMode: trimOptional(formData.get("publishingMode")) ?? "",
  });
}

export function buildGlwPageTitle(request: GlwPageGenerationRequest): string {
  const location = [request.city, request.state].filter(Boolean).join(", ");

  if (location) {
    return `${request.product} - ${request.category} in ${location}`;
  }

  return `${request.product} - ${request.category}`;
}

export function getGlwLocationLabel(request: GlwPageGenerationRequest): string {
  const location = [request.city, request.state].filter(Boolean).join(", ");

  return location || "Unspecified";
}

export function createGlwJobInput(
  request: GlwPageGenerationRequest,
  callbackUrl?: string,
): GlwPageGenerationJobInput {
  const site = getGlwSite(request.siteId);

  if (!site) {
    throw new Error(`Unknown GLW site: ${request.siteId}`);
  }

  return {
    type: "page_generation",
    site: {
      id: site.id,
      name: site.name,
    },
    page: {
      product: request.product,
      category: request.category,
      state: request.state,
      city: request.city,
      primaryKeyword: request.primaryKeyword,
      additionalInstructions: request.additionalInstructions,
      publishingMode: request.publishingMode,
      wordCount: 1500,
    },
    callbackUrl,
  };
}

export function isTerminalGlwJobStatus(status: GlwJobStatus): boolean {
  return status === "COMPLETE" || status === "FAILED";
}

export function canTransitionGlwJobStatus(current: GlwJobStatus, next: GlwJobStatus): boolean {
  if (current === next) {
    return true;
  }

  if (current === "COMPLETE") {
    return false;
  }

  if (current === "FAILED") {
    return false;
  }

  if (next === "FAILED") {
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
    product: job.input.page.product,
    primaryKeyword: job.input.page.primaryKeyword,
    site: job.input.site.name,
    location: getGlwLocationLabel(job.input.page),
    title: job.title,
    created: formatGlwJobCreatedTime(job),
    duration: formatGlwJobDuration(job, now),
    actionLabel: job.status === "FAILED" ? "Retry" : job.status === "COMPLETE" ? "Open" : "View",
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

  return status === "FAILED";
}

export function describeOperatorSafeError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}
