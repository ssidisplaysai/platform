import { Prisma, type PrismaClient } from "@prisma/client";
import type { GenesisExecution, GenesisExecutionSnapshot } from "../contracts";
import type { GenesisExecutionRepository } from "../runtime/execution-repository";
import { getPlatformPrismaClient } from "../runtime/prisma";
import { replayExecutionFromSnapshotAndEvents } from "../runtime/replay-engine";

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function toExecution(row: {
  executionId: string;
  executionType: string | null;
  jobId: string | null;
  moduleId: string;
  workspaceId: string;
  parentExecutionId: string | null;
  childExecutionIds: unknown;
  status: string;
  currentState: string | null;
  currentNodeId: string | null;
  priority: string;
  queueName: string | null;
  workerAssignment: unknown;
  retryCount: number;
  retryHistory: unknown;
  startedAt: Date | null;
  completedAt: Date | null;
  scheduledAt: Date | null;
  timeoutMs: number | null;
  correlationId: string | null;
  causationId: string | null;
  context: unknown;
  input: unknown;
  output: unknown;
  artifacts: unknown;
  metadata: unknown;
  executionVersion: number;
  snapshotVersion: number;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): GenesisExecution {
  return {
    executionId: row.executionId,
    executionType: row.executionType ?? undefined,
    jobId: row.jobId ?? undefined,
    moduleId: row.moduleId,
    workspaceId: row.workspaceId,
    parentExecutionId: row.parentExecutionId,
    childExecutionIds: (row.childExecutionIds as string[]) ?? [],
    jobType: (row.executionType as GenesisExecution["jobType"]) ?? "CUSTOM",
    executionClass: "AUTOMATED",
    status: row.status as GenesisExecution["status"],
    currentState: row.currentState ?? undefined,
    priority: row.priority as GenesisExecution["priority"],
    queueName: row.queueName ?? undefined,
    context: (row.context as GenesisExecution["context"]) ?? {},
    input: (row.input as Record<string, unknown>) ?? {},
    output: (row.output as Record<string, unknown> | null) ?? null,
    artifacts: (row.artifacts as GenesisExecution["artifacts"]) ?? [],
    worker: (row.workerAssignment as GenesisExecution["worker"]) ?? null,
    correlationId: row.correlationId ?? undefined,
    causationId: row.causationId ?? undefined,
    retryHistory: (row.retryHistory as GenesisExecution["retryHistory"]) ?? [],
    timing: {
      createdAt: row.createdAt.toISOString(),
      startedAt: row.startedAt?.toISOString(),
      completedAt: row.completedAt?.toISOString(),
      scheduledAt: row.scheduledAt?.toISOString(),
      archivedAt: row.archivedAt?.toISOString(),
    },
    scheduledAt: row.scheduledAt?.toISOString(),
    timeoutMs: row.timeoutMs ?? undefined,
    metrics: {
      retries: row.retryCount,
      nodeCompleted: 0,
      nodeTotal: 0,
    },
    graph: {
      graphId: `${row.moduleId}:persisted`,
      nodes: [],
      edges: [],
    },
    currentNodeId: row.currentNodeId ?? undefined,
    executionVersion: row.executionVersion,
    snapshotVersion: row.snapshotVersion,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? undefined,
  };
}

function toSnapshot(row: {
  snapshotId: string;
  executionId: string;
  snapshotVersion: number;
  snapshotSequence: number;
  status: string;
  currentState: string | null;
  currentNodeId: string | null;
  progressPercent: number;
  queuePosition: number | null;
  workerAssignment: unknown;
  retryCount: number;
  retryHistory: unknown;
  output: unknown;
  timing: unknown;
  metrics: unknown;
  artifacts: unknown;
  state: unknown;
  upToEventSequence: number | null;
  metadata: unknown;
  createdAt: Date;
}): GenesisExecutionSnapshot {
  return {
    snapshotId: row.snapshotId,
    executionId: row.executionId,
    snapshotVersion: row.snapshotVersion,
    snapshotSequence: row.snapshotSequence,
    status: row.status as GenesisExecutionSnapshot["status"],
    currentState: row.currentState ?? undefined,
    currentNodeId: row.currentNodeId ?? undefined,
    progressPercent: row.progressPercent,
    queuePosition: row.queuePosition,
    worker: (row.workerAssignment as GenesisExecutionSnapshot["worker"]) ?? null,
    retryCount: row.retryCount,
    retryHistory: (row.retryHistory as GenesisExecutionSnapshot["retryHistory"]) ?? [],
    output: (row.output as GenesisExecutionSnapshot["output"]) ?? null,
    timing: row.timing as GenesisExecutionSnapshot["timing"],
    metrics: row.metrics as GenesisExecutionSnapshot["metrics"],
    artifacts: (row.artifacts as GenesisExecutionSnapshot["artifacts"]) ?? [],
    state: row.state as GenesisExecution,
    upToEventSequence: row.upToEventSequence,
    metadata: (row.metadata as Record<string, unknown>) ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export function createPrismaExecutionRepository(prisma: PrismaClient = getPlatformPrismaClient()): GenesisExecutionRepository {
  return {
    async saveExecution(execution) {
      const saved = await prisma.gopExecution.upsert({
        where: { executionId: execution.executionId },
        update: {
          executionType: execution.executionType ?? execution.jobType,
          jobId: execution.jobId ?? null,
          moduleId: execution.moduleId,
          workspaceId: execution.workspaceId,
          parentExecutionId: execution.parentExecutionId ?? null,
          childExecutionIds: toJsonValue(execution.childExecutionIds ?? []),
          status: execution.status,
          currentState: execution.currentState ?? null,
          currentNodeId: execution.currentNodeId ?? null,
          priority: execution.priority,
          queueName: execution.queueName ?? null,
          workerAssignment: execution.worker ? toJsonValue(execution.worker) : Prisma.JsonNull,
          retryCount: execution.retryHistory.length,
          retryHistory: toJsonValue(execution.retryHistory),
          startedAt: execution.timing.startedAt ? new Date(execution.timing.startedAt) : null,
          completedAt: execution.timing.completedAt ? new Date(execution.timing.completedAt) : null,
          scheduledAt: execution.scheduledAt ? new Date(execution.scheduledAt) : execution.timing.scheduledAt ? new Date(execution.timing.scheduledAt) : null,
          timeoutMs: execution.timeoutMs ?? null,
          correlationId: execution.correlationId ?? null,
          causationId: execution.causationId ?? null,
          context: toJsonValue(execution.context ?? {}),
          input: toJsonValue(execution.input ?? {}),
          output: execution.output ? toJsonValue(execution.output) : Prisma.JsonNull,
          artifacts: toJsonValue(execution.artifacts ?? []),
          metadata: execution.metadata ? toJsonValue(execution.metadata) : Prisma.JsonNull,
          executionVersion: execution.executionVersion ?? 1,
          snapshotVersion: execution.snapshotVersion ?? 1,
          archivedAt: execution.archivedAt ? new Date(execution.archivedAt) : null,
        },
        create: {
          executionId: execution.executionId,
          executionType: execution.executionType ?? execution.jobType,
          jobId: execution.jobId ?? null,
          moduleId: execution.moduleId,
          workspaceId: execution.workspaceId,
          parentExecutionId: execution.parentExecutionId ?? null,
          childExecutionIds: toJsonValue(execution.childExecutionIds ?? []),
          status: execution.status,
          currentState: execution.currentState ?? null,
          currentNodeId: execution.currentNodeId ?? null,
          priority: execution.priority,
          queueName: execution.queueName ?? null,
          workerAssignment: execution.worker ? toJsonValue(execution.worker) : Prisma.JsonNull,
          retryCount: execution.retryHistory.length,
          retryHistory: toJsonValue(execution.retryHistory),
          startedAt: execution.timing.startedAt ? new Date(execution.timing.startedAt) : null,
          completedAt: execution.timing.completedAt ? new Date(execution.timing.completedAt) : null,
          scheduledAt: execution.scheduledAt ? new Date(execution.scheduledAt) : execution.timing.scheduledAt ? new Date(execution.timing.scheduledAt) : null,
          timeoutMs: execution.timeoutMs ?? null,
          correlationId: execution.correlationId ?? null,
          causationId: execution.causationId ?? null,
          context: toJsonValue(execution.context ?? {}),
          input: toJsonValue(execution.input ?? {}),
          output: execution.output ? toJsonValue(execution.output) : Prisma.JsonNull,
          artifacts: toJsonValue(execution.artifacts ?? []),
          metadata: execution.metadata ? toJsonValue(execution.metadata) : Prisma.JsonNull,
          executionVersion: execution.executionVersion ?? 1,
          snapshotVersion: execution.snapshotVersion ?? 1,
          archivedAt: execution.archivedAt ? new Date(execution.archivedAt) : null,
        },
      });

      return toExecution(saved);
    },

    async loadExecution(executionId) {
      const row = await prisma.gopExecution.findUnique({ where: { executionId } });
      return row ? toExecution(row) : null;
    },

    async loadExecutionByJobId(jobId) {
      const row = await prisma.gopExecution.findUnique({ where: { jobId } });
      return row ? toExecution(row) : null;
    },

    async updateExecution(executionId, changes) {
      const existing = await prisma.gopExecution.findUnique({ where: { executionId } });
      if (!existing) {
        return null;
      }

      return this.saveExecution({
        ...toExecution(existing),
        ...changes,
        timing: {
          ...toExecution(existing).timing,
          ...(changes.timing ?? {}),
        },
      });
    },

    async storeSnapshot(snapshot) {
      const created = await prisma.gopExecutionSnapshot.create({
        data: {
          snapshotId: snapshot.snapshotId,
          executionId: snapshot.executionId,
          snapshotVersion: snapshot.snapshotVersion,
          snapshotSequence: snapshot.snapshotSequence,
          status: snapshot.status,
          currentState: snapshot.currentState ?? null,
          currentNodeId: snapshot.currentNodeId ?? null,
          progressPercent: snapshot.progressPercent,
          queuePosition: snapshot.queuePosition ?? null,
          workerAssignment: snapshot.worker ? toJsonValue(snapshot.worker) : Prisma.JsonNull,
          retryCount: snapshot.retryCount,
          retryHistory: toJsonValue(snapshot.retryHistory),
          output: snapshot.output ? toJsonValue(snapshot.output) : Prisma.JsonNull,
          timing: toJsonValue(snapshot.timing),
          metrics: toJsonValue(snapshot.metrics),
          artifacts: toJsonValue(snapshot.artifacts),
          state: toJsonValue(snapshot.state),
          upToEventSequence: snapshot.upToEventSequence ?? null,
          metadata: snapshot.metadata ? toJsonValue(snapshot.metadata) : Prisma.JsonNull,
        },
      });

      return toSnapshot(created);
    },

    async loadLatestSnapshot(executionId) {
      const row = await prisma.gopExecutionSnapshot.findFirst({
        where: { executionId },
        orderBy: [{ snapshotSequence: "desc" }],
      });
      return row ? toSnapshot(row) : null;
    },

    async loadSnapshots(executionId, limit = 100) {
      const rows = await prisma.gopExecutionSnapshot.findMany({
        where: { executionId },
        orderBy: [{ snapshotSequence: "desc" }],
        take: limit,
      });

      return rows.map(toSnapshot);
    },

    async compactSnapshots(executionId, keepLatest = 50) {
      const rows = await prisma.gopExecutionSnapshot.findMany({
        where: { executionId },
        orderBy: [{ snapshotSequence: "desc" }],
        skip: keepLatest,
        select: { snapshotId: true },
      });

      if (rows.length === 0) {
        return 0;
      }

      const result = await prisma.gopExecutionSnapshot.deleteMany({
        where: { snapshotId: { in: rows.map((row) => row.snapshotId) } },
      });

      return result.count;
    },

    async replayExecution(executionId, options = {}) {
      const baseExecution = await this.loadExecution(executionId);
      if (!baseExecution) {
        return null;
      }

      const snapshot = await this.loadLatestSnapshot(executionId);
      const jobId = baseExecution.jobId ?? ((baseExecution.input?.jobId as string | undefined) ?? null);

      if (!jobId || !options.eventStore) {
        return snapshot?.state ?? baseExecution;
      }

      const events = await options.eventStore.listEventsForJob(jobId);
      return replayExecutionFromSnapshotAndEvents({
        baseExecution,
        snapshot,
        events,
        untilSequence: options.sequence,
      });
    },

    async listExecutionHistory(executionId) {
      return this.loadSnapshots(executionId, 500);
    },

    async listExecutions(query = {}) {
      const rows = await prisma.gopExecution.findMany({
        where: {
          workspaceId: query.workspaceId,
          moduleId: query.moduleId,
          status: query.status,
        },
        orderBy: [{ updatedAt: "desc" }],
        take: Math.min(500, Math.max(1, query.limit ?? 100)),
      });

      return rows.map(toExecution);
    },

    async searchExecutions(query) {
      const rows = await prisma.gopExecution.findMany({
        where: {
          workspaceId: query.workspaceId,
          moduleId: query.moduleId,
          status: query.status,
          OR: query.q
            ? [
                { executionId: { contains: query.q, mode: "insensitive" } },
                { jobId: { contains: query.q, mode: "insensitive" } },
                { correlationId: { contains: query.q, mode: "insensitive" } },
              ]
            : undefined,
        },
        orderBy: [{ updatedAt: "desc" }],
        take: Math.min(500, Math.max(1, query.limit ?? 100)),
      });

      return rows.map(toExecution);
    },

    async archiveExecution(executionId) {
      const execution = await this.loadExecution(executionId);
      if (!execution) {
        return null;
      }

      return this.saveExecution({
        ...execution,
        status: "ARCHIVED",
        archivedAt: new Date().toISOString(),
      });
    },

    async loadRecoverableExecutions() {
      const rows = await prisma.gopExecution.findMany({
        where: {
          status: {
            in: ["RUNNING", "DISPATCHED", "QUEUED", "SCHEDULED", "WAITING", "BLOCKED", "RETRYING"],
          },
        },
        orderBy: [{ updatedAt: "desc" }],
        take: 2000,
      });

      return rows.map(toExecution);
    },
  };
}
