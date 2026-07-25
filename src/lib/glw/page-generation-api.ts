import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getGlwSession } from "./auth";
import { createPrismaGlwJobRepository } from "./job-repository";
import {
  applyGlwJobCallback,
  retryGlwPageGenerationJob,
  submitGlwPageGenerationJob,
} from "./page-generation";
import {
  validatePageGenerationRequest,
  GlwPageGenerationRequest,
  GlwPageGenerationCallbackPayload,
  GlwJobRecord,
  describeOperatorSafeError,
  matchesGlwJobFilter,
  normalizeGlwJobStatus,
  type GlwJobFilter,
} from "./jobs";
import { createGlwN8nTransport } from "./n8n";

export type GlwApiDependencies = {
  repository?: ReturnType<typeof createPrismaGlwJobRepository>;
  workflow?: ReturnType<typeof createGlwN8nTransport>;
  appUrl?: string;
  webhookSecret?: string;
  sessionLoader?: typeof getGlwSession;
};

function getDependencies(dependencies?: GlwApiDependencies) {
  return {
    repository: dependencies?.repository ?? createPrismaGlwJobRepository(),
    workflow: dependencies?.workflow ?? createGlwN8nTransport(),
    appUrl: dependencies?.appUrl ?? process.env.GLW_APP_URL ?? "http://localhost:3000",
    webhookSecret: dependencies?.webhookSecret ?? process.env.GLW_N8N_WEBHOOK_SECRET ?? "",
    sessionLoader: dependencies?.sessionLoader ?? getGlwSession,
  };
}

async function requireGlwSession(dependencies?: GlwApiDependencies): Promise<boolean> {
  const { sessionLoader } = getDependencies(dependencies);
  return Boolean(await sessionLoader());
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

export async function handleCreatePageGenerationJob(
  request: Request,
  dependencies?: GlwApiDependencies,
): Promise<NextResponse> {
  if (!(await requireGlwSession(dependencies))) {
    return unauthorizedResponse();
  }

  const { repository, workflow, appUrl } = getDependencies(dependencies);
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

  return jsonResponse({ job });
}

export async function handleRetryJob(
  _request: Request,
  jobId: string,
  dependencies?: GlwApiDependencies,
): Promise<NextResponse> {
  if (!(await requireGlwSession(dependencies))) {
    return unauthorizedResponse();
  }

  const { repository, workflow, appUrl } = getDependencies(dependencies);
  const currentJob = await repository.findById(jobId);

  if (!currentJob) {
    return notFoundResponse();
  }

  if (currentJob.status !== "FAILED") {
    return conflictResponse("Only failed GLW jobs can be retried.", currentJob);
  }

  try {
    const result = await retryGlwPageGenerationJob(jobId, {
      repository,
      workflow,
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
  const { repository, webhookSecret } = getDependencies(dependencies);

  if (!callbackAuthValid(request, webhookSecret)) {
    return unauthorizedResponse();
  }

  const body = (await request.json().catch(() => null)) as Partial<GlwPageGenerationCallbackPayload> | null;

  if (!body) {
    return validationResponse("The callback body must be valid JSON.", {});
  }

  const jobId = typeof body.jobId === "string" ? body.jobId.trim() : "";
  const executionId = typeof body.executionId === "string" ? body.executionId.trim() : "";
  const status = typeof body.status === "string" ? body.status.trim().toUpperCase() : "";
  const normalizedStatus = status ? normalizeGlwJobStatus(status) : null;

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
    title: typeof body.title === "string" ? body.title : undefined,
    wordpressUrl: typeof body.wordpressUrl === "string" ? body.wordpressUrl : undefined,
    wordpressPostId: body.wordpressPostId === undefined ? undefined : body.wordpressPostId,
    error: body.error && typeof body.error.message === "string"
      ? {
          message: body.error.message,
          step: typeof body.error.step === "string" ? body.error.step : undefined,
          code: typeof body.error.code === "string" ? body.error.code : undefined,
        }
      : undefined,
  };

  try {
    const job = await applyGlwJobCallback(normalizedPayload, repository);
    return jsonResponse({ job });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The callback payload could not be processed.";
    if (message.includes("not found")) {
      return notFoundResponse(message);
    }

    return conflictResponse(message);
  }
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

  const jobs = await repository.findPageGenerationJobs(limit);
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
      job.input.page.product,
      job.input.page.primaryKeyword,
      job.input.page.city ?? "",
      job.input.page.state ?? "",
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
  const jobs = await repository.findPageGenerationJobs(500);
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
