import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { getPrismaClient } from "@/lib/glw/prisma";
import { createGlwN8nExecutionService } from "@/lib/glw/n8n";
import { classifyRecoveryCandidate } from "./classifier";
import type {
  JobRecoveryAuditResult,
  JobRecoveryAuditRow,
  JobRecoveryAuditSummary,
  JobRecoveryExecuteInput,
  JobRecoveryExecuteResult,
  JobRecoveryExecutionProbe,
  JobRecoveryHealthCards,
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
      reason: "No external execution ID.",
    };
  }

  try {
    const n8n = createGlwN8nExecutionService();
    const lookup = await n8n.getExecutionDiagnostics(executionId);
    if (lookup.available) {
      return {
        executionId,
        executionExists: true,
        executionTerminal: lookup.diagnostics.terminal,
        executionState: lookup.diagnostics.executionState,
      };
    }

    if (lookup.upstreamStatus === 404) {
      return {
        executionId,
        executionExists: false,
        executionTerminal: null,
        executionState: "MISSING",
        reason: lookup.reason,
      };
    }

    return {
      executionId,
      executionExists: null,
      executionTerminal: null,
      executionState: "UNKNOWN",
      reason: lookup.reason,
    };
  } catch (error) {
    return {
      executionId,
      executionExists: null,
      executionTerminal: null,
      executionState: "UNKNOWN",
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
  const dryRun = input.dryRun ?? false;
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

      return {
        dryRun,
        attempted,
        recovered,
        skippedUnsafe,
        skippedMissing,
        rows,
      };
    },
  };
}
