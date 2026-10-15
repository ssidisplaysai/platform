import { timingSafeEqual } from "node:crypto";
import {
  createGlwDraftExecutionService,
  type GlwGeneratedDraftArtifact,
  type GlwN8nDraftDispatcher,
  type GlwN8nDraftResponse,
  type GlwPageExecutionRecord,
  type GlwPageExecutionRepository,
} from "./page-execution";

export const GLW_N8N_RECONNECT_ENABLED_ENV = "GLW_N8N_RECONNECT_ENABLED";
export const GLW_N8N_NON_MUTATING_TEST_ENV = "GLW_N8N_NON_MUTATING_TEST";
export const GLW_N8N_CALLBACK_SECRET_ENV = "GLW_N8N_CALLBACK_SECRET";

type ReconnectStatus = "RUNNING" | "CONTENT_READY" | "COMPLETE" | "FAILED";

export type GlwReconnectCallbackPayload = {
  jobId?: unknown;
  id?: unknown;
  executionId?: unknown;
  status?: unknown;
  siteId?: unknown;
  organizationId?: unknown;
  wordpressObjectId?: unknown;
  wordpressPageId?: unknown;
  wordpressPostId?: unknown;
  wordpressUrl?: unknown;
  generatedDraft?: unknown;
  generated_draft?: unknown;
  page_title?: unknown;
  article_html?: unknown;
  hierarchical_slug?: unknown;
  requested_publishing_mode?: unknown;
  qa_disposition?: unknown;
  error?: unknown;
};

export type ApplyReconnectCallbackInput = {
  authorizationHeader: string | null;
  payload: GlwReconnectCallbackPayload;
  repository: GlwPageExecutionRepository;
  environment?: NodeJS.ProcessEnv;
};

export type ReconnectCallbackResult = {
  ok: boolean;
  code: string;
  status: number;
  job?: GlwPageExecutionRecord;
};

function getEnv(environment?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return environment ?? process.env;
}

export function isGlwN8nReconnectEnabled(environment?: NodeJS.ProcessEnv): boolean {
  return getEnv(environment)[GLW_N8N_RECONNECT_ENABLED_ENV] === "true";
}

export function isGlwN8nNonMutatingTestMode(environment?: NodeJS.ProcessEnv): boolean {
  return getEnv(environment)[GLW_N8N_NON_MUTATING_TEST_ENV] === "true";
}

function resolveCallbackSecret(environment?: NodeJS.ProcessEnv): string {
  return getEnv(environment)[GLW_N8N_CALLBACK_SECRET_ENV]?.trim() ?? "";
}

function safeCompare(expected: string, received: string): boolean {
  try {
    const expectedBuffer = Buffer.from(expected, "utf8");
    const receivedBuffer = Buffer.from(received, "utf8");
    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }
    return timingSafeEqual(expectedBuffer, receivedBuffer);
  } catch {
    return false;
  }
}

function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return null;
  const token = header.slice(prefix.length).trim();
  return token.length > 0 ? token : null;
}

export function isGlwN8nCallbackAuthorized(input: {
  authorizationHeader: string | null;
  environment?: NodeJS.ProcessEnv;
}): boolean {
  const secret = resolveCallbackSecret(input.environment);
  if (!secret) return false;
  const received = bearerToken(input.authorizationHeader);
  if (!received) return false;
  return safeCompare(secret, received);
}

function normalizeStatus(value: unknown): ReconnectStatus | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === "RUNNING" || normalized === "GENERATING_CONTENT" || normalized === "GENERATING_IMAGE" || normalized === "UPLOADING_IMAGE" || normalized === "PUBLISHING") {
    return "RUNNING";
  }
  if (normalized === "CONTENT_READY") return "CONTENT_READY";
  if (normalized === "COMPLETE") return "COMPLETE";
  if (normalized === "FAILED" || normalized === "FAILED_QA") return "FAILED";
  return null;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function resolveJobId(payload: GlwReconnectCallbackPayload): string {
  return optionalString(payload.jobId) ?? optionalString(payload.id) ?? "";
}

