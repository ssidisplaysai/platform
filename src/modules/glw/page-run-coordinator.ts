import type { GlwGenerationRequest } from "./page-generation";
import type { GlwPageExecutionRecord } from "./page-execution";
import {
  glwPageRunRepository,
} from "./page-run-repository";
import type {
  GlwPageRunRecord,
  GlwPageRunRepository,
} from "./page-run";

export class GlwPageRunIdentityError extends Error {}

function normalizePath(value: string): string {
  return value.trim().replace(/^\/+|\/+$/g, "");
}

function normalizeCitySlug(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized || null;
}

export function assertGlwPageRunMatchesGenerationRequest(input: {
  run: GlwPageRunRecord;
  request: GlwGenerationRequest;
  targetId?: string | null;
}): void {
  const targetId = input.targetId?.trim() || input.run.targetId;

  const matches =
    input.run.targetId === targetId
    && input.run.campaignId === input.request.campaignId
    && input.run.organizationId === input.request.organizationId
    && input.run.siteId === input.request.siteId
    && input.run.productId === input.request.productId
    && input.run.stateCode === input.request.stateCode.trim().toUpperCase()
    && normalizeCitySlug(input.run.citySlug) === normalizeCitySlug(input.request.citySlug)
    && normalizePath(input.run.canonicalPath) === normalizePath(input.request.canonicalPath);

  if (!matches) {
    throw new GlwPageRunIdentityError(
      "PageRun identity does not match the exact generation target.",
    );
  }
}

function failureCode(job: GlwPageExecutionRecord): string {
  return job.errorCode?.trim() || "PAGE_RUN_EXECUTION_FAILED";
}

function failureMessage(job: GlwPageExecutionRecord): string {
  return job.errorMessage?.trim() || "The page execution failed.";
}

export async function synchronizeGlwPageRunWithExecution(input: {
  runId: string;
  job: GlwPageExecutionRecord;
  repository?: GlwPageRunRepository;
}): Promise<GlwPageRunRecord> {
  const repository = input.repository ?? glwPageRunRepository;
  let run = await repository.getById(input.runId);

  if (!run) {
    throw new GlwPageRunIdentityError(`Unknown PageRun: ${input.runId}`);
  }

  if (run.generationJobId && run.generationJobId !== input.job.jobId) {
    throw new GlwPageRunIdentityError(
      "PageRun is already bound to a different generation job.",
    );
  }

  if (
    run.externalExecutionId
    && input.job.externalExecutionId
    && run.externalExecutionId !== input.job.externalExecutionId
  ) {
    throw new GlwPageRunIdentityError(
      "PageRun external execution identity does not match the generation job.",
    );
  }

  if (run.status === "PUBLISHED" || run.status === "ABANDONED") {
    return run;
  }

  if (run.status === "FAILED") {
    return run;
  }

  if (run.status === "CREATED") {
    run = await repository.transition(run.runId, "CREATED", {
      to: "DISPATCHED",
      generationJobId: input.job.jobId,
      externalExecutionId: input.job.externalExecutionId,
    });
  }

  if (
    run.status === "DISPATCHED"
    && input.job.externalExecutionId
    && (
      input.job.status === "RUNNING"
      || input.job.status === "DISCOVERING_EXECUTION"
    )
  ) {
    run = await repository.transition(run.runId, "DISPATCHED", {
      to: "RUNNING",
      generationJobId: input.job.jobId,
      externalExecutionId: input.job.externalExecutionId,
    });
  }

  if (input.job.status === "FAILED") {
    return repository.transition(run.runId, run.status, {
      to: "FAILED",
      code: failureCode(input.job),
      message: failureMessage(input.job),
    });
  }

  const generated =
    input.job.status === "CONTENT_READY"
    || input.job.status === "COMPLETE";

  if (generated && (run.status === "DISPATCHED" || run.status === "RUNNING")) {
    if (!input.job.externalExecutionId || !input.job.generatedDraft) {
      throw new GlwPageRunIdentityError(
        "Generated PageRun requires exact external execution identity and generated content.",
      );
    }

    run = await repository.transition(run.runId, run.status, {
      to: "GENERATED",
      generationJobId: input.job.jobId,
      externalExecutionId: input.job.externalExecutionId,
      generatedDraft: input.job.generatedDraft,
    });
  }

  if (
    input.job.status === "COMPLETE"
    && run.status === "GENERATED"
    && input.job.qaStatus === "COMPLETE"
  ) {
    run = await repository.transition(run.runId, "GENERATED", {
      to: "QA_PASSED",
      qaChecks: input.job.qaChecks ?? {},
    });
  }

  if (
    input.job.status === "COMPLETE"
    && run.status === "QA_PASSED"
    && input.job.wordpressStatus === "draft"
    && input.job.wordpressObjectId
  ) {
    run = await repository.transition(run.runId, "QA_PASSED", {
      to: "WORDPRESS_DRAFT",
      wordpressObjectId: input.job.wordpressObjectId,
      wordpressUrl: input.job.wordpressUrl,
    });
  }

  return run;
}
