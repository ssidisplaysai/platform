import type { GenesisExecution, GenesisExecutionSnapshot } from "../contracts";
import type { GenesisEventStore } from "../event-store";

export type GenesisExecutionSearchQuery = {
  workspaceId?: string;
  moduleId?: string;
  status?: string;
  q?: string;
  limit?: number;
  cursor?: string;
};

export type GenesisExecutionRepository = {
  saveExecution: (execution: GenesisExecution) => Promise<GenesisExecution>;
  loadExecution: (executionId: string) => Promise<GenesisExecution | null>;
  loadExecutionByJobId: (jobId: string) => Promise<GenesisExecution | null>;
  updateExecution: (executionId: string, changes: Partial<GenesisExecution>) => Promise<GenesisExecution | null>;
  storeSnapshot: (snapshot: GenesisExecutionSnapshot) => Promise<GenesisExecutionSnapshot>;
  loadLatestSnapshot: (executionId: string) => Promise<GenesisExecutionSnapshot | null>;
  loadSnapshots: (executionId: string, limit?: number) => Promise<GenesisExecutionSnapshot[]>;
  compactSnapshots: (executionId: string, keepLatest?: number) => Promise<number>;
  replayExecution: (executionId: string, options?: { sequence?: number; eventStore?: GenesisEventStore | null }) => Promise<GenesisExecution | null>;
  listExecutionHistory: (executionId: string) => Promise<GenesisExecutionSnapshot[]>;
  listExecutions: (query?: GenesisExecutionSearchQuery) => Promise<GenesisExecution[]>;
  searchExecutions: (query: GenesisExecutionSearchQuery) => Promise<GenesisExecution[]>;
  archiveExecution: (executionId: string) => Promise<GenesisExecution | null>;
  loadRecoverableExecutions: () => Promise<GenesisExecution[]>;
};

export function createInMemoryExecutionRepository(initialExecutions: GenesisExecution[] = []): GenesisExecutionRepository {
  const executions = new Map<string, GenesisExecution>(initialExecutions.map((execution) => [execution.executionId, execution]));
  const snapshots = new Map<string, GenesisExecutionSnapshot[]>();

  return {
    async saveExecution(execution) {
      executions.set(execution.executionId, execution);
      return execution;
    },

    async loadExecution(executionId) {
      return executions.get(executionId) ?? null;
    },

    async loadExecutionByJobId(jobId) {
      return [...executions.values()].find((execution) => execution.jobId === jobId || execution.input?.jobId === jobId) ?? null;
    },

    async updateExecution(executionId, changes) {
      const existing = executions.get(executionId);
      if (!existing) {
        return null;
      }

      const updated: GenesisExecution = {
        ...existing,
        ...changes,
        timing: {
          ...existing.timing,
          ...(changes.timing ?? {}),
        },
      };

      executions.set(executionId, updated);
      return updated;
    },

    async storeSnapshot(snapshot) {
      const current = snapshots.get(snapshot.executionId) ?? [];
      snapshots.set(snapshot.executionId, [...current, snapshot]);
      return snapshot;
    },

    async loadLatestSnapshot(executionId) {
      const current = snapshots.get(executionId) ?? [];
      return current.length > 0 ? current[current.length - 1] : null;
    },

    async loadSnapshots(executionId, limit = 100) {
      const current = snapshots.get(executionId) ?? [];
      return [...current].reverse().slice(0, limit);
    },

    async compactSnapshots(executionId, keepLatest = 50) {
      const current = snapshots.get(executionId) ?? [];
      if (current.length <= keepLatest) {
        return 0;
      }

      const removed = current.length - keepLatest;
      snapshots.set(executionId, current.slice(current.length - keepLatest));
      return removed;
    },

    async replayExecution(executionId) {
      return executions.get(executionId) ?? null;
    },

    async listExecutionHistory(executionId) {
      return this.loadSnapshots(executionId, 500);
    },

    async listExecutions(query = {}) {
      const list = [...executions.values()].filter((execution) => {
        if (query.workspaceId && execution.workspaceId !== query.workspaceId) {
          return false;
        }

        if (query.moduleId && execution.moduleId !== query.moduleId) {
          return false;
        }

        if (query.status && execution.status !== query.status) {
          return false;
        }

        return true;
      });

      return list
        .sort((left, right) => right.timing.createdAt.localeCompare(left.timing.createdAt))
        .slice(0, Math.min(500, Math.max(1, query.limit ?? 100)));
    },

    async searchExecutions(query) {
      const q = (query.q ?? "").toLowerCase();
      const list = await this.listExecutions(query);

      if (!q) {
        return list;
      }

      return list.filter((execution) => [execution.executionId, execution.jobId, execution.correlationId]
        .filter((value): value is string => typeof value === "string")
        .some((value) => value.toLowerCase().includes(q)));
    },

    async archiveExecution(executionId) {
      const execution = executions.get(executionId);
      if (!execution) {
        return null;
      }

      const archived: GenesisExecution = {
        ...execution,
        status: "ARCHIVED",
        archivedAt: new Date().toISOString(),
      };

      executions.set(executionId, archived);
      return archived;
    },

    async loadRecoverableExecutions() {
      return [...executions.values()].filter((execution) =>
        ["RUNNING", "DISPATCHED", "QUEUED", "SCHEDULED", "WAITING", "BLOCKED", "RETRYING"].includes(execution.status));
    },
  };
}
