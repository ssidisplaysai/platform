import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getGlwSession } from "./auth";
import { createPrismaGlwJobRepository } from "./job-repository";
import {
  reconcileGlwTimedOutJob,
  reconcileGlwTimedOutJobs,
  runGlwTimeoutReconciliation,
} from "./timeout-reconciliation";
import {
  applyGlwJobCallback,
  retryGlwPageGenerationJob,
  submitGlwPageGenerationJob,
} from "./page-generation";
import {
  GLW_QA_CHECK_KEYS,
  GLW_QA_CONTRACT_VERSION,
  GLW_CALLBACK_CONTRACT_VERSION,
  validatePageGenerationRequest,
  GlwPageGenerationRequest,
  GlwPageGenerationCallbackPayload,
  GlwJobRecord,
  describeOperatorSafeError,
  matchesGlwJobFilter,
  normalizeGlwQaChecks,
  normalizeGlwQaFailureReasons,
  normalizeGlwJobStatus,
  normalizeGlwWordpressWorkflowStatus,
  type GlwJobFilter,
} from "./jobs";
import { createGlwN8nExecutionService, createGlwN8nTransport } from "./n8n";
import { getGenesisEventStore } from "@/platform/gop/runtime/event-store";
import type { GenesisEventStore } from "@/platform/gop/event-store";
import { verifyWorkerToken } from "@/platform/gop/runtime/worker-token";

export type GlwApiDependencies = {
  repository?: ReturnType<typeof createPrismaGlwJobRepository>;
  workflow?: ReturnType<typeof createGlwN8nTransport>;
  n8nExecutionService?: ReturnType<typeof createGlwN8nExecutionService>;
  eventStore?: GenesisEventStore | null;
  appUrl?: string;
  webhookSecret?: string;
  workerTokenSecret?: string;
  timeoutReconciliationWorkerId?: string;
  sessionLoader?: typeof getGlwSession;
};

function getDependencies(dependencies?: GlwApiDependencies) {
  return {
    repository: dependencies?.repository ?? createPrismaGlwJobRepository(),
    workflow: dependencies?.workflow ?? createGlwN8nTransport(),
    n8nExecutionService: dependencies?.n8nExecutionService ?? createGlwN8nExecutionService(),
    eventStore: dependencies?.eventStore ?? (process.env.DATABASE_URL ? getGenesisEventStore() : null),
    appUrl: dependencies?.appUrl ?? process.env.GLW_APP_URL ?? "http://localhost:3000",
    webhookSecret: dependencies?.webhookSecret ?? process.env.GLW_N8N_WEBHOOK_SECRET ?? "",
    workerTokenSecret: dependencies?.workerTokenSecret ?? process.env.GOP_WORKER_TOKEN_SECRET ?? "",
    timeoutReconciliationWorkerId: dependencies?.timeoutReconciliationWorkerId
      ?? process.env.GLW_TIMEOUT_RECONCILIATION_WORKER_ID
      ?? "glw-timeout-reconciler",
    sessionLoader: dependencies?.sessionLoader ?? getGlwSession,
  };
}

async function requireGlwSession(dependencies?: GlwApiDependencies): Promise<boolean> {
  const { sessionLoader } = getDependencies(dependencies);
  return Boolean(await sessionLoader());
}

function parseWorkerBearer(request: Request): string | null {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return null;
  }

  return auth.slice("Bearer ".length).trim();
}

function jsonResponse(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

function unauthorizedResponse(): NextResponse {
  return jsonResponse({ error: "GLW session is required." }, 401);
}

function notFoundResponse(message = "GLW job not found."): NextResponse {
  return jsonResponse({ error: message }, 404);
}

function conflictResponse(message: string, job?: GlwJobRecord): NextResponse {
  return jsonResponse(job ? { error: message, job } : { error: message }, 409);
}

function validationResponse(message: string, errors: Record<string, string | undefined>): NextResponse {
  return jsonResponse({ error: message, fieldErrors: errors }, 400);
}

function callbackAuthValid(request: Request, secret: string): boolean {
  if (!secret) {
    return false;
  }

  const authorization = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";

  if (!authorization.startsWith(prefix)) {
    return false;
  }

  const received = authorization.slice(prefix.length);

  try {
    const expectedBuffer = Buffer.from(secret, "utf8");
    const receivedBuffer = Buffer.from(received, "utf8");

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, receivedBuffer);
  } catch {
    return false;
  }
}

function parseJsonObjectFromString(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Ignore invalid JSON payload aliases; canonical normalization handles validation.
  }

  return undefined;
}

