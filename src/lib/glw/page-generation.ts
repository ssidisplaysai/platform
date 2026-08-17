import {
  buildGlwPageTitle,
  canTransitionGlwJobStatus,
  createGlwJobInput,
  createGlwJobRecord,
  GlwJobError,
  GlwJobRecord,
  GlwJobRepository,
  validatePageGenerationRequest,
  normalizeGlwQaChecks,
  normalizeGlwQaFailureReasons,
  GlwPageGenerationRequest,
  GlwPageGenerationCallbackPayload,
  normalizeGlwWordpressUrlForDisplay,
  normalizeGlwJobError,
} from "./jobs";
import { GlwN8nResponse, GlwN8nTransport } from "./n8n";
import {
  createGlwProducerOperationIdentity,
  type GlwProducerOperationIdentity,
} from "./producer-callback-contract";
import type { GenesisEventStore } from "@/platform/gop/event-store";
import { backfillGlwJobEvents, emitGlwJobLifecycleEvent } from "@/platform/gop/adapters/glw-events";
import { getGenesisOrchestrationRuntime } from "@/platform/gop/runtime/orchestration-runtime";
import type { GenesisJobStatus } from "@/platform/gop/contracts";

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
      n8nExecutionId: response.executionId,
      status: "COMPLETE",
      title: response.title,
      wordpressPageId: response.wordpressPageId ?? response.wordpressPostId,
      wordpressUrl: response.wordpressUrl,
      wordpressPostId: response.wordpressPostId,
      wordpressStatus: response.wordpressStatus,
      requestedPublishingMode: response.requestedPublishingMode,
      disposition: response.disposition,
      qaChecks: normalizeGlwQaChecks(response.qaChecks),
      qaFailureReasons: normalizeGlwQaFailureReasons(response.qaFailureReasons),
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

function toOrchestrationStatus(status: GlwJobRecord["status"]): GenesisJobStatus {
  return status === "FAILED_QA" ? "FAILED" : status;
}

