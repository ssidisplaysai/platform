import {
  buildGlwPageTitle,
  canTransitionGlwJobStatus,
  createGlwJobInput,
  createGlwJobRecord,
  GlwJobError,
  GlwJobRecord,
  GlwJobRepository,
  GlwPageGenerationRequest,
  GlwPageGenerationCallbackPayload,
  normalizeGlwJobError,
} from "./jobs";
import { GlwN8nResponse, GlwN8nTransport } from "./n8n";
import type { GenesisEventStore } from "@/platform/gop/event-store";
import { backfillGlwJobEvents, emitGlwJobLifecycleEvent } from "@/platform/gop/adapters/glw-events";
import { getGenesisOrchestrationRuntime } from "@/platform/gop/runtime/orchestration-runtime";

function nowIso(): string {
  return new Date().toISOString();
}

function buildCallbackUrl(appUrl: string): string {
  return new URL("/api/glw/jobs/callback", appUrl).toString();
}

function buildResultFromResponse(response: GlwN8nResponse): GlwJobRecord["result"] {
  if (response.kind === "complete") {
    return {
      executionId: response.executionId,
      status: "COMPLETE",
      title: response.title,
      wordpressPageId: response.wordpressPageId ?? response.wordpressPostId,
      wordpressUrl: response.wordpressUrl,
      wordpressPostId: response.wordpressPostId,
      featuredImageUrl: response.featuredImageUrl,
      executionTimeMs: response.executionTimeMs,
    };
  }

  if (response.kind === "accepted") {
    return {
      executionId: response.executionId,
      status: "RUNNING",
      title: response.title,
    };
  }

  return null;
}

function statusFromAcceptedResponse(response: Extract<GlwN8nResponse, { kind: "accepted" }>): GlwJobRecord["status"] {
  return response.status === "running" ? "RUNNING" : "STARTING";
}

export type GlwPageGenerationDependencies = {
  repository: GlwJobRepository;
  workflow: GlwN8nTransport;
  appUrl: string;
  eventStore?: GenesisEventStore | null;
  now?: () => Date;
};

export type GlwJobOperationResult = {
  job: GlwJobRecord;
  workflowStatus: "completed" | "accepted" | "failed";
  workflowError?: GlwJobError;
};

