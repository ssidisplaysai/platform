import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { getPrismaClient } from "@/lib/glw/prisma";
import { createGlwN8nExecutionService } from "@/lib/glw/n8n";
import { logRecoveryTrace } from "@/lib/gop/recovery-trace";
import { classifyRecoveryCandidate } from "./classifier";
import type {
  JobRecoveryAuditResult,
  JobRecoveryAuditRow,
  JobRecoveryAuditSummary,
  JobRecoveryExecuteInput,
  JobRecoveryExecuteResult,
  JobRecoveryExecutionProbe,
  JobRecoveryHealthCards,
  ManualAdjudicationInput,
  ManualAdjudicationResult,
} from "./types";

const DEFAULT_WORKSPACE_ID = "glw-led-display-warehouse";
const APPROVAL_TOKEN = "APPROVE_RECOVERY_WRITE";

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function targetFromInput(input: unknown): string {
  if (typeof input !== "object" || input === null) {
    return "UNKNOWN";
  }

  const payload = input as Record<string, unknown>;
  const page = typeof payload.page === "object" && payload.page !== null
    ? payload.page as Record<string, unknown>
    : null;

  if (!page) {
    return "UNKNOWN";
  }

  const product = typeof page.productTopic === "string" ? page.productTopic.trim() : "";
  const state = typeof page.state === "string" ? page.state.trim() : "";
  const city = typeof page.citySlug === "string"
    ? page.citySlug.trim()
    : (typeof page.city === "string" ? page.city.trim() : "");

  const parts = [product, state, city].filter((entry) => entry.length > 0);
  return parts.length > 0 ? parts.join(" / ") : "UNKNOWN";
}

function workflowFromInput(input: unknown): string {
  if (typeof input !== "object" || input === null) {
    return "PAGE_GENERATION";
  }

  const payload = input as Record<string, unknown>;
  const callbackUrl = typeof payload.callbackUrl === "string" ? payload.callbackUrl : "";
  if (!callbackUrl) {
    return "PAGE_GENERATION";
  }

  try {
    const url = new URL(callbackUrl);
    return `${url.hostname}${url.pathname}`;
  } catch {
    return "PAGE_GENERATION";
  }
}

async function lookupExecutionProbe(executionId: string | null): Promise<JobRecoveryExecutionProbe> {
  if (!executionId) {
    return {
      executionId: null,
      executionExists: null,
      executionTerminal: null,
      executionState: null,
      executionIdentityVerified: null,
      reason: "No external execution ID.",
    };
  }

  const normalized = executionId.trim();
  const isNativeExecutionId = /^\d+$/.test(normalized);

  if (!isNativeExecutionId) {
    return {
      executionId: normalized,
      executionExists: null,
      executionTerminal: null,
      executionState: "UNKNOWN",
      executionIdentityVerified: false,
      reason: "The recorded execution identifier is not a native n8n execution ID.",
    };
  }

  try {
    const n8n = createGlwN8nExecutionService();
    const lookup = await n8n.getExecutionDiagnostics(normalized);
    if (lookup.available) {
      return {
        executionId: normalized,
        executionExists: true,
        executionTerminal: lookup.diagnostics.terminal,
        executionState: lookup.diagnostics.executionState,
        executionIdentityVerified: true,
      };
    }

    if (lookup.upstreamStatus === 404) {
      return {
        executionId: normalized,
        executionExists: false,
        executionTerminal: null,
        executionState: "MISSING",
        executionIdentityVerified: true,
        reason: lookup.reason,
      };
    }

    return {
      executionId: normalized,
      executionExists: null,
      executionTerminal: null,
      executionState: "UNKNOWN",
      executionIdentityVerified: true,
      reason: lookup.reason,
    };
  } catch (error) {
    return {
      executionId: normalized,
      executionExists: null,
      executionTerminal: null,
      executionState: "UNKNOWN",
      executionIdentityVerified: true,
      reason: error instanceof Error ? error.message : "Execution diagnostics failed.",
    };
  }
}

async function hasRecoveryRecordTable(prisma: PrismaClient): Promise<boolean> {
  try {
    const rows = await prisma.$queryRaw<Array<{ regclass: string | null }>>`
      SELECT to_regclass('"GopRecoveryRecord"') AS regclass
    `;
    return Boolean(rows[0]?.regclass);
  } catch {
    return false;
  }
}

