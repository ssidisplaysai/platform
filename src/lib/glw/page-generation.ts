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
      wordpressUrl: response.wordpressUrl,
      wordpressPostId: response.wordpressPostId,
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
  const startingJob = await dependencies.repository.update(queuedJob.id, {
    status: "STARTING",
    startedAt,
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
      callbackUrl,
    });

    if (response.kind === "failed") {
      const failedJob = await dependencies.repository.update(startingJob.id, {
        status: "FAILED",
        completedAt: now().toISOString(),
        result: null,
        error: response.error,
        externalExecutionId: response.executionId ?? null,
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
      product: existingJob.input.page.product,
      category: existingJob.input.page.category,
      state: existingJob.input.page.state,
      city: existingJob.input.page.city,
      primaryKeyword: existingJob.input.page.primaryKeyword,
      additionalInstructions: existingJob.input.page.additionalInstructions,
      publishingMode: existingJob.input.page.publishingMode,
    },
    dependencies,
    existingJob.id,
  );
}

export async function applyGlwJobCallback(
  payload: GlwPageGenerationCallbackPayload,
  repository: GlwJobRepository,
): Promise<GlwJobRecord> {
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

  const sameExecution = existingJob.externalExecutionId === payload.executionId;
  const sameStatus = existingJob.status === payload.status;
  const sameResult =
    existingJob.result?.executionId === payload.executionId &&
    existingJob.result?.status === payload.status &&
    existingJob.result?.title === payload.title &&
    existingJob.result?.wordpressUrl === payload.wordpressUrl &&
    existingJob.result?.wordpressPostId === payload.wordpressPostId;
  const sameError =
    existingJob.error?.message === payload.error?.message &&
    existingJob.error?.step === payload.error?.step &&
    existingJob.error?.code === payload.error?.code;

  if (sameExecution && sameStatus && sameResult && sameError) {
    return existingJob;
  }

  if (payload.status === "COMPLETE") {
    if (!payload.wordpressUrl || payload.wordpressPostId === undefined || payload.wordpressPostId === null) {
      throw new Error("Completed callback payload must include a WordPress URL and post identifier.");
    }

    return repository.update(existingJob.id, {
      status: "COMPLETE",
      title: payload.title ?? existingJob.title,
      externalExecutionId: payload.executionId,
      completedAt: existingJob.completedAt ?? nowIso(),
      result: {
        executionId: payload.executionId,
        status: "COMPLETE",
        title: payload.title ?? existingJob.title,
        wordpressUrl: payload.wordpressUrl,
        wordpressPostId: payload.wordpressPostId,
      },
      error: null,
    });
  }

  if (payload.status === "FAILED") {
    if (!payload.error) {
      throw new Error("Failed callback payload must include an error.");
    }

    return repository.update(existingJob.id, {
      status: "FAILED",
      externalExecutionId: payload.executionId,
      completedAt: existingJob.completedAt ?? nowIso(),
      result: existingJob.result,
      error: payload.error,
    });
  }

  return repository.update(existingJob.id, {
    status: payload.status,
    externalExecutionId: payload.executionId,
    startedAt: existingJob.startedAt ?? nowIso(),
    completedAt: payload.status === "COMPLETE" || payload.status === "FAILED"
      ? (existingJob.completedAt ?? nowIso())
      : existingJob.completedAt,
    result: {
      executionId: payload.executionId,
      status: payload.status,
      title: payload.title ?? existingJob.title,
    },
    error: null,
  });
}