function normalizeOptionalIdentifier(value: unknown): string | number | undefined {
  return typeof value === "string" || typeof value === "number" ? value : undefined;
}

type QaContractValidationResult =
  | { ok: true }
  | {
      ok: false;
      receivedQaContractVersion: number;
      missingQaCheckKeys: string[];
      unknownQaCheckKeys: string[];
      unknownQaFailureReasonKeys: string[];
      message: string;
    };

function sortedUniqueKeys(input: Record<string, unknown>): string[] {
  return [...new Set(Object.keys(input).map((key) => key.trim()).filter((key) => key.length > 0))].sort();
}

function validateQaContractPayload(input: {
  qaChecksInput: unknown;
  qaFailureReasonsInput: unknown;
}): QaContractValidationResult {
  const expectedKeys = [...GLW_QA_CHECK_KEYS].sort();
  const expectedSet = new Set(GLW_QA_CHECK_KEYS);

  if (typeof input.qaChecksInput !== "object" || input.qaChecksInput === null) {
    return {
      ok: false,
      receivedQaContractVersion: 0,
      missingQaCheckKeys: [...expectedKeys],
      unknownQaCheckKeys: [],
      unknownQaFailureReasonKeys: [],
      message: "Callback QA payload is missing qaChecks.",
    };
  }

  const qaChecksSource = input.qaChecksInput as Record<string, unknown>;
  const rawQaCheckKeys = sortedUniqueKeys(qaChecksSource);
  const normalizedQaChecks = normalizeGlwQaChecks(qaChecksSource) ?? {};
  const normalizedQaCheckKeys = sortedUniqueKeys(normalizedQaChecks as Record<string, unknown>);

  const missingQaCheckKeys = expectedKeys.filter((key) => !normalizedQaCheckKeys.includes(key));
  const unknownQaCheckKeys = rawQaCheckKeys.filter((key) => !expectedSet.has(key as typeof GLW_QA_CHECK_KEYS[number]));

  const unknownQaFailureReasonKeys =
    typeof input.qaFailureReasonsInput === "object" && input.qaFailureReasonsInput !== null
      ? sortedUniqueKeys(input.qaFailureReasonsInput as Record<string, unknown>)
        .filter((key) => !expectedSet.has(key as typeof GLW_QA_CHECK_KEYS[number]))
      : [];

  const hasMismatch =
    missingQaCheckKeys.length > 0
    || unknownQaCheckKeys.length > 0
    || unknownQaFailureReasonKeys.length > 0;

  if (!hasMismatch) {
    return { ok: true };
  }

  return {
    ok: false,
    receivedQaContractVersion: normalizedQaCheckKeys.length,
    missingQaCheckKeys,
    unknownQaCheckKeys,
    unknownQaFailureReasonKeys,
    message: "Callback QA payload contract does not match runtime QA contract.",
  };
}

export async function handleCreatePageGenerationJob(
  request: Request,
  dependencies?: GlwApiDependencies,
): Promise<NextResponse> {
  if (!(await requireGlwSession(dependencies))) {
    return unauthorizedResponse();
  }

  const { repository, workflow, eventStore, appUrl } = getDependencies(dependencies);
  const body = (await request.json().catch(() => null)) as Partial<GlwPageGenerationRequest> | null;

  if (!body) {
    return validationResponse("The request body must be valid JSON.", {});
  }

  const validation = validatePageGenerationRequest(body);

  if (!validation.ok) {
    return validationResponse(validation.message, validation.errors);
  }

  try {
    const result = await submitGlwPageGenerationJob(validation.value, {
      repository,
      workflow,
      eventStore,
      appUrl,
    });

    const status = result.workflowStatus === "completed" ? 201 : result.workflowStatus === "accepted" ? 202 : 502;
    return jsonResponse({ job: result.job, workflowStatus: result.workflowStatus, error: result.workflowError ?? null }, status);
  } catch (error) {
    return jsonResponse({
      error: describeOperatorSafeError(error, "Unable to create the page-generation job."),
    }, 500);
  }
}

export async function handleGetJob(
  _request: Request,
  jobId: string,
  dependencies?: GlwApiDependencies,
): Promise<NextResponse> {
  if (!(await requireGlwSession(dependencies))) {
    return unauthorizedResponse();
  }

  const { repository } = getDependencies(dependencies);
  const job = await repository.findById(jobId);

  if (!job) {
    return notFoundResponse();
  }

  const reconciliation = await reconcileGlwTimedOutJob(job, repository);
  const reconciledJob = await repository.findById(job.id);
  if (!reconciledJob) {
    return notFoundResponse();
  }

  if (reconciliation.action === "ERROR") {
    return jsonResponse({ error: "Timeout reconciliation failed for this GLW job." }, 500);
  }

  return jsonResponse({ job: reconciledJob });
}