async function countRecoveredRecords(prisma: PrismaClient): Promise<number> {
  if (!(await hasRecoveryRecordTable(prisma))) {
    return 0;
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ value: bigint | number | string }>>`
      SELECT COUNT(*) AS value
      FROM "GopRecoveryRecord"
      WHERE "dryRun" = false
    `;
    const value = rows[0]?.value ?? 0;
    return typeof value === "bigint" ? Number(value) : Number.parseInt(String(value), 10) || 0;
  } catch {
    return 0;
  }
}

async function insertRecoveryRecord(
  prisma: PrismaClient,
  input: {
    workspaceId: string;
    moduleId: string;
    jobId: string;
    executionId: string | null;
    previousJobStatus: string;
    newJobStatus: string;
    previousExecutionStatus: string | null;
    newExecutionStatus: string | null;
    reason: string;
    recoveredBy: string;
    dryRun: boolean;
    safeRecovery: boolean;
    metadata: Record<string, unknown>;
  },
): Promise<void> {
  if (!(await hasRecoveryRecordTable(prisma))) {
    return;
  }

  const metadataJson = JSON.stringify(input.metadata);

  await prisma.$executeRaw`
    INSERT INTO "GopRecoveryRecord" (
      "id",
      "workspaceId",
      "moduleId",
      "jobId",
      "executionId",
      "previousJobStatus",
      "newJobStatus",
      "previousExecutionStatus",
      "newExecutionStatus",
      "reason",
      "recoveredBy",
      "dryRun",
      "safeRecovery",
      "metadata",
      "createdAt"
    ) VALUES (
      ${`grec_${randomUUID()}`},
      ${input.workspaceId},
      ${input.moduleId},
      ${input.jobId},
      ${input.executionId},
      ${input.previousJobStatus},
      ${input.newJobStatus},
      ${input.previousExecutionStatus},
      ${input.newExecutionStatus},
      ${input.reason},
      ${input.recoveredBy},
      ${input.dryRun},
      ${input.safeRecovery},
      CAST(${metadataJson} AS jsonb),
      NOW()
    )
  `;
}

function buildSummary(rows: JobRecoveryAuditRow[]): JobRecoveryAuditSummary {
  const running = rows.filter((row) => row.classification === "RUNNING").length;
  const stuck = rows.filter((row) => row.classification === "STUCK").length;
  const abandoned = rows.filter((row) => row.classification === "ABANDONED").length;
  const unknown = rows.filter((row) => row.classification === "UNKNOWN").length;
  const recoverable = rows.filter((row) => row.safeToRecover).length;
  const notRecoverable = rows.length - recoverable;

  return {
    totalStartingJobs: rows.length,
    running,
    stuck,
    abandoned,
    unknown,
    recoverable,
    notRecoverable,
    verdict: running > 0 && stuck === 0 && abandoned === 0 && unknown === 0 ? "QUEUE HEALTHY" : "QUEUE BLOCKED",
  };
}

