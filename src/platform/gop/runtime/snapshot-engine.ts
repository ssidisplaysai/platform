import { randomUUID } from "node:crypto";
import type { GenesisExecution, GenesisExecutionSnapshot } from "../contracts";

function nowIso(): string {
  return new Date().toISOString();
}

function computeProgressPercent(execution: GenesisExecution): number {
  const total = Math.max(1, execution.metrics.nodeTotal || execution.graph.nodes.length || 1);
  const completed = Math.max(0, execution.metrics.nodeCompleted || 0);

  if (execution.status === "SUCCEEDED" || execution.status === "FAILED" || execution.status === "CANCELLED" || execution.status === "TIMED_OUT" || execution.status === "ARCHIVED") {
    return 100;
  }

  return Math.min(99, Math.round((completed / total) * 100));
}

export function createExecutionSnapshot(input: {
  execution: GenesisExecution;
  snapshotSequence: number;
  queuePosition?: number | null;
  upToEventSequence?: number | null;
  metadata?: Record<string, unknown>;
}): GenesisExecutionSnapshot {
  const execution = input.execution;

  return {
    snapshotId: `gsnap_${randomUUID()}`,
    executionId: execution.executionId,
    snapshotVersion: execution.snapshotVersion ?? 1,
    snapshotSequence: input.snapshotSequence,
    status: execution.status,
    currentState: execution.currentState,
    currentNodeId: execution.currentNodeId,
    progressPercent: computeProgressPercent(execution),
    queuePosition: input.queuePosition ?? null,
    worker: execution.worker ?? null,
    retryCount: execution.retryHistory.length,
    retryHistory: execution.retryHistory,
    output: execution.output ?? null,
    timing: execution.timing,
    metrics: execution.metrics,
    artifacts: execution.artifacts ?? [],
    state: execution,
    upToEventSequence: input.upToEventSequence ?? null,
    metadata: input.metadata,
    createdAt: nowIso(),
  };
}
