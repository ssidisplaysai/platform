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
  title?: string;
  wordpressPageId?: string | number;
  wordpressUrl?: string;
  wordpressPostId?: string | number;
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
  wordpressPageId?: string | number;
  wordpressUrl?: string;
  wordpressPostId?: string | number;
  featuredImageUrl?: string;
  executionTimeMs?: number;
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
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const targetSlug = typeof input.targetSlug === "string" ? input.targetSlug.trim() : "";
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

  if (!title) {
    errors.title = "Title is required.";
  }

  if (!targetSlug) {
    errors.targetSlug = "Target URL slug is required.";
  }

  if (!/^[-a-z0-9]+$/.test(targetSlug)) {
    errors.targetSlug = "Slug must contain only lowercase letters, numbers, and hyphens.";
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
      message: "Please fix the highlighted fields and try again.",
    };
  }

  return {
    ok: true,
    value: {
      siteId,
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
  "WordPress Draft Created",
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

function isGlwJobTimedOut(job: GlwJobRecord, now: Date, timeoutMs: number): boolean {
  if (job.status === "COMPLETE" || job.status === "FAILED") {
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
      return "Publishing the WordPress draft and metadata.";
    case "COMPLETE":
      return "Workflow completed successfully.";
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
    const timestamp = index <= activeIndex || job.status === "COMPLETE" || job.status === "FAILED" || timedOut
      ? formatGlwTimestamp(timestampMs)
      : null;

    let state: GlwJobTimelineState = "pending";

    if (index < activeIndex) {
      state = "complete";
    } else if (index === activeIndex) {
      state = job.status === "FAILED" || timedOut ? "failed" : index === stageCount - 1 ? "complete" : "active";
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
    estimatedRemainingText: timedOut || job.status === "COMPLETE" || job.status === "FAILED" || !job.startedAt
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