function hasWordPressAuthorityFields(payload: GlwReconnectCallbackPayload): boolean {
  return payload.wordpressObjectId !== undefined
    || payload.wordpressPageId !== undefined
    || payload.wordpressPostId !== undefined
    || payload.wordpressUrl !== undefined;
}

function parseGeneratedDraft(payload: GlwReconnectCallbackPayload): GlwGeneratedDraftArtifact | null {
  const source = (payload.generatedDraft ?? payload.generated_draft) as Record<string, unknown> | undefined;
  const title = optionalString(source?.title ?? payload.page_title);
  const contentHtml = optionalString(source?.contentHtml ?? source?.article_html ?? payload.article_html);
  const slug = optionalString(source?.slug ?? source?.hierarchicalSlug ?? source?.hierarchical_slug ?? payload.hierarchical_slug);
  if (!title || !contentHtml || !slug) return null;
  return {
    title,
    contentHtml,
    slug,
    excerpt: optionalString(source?.excerpt),
    seoTitle: optionalString(source?.seoTitle ?? source?.seo_title),
    metaDescription: optionalString(source?.metaDescription ?? source?.meta_description),
    focusKeyphrase: optionalString(source?.focusKeyphrase ?? source?.focus_keyphrase),
  };
}

function sameGeneratedDraft(
  left: GlwGeneratedDraftArtifact | null | undefined,
  right: GlwGeneratedDraftArtifact | null | undefined,
): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function canTransition(current: GlwPageExecutionRecord["status"], next: ReconnectStatus): boolean {
  if (current === "COMPLETE" || current === "FAILED") {
    return current === next;
  }

  if (current === "CONTENT_READY") {
    return next === "CONTENT_READY" || next === "FAILED";
  }

  if (next === "RUNNING") {
    return current === "QUEUED" || current === "DISPATCHED" || current === "DISCOVERING_EXECUTION" || current === "RUNNING";
  }

  if (next === "CONTENT_READY") {
    return current === "QUEUED"
      || current === "DISPATCHED"
      || current === "DISCOVERING_EXECUTION"
      || current === "RUNNING"
      || current === "CONTENT_READY";
  }

  if (next === "FAILED") {
    return true;
  }

  return false;
}

const neverDispatch: GlwN8nDraftDispatcher = {
  async dispatch() {
    throw new Error("Dispatch is not supported in callback reconciliation.");
  },
};

function resolveFailureMessage(payload: GlwReconnectCallbackPayload): string {
  if (payload.error && typeof payload.error === "object") {
    const message = optionalString((payload.error as { message?: unknown }).message);
    if (message) return message;
  }
  return "n8n callback reported a failed execution.";
}