async function buildHealthCards(prisma: PrismaClient, rows: JobRecoveryAuditRow[]): Promise<JobRecoveryHealthCards> {
  const now = Date.now();

  const [
    running,
    starting,
    failed,
    workers,
    recovered,
    expiredLeases,
    activeLeases,
    oldestActive,
    completedForRuntime,
  ] = await Promise.all([
    prisma.glwJob.count({ where: { status: "RUNNING" } }),
    prisma.glwJob.count({ where: { status: "STARTING" } }),
    prisma.glwJob.count({ where: { status: { in: ["FAILED", "FAILED_QA"] } } }),
    prisma.gopWorker.findMany(),
    countRecoveredRecords(prisma),
    prisma.gopExecutionLease.count({
      where: {
        leaseState: "ACTIVE",
        OR: [{ leaseExpiresAt: { lt: new Date() } }, { heartbeatDeadlineAt: { lt: new Date() } }],
      },
    }),
    prisma.gopExecutionLease.count({ where: { leaseState: "ACTIVE" } }),
    prisma.glwJob.findFirst({
      where: { status: { in: ["STARTING", "RUNNING", "GENERATING_CONTENT", "GENERATING_IMAGE", "UPLOADING_IMAGE", "PUBLISHING"] } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.glwJob.findMany({
      where: {
        startedAt: { not: null },
        completedAt: { not: null },
      },
      orderBy: { completedAt: "desc" },
      take: 100,
      select: { startedAt: true, completedAt: true },
    }),
  ]);

  let avgRuntimeMs = 0;
  if (completedForRuntime.length > 0) {
    const durations = completedForRuntime
      .map((job) => {
        if (!job.startedAt || !job.completedAt) {
          return 0;
        }

        const ms = job.completedAt.getTime() - job.startedAt.getTime();
        return ms > 0 ? ms : 0;
      })
      .filter((value) => value > 0);

    if (durations.length > 0) {
      avgRuntimeMs = Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length);
    }
  }

  const workerCount = workers.length;
  const healthyWorkers = workers.filter((worker) => {
    if (worker.health !== "HEALTHY") {
      return false;
    }

    const interval = worker.heartbeatIntervalMs ?? 30_000;
    const staleAfterMs = Math.max(interval * 3, 120_000);
    return now - worker.heartbeatAt.getTime() <= staleAfterMs;
  }).length;

  const queueCapacity = workers.reduce((sum, worker) => sum + Math.max(0, worker.maxCapacity), 0);
  const concurrencyRemaining = Math.max(0, queueCapacity - activeLeases);

  return {
    running,
    starting,
    waitingCallback: rows.filter((row) => row.n8nExecutionId !== null).length,
    failed,
    recovered,
    orphaned: rows.filter((row) => row.classification === "ABANDONED").length,
    workers: workerCount,
    healthyWorkers,
    expiredLeases,
    queueCapacity,
    concurrencyRemaining,
    averageRuntimeMs: avgRuntimeMs,
    oldestActiveJobHours: oldestActive ? Number(((now - oldestActive.createdAt.getTime()) / 3_600_000).toFixed(2)) : 0,
  };
}

async function buildAuditRows(prisma: PrismaClient): Promise<JobRecoveryAuditRow[]> {
  const now = Date.now();
  const jobs = await prisma.glwJob.findMany({
    where: {
      status: "STARTING",
      type: "PAGE_GENERATION",
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const rows: JobRecoveryAuditRow[] = [];

  for (const job of jobs) {
    const gopExecution = await prisma.gopExecution.findFirst({
      where: {
        OR: [
          { jobId: job.id },
          ...(job.externalExecutionId ? [{ executionId: job.externalExecutionId }] : []),
        ],
      },
      include: {
        leases: {
          orderBy: {
            leaseStartAt: "desc",
          },
          take: 1,
        },
      },
    });

    const latestLease = gopExecution?.leases[0] ?? null;
    const worker = latestLease
      ? await prisma.gopWorker.findUnique({ where: { workerId: latestLease.workerId } })
      : null;

    const leaseExpired = latestLease ? latestLease.leaseExpiresAt.getTime() < now : null;

    let heartbeatStopped: boolean | null = null;
    if (worker) {
      const interval = worker.heartbeatIntervalMs ?? 30_000;
      const staleAfterMs = Math.max(interval * 3, 120_000);
      heartbeatStopped = now - worker.heartbeatAt.getTime() > staleAfterMs;
    } else if (latestLease) {
      heartbeatStopped = latestLease.heartbeatDeadlineAt.getTime() < now;
    }

    const executionProbe = await lookupExecutionProbe(job.externalExecutionId ?? null);
    const classification = classifyRecoveryCandidate({
      execution: executionProbe,
      signals: {
        leaseExpired,
        heartbeatStopped,
      },
    });

    rows.push({
      jobId: job.id,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      ageHours: Number(((now - job.createdAt.getTime()) / 3_600_000).toFixed(2)),
      siteId: job.siteId,
      workflow: workflowFromInput(job.input),
      target: targetFromInput(job.input),
      status: job.status,
      n8nExecutionId: job.externalExecutionId ?? null,
      leaseId: latestLease?.leaseId ?? null,
      leaseOwner: latestLease?.workerId ?? null,
      leaseState: latestLease?.leaseState ?? null,
      leaseExpiration: toIso(latestLease?.leaseExpiresAt),
      leaseExpired,
      heartbeat: toIso(worker?.heartbeatAt),
      heartbeatStopped,
      worker: worker ? `${worker.workerId} (${worker.health})` : null,
      retryCount: gopExecution?.retryCount ?? 0,
      executionExists: executionProbe.executionExists,
      executionIdentityVerified: executionProbe.executionIdentityVerified ?? null,
      executionTerminal: executionProbe.executionTerminal,
      executionState: executionProbe.executionState,
      classification: classification.classification,
      reason: classification.reason,
      decision: classification.decision,
      safeToRecover: classification.safeToRecover,
      recommendedJobStatus: classification.recommendedJobStatus,
    });
  }

  return rows;
}

function assertRecoveryWriteAllowed(input: JobRecoveryExecuteInput): void {
  const dryRun = input.dryRun ?? true;
  if (dryRun) {
    return;
  }

  if (!input.approvalToken || input.approvalToken !== APPROVAL_TOKEN) {
    throw new Error("Recovery writes require approval token APPROVE_RECOVERY_WRITE.");
  }
}

export type JobRecoveryService = {
  runAudit: () => Promise<JobRecoveryAuditResult>;
  executeRecovery: (input: JobRecoveryExecuteInput) => Promise<JobRecoveryExecuteResult>;
  adjudicateManualReview: (input: ManualAdjudicationInput) => Promise<ManualAdjudicationResult>;
};

export function createJobRecoveryService(prisma: PrismaClient = getPrismaClient()): JobRecoveryService {
  return {
    async runAudit() {
      const rows = await buildAuditRows(prisma);
      const summary = buildSummary(rows);
      const cards = await buildHealthCards(prisma, rows);

      return {
        generatedAt: new Date().toISOString(),
        workspaceId: DEFAULT_WORKSPACE_ID,
        rows,
        summary,
        cards,
      };
    },

    async executeRecovery(input) {
      const dryRun = input.dryRun ?? true;
      const traceId = input.traceId ?? `recovery_trace_${Math.random().toString(16).slice(2)}`;
      logRecoveryTrace(traceId, "SERVICE_INPUT_DRYRUN", input.dryRun, {
        boundary: "SERVICE_INPUT_DRYRUN",
        authenticated: true,
        approvalTokenPresent: Boolean(input.approvalToken),
        writeAuthorizationEntered: false,
        approvalGateEntered: false,
        persistenceBranchEntered: false,
      });
      logRecoveryTrace(traceId, "SERVICE_RESOLVED_DRYRUN", dryRun, {
        boundary: "SERVICE_RESOLVED_DRYRUN",
        authenticated: true,
        approvalTokenPresent: Boolean(input.approvalToken),
        writeAuthorizationEntered: false,
        approvalGateEntered: false,
        persistenceBranchEntered: false,
      });
      assertRecoveryWriteAllowed(input);

      const audit = await this.runAudit();
      const selected = input.mode === "RECOVER_SELECTED_SAFE"
        ? new Set(input.selectedJobIds ?? [])
        : null;

      const rows: JobRecoveryExecuteResult["rows"] = [];
      let recovered = 0;
      let skippedUnsafe = 0;
      let skippedMissing = 0;

      for (const row of audit.rows) {
        const selectedForAttempt = input.mode === "RECOVER_ALL_SAFE"
          ? row.safeToRecover
          : (selected?.has(row.jobId) ?? false);

        if (!selectedForAttempt) {
          continue;
        }

        if (!row.safeToRecover) {
          skippedUnsafe += 1;
          rows.push({
            jobId: row.jobId,
            classification: row.classification,
            safeToRecover: row.safeToRecover,
            previousJobStatus: row.status,
            nextJobStatus: null,
            executionId: row.n8nExecutionId,
            previousExecutionStatus: null,
            nextExecutionStatus: null,
            action: "SKIPPED_UNSAFE",
            reason: row.reason,
          });
          continue;
        }

        const execution = await prisma.gopExecution.findFirst({
          where: {
            OR: [
              { jobId: row.jobId },
              ...(row.n8nExecutionId ? [{ executionId: row.n8nExecutionId }] : []),
            ],
          },
        });

        if (!dryRun) {
          logRecoveryTrace(traceId, "PERSISTENCE_BRANCH_ENTERED", dryRun, {
            boundary: "PERSISTENCE_BRANCH_ENTERED",
            authenticated: true,
            approvalTokenPresent: Boolean(input.approvalToken),
            writeAuthorizationEntered: !dryRun,
            approvalGateEntered: Boolean(input.approvalToken),
            persistenceBranchEntered: true,
          });
          await prisma.glwJob.update({
            where: { id: row.jobId },
            data: {
              status: "FAILED",
              completedAt: new Date(),
              error: {
                recovery: "GENESIS_QUEUE_RECOVERY",
                reason: input.reason ?? row.reason,
                recoveredBy: input.actorId,
                previousStatus: row.status,
              },
            },
          });

          if (execution) {
            await prisma.gopExecution.update({
              where: { executionId: execution.executionId },
              data: {
                status: "FAILED",
                completedAt: new Date(),
                metadata: {
                  recovery: "GENESIS_QUEUE_RECOVERY",
                  reason: input.reason ?? row.reason,
                  recoveredBy: input.actorId,
                  previousStatus: execution.status,
                },
              },
            });

            await prisma.gopExecutionLease.updateMany({
              where: {
                executionId: execution.executionId,
                leaseState: "ACTIVE",
              },
              data: {
                leaseState: "RELEASED",
                releasedAt: new Date(),
                releaseReason: "Recovered by Genesis queue recovery service",
              },
            });
          }

          await insertRecoveryRecord(prisma, {
            workspaceId: DEFAULT_WORKSPACE_ID,
            moduleId: "glw.core",
            jobId: row.jobId,
            executionId: execution?.executionId ?? null,
            previousJobStatus: row.status,
            newJobStatus: "FAILED",
            previousExecutionStatus: execution?.status ?? null,
            newExecutionStatus: execution ? "FAILED" : null,
            reason: input.reason ?? row.reason,
            recoveredBy: input.actorId,
            dryRun: false,
            safeRecovery: true,
            metadata: {
              classification: row.classification,
              decision: row.decision,
            },
          });
        }

        rows.push({
          jobId: row.jobId,
          classification: row.classification,
          safeToRecover: row.safeToRecover,
          previousJobStatus: row.status,
          nextJobStatus: "FAILED",
          executionId: execution?.executionId ?? row.n8nExecutionId,
          previousExecutionStatus: execution?.status ?? null,
          nextExecutionStatus: execution ? "FAILED" : null,
          action: "RECOVERED",
          reason: input.reason ?? row.reason,
        });
        recovered += 1;
      }

      const attempted = input.mode === "RECOVER_ALL_SAFE"
        ? audit.rows.filter((row) => row.safeToRecover).length
        : (input.selectedJobIds?.length ?? 0);

      if (input.mode === "RECOVER_SELECTED_SAFE") {
        const existingIds = new Set(audit.rows.map((row) => row.jobId));
        const selectedIds = input.selectedJobIds ?? [];
        skippedMissing = selectedIds.filter((jobId) => !existingIds.has(jobId)).length;
      }

      const result = {
        dryRun,
        attempted,
        recovered,
        skippedUnsafe,
        skippedMissing,
        rows,
      };

      logRecoveryTrace(traceId, "RESULT_DRYRUN", result.dryRun, {
        boundary: "RESULT_DRYRUN",
        authenticated: true,
        approvalTokenPresent: Boolean(input.approvalToken),
        writeAuthorizationEntered: !dryRun,
        approvalGateEntered: Boolean(input.approvalToken),
        persistenceBranchEntered: !dryRun,
      });

      return result;
    },

    async adjudicateManualReview(input) {
      const sanitizedReason = input.reason?.trim();
      if (!sanitizedReason) {
        throw new Error("A non-empty reason is required for manual adjudication.");
      }

      if (input.decision !== "MARK_FAILED") {
        throw new Error("Unsupported manual adjudication decision. Only MARK_FAILED is valid for orphaned STARTING jobs.");
      }

      const job = await prisma.glwJob.findUnique({
        where: { id: input.jobId },
      });

      if (!job) {
        throw new Error(`GLW job not found: ${input.jobId}`);
      }

      if (job.status !== "STARTING") {
        throw new Error(`Only STARTING jobs can be manually adjudicated. Current status: ${job.status}`);
      }

      const workspaceId = input.workspaceId ?? DEFAULT_WORKSPACE_ID;
      if (workspaceId !== DEFAULT_WORKSPACE_ID) {
        throw new Error("Cross-workspace manual adjudication is not allowed.");
      }

      const execution = await prisma.gopExecution.findFirst({
        where: {
          OR: [
            { jobId: job.id },
            ...(job.externalExecutionId ? [{ executionId: job.externalExecutionId }] : []),
          ],
        },
        include: {
          leases: {
            orderBy: { leaseStartAt: "desc" },
            take: 1,
          },
        },
      });

      const latestLease = execution?.leases[0] ?? null;
      const latestWorker = latestLease
        ? await prisma.gopWorker.findUnique({ where: { workerId: latestLease.workerId } })
        : null;
      const now = Date.now();
      const leaseExpired = latestLease ? latestLease.leaseExpiresAt.getTime() < now : null;
      const heartbeatStopped = latestWorker
        ? (now - latestWorker.heartbeatAt.getTime()) > Math.max((latestWorker.heartbeatIntervalMs ?? 30_000) * 3, 120_000)
        : (latestLease ? latestLease.heartbeatDeadlineAt.getTime() < now : null);
      const executionProbe = await lookupExecutionProbe(job.externalExecutionId ?? null);
      const classification = classifyRecoveryCandidate({
        execution: executionProbe,
        signals: { leaseExpired, heartbeatStopped },
      });

      if (classification.decision !== "MANUAL_REVIEW" && classification.recommendedJobStatus !== "MANUAL_INVESTIGATION") {
        throw new Error(`Job ${job.id} is not eligible for manual adjudication. Current classification: ${classification.classification} (${classification.decision}).`);
      }

      const existingEvent = await prisma.gopJobEvent.findFirst({
        where: {
          jobId: job.id,
          idempotencyKey: input.idempotencyKey,
        },
      });

      if (existingEvent) {
        return {
          jobId: job.id,
          previousStatus: job.status,
          newStatus: existingEvent.status ?? "FAILED",
          decision: input.decision,
          adjudicatedBy: existingEvent.actorId ?? input.actorId,
          adjudicatedAt: existingEvent.occurredAt.toISOString(),
          reason: existingEvent.message ?? sanitizedReason,
          reasonCode: "MANUAL_REVIEW_IDEMPOTENT",
          auditId: null,
          eventId: existingEvent.eventId,
        };
      }

      const result = await prisma.$transaction(async (tx) => {
        const currentJob = await tx.glwJob.findUnique({ where: { id: input.jobId } });
        if (!currentJob || currentJob.status !== "STARTING") {
          throw new Error(`Job ${input.jobId} is no longer eligible for manual adjudication.`);
        }

        const lastEvent = await tx.gopJobEvent.findFirst({
          where: { jobId: input.jobId },
          orderBy: { sequence: "desc" },
        });
        const nextSequence = (lastEvent?.sequence ?? 0) + 1;

        const updatedJob = await tx.glwJob.update({
          where: { id: input.jobId },
          data: {
            status: "FAILED",
            completedAt: new Date(),
            error: {
              manualAdjudication: true,
              decision: input.decision,
              reason: sanitizedReason,
              adjudicatedBy: input.actorId,
              previousStatus: currentJob.status,
              classification: classification.classification,
            },
          },
        });

        const event = await tx.gopJobEvent.create({
          data: {
            eventId: `gje_${randomUUID()}`,
            jobId: input.jobId,
            moduleId: input.moduleId ?? "glw.core",
            jobType: job.type,
            eventType: "MANUAL_ADJUDICATION",
            stage: "manual_review",
            status: "FAILED",
            message: sanitizedReason,
            source: "GOP_MANUAL_ADJUDICATION",
            occurredAt: new Date(),
            sequence: nextSequence,
            durationMs: 0,
            metadata: {
              decision: input.decision,
              operatorId: input.actorId,
              classification: classification.classification,
              safeToRecover: classification.safeToRecover,
              idempotencyKey: input.idempotencyKey,
              workspaceId,
            },
            actorId: input.actorId,
            actorName: input.actorId,
            correlationId: job.externalExecutionId ?? null,
            causationId: job.id,
            idempotencyKey: input.idempotencyKey,
          },
        });

        const auditRecord = await tx.gopRecoveryRecord.create({
          data: {
            workspaceId,
            moduleId: input.moduleId ?? "glw.core",
            jobId: input.jobId,
            executionId: job.externalExecutionId ?? null,
            previousJobStatus: currentJob.status,
            newJobStatus: "FAILED",
            previousExecutionStatus: execution?.status ?? null,
            newExecutionStatus: "FAILED",
            reason: sanitizedReason,
            recoveredBy: input.actorId,
            dryRun: false,
            safeRecovery: false,
            metadata: {
              decision: input.decision,
              classification: classification.classification,
              operatorId: input.actorId,
              idempotencyKey: input.idempotencyKey,
              workspaceId,
              reasonCode: "MANUAL_REVIEW_FAILED",
            },
          },
        });

        return {
          updatedJob,
          event,
          auditRecord,
        };
      });

      return {
        jobId: input.jobId,
        previousStatus: job.status,
        newStatus: "FAILED",
        decision: input.decision,
        adjudicatedBy: input.actorId,
        adjudicatedAt: new Date().toISOString(),
        reason: sanitizedReason,
        reasonCode: "MANUAL_REVIEW_FAILED",
        auditId: result.auditRecord.id,
        eventId: result.event.eventId,
      };
    },
  };
}
