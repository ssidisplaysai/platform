import { randomUUID } from "node:crypto";
import type {
  GenesisDispatchOutcome,
  GenesisExecutionClass,
  GenesisExecutionLease,
  GenesisLeaseState,
  GenesisQueueItem,
  GenesisQueueMetrics,
  GenesisQueuePriority,
  GenesisQueueState,
} from "../contracts";

const priorityWeight: Record<GenesisQueuePriority, number> = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
  URGENT: 4,
};

function nowIso(): string {
  return new Date().toISOString();
}

function ageBoostMs(queuedAt: string): number {
  const age = Date.now() - new Date(queuedAt).getTime();
  return Math.floor(age / 30000);
}

function quantile(values: number[], q: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * q)));
  return sorted[idx];
}

function hasRequiredCapabilities(item: GenesisQueueItem, workerCapabilities: string[]): boolean {
  const required = item.requiredCapabilities ?? [];
  if (required.length === 0) {
    return true;
  }

  const set = new Set(workerCapabilities);
  return required.every((capability) => set.has(capability));
}

function leaseFor(
  item: GenesisQueueItem,
  worker: { workerId: string; protocolVersion?: string; tokenId?: string },
  now: number,
  leaseTtlMs: number,
  heartbeatWindowMs: number,
  leaseState: GenesisLeaseState = "ACTIVE",
): GenesisExecutionLease {
  return {
    leaseId: `glease_${randomUUID()}`,
    executionId: item.executionId,
    queueItemId: item.queueItemId,
    workerId: worker.workerId,
    workspaceId: item.workspaceId,
    moduleId: item.moduleId,
    leaseStartAt: new Date(now).toISOString(),
    leaseExpiresAt: new Date(now + leaseTtlMs).toISOString(),
    heartbeatDeadlineAt: new Date(now + heartbeatWindowMs).toISOString(),
    renewalCount: 0,
    leaseState,
    protocolVersion: worker.protocolVersion ?? "gop-worker/v1",
    tokenId: worker.tokenId,
  };
}

export type GenesisQueueManager = {
  enqueue: (input: Omit<GenesisQueueItem, "queueItemId" | "enqueuedAt">) => GenesisQueueItem;
  dequeue: (workerType: string) => GenesisQueueItem | null;
  acquireLease: (input: {
    workerId: string;
    workerType: string;
    workerCapabilities: string[];
    workerCurrentLoad: number;
    workerMaxCapacity: number;
    workspaceId?: string;
    moduleId?: string;
    protocolVersion?: string;
    tokenId?: string;
    leaseTtlMs?: number;
    heartbeatWindowMs?: number;
    now?: number;
  }) => { item: GenesisQueueItem; lease: GenesisExecutionLease } | null;
  renewLease: (input: {
    leaseId: string;
    workerId: string;
    leaseTtlMs?: number;
    heartbeatWindowMs?: number;
    now?: number;
  }) => GenesisExecutionLease | null;
  releaseLease: (input: {
    leaseId: string;
    workerId: string;
    outcome: GenesisDispatchOutcome;
    reason?: string;
    now?: number;
  }) => GenesisExecutionLease | null;
  expireLeases: (now?: number) => GenesisExecutionLease[];
  stealExpiredLease: (input: {
    executionId: string;
    workerId: string;
    workerType: string;
    workerCapabilities: string[];
    workerCurrentLoad: number;
    workerMaxCapacity: number;
    protocolVersion?: string;
    tokenId?: string;
    leaseTtlMs?: number;
    heartbeatWindowMs?: number;
    now?: number;
  }) => { item: GenesisQueueItem; lease: GenesisExecutionLease } | null;
  list: () => GenesisQueueItem[];
  listRetryQueue: () => GenesisQueueItem[];
  listLeases: (state?: GenesisLeaseState) => GenesisExecutionLease[];
  listDeadLetters: () => Array<{ item: GenesisQueueItem; reason: string; deadLetteredAt: string; retries: number }>;
  retryDeadLetter: (executionId: string) => GenesisQueueItem | null;
  archiveDeadLetter: (executionId: string) => boolean;
  setState: (state: GenesisQueueState) => void;
  getState: () => GenesisQueueState;
  pause: () => void;
  resume: () => void;
  drain: () => void;
  clear: () => void;
  depthByPriority: () => Record<GenesisQueuePriority, number>;
  metrics: () => GenesisQueueMetrics;
};

