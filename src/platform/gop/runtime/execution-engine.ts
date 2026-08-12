import { randomUUID } from "node:crypto";
import type {
  GenesisExecution,
  GenesisExecutionClass,
  GenesisExecutionGraph,
  GenesisExecutionMetrics,
  GenesisExecutionRetryEntry,
  GenesisExecutionStatus,
  GenesisJobPriority,
  GenesisJobType,
  GenesisWorkerRegistration,
} from "../contracts";

const transitionOrder: Record<GenesisExecutionStatus, number> = {
  CREATED: 1,
  SCHEDULED: 2,
  QUEUED: 3,
  DISPATCHED: 4,
  RUNNING: 5,
  WAITING: 6,
  BLOCKED: 7,
  RETRYING: 8,
  SUCCEEDED: 9,
  FAILED: 9,
  CANCELLED: 9,
  TIMED_OUT: 9,
  ARCHIVED: 10,
};

function nowIso(): string {
  return new Date().toISOString();
}

function buildDefaultGraph(moduleId: string): GenesisExecutionGraph {
  return {
    graphId: `${moduleId}:default`,
    nodes: [
      {
        nodeId: "intake",
        label: "Request Intake",
        nodeType: "CUSTOM",
        dependsOn: [],
      },
      {
        nodeId: "dispatch",
        label: "Dispatch Worker",
        nodeType: "PLUGIN",
        dependsOn: ["intake"],
      },
      {
        nodeId: "complete",
        label: "Complete",
        nodeType: "NOTIFICATION",
        dependsOn: ["dispatch"],
      },
    ],
    edges: [
      { edgeId: "edge:intake:dispatch", fromNodeId: "intake", toNodeId: "dispatch" },
      { edgeId: "edge:dispatch:complete", fromNodeId: "dispatch", toNodeId: "complete" },
    ],
  };
}

function buildInitialMetrics(nodeTotal: number): GenesisExecutionMetrics {
  return {
    retries: 0,
    nodeCompleted: 0,
    nodeTotal,
  };
}

export function createGenesisExecution(input: {
  executionId?: string;
  executionType?: string;
  jobId?: string;
  workspaceId: string;
  moduleId: string;
  jobType: GenesisJobType;
  executionClass?: GenesisExecutionClass;
  priority?: GenesisJobPriority;
  queueName?: string;
  correlationId?: string;
  causationId?: string;
  parentExecutionId?: string | null;
  input?: Record<string, unknown>;
  context?: Record<string, unknown>;
  graph?: GenesisExecutionGraph;
  executionVersion?: number;
  snapshotVersion?: number;
  timeoutMs?: number;
}): GenesisExecution {
  const createdAt = nowIso();
  const graph = input.graph ?? buildDefaultGraph(input.moduleId);

  return {
    executionId: input.executionId ?? `gexec_${randomUUID()}`,
    executionType: input.executionType ?? input.jobType,
    jobId: input.jobId,
    workspaceId: input.workspaceId,
    moduleId: input.moduleId,
    jobType: input.jobType,
    executionClass: input.executionClass ?? "AUTOMATED",
    status: "CREATED",
    currentState: "created",
    priority: input.priority ?? "NORMAL",
    queueName: input.queueName,
    context: {
      moduleId: input.moduleId,
      correlationId: input.correlationId,
      metadata: input.context,
    },
    input: input.input ?? {},
    output: null,
    artifacts: [],
    worker: null,
    correlationId: input.correlationId,
    causationId: input.causationId,
    parentExecutionId: input.parentExecutionId ?? null,
    childExecutionIds: [],
    retryHistory: [],
    timing: {
      createdAt,
    },
    timeoutMs: input.timeoutMs,
    metrics: buildInitialMetrics(graph.nodes.length),
    graph,
    currentNodeId: graph.nodes[0]?.nodeId,
    approvalRequired: false,
    executionVersion: input.executionVersion ?? 1,
    snapshotVersion: input.snapshotVersion ?? 1,
    archivedAt: null,
  };
}

export function canTransitionExecutionStatus(current: GenesisExecutionStatus, next: GenesisExecutionStatus): boolean {
  if (current === next) {
    return true;
  }

  if (current === "ARCHIVED") {
    return false;
  }

  if (current === "SUCCEEDED" || current === "FAILED" || current === "CANCELLED" || current === "TIMED_OUT") {
    return next === "ARCHIVED";
  }

  if (next === "ARCHIVED") {
    return false;
  }

  if ((current === "WAITING" || current === "BLOCKED") && (next === "RUNNING" || next === "DISPATCHED")) {
    return true;
  }

  return transitionOrder[next] >= transitionOrder[current];
}

export function transitionExecutionStatus(
  execution: GenesisExecution,
  nextStatus: GenesisExecutionStatus,
  updates: {
    worker?: GenesisWorkerRegistration | null;
    blockedReason?: string;
    approvalRequired?: boolean;
    currentNodeId?: string;
    output?: Record<string, unknown> | null;
  } = {},
): GenesisExecution {
  if (!canTransitionExecutionStatus(execution.status, nextStatus)) {
    throw new Error(`Invalid execution transition ${execution.status} -> ${nextStatus} for ${execution.executionId}`);
  }

  const now = nowIso();
  const next: GenesisExecution = {
    ...execution,
    status: nextStatus,
    worker: updates.worker === undefined ? execution.worker : updates.worker,
    blockedReason: updates.blockedReason,
    approvalRequired: updates.approvalRequired ?? execution.approvalRequired,
    currentNodeId: updates.currentNodeId ?? execution.currentNodeId,
    output: updates.output === undefined ? execution.output : updates.output,
    timing: {
      ...execution.timing,
      scheduledAt: nextStatus === "SCHEDULED" && !execution.timing.scheduledAt ? now : execution.timing.scheduledAt,
      queuedAt: nextStatus === "QUEUED" && !execution.timing.queuedAt ? now : execution.timing.queuedAt,
      startedAt: (nextStatus === "RUNNING" || nextStatus === "DISPATCHED") && !execution.timing.startedAt
        ? now
        : execution.timing.startedAt,
      completedAt:
        (nextStatus === "SUCCEEDED" || nextStatus === "FAILED" || nextStatus === "CANCELLED" || nextStatus === "TIMED_OUT")
        && !execution.timing.completedAt
          ? now
          : execution.timing.completedAt,
      archivedAt: nextStatus === "ARCHIVED" && !execution.timing.archivedAt ? now : execution.timing.archivedAt,
    },
  };

  const createdAtMs = new Date(next.timing.createdAt).getTime();
  const startedAtMs = next.timing.startedAt ? new Date(next.timing.startedAt).getTime() : null;
  const completedAtMs = next.timing.completedAt ? new Date(next.timing.completedAt).getTime() : null;

  next.metrics = {
    ...next.metrics,
    queueWaitMs: startedAtMs ? Math.max(0, startedAtMs - createdAtMs) : next.metrics.queueWaitMs,
    durationMs: startedAtMs && completedAtMs ? Math.max(0, completedAtMs - startedAtMs) : next.metrics.durationMs,
  };

  return next;
}

export function addExecutionRetry(execution: GenesisExecution, reason: string): GenesisExecution {
  const entry: GenesisExecutionRetryEntry = {
    attempt: execution.retryHistory.length + 1,
    reason,
    occurredAt: nowIso(),
  };

  return {
    ...execution,
    status: "RETRYING",
    retryHistory: [...execution.retryHistory, entry],
    metrics: {
      ...execution.metrics,
      retries: execution.retryHistory.length + 1,
    },
  };
}