export async function handleGetN8nExecutionDiagnostics(
  _request: Request,
  jobId: string,
  dependencies?: GlwApiDependencies,
): Promise<NextResponse> {
  if (!(await requireGlwSession(dependencies))) {
    return unauthorizedResponse();
  }

  const { repository, n8nExecutionService } = getDependencies(dependencies);
  const job = await repository.findById(jobId);

  if (!job) {
    return notFoundResponse();
  }

  const executionId = job.externalExecutionId ?? job.result?.executionId ?? null;

  if (!executionId) {
    return jsonResponse({
      jobId,
      execution: null,
      status: "not_started",
      message: "Execution has not been accepted by n8n.",
      openUrl: null,
    });
  }

  const diagnostics = await n8nExecutionService.getExecutionDiagnostics(executionId);

  if (!diagnostics.available) {
    return jsonResponse({
      jobId,
      executionId,
      execution: null,
      status: "unavailable",
      message: "Execution accepted but status unavailable.",
      reason: diagnostics.reason,
      upstreamStatus: diagnostics.upstreamStatus,
      upstreamContentType: diagnostics.upstreamContentType,
      upstreamMessage: diagnostics.upstreamMessage,
      openUrl: diagnostics.deepLinkUrl,
    });
  }

  return jsonResponse({
    jobId,
    executionId,
    execution: diagnostics.diagnostics,
    status: "available",
    message: diagnostics.diagnostics.terminal
      ? `Execution reached terminal state ${diagnostics.diagnostics.executionState}.`
      : "Execution is in progress.",
    openUrl: diagnostics.diagnostics.deepLinkUrl,
  });
}

export async function handleRetryJob(
  _request: Request,
  jobId: string,
  dependencies?: GlwApiDependencies,
): Promise<NextResponse> {
  if (!(await requireGlwSession(dependencies))) {
    return unauthorizedResponse();
  }

  const { repository, workflow, eventStore, appUrl } = getDependencies(dependencies);
  const currentJob = await repository.findById(jobId);

  if (!currentJob) {
    return notFoundResponse();
  }

  const reconcileResult = await reconcileGlwTimedOutJob(currentJob, repository);
  if (reconcileResult.action === "ERROR") {
    return jsonResponse({ error: "Timeout reconciliation failed for this GLW job." }, 500);
  }

  const reconciledJob = await repository.findById(currentJob.id);
  if (!reconciledJob) {
    return notFoundResponse();
  }

  if (reconciledJob.status !== "FAILED" && reconciledJob.status !== "FAILED_QA") {
    return conflictResponse("Only failed GLW jobs can be retried.", reconciledJob);
  }

  try {
    const result = await retryGlwPageGenerationJob(jobId, {
      repository,
      workflow,
      eventStore,
      appUrl,
    });

    const status = result.workflowStatus === "failed" ? 502 : result.workflowStatus === "accepted" ? 202 : 201;
    return jsonResponse({ job: result.job, workflowStatus: result.workflowStatus, error: result.workflowError ?? null }, status);
  } catch (error) {
    const message = describeOperatorSafeError(error, "Unable to retry this GLW job.");

    if (message.includes("still in progress") || message.includes("Only failed")) {
      return conflictResponse(message, currentJob);
    }

    return jsonResponse({ error: message }, 500);
  }
}

