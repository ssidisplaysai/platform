import type { GenesisWorkerHealth, GenesisWorkerRegistration } from "../contracts";

function nowIso(): string {
  return new Date().toISOString();
}

export type GenesisWorkerRegistry = {
  register: (worker: Omit<GenesisWorkerRegistration, "heartbeatAt" | "currentWorkload" | "health"> & {
    heartbeatAt?: string;
    currentWorkload?: number;
    health?: GenesisWorkerHealth;
  }) => GenesisWorkerRegistration;
  heartbeat: (workerId: string) => GenesisWorkerRegistration | null;
  authenticate: (input: { workerId: string; tokenId?: string; protocolVersion?: string }) => GenesisWorkerRegistration | null;
  updateHealth: (workerId: string, health: GenesisWorkerHealth) => GenesisWorkerRegistration | null;
  assignWork: (workerId: string) => GenesisWorkerRegistration | null;
  releaseWork: (workerId: string) => GenesisWorkerRegistration | null;
  markDisconnected: (workerId: string) => GenesisWorkerRegistration | null;
  recoverAfterRestart: (workerId: string) => GenesisWorkerRegistration | null;
  evictStaleWorkers: (timeoutMs?: number) => GenesisWorkerRegistration[];
  pickEligibleWorkers: (input: {
    workerType: string;
    requiredCapabilities?: string[];
    workspaceId?: string;
    moduleId?: string;
    maxResults?: number;
  }) => GenesisWorkerRegistration[];
  list: () => GenesisWorkerRegistration[];
  getById: (workerId: string) => GenesisWorkerRegistration | null;
};

export function createGenesisWorkerRegistry(): GenesisWorkerRegistry {
  const workers = new Map<string, GenesisWorkerRegistration>();

  const clone = (worker: GenesisWorkerRegistration) => ({ ...worker, capabilities: [...worker.capabilities] });

  return {
    register(worker) {
      const registered: GenesisWorkerRegistration = {
        ...worker,
        heartbeatAt: worker.heartbeatAt ?? nowIso(),
        currentWorkload: worker.currentWorkload ?? 0,
        health: worker.health ?? "HEALTHY",
        protocolVersion: worker.protocolVersion ?? "gop-worker/v1",
        supportedProtocolVersions: worker.supportedProtocolVersions ?? [worker.protocolVersion ?? "gop-worker/v1"],
        authMode: worker.authMode ?? "SESSION",
        leaseTtlMs: worker.leaseTtlMs ?? 30_000,
        heartbeatIntervalMs: worker.heartbeatIntervalMs ?? 10_000,
        lastLeaseId: worker.lastLeaseId ?? null,
        disconnectedAt: worker.disconnectedAt ?? null,
      };

      workers.set(registered.workerId, registered);
      return clone(registered);
    },

    heartbeat(workerId) {
      const worker = workers.get(workerId);
      if (!worker) {
        return null;
      }

      worker.heartbeatAt = nowIso();
      worker.disconnectedAt = null;
      if (worker.health === "OFFLINE") {
        worker.health = "DEGRADED";
      }

      return clone(worker);
    },

    authenticate(input) {
      const worker = workers.get(input.workerId);
      if (!worker) {
        return null;
      }

      if (worker.tokenId && input.tokenId && worker.tokenId !== input.tokenId) {
        return null;
      }

      if (input.protocolVersion && worker.supportedProtocolVersions && !worker.supportedProtocolVersions.includes(input.protocolVersion)) {
        return null;
      }

      worker.heartbeatAt = nowIso();
      worker.disconnectedAt = null;
      return clone(worker);
    },

    updateHealth(workerId, health) {
      const worker = workers.get(workerId);
      if (!worker) {
        return null;
      }

      worker.health = health;
      worker.heartbeatAt = nowIso();
      return clone(worker);
    },

    assignWork(workerId) {
      const worker = workers.get(workerId);
      if (!worker) {
        return null;
      }

      if (worker.currentWorkload < worker.maxCapacity) {
        worker.currentWorkload += 1;
      }

      worker.heartbeatAt = nowIso();
      return clone(worker);
    },

    releaseWork(workerId) {
      const worker = workers.get(workerId);
      if (!worker) {
        return null;
      }

      worker.currentWorkload = Math.max(0, worker.currentWorkload - 1);
      worker.heartbeatAt = nowIso();
      return clone(worker);
    },

    markDisconnected(workerId) {
      const worker = workers.get(workerId);
      if (!worker) {
        return null;
      }

      worker.health = "OFFLINE";
      worker.disconnectedAt = nowIso();
      return clone(worker);
    },

    recoverAfterRestart(workerId) {
      const worker = workers.get(workerId);
      if (!worker) {
        return null;
      }

      worker.health = "DEGRADED";
      worker.disconnectedAt = null;
      worker.heartbeatAt = nowIso();
      return clone(worker);
    },

    evictStaleWorkers(timeoutMs = 45_000) {
      const now = Date.now();
      const stale: GenesisWorkerRegistration[] = [];

      for (const worker of workers.values()) {
        const lag = now - new Date(worker.heartbeatAt).getTime();
        if (lag <= timeoutMs) {
          continue;
        }

        worker.health = "OFFLINE";
        worker.disconnectedAt = nowIso();
        stale.push(clone(worker));
      }

      return stale;
    },

    pickEligibleWorkers(input) {
      const required = new Set(input.requiredCapabilities ?? []);

      return [...workers.values()]
        .filter((worker) => {
          if (worker.workerType !== input.workerType) {
            return false;
          }

          if (worker.health === "OFFLINE") {
            return false;
          }

          if (input.workspaceId && worker.workspaceId && worker.workspaceId !== input.workspaceId) {
            return false;
          }

          if (input.moduleId && worker.moduleId && worker.moduleId !== input.moduleId) {
            return false;
          }

          if (worker.currentWorkload >= worker.maxCapacity) {
            return false;
          }

          for (const capability of required) {
            if (!worker.capabilities.includes(capability)) {
              return false;
            }
          }

          return true;
        })
        .sort((left, right) => {
          const leftLoad = left.currentWorkload / Math.max(1, left.maxCapacity);
          const rightLoad = right.currentWorkload / Math.max(1, right.maxCapacity);
          if (leftLoad !== rightLoad) {
            return leftLoad - rightLoad;
          }

          return left.workerId.localeCompare(right.workerId);
        })
        .slice(0, input.maxResults ?? 100)
        .map(clone);
    },

    list() {
      return [...workers.values()].map(clone);
    },

    getById(workerId) {
      const worker = workers.get(workerId);
      return worker ? clone(worker) : null;
    },
  };
}
