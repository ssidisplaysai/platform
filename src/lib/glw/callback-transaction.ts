import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { GenesisExecution } from "@/platform/gop/contracts";
import { deriveGlwCallbackIdentity, type GlwCallbackIdentity } from "./callback-idempotency";
import { getPrismaClient } from "./prisma";
import {
  canTransitionGlwJobStatus,
  isTerminalGlwJobStatus,
  normalizeGlwQaChecks,
  normalizeGlwQaFailureReasons,
  normalizeGlwWordpressUrlForDisplay,
  parseGlwJobRecord,
  toJsonValue,
  type GlwBusinessStatus,
  type GlwJobError,
  type GlwJobRecord,
  type GlwJobResult,
  type GlwPageGenerationCallbackPayload,
} from "./jobs";

export type GlwCallbackTransactionOutcome =
  | { outcome: "APPLIED" | "ALREADY_APPLIED"; receiptId: string; job: GlwJobRecord }
  | { outcome: "IDEMPOTENCY_CONFLICT" | "TERMINAL_CONFLICT" | "EXECUTION_CONFLICT" | "STATE_CONFLICT"; receiptId?: string; message: string }
  | { outcome: "NOT_FOUND"; message: string };

export class GlwCallbackTransactionUnavailableError extends Error {
  readonly code: "DATABASE_UNAVAILABLE" | "TRANSACTION_RETRY";

  constructor(code: "DATABASE_UNAVAILABLE" | "TRANSACTION_RETRY", cause?: unknown) {
    super(code === "DATABASE_UNAVAILABLE" ? "Callback database is unavailable." : "Callback transaction must be retried.", { cause });
    this.name = "GlwCallbackTransactionUnavailableError";
    this.code = code;
  }
}

export type GlwCallbackReceiptIdentityRecord = {
  receiptId: string;
  idempotencyKey: string;
  terminalScopeKey: string;
  jobId: string;
  externalExecutionId: string;
  terminalStatus: string;
  payloadSha256: string;
  outcome: string;
};

type TerminalEffect = {
  title: string;
  result: GlwJobResult | null;
  error: GlwJobError | null;
  businessStatus: GlwBusinessStatus;
  eventType: "SUCCEEDED" | "FAILED";
  eventStage: string;
  eventMessage: string;
};

function isTransientTransactionError(error: unknown): boolean {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  const message = error instanceof Error ? error.message : "";
  return code === "40001" || code === "40P01" || code === "P2034" || /serializ|deadlock|40001|40P01/i.test(message);
}

function isDatabaseUnavailableError(error: unknown): boolean {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  const message = error instanceof Error ? error.message : "";
  return ["P1000", "P1001", "P1002", "P1008", "P1017", "ECONNREFUSED", "ECONNRESET"].includes(code)
    || /connection|database server|socket/i.test(message);
}

export function validateGlwTerminalCallbackPayload(payload: GlwPageGenerationCallbackPayload): void {
  if (!isTerminalGlwJobStatus(payload.status)) {
    throw new Error("Durable callback receipts accept terminal GLW statuses only.");
  }
  if (payload.status === "COMPLETE" && (!payload.wordpressUrl || (payload.wordpressPageId == null && payload.wordpressPostId == null))) {
    throw new Error("Completed callback payload must include a WordPress URL and post identifier.");
  }
  if (payload.status === "FAILED" && !payload.error) {
    throw new Error("Failed callback payload must include an error.");
  }
}

