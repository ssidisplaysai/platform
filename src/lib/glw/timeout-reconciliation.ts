import {
  GLW_JOB_TIMEOUT_MS,
  GlwJobRecord,
  GlwJobRepository,
  glwNonTerminalJobStatuses,
  isGlwJobTimedOut,
  isTerminalGlwJobStatus,
} from "./jobs";

export type GlwTimeoutReconciliationAction =
  | "RECONCILED"
  | "SKIPPED_FRESH"
  | "SKIPPED_TERMINAL"
  | "SKIPPED_RACE_TERMINAL"
  | "SKIPPED_RACE_NON_TERMINAL"
  | "ERROR";

export type GlwTimeoutReconciliationItemResult = {
  jobId: string;
  previousStatus: GlwJobRecord["status"];
  currentStatus: GlwJobRecord["status"];
  action: GlwTimeoutReconciliationAction;
  errorMessage?: string;
};

export type GlwTimeoutReconciliationResult = {
  startedAt: string;
  completedAt: string;
  scanned: number;
  eligible: number;
  reconciled: number;
  skipped: number;
  alreadyTerminal: number;
  errors: number;
  items: GlwTimeoutReconciliationItemResult[];
};

function buildTimedOutError() {
  return {
    code: "TIMED_OUT",
    step: "workflow",
    message: "GLW job timed out while waiting for workflow completion callback.",
  };
}

export async function reconcileGlwTimedOutJob(
  job: GlwJobRecord,
  repository: GlwJobRepository,
  options?: {
    now?: Date;
    timeoutMs?: number;
  },
): Promise<GlwTimeoutReconciliationItemResult> {
  const now = options?.now ?? new Date();
  const timeoutMs = options?.timeoutMs ?? GLW_JOB_TIMEOUT_MS;

  if (isTerminalGlwJobStatus(job.status)) {
    return {
      jobId: job.id,
      previousStatus: job.status,
      currentStatus: job.status,
      action: "SKIPPED_TERMINAL",
    };
  }

  if (!isGlwJobTimedOut(job, now, timeoutMs)) {
    return {
      jobId: job.id,
      previousStatus: job.status,
      currentStatus: job.status,
      action: "SKIPPED_FRESH",
    };
  }

  const updated = await repository.updateIfCurrentStatusIn(job.id, glwNonTerminalJobStatuses, {
    status: "FAILED",
    completedAt: job.completedAt ?? now.toISOString(),
    result: job.result,
    error: job.error ?? buildTimedOutError(),
  });

  if (!updated) {
    return {
      jobId: job.id,
      previousStatus: job.status,
      currentStatus: job.status,
      action: "ERROR",
      errorMessage: "GLW job not found during timeout reconciliation.",
    };
  }

  if (isTerminalGlwJobStatus(updated.status) && updated.status !== "FAILED") {
    return {
      jobId: job.id,
      previousStatus: job.status,
      currentStatus: updated.status,
      action: "SKIPPED_RACE_TERMINAL",
    };
  }

  if (updated.status !== "FAILED") {
    return {
      jobId: job.id,
      previousStatus: job.status,
      currentStatus: updated.status,
      action: "SKIPPED_RACE_NON_TERMINAL",
    };
  }

  return {
    jobId: job.id,
    previousStatus: job.status,
    currentStatus: updated.status,
    action: "RECONCILED",
  };
}

export async function reconcileGlwTimedOutJobs(
  jobs: GlwJobRecord[],
  repository: GlwJobRepository,
  options?: {
    now?: Date;
    timeoutMs?: number;
  },
): Promise<GlwJobRecord[]> {
  const results = await Promise.all(
    jobs.map(async (job) => {
      await reconcileGlwTimedOutJob(job, repository, options);
      return repository.findById(job.id);
    }),
  );

  return results.filter((job): job is GlwJobRecord => Boolean(job));
}

export async function runGlwTimeoutReconciliation(input: {
  repository: GlwJobRepository;
  now?: Date;
  timeoutMs?: number;
  limit?: number;
}): Promise<GlwTimeoutReconciliationResult> {
  const startedAtDate = input.now ?? new Date();
  const timeoutMs = input.timeoutMs ?? GLW_JOB_TIMEOUT_MS;
  const limit = Math.max(1, Math.min(1000, input.limit ?? 200));

  const candidates = await input.repository.findPageGenerationJobsByStatuses(glwNonTerminalJobStatuses, limit);
  const items: GlwTimeoutReconciliationItemResult[] = [];

  let eligible = 0;
  let reconciled = 0;
  let skipped = 0;
  let alreadyTerminal = 0;
  let errors = 0;

  for (const job of candidates) {
    const timedOut = isGlwJobTimedOut(job, startedAtDate, timeoutMs);
    if (timedOut) {
      eligible += 1;
    }

    try {
      const result = await reconcileGlwTimedOutJob(job, input.repository, {
        now: startedAtDate,
        timeoutMs,
      });
      items.push(result);

      if (result.action === "RECONCILED") {
        reconciled += 1;
      } else if (result.action === "SKIPPED_TERMINAL" || result.action === "SKIPPED_RACE_TERMINAL") {
        alreadyTerminal += 1;
      } else if (result.action === "ERROR") {
        errors += 1;
      } else {
        skipped += 1;
      }
    } catch (error) {
      errors += 1;
      items.push({
        jobId: job.id,
        previousStatus: job.status,
        currentStatus: job.status,
        action: "ERROR",
        errorMessage: error instanceof Error ? error.message : "Unknown reconciliation error.",
      });
    }
  }

  return {
    startedAt: startedAtDate.toISOString(),
    completedAt: new Date().toISOString(),
    scanned: candidates.length,
    eligible,
    reconciled,
    skipped,
    alreadyTerminal,
    errors,
    items,
  };
}