export async function handleJobCallback(
  request: Request,
  dependencies?: GlwApiDependencies,
): Promise<NextResponse> {
  const { repository, eventStore, webhookSecret } = getDependencies(dependencies);

  if (!callbackAuthValid(request, webhookSecret)) {
    return unauthorizedResponse();
  }

  const body = (await request.json().catch(() => null)) as Partial<GlwPageGenerationCallbackPayload> | null;

  if (!body) {
    return validationResponse("The callback body must be valid JSON.", {});
  }

  const callbackBody = body as Partial<GlwPageGenerationCallbackPayload> & Record<string, unknown>;

  const jobId = typeof callbackBody.jobId === "string" ? callbackBody.jobId.trim() : "";
  const executionId = typeof callbackBody.executionId === "string" ? callbackBody.executionId.trim() : "";
  const status = typeof callbackBody.status === "string" ? callbackBody.status.trim().toUpperCase() : "";
  const normalizedStatus = status ? normalizeGlwJobStatus(status) : null;

  const requestedPublishingModeRaw =
    typeof callbackBody.requestedPublishingMode === "string"
      ? callbackBody.requestedPublishingMode
      : typeof callbackBody.requested_publishing_mode === "string"
        ? callbackBody.requested_publishing_mode
        : undefined;

  const qaChecksInput =
    callbackBody.qaChecks
    ?? callbackBody.qa_checks
    ?? parseJsonObjectFromString(callbackBody.qaChecksJson)
    ?? parseJsonObjectFromString(callbackBody.qa_checks_json);

  const qaFailureReasonsInput =
    callbackBody.qaFailureReasons
    ?? callbackBody.qa_failure_reasons
    ?? parseJsonObjectFromString(callbackBody.qaFailureReasonsJson)
    ?? parseJsonObjectFromString(callbackBody.qa_failure_reasons_json);

  const requiresQaContractValidation = normalizedStatus === "COMPLETE" || normalizedStatus === "FAILED_QA";
  if (requiresQaContractValidation) {
    const validation = validateQaContractPayload({ qaChecksInput, qaFailureReasonsInput });
    if (!validation.ok) {
      return jsonResponse({
        error: validation.message,
        code: "QA_CONTRACT_VERSION_MISMATCH",
        expectedQaContractVersion: GLW_QA_CONTRACT_VERSION,
        expectedCallbackContractVersion: GLW_CALLBACK_CONTRACT_VERSION,
        receivedQaContractVersion: validation.receivedQaContractVersion,
        missingQaCheckKeys: validation.missingQaCheckKeys,
        unknownQaCheckKeys: validation.unknownQaCheckKeys,
        unknownQaFailureReasonKeys: validation.unknownQaFailureReasonKeys,
      }, 409);
    }
  }

  if (!jobId || !executionId || !normalizedStatus) {
    return validationResponse("The callback payload is missing required fields.", {
      jobId: jobId ? undefined : "Job id is required.",
      executionId: executionId ? undefined : "Execution id is required.",
      status: normalizedStatus ? undefined : "A valid status is required.",
    });
  }

  const normalizedPayload: GlwPageGenerationCallbackPayload = {
    jobId,
    executionId,
    status: normalizedStatus,
    title: typeof callbackBody.title === "string" ? callbackBody.title : undefined,
    wordpressPageId: normalizeOptionalIdentifier(
      callbackBody.wordpressPageId
      ?? callbackBody.wordpressPageID
      ?? callbackBody.wordpress_page_id,
    ),
    wordpressUrl: typeof callbackBody.wordpressUrl === "string"
      ? callbackBody.wordpressUrl
      : typeof callbackBody.wordpress_url === "string"
        ? callbackBody.wordpress_url
        : undefined,
    wordpressPostId: normalizeOptionalIdentifier(
      callbackBody.wordpressPostId
      ?? callbackBody.wordpressPostID
      ?? callbackBody.wordpress_post_id,
    ),
    wordpressStatus: normalizeGlwWordpressWorkflowStatus(callbackBody.wordpressStatus ?? callbackBody.wordpress_status),
    requestedPublishingMode:
      typeof requestedPublishingModeRaw === "string" && (requestedPublishingModeRaw.trim().toLowerCase() === "draft" || requestedPublishingModeRaw.trim().toLowerCase() === "publish")
        ? (requestedPublishingModeRaw.trim().toLowerCase() as "draft" | "publish")
        : undefined,
    disposition: typeof callbackBody.disposition === "string"
      ? callbackBody.disposition.toUpperCase()
      : typeof callbackBody.qa_disposition === "string"
        ? callbackBody.qa_disposition.toUpperCase()
        : undefined,
    qaChecks: normalizeGlwQaChecks(qaChecksInput),
    qaFailureReasons: normalizeGlwQaFailureReasons(qaFailureReasonsInput),
    featuredImageUrl: typeof callbackBody.featuredImageUrl === "string"
      ? callbackBody.featuredImageUrl
      : typeof callbackBody.featured_image_url === "string"
        ? callbackBody.featured_image_url
        : undefined,
    executionTimeMs: typeof callbackBody.executionTimeMs === "number"
      ? callbackBody.executionTimeMs
      : typeof callbackBody.execution_time_ms === "number"
        ? callbackBody.execution_time_ms
        : undefined,
    error: callbackBody.error && typeof callbackBody.error.message === "string"
      ? {
          message: callbackBody.error.message,
          step: typeof callbackBody.error.step === "string" ? callbackBody.error.step : undefined,
          code: typeof callbackBody.error.code === "string" ? callbackBody.error.code : undefined,
        }
      : undefined,
  };

  try {
    const job = await applyGlwJobCallback(normalizedPayload, repository, eventStore);
    return jsonResponse({ job });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The callback payload could not be processed.";
    if (message.includes("not found")) {
      return notFoundResponse(message);
    }

    return conflictResponse(message);
  }
}