export async function submitGlwPageGenerationJob(
  request: GlwPageGenerationRequest,
  dependencies: GlwPageGenerationDependencies,
  retryOfJobId?: string,
): Promise<GlwJobOperationResult> {
  const now = dependencies.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const callbackUrl = buildCallbackUrl(dependencies.appUrl);
  const input = createGlwJobInput(request, callbackUrl);
  const title = buildGlwPageTitle(request);
  const createdJob = createGlwJobRecord({
    type: "PAGE_GENERATION",
    status: "QUEUED",
    retryOfJobId: retryOfJobId ?? null,
    siteId: request.siteId,
    title,
    input,
    result: null,
    error: null,
    externalExecutionId: null,
    startedAt: null,
    completedAt: null,
  });

  const queuedJob = await dependencies.repository.create(createdJob);
  await backfillGlwJobEvents(dependencies.eventStore ?? null, queuedJob);
  const orchestration = getGenesisOrchestrationRuntime();
  orchestration.createGlwExecutionForJob({
    jobId: queuedJob.id,
    jobType: queuedJob.type,
    title: queuedJob.title,
    siteId: queuedJob.siteId,
    retryOfJobId,
  });

  const startingJob = await dependencies.repository.update(queuedJob.id, {
    status: "STARTING",
    startedAt,
  });
  await emitGlwJobLifecycleEvent(dependencies.eventStore ?? null, startingJob, {
    type: "STARTED",
    label: "Started",
    stage: "worker_start",
    message: "Workflow execution started.",
    idempotencyKey: `${startingJob.id}:STARTED:${startingJob.updatedAt}`,
  });
  orchestration.syncGlwExecutionState({
    jobId: startingJob.id,
    status: startingJob.status,
  });

  try {
    const response = await dependencies.workflow.invokePageGeneration({
      jobId: startingJob.id,
      type: "page_generation",
      site: {
        id: startingJob.input.site.id,
        name: startingJob.input.site.name,
      },
      page: startingJob.input.page,
      promptData: startingJob.input.promptData,
      seoSettings: startingJob.input.seoSettings,
      publishingSettings: startingJob.input.publishingSettings,
      imageSettings: startingJob.input.imageSettings,
      callbackUrl,
      authToken: process.env.GLW_N8N_WEBHOOK_SECRET,
    });

    if (response.kind === "failed") {
      const failedJob = await dependencies.repository.update(startingJob.id, {
        status: "FAILED",
        completedAt: now().toISOString(),
        result: null,
        error: response.error,
        externalExecutionId: response.executionId ?? null,
      });
      await emitGlwJobLifecycleEvent(dependencies.eventStore ?? null, failedJob, {
        type: "FAILED",
        label: "Failed",
        stage: "workflow_error",
        message: response.error.message,
        idempotencyKey: `${failedJob.id}:FAILED:${failedJob.updatedAt}`,
      });
      orchestration.syncGlwExecutionState({
        jobId: failedJob.id,
        status: failedJob.status,
        correlationId: failedJob.externalExecutionId,
        errorMessage: failedJob.error?.message,
      });

      return {
        job: failedJob,
        workflowStatus: "failed",
        workflowError: response.error,
      };
    }

    if (response.kind === "complete") {
      const completedJob = await dependencies.repository.update(startingJob.id, {
        status: "COMPLETE",
        completedAt: now().toISOString(),
        result: buildResultFromResponse(response),
        error: null,
        externalExecutionId: response.executionId,
      });
      await emitGlwJobLifecycleEvent(dependencies.eventStore ?? null, completedJob, {
        type: "SUCCEEDED",
        label: "Succeeded",
        stage: "completed",
        message: "Workflow completed synchronously.",
        idempotencyKey: `${completedJob.id}:COMPLETE:${completedJob.updatedAt}`,
      });
      orchestration.syncGlwExecutionState({
        jobId: completedJob.id,
        status: completedJob.status,
        correlationId: completedJob.externalExecutionId,
        result: completedJob.result as Record<string, unknown> | null,
      });

      return {
        job: completedJob,
        workflowStatus: "completed",
      };
    }

    const runningJob = await dependencies.repository.update(startingJob.id, {
      status: statusFromAcceptedResponse(response),
      result: buildResultFromResponse(response),
      error: null,
      externalExecutionId: response.executionId,
    });
    await emitGlwJobLifecycleEvent(dependencies.eventStore ?? null, runningJob, {
      type: "STAGE_CHANGED",
      label: "Stage Changed",
      stage: "accepted",
      message: "Workflow accepted by n8n.",
      idempotencyKey: `${runningJob.id}:${runningJob.status}:${runningJob.updatedAt}`,
    });
    orchestration.syncGlwExecutionState({
      jobId: runningJob.id,
      status: runningJob.status,
      correlationId: runningJob.externalExecutionId,
      result: runningJob.result as Record<string, unknown> | null,
    });

    return {
      job: runningJob,
      workflowStatus: "accepted",
    };
  } catch (error) {
    const workflowError = normalizeGlwJobError(error);
    const failedJob = await dependencies.repository.update(startingJob.id, {
      status: "FAILED",
      completedAt: now().toISOString(),
      error: workflowError,
      result: null,
    }).catch(async () => {
      const latest = await dependencies.repository.findById(startingJob.id);

      if (latest) {
        return latest;
      }

      throw error;
    });
    await emitGlwJobLifecycleEvent(dependencies.eventStore ?? null, failedJob, {
      type: "FAILED",
      label: "Failed",
      stage: "workflow_exception",
      message: workflowError.message,
      idempotencyKey: `${failedJob.id}:FAILED:${failedJob.updatedAt}`,
    });
    orchestration.syncGlwExecutionState({
      jobId: failedJob.id,
      status: failedJob.status,
      correlationId: failedJob.externalExecutionId,
      errorMessage: failedJob.error?.message,
    });

    return {
      job: failedJob,
      workflowStatus: "failed",
      workflowError,
    };
  }
}

export async function retryGlwPageGenerationJob(
  jobId: string,
  dependencies: GlwPageGenerationDependencies,
): Promise<GlwJobOperationResult> {
  const existingJob = await dependencies.repository.findById(jobId);

  if (!existingJob) {
    throw new Error(`GLW job not found: ${jobId}`);
  }

  if (existingJob.status !== "FAILED") {
    throw new Error("Only failed GLW jobs can be retried.");
  }

  const latestRetry = await dependencies.repository.findLatestRetryForJob(existingJob.id);

  if (latestRetry && latestRetry.status !== "FAILED" && latestRetry.status !== "COMPLETE") {
    throw new Error("The latest retry for this job is still in progress.");
  }

  return submitGlwPageGenerationJob(
    {
      siteId: existingJob.input.site.id,
      title: existingJob.input.page.title,
      targetSlug: existingJob.input.page.targetSlug,
      primaryKeyword: existingJob.input.page.primaryKeyword,
      secondaryKeywords: existingJob.input.page.secondaryKeywords,
      wordCount: existingJob.input.page.wordCount,
      tone: existingJob.input.page.tone,
      audience: existingJob.input.page.audience,
      callToAction: existingJob.input.page.callToAction,
      category: existingJob.input.page.category,
      status: existingJob.input.page.status,
    },
    dependencies,
    existingJob.id,
  );
}