export async function applyGlwN8nReconnectCallback(input: ApplyReconnectCallbackInput): Promise<ReconnectCallbackResult> {
  if (!isGlwN8nReconnectEnabled(input.environment)) {
    return { ok: false, code: "FEATURE_DISABLED", status: 404 };
  }

  if (!isGlwN8nCallbackAuthorized({
    authorizationHeader: input.authorizationHeader,
    environment: input.environment,
  })) {
    return { ok: false, code: "CALLBACK_UNAUTHORIZED", status: 401 };
  }

  const jobId = resolveJobId(input.payload);
  const executionId = optionalString(input.payload.executionId) ?? "";
  const status = normalizeStatus(input.payload.status);
  if (!jobId || !executionId || !status) {
    return { ok: false, code: "INVALID_PAYLOAD", status: 422 };
  }

  const existing = await input.repository.getById(jobId);
  if (!existing) {
    return { ok: false, code: "UNKNOWN_JOB", status: 404 };
  }

  const expectedOrganizationId = existing.organizationId;
  const expectedSiteId = existing.siteId;
  const candidateOrganizationId = optionalString(input.payload.organizationId);
  const candidateSiteId = optionalString(input.payload.siteId);
  if (candidateOrganizationId && candidateOrganizationId !== expectedOrganizationId) {
    return { ok: false, code: "ORGANIZATION_MISMATCH", status: 409 };
  }
  if (candidateSiteId && candidateSiteId !== expectedSiteId) {
    return { ok: false, code: "SITE_MISMATCH", status: 409 };
  }

  if (existing.externalExecutionId && existing.externalExecutionId !== executionId) {
    return { ok: false, code: "EXECUTION_MISMATCH", status: 409 };
  }

  if (status === "COMPLETE") {
    return { ok: false, code: "UNAUTHORIZED_COMPLETE", status: 409 };
  }

  if (hasWordPressAuthorityFields(input.payload)) {
    return { ok: false, code: "WORDPRESS_AUTHORITY_REJECTED", status: 409 };
  }

  if (!canTransition(existing.status, status)) {
    return { ok: false, code: "INVALID_TRANSITION", status: 409 };
  }

  const timestamp = new Date().toISOString();
  if (status === "RUNNING") {
    const alreadyRunning = existing.status === "RUNNING"
      && existing.externalExecutionId === executionId
      && !existing.errorCode
      && !existing.errorMessage;
    if (alreadyRunning) {
      return { ok: true, code: "IDEMPOTENT_REPLAY", status: 200, job: existing };
    }
    const updated = await input.repository.update(existing.jobId, {
      status: "RUNNING",
      externalExecutionId: executionId,
      errorCode: null,
      errorMessage: null,
      completedAt: null,
      updatedAt: timestamp,
      qaChecks: {
        ...(existing.qaChecks ?? {}),
        reconnectLastCallbackStatus: "RUNNING",
        reconnectLastCallbackAt: timestamp,
      },
    });
    return { ok: true, code: "CALLBACK_APPLIED", status: 200, job: updated };
  }

  if (status === "CONTENT_READY") {
    const generatedDraft = parseGeneratedDraft(input.payload);
    if (!generatedDraft) {
      return { ok: false, code: "CONTENT_READY_DRAFT_REQUIRED", status: 422 };
    }
    const sameReplay = existing.status === "CONTENT_READY"
      && existing.externalExecutionId === executionId
      && sameGeneratedDraft(existing.generatedDraft, generatedDraft);
    if (sameReplay) {
      return { ok: true, code: "IDEMPOTENT_REPLAY", status: 200, job: existing };
    }

    const service = createGlwDraftExecutionService({
      repository: input.repository,
      dispatcher: neverDispatch,
    });
    const response: GlwN8nDraftResponse = {
      kind: "complete",
      executionId,
      status: "complete",
      wordpressObjectId: null,
      wordpressUrl: null,
      wordpressStatus: null,
      generatedDraft,
      requestedPublicationMode: "draft",
      disposition: optionalString(input.payload.qa_disposition) ?? "CONTENT_READY",
      qaStatus: "CONTENT_READY",
      qaChecks: {
        reconnectLastCallbackStatus: "CONTENT_READY",
        reconnectNonMutatingMode: isGlwN8nNonMutatingTestMode(input.environment),
      },
      qaFailureReasons: {},
    };
    const updated = await service.applyTerminalResult(existing.jobId, response);
    return { ok: true, code: "CALLBACK_APPLIED", status: 200, job: updated };
  }

  const failedMessage = resolveFailureMessage(input.payload);
  const sameFailure = existing.status === "FAILED"
    && existing.externalExecutionId === executionId
    && existing.errorCode === "N8N_EXECUTION_FAILED"
    && existing.errorMessage === failedMessage;
  if (sameFailure) {
    return { ok: true, code: "IDEMPOTENT_REPLAY", status: 200, job: existing };
  }

  const service = createGlwDraftExecutionService({
    repository: input.repository,
    dispatcher: neverDispatch,
  });
  const response: GlwN8nDraftResponse = {
    kind: "failed",
    executionId,
    status: "failed",
    errorCode: "N8N_EXECUTION_FAILED",
    errorMessage: failedMessage,
    qaChecks: {
      reconnectLastCallbackStatus: "FAILED",
      reconnectNonMutatingMode: isGlwN8nNonMutatingTestMode(input.environment),
    },
  };
  const updated = await service.applyTerminalResult(existing.jobId, response);
  return { ok: true, code: "CALLBACK_APPLIED", status: 200, job: updated };
}