export async function handleRetryCallback(
  request: Request,
  dependencies?: GlwApiDependencies,
): Promise<NextResponse> {
  return handleJobCallback(request, dependencies);
}

export async function handleRunTimeoutReconciliation(
  request: Request,
  dependencies?: GlwApiDependencies,
): Promise<NextResponse> {
  const {
    repository,
    workerTokenSecret,
    timeoutReconciliationWorkerId,
  } = getDependencies(dependencies);

  const bearer = parseWorkerBearer(request);
  if (!bearer || !workerTokenSecret) {
    return jsonResponse({ error: "Signed worker token is required." }, 401);
  }

  const payload = verifyWorkerToken(bearer, workerTokenSecret);
  if (!payload) {
    return jsonResponse({ error: "Signed worker token is required." }, 401);
  }

  if (timeoutReconciliationWorkerId && payload.workerId !== timeoutReconciliationWorkerId) {
    return jsonResponse({ error: "workerId does not match reconciliation worker policy." }, 403);
  }

  const url = new URL(request.url);
  const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get("limit") ?? "200") || 200));

  const reconciliation = await runGlwTimeoutReconciliation({
    repository,
    limit,
  });

  return jsonResponse({
    reconciliation,
    worker: {
      workerId: payload.workerId,
      tokenId: payload.tokenId,
      protocolVersion: payload.protocolVersion,
    },
  });
}

export async function listPageGenerationJobs(
  request: Request,
  dependencies?: GlwApiDependencies,
): Promise<NextResponse> {
  if (!(await requireGlwSession(dependencies))) {
    return unauthorizedResponse();
  }

  const { repository } = getDependencies(dependencies);
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const filterRaw = (url.searchParams.get("filter") ?? "all").toLowerCase();
  const filter = (["all", "active", "complete", "failed"] as const).includes(filterRaw as GlwJobFilter)
    ? (filterRaw as GlwJobFilter)
    : "all";
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? "100") || 100));

  const jobs = await reconcileGlwTimedOutJobs(await repository.findPageGenerationJobs(limit), repository);
  const filtered = jobs.filter((job) => {
    if (!matchesGlwJobFilter(job.status, filter)) {
      return false;
    }

    if (!query) {
      return true;
    }

    const haystack = [
      job.id,
      job.title,
      job.input.site.name,
      job.input.page.title,
      job.input.page.targetSlug,
      job.input.page.primaryKeyword,
      ...(job.input.page.secondaryKeywords ?? []),
    ].join(" ").toLowerCase();

    return haystack.includes(query);
  });

  return jsonResponse({ jobs: filtered, total: filtered.length });
}

export async function getPageGenerationDashboard(
  request: Request,
  dependencies?: GlwApiDependencies,
): Promise<NextResponse> {
  if (!(await requireGlwSession(dependencies))) {
    return unauthorizedResponse();
  }

  const { repository } = getDependencies(dependencies);
  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? "20") || 20));
  const jobs = await reconcileGlwTimedOutJobs(await repository.findPageGenerationJobs(500), repository);
  const recent = jobs.slice(0, limit);

  const completedDurations = jobs
    .filter((job) => job.status === "COMPLETE" && job.startedAt && job.completedAt)
    .map((job) => new Date(job.completedAt as string).getTime() - new Date(job.startedAt as string).getTime())
    .filter((durationMs) => durationMs >= 0);

  const avgDurationMs = completedDurations.length > 0
    ? Math.round(completedDurations.reduce((sum, value) => sum + value, 0) / completedDurations.length)
    : 0;

  const metrics = {
    total: jobs.length,
    active: jobs.filter((job) => matchesGlwJobFilter(job.status, "active")).length,
    complete: jobs.filter((job) => job.status === "COMPLETE").length,
    failed: jobs.filter((job) => job.status === "FAILED").length,
    avgDurationMs,
  };

  return jsonResponse({ metrics, recentJobs: recent });
}