export function refreshGlwCallbackProjection(job: GlwJobRecord, correlationId: string): void {
  getGenesisOrchestrationRuntime().syncGlwExecutionState({
    jobId: job.id,
    status: toOrchestrationStatus(job.status),
    correlationId,
    errorMessage: job.error?.message,
    result: job.result as Record<string, unknown> | null,
  });
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
  producerIdentity?: GlwProducerOperationIdentity,
): Promise<GlwJobOperationResult> {
  const validation = validatePageGenerationRequest(request);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const now = dependencies.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const callbackUrl = buildCallbackUrl(dependencies.appUrl);
  const input = createGlwJobInput(request, callbackUrl);
  const title = buildGlwPageTitle(request);
  const identity = createGlwProducerOperationIdentity(producerIdentity);
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
    operationKey: identity.operationKey,
    publicationKey: identity.publicationKey,
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
    status: toOrchestrationStatus(startingJob.status),
  });

  try {
    const response = await dependencies.workflow.invokePageGeneration({
      jobId: startingJob.id,
      operationKey: identity.operationKey,
      publicationKey: identity.publicationKey,
      type: "page_generation",
      workspaceId: startingJob.input.page.workspaceId,
      workspace_id: startingJob.input.page.workspaceId,
      site: {
        id: startingJob.input.site.id,
        name: startingJob.input.site.name,
      },
      page: {
        ...startingJob.input.page,
        page_type: startingJob.input.page.pageType,
        product_topic: startingJob.input.page.productTopic,
        city_slug: startingJob.input.page.citySlug,
        hierarchical_slug: startingJob.input.page.hierarchicalSlug,
        additional_instructions: startingJob.input.page.additionalInstructions,
      },
      promptData: startingJob.input.promptData,
      seoSettings: {
        ...startingJob.input.seoSettings,
        city_slug: startingJob.input.seoSettings.citySlug,
      },
      publishingSettings: startingJob.input.publishingSettings,
      imageSettings: startingJob.input.imageSettings,
      workflowContext: {
        workspaceId: startingJob.input.page.workspaceId,
        pageType: startingJob.input.page.pageType,
        productTopic: startingJob.input.page.productTopic,
        state: startingJob.input.page.state,
        city: startingJob.input.page.city,
        citySlug: startingJob.input.page.citySlug,
        hierarchicalSlug: startingJob.input.page.hierarchicalSlug,
        additionalInstructions: startingJob.input.page.additionalInstructions,
      },
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
        status: toOrchestrationStatus(failedJob.status),
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
      const completionResult = buildResultFromResponse(response);
      const normalizedWordpressUrl = completionResult
        ? normalizeGlwWordpressUrlForDisplay({
            wordpressUrl: completionResult.wordpressUrl,
            wordpressStatus: completionResult.wordpressStatus,
            requestedPublishingMode: completionResult.requestedPublishingMode ?? startingJob.input.page.status,
            wordpressPageId: completionResult.wordpressPageId ?? completionResult.wordpressPostId,
            hierarchicalSlug: startingJob.input.page.hierarchicalSlug,
          })
        : null;
      const completedJob = await dependencies.repository.update(startingJob.id, {
        status: "COMPLETE",
        completedAt: now().toISOString(),
        result: completionResult
          ? {
              ...completionResult,
              wordpressUrl: normalizedWordpressUrl ?? completionResult.wordpressUrl,
              requestedPublishingMode: startingJob.input.page.status,
              wordpressStatus: completionResult.wordpressStatus ?? startingJob.input.page.status,
            }
          : completionResult,
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
        status: toOrchestrationStatus(completedJob.status),
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
      result: (() => {
        const runningResult = buildResultFromResponse(response);
        return runningResult
          ? {
              ...runningResult,
              requestedPublishingMode: startingJob.input.page.status,
            }
          : runningResult;
      })(),
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
      status: toOrchestrationStatus(runningJob.status),
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
      status: toOrchestrationStatus(failedJob.status),
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

  if (existingJob.status !== "FAILED" && existingJob.status !== "FAILED_QA") {
    throw new Error("Only failed GLW jobs can be retried.");
  }

  const latestRetry = await dependencies.repository.findLatestRetryForJob(existingJob.id);

  if (latestRetry && latestRetry.status !== "FAILED" && latestRetry.status !== "COMPLETE") {
    throw new Error("The latest retry for this job is still in progress.");
  }

  return submitGlwPageGenerationJob(
    {
      siteId: existingJob.input.site.id,
      workspaceId: existingJob.input.page.workspaceId,
      pageType: existingJob.input.page.pageType,
      productTopic: existingJob.input.page.productTopic,
      state: existingJob.input.page.state,
      city: existingJob.input.page.city,
      citySlug: existingJob.input.page.citySlug,
      hierarchicalSlug: existingJob.input.page.hierarchicalSlug,
      additionalInstructions: existingJob.input.page.additionalInstructions,
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
    createGlwProducerOperationIdentity({
      operationKey: existingJob.operationKey ?? undefined,
      publicationKey: existingJob.publicationKey ?? undefined,
    }),
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
  const normalizedRequestedPublishingMode = payload.requestedPublishingMode ?? existingJob.input.page.status;
  const normalizedWordpressStatus = payload.wordpressStatus ?? normalizedRequestedPublishingMode;
  const normalizedWordpressUrl = normalizeGlwWordpressUrlForDisplay({
    wordpressUrl: payload.wordpressUrl ?? existingJob.result?.wordpressUrl,
    wordpressStatus: normalizedWordpressStatus,
    requestedPublishingMode: normalizedRequestedPublishingMode,
    wordpressPageId: normalizedWordpressIdentifier,
    hierarchicalSlug: existingJob.input.page.hierarchicalSlug,
  });
  const normalizedQaChecks = normalizeGlwQaChecks(payload.qaChecks);
  const normalizedQaFailureReasons = normalizeGlwQaFailureReasons(payload.qaFailureReasons);

  const sameExecution = existingJob.externalExecutionId === payload.executionId;
  const sameStatus = existingJob.status === payload.status;
  const sameResult =
    existingJob.result?.executionId === payload.executionId &&
    existingJob.result?.n8nExecutionId === payload.executionId &&
    existingJob.result?.status === payload.status &&
    existingJob.result?.title === normalizedTitle &&
    existingJob.result?.wordpressPageId === normalizedWordpressIdentifier &&
    existingJob.result?.wordpressUrl === (normalizedWordpressUrl ?? undefined) &&
    existingJob.result?.wordpressPostId === normalizedWordpressPostId &&
    existingJob.result?.wordpressStatus === normalizedWordpressStatus &&
    existingJob.result?.requestedPublishingMode === normalizedRequestedPublishingMode &&
    existingJob.result?.disposition === payload.disposition &&
    JSON.stringify(existingJob.result?.qaChecks ?? null) === JSON.stringify(normalizedQaChecks ?? null) &&
    JSON.stringify(existingJob.result?.qaFailureReasons ?? null) === JSON.stringify(normalizedQaFailureReasons ?? null) &&
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
        n8nExecutionId: payload.executionId,
        status: "COMPLETE",
        title: normalizedTitle,
        wordpressPageId: wordpressIdentifier,
        wordpressUrl: normalizedWordpressUrl ?? payload.wordpressUrl,
        wordpressPostId: normalizedWordpressPostId,
        wordpressStatus: normalizedWordpressStatus,
        requestedPublishingMode: normalizedRequestedPublishingMode,
        disposition: payload.disposition,
        qaChecks: normalizedQaChecks,
        qaFailureReasons: normalizedQaFailureReasons,
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
      status: toOrchestrationStatus(updated.status),
      correlationId: payload.executionId,
      result: updated.result as Record<string, unknown> | null,
    });
    return updated;
  }

  if (payload.status === "FAILED_QA") {
    const updated = await repository.update(existingJob.id, {
      status: "FAILED_QA",
      title: normalizedTitle,
      externalExecutionId: payload.executionId,
      completedAt: existingJob.completedAt ?? nowIso(),
      result: {
        executionId: payload.executionId,
        n8nExecutionId: payload.executionId,
        status: "FAILED_QA",
        title: normalizedTitle,
        wordpressPageId: normalizedWordpressIdentifier,
        wordpressUrl: normalizedWordpressUrl ?? payload.wordpressUrl,
        wordpressPostId: normalizedWordpressPostId,
        wordpressStatus: normalizedWordpressStatus,
        requestedPublishingMode: normalizedRequestedPublishingMode,
        disposition: payload.disposition ?? "FAILED_QA",
        qaChecks: normalizedQaChecks,
        qaFailureReasons: normalizedQaFailureReasons,
        featuredImageUrl: payload.featuredImageUrl,
        executionTimeMs: payload.executionTimeMs,
      },
      error: payload.error ?? {
        code: "FAILED_QA",
        step: "Pre-Publish QA Gate",
        message: "Pre-publish QA gate failed.",
      },
    });
    await emitGlwJobLifecycleEvent(eventStore ?? null, updated, {
      type: "FAILED",
      label: "QA Failed",
      stage: "qa_gate",
      message: updated.error?.message ?? "Pre-publish QA gate failed.",
      idempotencyKey: `${updated.id}:FAILED_QA:${updated.updatedAt}`,
      correlationId: payload.executionId,
    });
    orchestration.syncGlwExecutionState({
      jobId: updated.id,
      status: toOrchestrationStatus(updated.status),
      correlationId: payload.executionId,
      errorMessage: updated.error?.message,
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
      status: toOrchestrationStatus(updated.status),
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
      qaChecks: normalizedQaChecks,
      qaFailureReasons: normalizedQaFailureReasons,
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
    status: toOrchestrationStatus(updated.status),
    correlationId: payload.executionId,
    result: updated.result as Record<string, unknown> | null,
  });
  return updated;
}