function composeTerminalEffect(job: GlwJobRecord, payload: GlwPageGenerationCallbackPayload): TerminalEffect {
  validateGlwTerminalCallbackPayload(payload);
  const title = payload.title ?? job.title;
  const wordpressPageId = payload.wordpressPageId ?? payload.wordpressPostId;
  const wordpressPostId = payload.wordpressPostId ?? wordpressPageId;
  const requestedPublishingMode = payload.requestedPublishingMode ?? job.input.page.status;
  const wordpressStatus = payload.wordpressStatus ?? requestedPublishingMode;
  const wordpressUrl = normalizeGlwWordpressUrlForDisplay({
    wordpressUrl: payload.wordpressUrl ?? job.result?.wordpressUrl,
    wordpressStatus,
    requestedPublishingMode,
    wordpressPageId,
    hierarchicalSlug: job.input.page.hierarchicalSlug,
  });
  const qaChecks = normalizeGlwQaChecks(payload.qaChecks);
  const qaFailureReasons = normalizeGlwQaFailureReasons(payload.qaFailureReasons);

  if (payload.status === "COMPLETE") {
    const result: GlwJobResult = {
      executionId: payload.executionId,
      n8nExecutionId: payload.executionId,
      status: "COMPLETE",
      title,
      wordpressPageId: wordpressPageId!,
      wordpressUrl: wordpressUrl ?? payload.wordpressUrl,
      wordpressPostId,
      wordpressStatus,
      requestedPublishingMode,
      disposition: payload.disposition,
      qaChecks,
      qaFailureReasons,
      featuredImageUrl: payload.featuredImageUrl,
      executionTimeMs: payload.executionTimeMs,
    };
    return { title, result, error: null, businessStatus: "COMPLETE", eventType: "SUCCEEDED", eventStage: "completed", eventMessage: "Callback marked job as complete." };
  }

  if (payload.status === "FAILED_QA") {
    const error = payload.error ?? { code: "FAILED_QA", step: "Pre-Publish QA Gate", message: "Pre-publish QA gate failed." };
    const result: GlwJobResult = {
      executionId: payload.executionId,
      n8nExecutionId: payload.executionId,
      status: "FAILED_QA",
      title,
      wordpressPageId,
      wordpressUrl: wordpressUrl ?? payload.wordpressUrl,
      wordpressPostId,
      wordpressStatus,
      requestedPublishingMode,
      disposition: payload.disposition ?? "FAILED_QA",
      qaChecks,
      qaFailureReasons,
      featuredImageUrl: payload.featuredImageUrl,
      executionTimeMs: payload.executionTimeMs,
    };
    return { title, result, error, businessStatus: "FAILED_QA", eventType: "FAILED", eventStage: "qa_gate", eventMessage: error.message };
  }

  return {
    title,
    result: job.result,
    error: payload.error!,
    businessStatus: "FAILED",
    eventType: "FAILED",
    eventStage: payload.error!.step ?? "callback",
    eventMessage: payload.error!.message,
  };
}

export function classifyExistingGlwCallbackReceipt(
  receipt: GlwCallbackReceiptIdentityRecord,
  identity: GlwCallbackIdentity,
): GlwCallbackTransactionOutcome | null {
  const exact = receipt.idempotencyKey === identity.idempotencyKey
    && receipt.terminalScopeKey === identity.terminalScopeKey
    && receipt.payloadSha256 === identity.payloadSha256
    && receipt.jobId === identity.canonicalPayload.jobId
    && receipt.externalExecutionId === identity.canonicalPayload.executionId;

  if (exact && receipt.outcome === "APPLIED") {
    return null;
  }

  const sameKey = receipt.idempotencyKey === identity.idempotencyKey;
  return {
    outcome: sameKey ? "IDEMPOTENCY_CONFLICT" : "TERMINAL_CONFLICT",
    receiptId: receipt.receiptId,
    message: sameKey ? "Callback idempotency key conflicts with the durable receipt." : "Callback terminal scope has already been claimed.",
  };
}