export async function applyGlwJobCallback(
  payload: GlwPageGenerationCallbackPayload,
  repository: GlwJobRepository,
  eventStore?: GenesisEventStore | null,
): Promise<GlwJobRecord> {
  const orchestration = getGenesisOrchestrationRuntime();
  const existingJob = await repository.findById(payload.jobId);

  if (!existingJob) {
    throw new Error(`GLW job not found: ${payload.jobId}`);
  }

  if (existingJob.externalExecutionId && existingJob.externalExecutionId !== payload.executionId) {
    throw new Error("Callback execution identifier does not match the tracked GLW job.");
  }

  if (!canTransitionGlwJobStatus(existingJob.status, payload.status)) {
    throw new Error(`Invalid GLW job status transition from ${existingJob.status} to ${payload.status}.`);
  }

  const normalizedTitle = payload.title ?? existingJob.title;
  const normalizedWordpressIdentifier = payload.wordpressPageId ?? payload.wordpressPostId;
  const normalizedWordpressPostId = payload.wordpressPostId ?? normalizedWordpressIdentifier;

  const sameExecution = existingJob.externalExecutionId === payload.executionId;
  const sameStatus = existingJob.status === payload.status;
  const sameResult =
    existingJob.result?.executionId === payload.executionId &&
    existingJob.result?.status === payload.status &&
    existingJob.result?.title === normalizedTitle &&
    existingJob.result?.wordpressPageId === normalizedWordpressIdentifier &&
    existingJob.result?.wordpressUrl === payload.wordpressUrl &&
    existingJob.result?.wordpressPostId === normalizedWordpressPostId &&
    existingJob.result?.featuredImageUrl === payload.featuredImageUrl &&
    existingJob.result?.executionTimeMs === payload.executionTimeMs;
  const sameError =
    existingJob.error?.message === payload.error?.message &&
    existingJob.error?.step === payload.error?.step &&
    existingJob.error?.code === payload.error?.code;

  if (sameExecution && sameStatus && sameResult && sameError) {
    return existingJob;
  }

  await emitGlwJobLifecycleEvent(eventStore ?? null, existingJob, {
    type: "CALLBACK_RECEIVED",
    label: "Callback Received",
    stage: "callback",
    message: "Callback payload accepted for processing.",
    idempotencyKey: `${existingJob.id}:CALLBACK:${payload.executionId}:${payload.status}`,
    correlationId: payload.executionId,
  });

  if (payload.status === "COMPLETE") {
    const wordpressIdentifier = normalizedWordpressIdentifier;

    if (!payload.wordpressUrl || wordpressIdentifier === undefined || wordpressIdentifier === null) {
      throw new Error("Completed callback payload must include a WordPress URL and post identifier.");
    }

    const updated = await repository.update(existingJob.id, {
      status: "COMPLETE",
      title: normalizedTitle,
      externalExecutionId: payload.executionId,
      completedAt: existingJob.completedAt ?? nowIso(),
      result: {
        executionId: payload.executionId,
        status: "COMPLETE",
        title: normalizedTitle,
        wordpressPageId: wordpressIdentifier,
        wordpressUrl: payload.wordpressUrl,
        wordpressPostId: normalizedWordpressPostId,
        featuredImageUrl: payload.featuredImageUrl,
        executionTimeMs: payload.executionTimeMs,
      },
      error: null,
    });
    await emitGlwJobLifecycleEvent(eventStore ?? null, updated, {
      type: "SUCCEEDED",
      label: "Succeeded",
      stage: "completed",
      message: "Callback marked job as complete.",
      idempotencyKey: `${updated.id}:COMPLETE:${updated.updatedAt}`,
      correlationId: payload.executionId,
    });
    orchestration.syncGlwExecutionState({
      jobId: updated.id,
      status: updated.status,
      correlationId: payload.executionId,
      result: updated.result as Record<string, unknown> | null,
    });
    return updated;
  }

  if (payload.status === "FAILED") {
    if (!payload.error) {
      throw new Error("Failed callback payload must include an error.");
    }

    const updated = await repository.update(existingJob.id, {
      status: "FAILED",
      externalExecutionId: payload.executionId,
      completedAt: existingJob.completedAt ?? nowIso(),
      result: existingJob.result,
      error: payload.error,
    });
    await emitGlwJobLifecycleEvent(eventStore ?? null, updated, {
      type: "FAILED",
      label: "Failed",
      stage: payload.error.step ?? "callback",
      message: payload.error.message,
      idempotencyKey: `${updated.id}:FAILED:${updated.updatedAt}`,
      correlationId: payload.executionId,
    });
    orchestration.syncGlwExecutionState({
      jobId: updated.id,
      status: updated.status,
      correlationId: payload.executionId,
      errorMessage: updated.error?.message,
      result: updated.result as Record<string, unknown> | null,
    });
    return updated;
  }

  const updated = await repository.update(existingJob.id, {
    status: payload.status,
    externalExecutionId: payload.executionId,
    startedAt: existingJob.startedAt ?? nowIso(),
    completedAt: existingJob.completedAt,
    result: {
      executionId: payload.executionId,
      status: payload.status,
      title: normalizedTitle,
    },
    error: null,
  });
  await emitGlwJobLifecycleEvent(eventStore ?? null, updated, {
    type: "STAGE_CHANGED",
    label: "Stage Changed",
    stage: payload.status.toLowerCase(),
    message: `Callback advanced job to ${payload.status}.`,
    idempotencyKey: `${updated.id}:${updated.status}:${updated.updatedAt}`,
    correlationId: payload.executionId,
  });
  orchestration.syncGlwExecutionState({
    jobId: updated.id,
    status: updated.status,
    correlationId: payload.executionId,
    result: updated.result as Record<string, unknown> | null,
  });
  return updated;
}