export function createGenesisQueueManager(): GenesisQueueManager {
  const items = new Map<string, GenesisQueueItem>();
  const retryQueue = new Map<string, GenesisQueueItem>();
  const leased = new Map<string, { item: GenesisQueueItem; lease: GenesisExecutionLease }>();
  const leaseById = new Map<string, { item: GenesisQueueItem; lease: GenesisExecutionLease }>();
  const leaseHistory: GenesisExecutionLease[] = [];
  const deadLetters = new Map<string, { item: GenesisQueueItem; reason: string; deadLetteredAt: string; retries: number; archivedAt?: string }>();
  let state: GenesisQueueState = "ACTIVE";
  const perMinuteByWorker = new Map<string, number[]>();
  const dispatchLatencyMs: number[] = [];
  const queueWaitMs: number[] = [];
  let expiredLeasesCount = 0;

  const underRateLimit = (workerKey: string) => {
    const now = Date.now();
    const windowStart = now - 60_000;
    const timestamps = perMinuteByWorker.get(workerKey) ?? [];
    const recent = timestamps.filter((value) => value >= windowStart);
    perMinuteByWorker.set(workerKey, recent);

    return recent.length < 60;
  };

  const markRateUsage = (workerKey: string) => {
    const now = Date.now();
    const current = perMinuteByWorker.get(workerKey) ?? [];
    perMinuteByWorker.set(workerKey, [...current, now]);
  };

  return {
    enqueue(input) {
      const queued: GenesisQueueItem = {
        queueItemId: `gq_${randomUUID()}`,
        enqueuedAt: nowIso(),
        attempts: input.attempts ?? 0,
        maxAttempts: input.maxAttempts ?? 5,
        queueName: input.queueName ?? "default",
        ...input,
      };
      items.set(queued.executionId, queued);
      return queued;
    },

    dequeue(workerType: string) {
      const acquired = this.acquireLease({
        workerId: `legacy.${workerType}`,
        workerType,
        workerCapabilities: [],
        workerCurrentLoad: 0,
        workerMaxCapacity: 9999,
      });

      if (!acquired) {
        return null;
      }

      this.releaseLease({
        leaseId: acquired.lease.leaseId,
        workerId: acquired.lease.workerId,
        outcome: "COMPLETED",
      });

      markRateUsage(`legacy.${workerType}`);
      return acquired.item;
    },

    acquireLease(input) {
      const now = input.now ?? Date.now();
      if (state !== "ACTIVE") {
        return null;
      }

      if (!underRateLimit(input.workerId)) {
        return null;
      }

      if (input.workerCurrentLoad >= input.workerMaxCapacity) {
        return null;
      }

      this.expireLeases(now);

      const candidates = [...items.values()]
        .filter((item) => {
          if (item.workerType !== input.workerType) {
            return false;
          }

          if (input.workspaceId && item.workspaceId !== input.workspaceId) {
            return false;
          }

          if (input.moduleId && item.moduleId !== input.moduleId) {
            return false;
          }

          if (item.affinityWorkerId && item.affinityWorkerId !== input.workerId) {
            return false;
          }

          if (!hasRequiredCapabilities(item, input.workerCapabilities)) {
            return false;
          }

          if (item.scheduledFor) {
            return new Date(item.scheduledFor).getTime() <= now;
          }

          return true;
        })
        .sort((left, right) => {
          const leftScore = priorityWeight[left.priority] + ageBoostMs(left.enqueuedAt);
          const rightScore = priorityWeight[right.priority] + ageBoostMs(right.enqueuedAt);

          if (leftScore !== rightScore) {
            return rightScore - leftScore;
          }

          return left.enqueuedAt.localeCompare(right.enqueuedAt);
        });

      const selected = candidates[0];
      if (!selected) {
        return null;
      }

      const lease = leaseFor(
        selected,
        {
          workerId: input.workerId,
          protocolVersion: input.protocolVersion,
          tokenId: input.tokenId,
        },
        now,
        input.leaseTtlMs ?? 30_000,
        input.heartbeatWindowMs ?? 10_000,
      );

      items.delete(selected.executionId);
      leased.set(selected.executionId, { item: selected, lease });
      leaseById.set(lease.leaseId, { item: selected, lease });
      leaseHistory.push(lease);

      dispatchLatencyMs.push(now - new Date(selected.enqueuedAt).getTime());
      queueWaitMs.push(now - new Date(selected.enqueuedAt).getTime());
      markRateUsage(input.workerId);
      return { item: selected, lease };
    },

    renewLease(input) {
      const record = leaseById.get(input.leaseId);
      if (!record || record.lease.workerId !== input.workerId || record.lease.leaseState !== "ACTIVE") {
        return null;
      }

      const now = input.now ?? Date.now();
      const next: GenesisExecutionLease = {
        ...record.lease,
        renewalCount: record.lease.renewalCount + 1,
        leaseExpiresAt: new Date(now + (input.leaseTtlMs ?? 30_000)).toISOString(),
        heartbeatDeadlineAt: new Date(now + (input.heartbeatWindowMs ?? 10_000)).toISOString(),
      };

      const wrapped = { item: record.item, lease: next };
      leased.set(record.item.executionId, wrapped);
      leaseById.set(next.leaseId, wrapped);
      leaseHistory.push(next);
      return next;
    },

    releaseLease(input) {
      const record = leaseById.get(input.leaseId);
      if (!record || record.lease.workerId !== input.workerId || record.lease.leaseState !== "ACTIVE") {
        return null;
      }

      const now = input.now ?? Date.now();
      const released: GenesisExecutionLease = {
        ...record.lease,
        leaseState: "RELEASED",
        releasedAt: new Date(now).toISOString(),
        releaseReason: input.reason ?? input.outcome,
      };

      leaseById.set(input.leaseId, { item: record.item, lease: released });
      leased.delete(record.item.executionId);
      leaseHistory.push(released);

      if (input.outcome === "RETRY" || input.outcome === "ABANDONED") {
        const attempts = (record.item.attempts ?? 0) + 1;
        const maxAttempts = record.item.maxAttempts ?? 5;
        const next = {
          ...record.item,
          attempts,
          enqueuedAt: new Date(now).toISOString(),
        };

        if (attempts >= maxAttempts || record.item.deadLetterOnFailure) {
          deadLetters.set(record.item.executionId, {
            item: next,
            reason: input.reason ?? `Retry exhausted with outcome ${input.outcome}`,
            deadLetteredAt: new Date(now).toISOString(),
            retries: attempts,
          });
        } else {
          retryQueue.set(record.item.executionId, next);
        }
      }

      return released;
    },

    expireLeases(now = Date.now()) {
      const expired: GenesisExecutionLease[] = [];

      for (const [executionId, value] of leased.entries()) {
        const expiresAt = new Date(value.lease.leaseExpiresAt).getTime();
        const heartbeatAt = new Date(value.lease.heartbeatDeadlineAt).getTime();
        if (now < expiresAt && now < heartbeatAt) {
          continue;
        }

        expiredLeasesCount += 1;
        const lease: GenesisExecutionLease = {
          ...value.lease,
          leaseState: "EXPIRED",
          releasedAt: new Date(now).toISOString(),
          releaseReason: "Lease expired or heartbeat timed out",
        };

        leased.delete(executionId);
        leaseById.set(lease.leaseId, { item: value.item, lease });
        leaseHistory.push(lease);

        const retries = (value.item.attempts ?? 0) + 1;
        const nextItem: GenesisQueueItem = {
          ...value.item,
          attempts: retries,
          enqueuedAt: new Date(now).toISOString(),
        };

        if (retries >= (value.item.maxAttempts ?? 5) || value.item.deadLetterOnFailure) {
          deadLetters.set(executionId, {
            item: nextItem,
            reason: "Lease expired repeatedly",
            deadLetteredAt: new Date(now).toISOString(),
            retries,
          });
        } else {
          retryQueue.set(executionId, nextItem);
        }

        expired.push(lease);
      }

      if (state === "ACTIVE" && retryQueue.size > 0) {
        for (const [executionId, item] of retryQueue.entries()) {
          items.set(executionId, item);
          retryQueue.delete(executionId);
        }
      }

      return expired;
    },

    stealExpiredLease(input) {
      const now = input.now ?? Date.now();
      const record = leased.get(input.executionId);
      if (!record) {
        return null;
      }

      const expiresAt = new Date(record.lease.leaseExpiresAt).getTime();
      const heartbeatAt = new Date(record.lease.heartbeatDeadlineAt).getTime();
      if (now < expiresAt && now < heartbeatAt) {
        return null;
      }

      const stolenExpired = this.expireLeases(now).find((entry) => entry.executionId === input.executionId);
      if (!stolenExpired) {
        return null;
      }

      const acquire = this.acquireLease({
        workerId: input.workerId,
        workerType: input.workerType,
        workerCapabilities: input.workerCapabilities,
        workerCurrentLoad: input.workerCurrentLoad,
        workerMaxCapacity: input.workerMaxCapacity,
        protocolVersion: input.protocolVersion,
        tokenId: input.tokenId,
        leaseTtlMs: input.leaseTtlMs,
        heartbeatWindowMs: input.heartbeatWindowMs,
        now,
      });

      if (!acquire) {
        return null;
      }

      const stolen: GenesisExecutionLease = {
        ...acquire.lease,
        leaseState: "STOLEN",
        stolenFromWorkerId: stolenExpired.workerId,
      };

      leaseById.set(stolen.leaseId, { item: acquire.item, lease: stolen });
      leased.set(acquire.item.executionId, { item: acquire.item, lease: stolen });
      leaseHistory.push(stolen);
      return { item: acquire.item, lease: stolen };
    },

    list() {
      return [...items.values()];
    },

    listRetryQueue() {
      return [...retryQueue.values()];
    },

    listLeases(filterState) {
      const active = [...leased.values()].map((entry) => entry.lease);
      const history = leaseHistory;
      const deduped = new Map<string, GenesisExecutionLease>();
      for (const lease of [...history, ...active]) {
        deduped.set(lease.leaseId, lease);
      }

      const combined = [...deduped.values()];
      if (!filterState) {
        return combined;
      }

      return combined.filter((lease) => lease.leaseState === filterState);
    },

    listDeadLetters() {
      return [...deadLetters.values()].filter((entry) => !entry.archivedAt);
    },

    retryDeadLetter(executionId) {
      const found = deadLetters.get(executionId);
      if (!found || found.archivedAt) {
        return null;
      }

      const retried: GenesisQueueItem = {
        ...found.item,
        attempts: 0,
        enqueuedAt: nowIso(),
      };

      items.set(retried.executionId, retried);
      deadLetters.delete(executionId);
      return retried;
    },

    archiveDeadLetter(executionId) {
      const found = deadLetters.get(executionId);
      if (!found || found.archivedAt) {
        return false;
      }

      found.archivedAt = nowIso();
      deadLetters.set(executionId, found);
      return true;
    },

    setState(nextState) {
      state = nextState;
    },

    getState() {
      return state;
    },

    pause() {
      state = "PAUSED";
    },

    resume() {
      state = "ACTIVE";
    },

    drain() {
      state = "DRAINING";
    },

    clear() {
      items.clear();
      retryQueue.clear();
      leased.clear();
      leaseById.clear();
    },

    depthByPriority() {
      const base: Record<GenesisQueuePriority, number> = {
        LOW: 0,
        NORMAL: 0,
        HIGH: 0,
        URGENT: 0,
      };

      for (const item of items.values()) {
        base[item.priority] += 1;
      }

      return base;
    },

    metrics() {
      const activeLeases = [...leased.values()].length;
      const totalCapacity = Math.max(1, [...leased.values()].length + [...items.values()].length);

      return {
        queued: items.size,
        leased: activeLeases,
        retryQueued: retryQueue.size,
        deadLettered: [...deadLetters.values()].filter((entry) => !entry.archivedAt).length,
        expiredLeases: expiredLeasesCount,
        dispatchLatencyMsP50: quantile(dispatchLatencyMs, 0.5),
        dispatchLatencyMsP95: quantile(dispatchLatencyMs, 0.95),
        queueWaitMsP50: quantile(queueWaitMs, 0.5),
        queueWaitMsP95: quantile(queueWaitMs, 0.95),
        leaseUtilizationPercent: Math.round((activeLeases / totalCapacity) * 100),
      };
    },
  };
}

export function inferWorkerTypeForExecutionClass(executionClass: GenesisExecutionClass): string {
  switch (executionClass) {
    case "INTERACTIVE":
      return "notification";
    case "SCHEDULED":
      return "scheduler";
    case "SYSTEM":
      return "system";
    default:
      return "orchestration";
  }
}