async function runTransaction(
  prisma: PrismaClient,
  payload: GlwPageGenerationCallbackPayload,
  identity: GlwCallbackIdentity,
  now: Date,
): Promise<GlwCallbackTransactionOutcome> {
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${payload.jobId}))`;
    const locked = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "GlwJob" WHERE "id" = ${payload.jobId} FOR UPDATE
    `;
    if (!locked[0]) {
      return { outcome: "NOT_FOUND", message: `GLW job not found: ${payload.jobId}` };
    }

    const jobRow = await transaction.glwJob.findUnique({ where: { id: payload.jobId } });
    if (!jobRow) {
      return { outcome: "NOT_FOUND", message: `GLW job not found: ${payload.jobId}` };
    }
    const job = parseGlwJobRecord(jobRow);
    if (job.externalExecutionId && job.externalExecutionId !== payload.executionId) {
      return { outcome: "EXECUTION_CONFLICT", message: "Callback execution identifier does not match the tracked GLW job." };
    }
    if (identity.mode === "V2" && job.operationKey && job.operationKey !== identity.operationKey) {
      return { outcome: "EXECUTION_CONFLICT", message: "Callback operation identifier does not match the tracked GLW job." };
    }

    const receiptId = randomUUID();
    const inserted = await transaction.$queryRaw<Array<{ receiptId: string }>>`
      INSERT INTO "GlwCallbackReceipt" (
        "receiptId", "idempotencyKey", "terminalScopeKey", "operationKey", "jobId",
        "externalExecutionId", "callbackType", "terminalStatus", "payloadSha256", "payloadJson", "outcome",
        "receivedAt", "createdAt", "updatedAt"
      ) VALUES (
        ${receiptId}, ${identity.idempotencyKey}, ${identity.terminalScopeKey}, ${identity.operationKey}, ${payload.jobId},
        ${payload.executionId}, ${identity.callbackType}, ${payload.status}, ${identity.payloadSha256},
        CAST(${JSON.stringify(identity.canonicalPayload)} AS JSONB), 'RECEIVED', ${now}, ${now}, ${now}
      ) ON CONFLICT DO NOTHING
      RETURNING "receiptId"
    `;

    if (!inserted[0]) {
      const receipts = await transaction.$queryRaw<GlwCallbackReceiptIdentityRecord[]>`
        SELECT "receiptId", "idempotencyKey", "terminalScopeKey", "jobId", "externalExecutionId",
               "terminalStatus", "payloadSha256", "outcome"
        FROM "GlwCallbackReceipt"
        WHERE "idempotencyKey" = ${identity.idempotencyKey} OR "terminalScopeKey" = ${identity.terminalScopeKey}
        ORDER BY CASE WHEN "idempotencyKey" = ${identity.idempotencyKey} THEN 0 ELSE 1 END
        LIMIT 1
      `;
      const receipt = receipts[0];
      if (!receipt) {
        throw new GlwCallbackTransactionUnavailableError("TRANSACTION_RETRY");
      }
      const conflict = classifyExistingGlwCallbackReceipt(receipt, identity);
      if (conflict) {
        return conflict;
      }
      return { outcome: "ALREADY_APPLIED", receiptId: receipt.receiptId, job };
    }

    if (!canTransitionGlwJobStatus(job.status, payload.status)) {
      throw new Prisma.PrismaClientKnownRequestError(
        `Invalid GLW job status transition from ${job.status} to ${payload.status}.`,
        { code: "HR004_STATE_CONFLICT", clientVersion: "slice-b" },
      );
    }

    const effect = composeTerminalEffect(job, payload);
    const completedAt = job.completedAt ? new Date(job.completedAt) : now;
    const updatedRow = await transaction.glwJob.update({
      where: { id: job.id },
      data: {
        status: payload.status,
        title: effect.title,
        externalExecutionId: payload.executionId,
        completedAt,
        result: effect.result ? toJsonValue(effect.result) : Prisma.JsonNull,
        error: effect.error ? toJsonValue(effect.error) : Prisma.JsonNull,
        businessStatus: effect.businessStatus,
        callbackDeliveryStatus: "ACKNOWLEDGED",
        terminalReceiptId: receiptId,
      },
    });

    const execution = await transaction.gopExecution.findUnique({ where: { jobId: job.id } });
    if (!execution) {
      throw new Error(`GOP execution not found for GLW job: ${job.id}`);
    }
    const gopStatus = payload.status === "COMPLETE" ? "SUCCEEDED" : "FAILED";
    const updatedExecution = await transaction.gopExecution.update({
      where: { executionId: execution.executionId },
      data: {
        status: gopStatus,
        currentState: gopStatus,
        completedAt,
        correlationId: payload.executionId,
        output: effect.result ? toJsonValue(effect.result) : Prisma.JsonNull,
        metadata: toJsonValue({
          ...((execution.metadata as Record<string, unknown> | null) ?? {}),
          callbackReceiptId: receiptId,
          callbackTerminalStatus: payload.status,
          callbackError: effect.error,
        }),
      },
    });

    const latestSnapshot = await transaction.gopExecutionSnapshot.findFirst({
      where: { executionId: execution.executionId },
      orderBy: { snapshotSequence: "desc" },
      select: { snapshotSequence: true },
    });
    const latestEvent = await transaction.gopJobEvent.findFirst({
      where: { jobId: job.id },
      orderBy: { sequence: "desc" },
      select: { sequence: true },
    });
    const eventSequence = (latestEvent?.sequence ?? 0) + 1;
    const snapshotSequence = (latestSnapshot?.snapshotSequence ?? 0) + 1;
    const executionState: GenesisExecution = {
      executionId: updatedExecution.executionId,
      executionType: updatedExecution.executionType ?? undefined,
      workspaceId: updatedExecution.workspaceId,
      moduleId: updatedExecution.moduleId,
      jobType: (updatedExecution.executionType as GenesisExecution["jobType"]) ?? "PAGE_GENERATION",
      jobId: updatedExecution.jobId ?? undefined,
      executionClass: "AUTOMATED",
      status: gopStatus,
      currentState: updatedExecution.currentState ?? undefined,
      priority: updatedExecution.priority as GenesisExecution["priority"],
      queueName: updatedExecution.queueName ?? undefined,
      context: (updatedExecution.context as GenesisExecution["context"]) ?? {},
      input: (updatedExecution.input as Record<string, unknown>) ?? {},
      output: (updatedExecution.output as Record<string, unknown> | null) ?? null,
      artifacts: (updatedExecution.artifacts as GenesisExecution["artifacts"]) ?? [],
      worker: (updatedExecution.workerAssignment as GenesisExecution["worker"]) ?? null,
      correlationId: updatedExecution.correlationId ?? undefined,
      causationId: updatedExecution.causationId ?? undefined,
      parentExecutionId: updatedExecution.parentExecutionId,
      childExecutionIds: (updatedExecution.childExecutionIds as string[]) ?? [],
      retryHistory: (updatedExecution.retryHistory as GenesisExecution["retryHistory"]) ?? [],
      timing: {
        createdAt: updatedExecution.createdAt.toISOString(),
        startedAt: updatedExecution.startedAt?.toISOString(),
        completedAt: completedAt.toISOString(),
        scheduledAt: updatedExecution.scheduledAt?.toISOString(),
        archivedAt: updatedExecution.archivedAt?.toISOString(),
      },
      scheduledAt: updatedExecution.scheduledAt?.toISOString(),
      timeoutMs: updatedExecution.timeoutMs ?? undefined,
      metrics: { retries: updatedExecution.retryCount, nodeCompleted: 0, nodeTotal: 0 },
      graph: { graphId: `${updatedExecution.moduleId}:persisted`, nodes: [], edges: [] },
      currentNodeId: updatedExecution.currentNodeId ?? undefined,
      executionVersion: updatedExecution.executionVersion,
      snapshotVersion: updatedExecution.snapshotVersion,
      archivedAt: updatedExecution.archivedAt?.toISOString() ?? null,
      metadata: (updatedExecution.metadata as Record<string, unknown>) ?? undefined,
    };
    await transaction.gopExecutionSnapshot.create({
      data: {
        executionId: execution.executionId,
        snapshotVersion: updatedExecution.snapshotVersion,
        snapshotSequence,
        status: gopStatus,
        currentState: gopStatus,
        currentNodeId: updatedExecution.currentNodeId,
        progressPercent: 100,
        queuePosition: null,
        workerAssignment: updatedExecution.workerAssignment === null ? Prisma.JsonNull : toJsonValue(updatedExecution.workerAssignment),
        retryCount: updatedExecution.retryCount,
        retryHistory: updatedExecution.retryHistory === null ? Prisma.JsonNull : toJsonValue(updatedExecution.retryHistory),
        output: updatedExecution.output ?? Prisma.JsonNull,
        timing: toJsonValue(executionState.timing),
        metrics: toJsonValue(executionState.metrics),
        artifacts: updatedExecution.artifacts === null ? Prisma.JsonNull : toJsonValue(updatedExecution.artifacts),
        state: toJsonValue(executionState),
        upToEventSequence: eventSequence,
        metadata: toJsonValue({ callbackReceiptId: receiptId, idempotencyKey: identity.idempotencyKey }),
      },
    });
    await transaction.gopJobEvent.create({
      data: {
        eventId: randomUUID(),
        jobId: job.id,
        moduleId: updatedExecution.moduleId,
        jobType: updatedExecution.executionType ?? "PAGE_GENERATION",
        eventType: effect.eventType,
        stage: effect.eventStage,
        status: payload.status,
        message: effect.eventMessage,
        source: "glw-callback",
        occurredAt: now,
        sequence: eventSequence,
        metadata: toJsonValue({ callbackReceiptId: receiptId, payloadSha256: identity.payloadSha256 }),
        correlationId: payload.executionId,
        idempotencyKey: identity.idempotencyKey,
      },
    });
    await transaction.glwCallbackReceipt.update({
      where: { receiptId },
      data: { outcome: "APPLIED", appliedAt: now, responseStatus: 200 },
    });

    return { outcome: "APPLIED", receiptId, job: parseGlwJobRecord(updatedRow) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function applyDurableGlwTerminalCallback(
  payload: GlwPageGenerationCallbackPayload,
  prisma: PrismaClient = getPrismaClient(),
  now = new Date(),
): Promise<GlwCallbackTransactionOutcome> {
  validateGlwTerminalCallbackPayload(payload);
  const identity = deriveGlwCallbackIdentity(payload);
  let lastTransientError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await runTransaction(prisma, payload, identity, now);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "HR004_STATE_CONFLICT") {
        return { outcome: "STATE_CONFLICT", message: error.message };
      }
      if (!isTransientTransactionError(error)) {
        if (error instanceof GlwCallbackTransactionUnavailableError) {
          throw error;
        }
        if (isDatabaseUnavailableError(error)) {
          throw new GlwCallbackTransactionUnavailableError("DATABASE_UNAVAILABLE", error);
        }
        throw error;
      }
      lastTransientError = error;
    }
  }

  throw new GlwCallbackTransactionUnavailableError("TRANSACTION_RETRY", lastTransientError);
}