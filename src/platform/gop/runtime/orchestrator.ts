import type {
  GenesisDeadLetterEntry,
  GenesisDispatchOutcome,
  GenesisExecution,
  GenesisExecutionClass,
  GenesisExecutionGraph,
  GenesisExecutionLease,
  GenesisExecutionNode,
  GenesisExecutionSnapshot,
  GenesisExecutionStatus,
  GenesisJobPriority,
  GenesisJobStatus,
  GenesisJobType,
  GenesisOperationsSnapshot,
  GenesisRuntimeFabricMetrics,
  GenesisWorkerUtilization,
} from "../contracts";
import { createGenesisExecution, addExecutionRetry, transitionExecutionStatus } from "./execution-engine";
import { createGenesisQueueManager } from "./queue-manager";
import { createGenesisWorkerRegistry } from "./worker-registry";
import { createGenesisNotificationCenter } from "./notification-center";
import type { GenesisEventStore } from "../event-store";
import { metricsFromDerived, reduceEventsToMetrics } from "../metrics-from-events";
import type { GenesisExecutionRepository } from "./execution-repository";
import { createExecutionSnapshot } from "./snapshot-engine";

function quantile(values: number[], q: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * q)));
  return sorted[idx];
}

function nowIso(): string {
  return new Date().toISOString();
}

function mapExecutionStateFromJobStatus(status: GenesisJobStatus): GenesisExecutionStatus {
  switch (status) {
    case "QUEUED":
      return "QUEUED";
    case "STARTING":
      return "DISPATCHED";
    case "RUNNING":
    case "GENERATING_CONTENT":
    case "GENERATING_IMAGE":
    case "UPLOADING_IMAGE":
    case "VALIDATION_STARTED":
    case "VALIDATION_PASSED":
    case "PUBLISHING":
      return "RUNNING";
    case "COMPLETE":
      return "SUCCEEDED";
    case "FAILED":
      return "FAILED";
    case "CANCELLED":
      return "CANCELLED";
    case "TIMED_OUT":
      return "TIMED_OUT";
    case "ARCHIVED":
      return "ARCHIVED";
    default:
      return "RUNNING";
  }
}

function buildGlwGraph(): GenesisExecutionGraph {
  const nodes: GenesisExecutionNode[] = [
    { nodeId: "n_intake", label: "Request Intake", nodeType: "VALIDATION", dependsOn: [] },
    { nodeId: "n_generate_content", label: "Generate Content", nodeType: "AI", dependsOn: ["n_intake"] },
    { nodeId: "n_generate_image", label: "Generate Image", nodeType: "IMAGE_GENERATION", dependsOn: ["n_generate_content"] },
    { nodeId: "n_publish", label: "Publish Draft", nodeType: "WORDPRESS", dependsOn: ["n_generate_image"] },
    { nodeId: "n_notify", label: "Notify Operators", nodeType: "NOTIFICATION", dependsOn: ["n_publish"] },
  ];

  return {
    graphId: "graph:glw:page-generation",
    nodes,
    edges: [
      { edgeId: "e1", fromNodeId: "n_intake", toNodeId: "n_generate_content" },
      { edgeId: "e2", fromNodeId: "n_generate_content", toNodeId: "n_generate_image" },
      { edgeId: "e3", fromNodeId: "n_generate_image", toNodeId: "n_publish" },
      { edgeId: "e4", fromNodeId: "n_publish", toNodeId: "n_notify" },
    ],
  };
}

export type GenesisOrchestrationRuntime = {
  createExecution: (input: {
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
    parentExecutionId?: string | null;
    input?: Record<string, unknown>;
    graph?: GenesisExecutionGraph;
    executionVersion?: number;
    snapshotVersion?: number;
    timeoutMs?: number;
  }) => GenesisExecution;
  createGlwExecutionForJob: (input: {
    jobId: string;
    jobType: GenesisJobType;
    title?: string;
    siteId?: string;
    retryOfJobId?: string | null;
  }) => GenesisExecution;
  syncGlwExecutionState: (input: {
    jobId: string;
    status: GenesisJobStatus;
    correlationId?: string | null;
    errorMessage?: string;
    result?: Record<string, unknown> | null;
  }) => GenesisExecution | null;
  scheduleExecution: (executionId: string, scheduledFor: string) => GenesisExecution | null;
  requestManualApproval: (executionId: string, reason: string) => GenesisExecution | null;
  resolveManualApproval: (executionId: string) => GenesisExecution | null;
  listExecutions: (limit?: number) => GenesisExecution[];
  getExecutionById: (executionId: string) => GenesisExecution | null;
  getExecutionByJobId: (jobId: string) => GenesisExecution | null;
  buildOperationsSnapshot: (workspaceId: string, eventStore?: GenesisEventStore | null) => Promise<GenesisOperationsSnapshot>;
  ensureRecovered: () => Promise<void>;
  flushPersistence: () => Promise<void>;
  acquireWorkLease: (input: {
    workerId: string;
    workerType: string;
    workerCapabilities: string[];
    protocolVersion?: string;
    tokenId?: string;
  }) => { execution: GenesisExecution; lease: GenesisExecutionLease } | null;
  renewExecutionLease: (input: { leaseId: string; workerId: string }) => GenesisExecutionLease | null;
  releaseExecutionLease: (input: { leaseId: string; workerId: string; outcome: GenesisDispatchOutcome; reason?: string }) => GenesisExecution | null;
  expireStaleLeases: () => { expired: GenesisExecutionLease[]; staleWorkers: string[] };
  dispatchPending: (limit?: number) => Array<{ execution: GenesisExecution; lease: GenesisExecutionLease }>;
  listExecutionLeases: () => GenesisExecutionLease[];
  listDeadLetters: () => GenesisDeadLetterEntry[];
  retryDeadLetter: (executionId: string) => GenesisExecution | null;
  archiveDeadLetter: (executionId: string) => boolean;
  reportExecutionProgress: (input: { leaseId: string; workerId: string; currentState?: string; currentNodeId?: string; outputPatch?: Record<string, unknown> }) => GenesisExecution | null;
  reportExecutionCompletion: (input: { leaseId: string; workerId: string; output?: Record<string, unknown> | null }) => GenesisExecution | null;
  reportExecutionFailure: (input: { leaseId: string; workerId: string; reason: string; retryable?: boolean }) => GenesisExecution | null;
  getExecutionHistory: (executionId: string) => Promise<GenesisExecutionSnapshot[]>;
  replayExecution: (executionId: string, options?: { sequence?: number; eventStore?: GenesisEventStore | null }) => Promise<GenesisExecution | null>;
  searchExecutions: (query: { workspaceId?: string; moduleId?: string; status?: string; q?: string; limit?: number }) => Promise<GenesisExecution[]>;
  listDurableExecutions: (query?: { workspaceId?: string; moduleId?: string; status?: string; q?: string; limit?: number }) => Promise<GenesisExecution[]>;
  queue: ReturnType<typeof createGenesisQueueManager>;
  workers: ReturnType<typeof createGenesisWorkerRegistry>;
  notifications: ReturnType<typeof createGenesisNotificationCenter>;
};

export function createGenesisOrchestrationRuntime(options: { repository?: GenesisExecutionRepository | null; bootstrapDefaultWorkers?: boolean } = {}): GenesisOrchestrationRuntime {
  const executions = new Map<string, GenesisExecution>();
  const executionByJobId = new Map<string, string>();
  const runtimeEventTimes: number[] = [];
  const leaseAcquisitionTimes: number[] = [];
  const dispatchTimes: number[] = [];
  const retryEventTimes: number[] = [];
  const deadLetterEventTimes: number[] = [];
  const persistenceTasks = new Set<Promise<unknown>>();
  let recovered = false;
  const queue = createGenesisQueueManager();
  const workers = createGenesisWorkerRegistry();
  const notifications = createGenesisNotificationCenter();
  const repository = options.repository ?? null;

  const trackPersistence = (promise: Promise<unknown>) => {
    const guarded = promise.catch(() => {
      return null;
    });

    persistenceTasks.add(guarded);
    guarded.finally(() => {
      persistenceTasks.delete(guarded);
    });
  };

  const persistSnapshot = (execution: GenesisExecution) => {
    if (!repository) {
      return;
    }

    const task = repository.loadLatestSnapshot(execution.executionId)
      .then((latest) => {
        const snapshot = createExecutionSnapshot({
          execution,
          snapshotSequence: (latest?.snapshotSequence ?? 0) + 1,
        });

        return repository.storeSnapshot(snapshot)
          .then(() => repository.compactSnapshots(execution.executionId, 60));
      });

    trackPersistence(task);
  };

  const persist = (execution: GenesisExecution): GenesisExecution => {
    executions.set(execution.executionId, execution);
    if (execution.jobId) {
      executionByJobId.set(execution.jobId, execution.executionId);
    }
    runtimeEventTimes.push(Date.now());

    if (repository) {
      const task = repository.saveExecution(execution);
      trackPersistence(task);
      persistSnapshot(execution);
    }

    return execution;
  };

  const recoverDecision = (execution: GenesisExecution): GenesisExecution => {
    if (execution.status === "RUNNING" || execution.status === "DISPATCHED" || execution.status === "RETRYING") {
      return transitionExecutionStatus(execution, "WAITING", {
        approvalRequired: true,
        blockedReason: "Recovered after restart. Operator confirmation required before resume.",
      });
    }

    if (execution.status === "QUEUED" || execution.status === "SCHEDULED") {
      queue.enqueue({
        executionId: execution.executionId,
        workspaceId: execution.workspaceId,
        moduleId: execution.moduleId,
        workerType: "ai",
        executionClass: execution.executionClass,
        priority: execution.priority,
        scheduledFor: execution.scheduledAt ?? execution.timing.scheduledAt,
      });
      return execution;
    }

    return execution;
  };

  const buildWorkerUtilization = (): GenesisWorkerUtilization[] => {
    const now = Date.now();
    const workersList = workers.list();
    return workersList.map((worker) => {
      const ratio = worker.currentWorkload / Math.max(1, worker.maxCapacity);
      return {
        workerId: worker.workerId,
        workerType: worker.workerType,
        utilizationPercent: Math.round(ratio * 100),
        idleMs: Math.max(0, now - new Date(worker.heartbeatAt).getTime()),
        activeLeases: queue.listLeases("ACTIVE").filter((lease) => lease.workerId === worker.workerId).length,
        lastHeartbeatAt: worker.heartbeatAt,
      };
    });
  };

  const buildFabricMetrics = (throughputPerMinute: number): GenesisRuntimeFabricMetrics => {
    const queueMetrics = queue.metrics();
    const utilization = buildWorkerUtilization();
    const now = Date.now();
    const oneMinuteAgo = now - 60_000;
    const retryFrequency = retryEventTimes.filter((value) => value >= oneMinuteAgo).length;
    const deadLetterRate = deadLetterEventTimes.filter((value) => value >= oneMinuteAgo).length;

    return {
      dispatchLatencyMsP50: queueMetrics.dispatchLatencyMsP50,
      dispatchLatencyMsP95: queueMetrics.dispatchLatencyMsP95,
      leaseAcquisitionMsP50: quantile(leaseAcquisitionTimes, 0.5),
      leaseAcquisitionMsP95: quantile(leaseAcquisitionTimes, 0.95),
      queueWaitMsP50: queueMetrics.queueWaitMsP50,
      queueWaitMsP95: queueMetrics.queueWaitMsP95,
      workerUtilization: utilization,
      workerIdleMsP95: quantile(utilization.map((entry) => entry.idleMs), 0.95),
      retryFrequencyPerMinute: retryFrequency,
      deadLetterRatePerMinute: deadLetterRate,
      throughputPerMinute,
    };
  };

  const toDeadLetterEntries = (): GenesisDeadLetterEntry[] => {
    const now = nowIso();
    return queue.listDeadLetters().map((entry) => ({
      deadLetterId: `gdl_${entry.item.executionId}`,
      executionId: entry.item.executionId,
      queueItemId: entry.item.queueItemId,
      workspaceId: entry.item.workspaceId,
      moduleId: entry.item.moduleId,
      queueName: entry.item.queueName,
      reason: entry.reason,
      retryHistory: [],
      failureHistory: [
        {
          occurredAt: entry.deadLetteredAt,
          reason: entry.reason,
        },
      ],
      operatorNotes: undefined,
      archivedAt: null,
      recoveredAt: null,
      createdAt: entry.deadLetteredAt,
      updatedAt: now,
    }));
  };

  const createExecution: GenesisOrchestrationRuntime["createExecution"] = (input) => {
    const created = createGenesisExecution({
      executionId: input.executionId,
      executionType: input.executionType,
      jobId: input.jobId,
      workspaceId: input.workspaceId,
      moduleId: input.moduleId,
      jobType: input.jobType,
      executionClass: input.executionClass,
      priority: input.priority,
      queueName: input.queueName,
      correlationId: input.correlationId,
      parentExecutionId: input.parentExecutionId,
      input: input.input,
      graph: input.graph,
      executionVersion: input.executionVersion,
      snapshotVersion: input.snapshotVersion,
      timeoutMs: input.timeoutMs,
    });

    return persist(created);
  };

  if (options.bootstrapDefaultWorkers !== false) {
    workers.register({
      workerId: "worker.ai.primary",
      name: "AI Worker",
      workerType: "ai",
      capabilities: ["content.generate", "seo.optimize"],
      maxCapacity: 8,
    });
    workers.register({
      workerId: "worker.wordpress.primary",
      name: "WordPress Worker",
      workerType: "wordpress",
      capabilities: ["wordpress.publish", "wordpress.update"],
      maxCapacity: 4,
    });
    workers.register({
      workerId: "worker.media.primary",
      name: "Media Worker",
      workerType: "media",
      capabilities: ["image.generate", "media.upload"],
      maxCapacity: 6,
    });
    workers.register({
      workerId: "worker.notify.primary",
      name: "Notification Worker",
      workerType: "notification",
      capabilities: ["in_app.notify"],
      maxCapacity: 20,
    });
  }

  return {
    createExecution,

    createGlwExecutionForJob(input) {
      const existingId = executionByJobId.get(input.jobId);
      if (existingId) {
        const existing = executions.get(existingId);
        if (existing) {
          return existing;
        }
      }

      const executionId = `gexec_glw_${input.jobId}`;
      const created = createExecution({
        executionId,
        workspaceId: "glw-led-display-warehouse",
        moduleId: "glw.core",
        jobType: input.jobType,
        executionType: input.jobType,
        executionClass: "AUTOMATED",
        priority: "NORMAL",
        parentExecutionId: input.retryOfJobId ? `gexec_glw_${input.retryOfJobId}` : null,
        jobId: input.jobId,
        queueName: "glw-default",
        executionVersion: 1,
        snapshotVersion: 1,
        input: {
          jobId: input.jobId,
          title: input.title,
          siteId: input.siteId,
        },
        graph: buildGlwGraph(),
      });

      const queued = transitionExecutionStatus(created, "QUEUED", {
        currentNodeId: "n_intake",
      });

      executionByJobId.set(input.jobId, queued.executionId);
      queue.enqueue({
        executionId: queued.executionId,
        workspaceId: queued.workspaceId,
        moduleId: queued.moduleId,
        workerType: "ai",
        executionClass: queued.executionClass,
        priority: queued.priority,
        scheduledFor: queued.timing.scheduledAt,
      });

      notifications.emit({
        title: "Execution queued",
        message: `Execution ${queued.executionId} entered the orchestration queue.`,
        kind: "info",
        audience: "operations",
        channel: "IN_APP",
        source: "QUEUE_BLOCKED",
        workspaceId: queued.workspaceId,
        executionId: queued.executionId,
      });

      return persist(queued);
    },

    syncGlwExecutionState(input) {
      const executionId = executionByJobId.get(input.jobId);
      if (!executionId) {
        return null;
      }

      const existing = executions.get(executionId);
      if (!existing) {
        return null;
      }

      let next = existing;
      const mapped = mapExecutionStateFromJobStatus(input.status);

      if (mapped === "RUNNING" && existing.status === "QUEUED") {
        queue.dequeue("ai");
      }

      if (mapped === "FAILED" && existing.retryHistory.length < 5) {
        next = addExecutionRetry(existing, input.errorMessage ?? "Job failure reported by callback/runtime state.");
      }

      next = transitionExecutionStatus(next, mapped, {
        output: input.result ?? undefined,
        blockedReason: mapped === "BLOCKED" ? input.errorMessage : undefined,
      });

      if (mapped === "SUCCEEDED") {
        notifications.emit({
          title: "Execution completed",
          message: `${next.executionId} completed successfully.`,
          kind: "success",
          audience: "operations",
          channel: "IN_APP",
          source: "EXECUTION_COMPLETED",
          workspaceId: next.workspaceId,
          executionId: next.executionId,
        });
      }

      if (mapped === "FAILED" || mapped === "TIMED_OUT" || mapped === "CANCELLED") {
        notifications.emit({
          title: "Execution failed",
          message: `${next.executionId} ended with ${mapped}.`,
          kind: "error",
          audience: "operations",
          channel: "IN_APP",
          source: mapped === "TIMED_OUT" ? "TIMEOUT" : "EXECUTION_FAILED",
          workspaceId: next.workspaceId,
          executionId: next.executionId,
        });
      }

      if (input.correlationId) {
        next = {
          ...next,
          correlationId: input.correlationId,
          context: {
            ...next.context,
            correlationId: input.correlationId,
          },
        };
      }

      return persist(next);
    },

    scheduleExecution(executionId, scheduledFor) {
      const execution = executions.get(executionId);
      if (!execution) {
        return null;
      }

      const scheduled = transitionExecutionStatus(execution, "SCHEDULED");
      queue.enqueue({
        executionId: scheduled.executionId,
        workspaceId: scheduled.workspaceId,
        moduleId: scheduled.moduleId,
        workerType: "ai",
        executionClass: scheduled.executionClass,
        priority: scheduled.priority,
        scheduledFor,
      });

      return persist(scheduled);
    },

    requestManualApproval(executionId, reason) {
      const execution = executions.get(executionId);
      if (!execution) {
        return null;
      }

      notifications.emit({
        title: "Approval required",
        message: `${executionId} requires manual approval: ${reason}`,
        kind: "warning",
        audience: "operations",
        channel: "IN_APP",
        source: "APPROVAL_REQUIRED",
        workspaceId: execution.workspaceId,
        executionId,
      });

      return persist(transitionExecutionStatus(execution, "WAITING", {
        approvalRequired: true,
        blockedReason: reason,
      }));
    },

    resolveManualApproval(executionId) {
      const execution = executions.get(executionId);
      if (!execution) {
        return null;
      }

      const resumed = transitionExecutionStatus(execution, "RUNNING", {
        approvalRequired: false,
        blockedReason: undefined,
      });

      return persist(resumed);
    },

    listExecutions(limit = 200) {
      return [...executions.values()]
        .sort((left, right) => right.timing.createdAt.localeCompare(left.timing.createdAt))
        .slice(0, limit);
    },

    getExecutionById(executionId) {
      return executions.get(executionId) ?? null;
    },

    getExecutionByJobId(jobId) {
      const executionId = executionByJobId.get(jobId);
      if (!executionId) {
        return null;
      }

      return executions.get(executionId) ?? null;
    },

    async buildOperationsSnapshot(workspaceId, eventStore) {
      await this.ensureRecovered();
      const all = [...executions.values()].filter((execution) => execution.workspaceId === workspaceId);
      const runningJobs = all.filter((execution) => execution.status === "RUNNING" || execution.status === "DISPATCHED").length;
      const failedExecutions = all.filter((execution) => execution.status === "FAILED" || execution.status === "TIMED_OUT");
      const retryQueue = all.filter((execution) => execution.status === "RETRYING");
      const activeApprovals = all.filter((execution) => execution.approvalRequired);
      const notificationsList = notifications.list(60);
      const queueState = queue.getState();
      const queueDepth = queue.list().length;
      const queueByPriority = queue.depthByPriority();
      const queueMetrics = queue.metrics();
      const leases = queue.listLeases("ACTIVE");
      const deadLetters = toDeadLetterEntries();

      const now = Date.now();
      const minuteAgo = now - 60_000;
      const recentRuntimeEvents = runtimeEventTimes.filter((value) => value >= minuteAgo);
      const throughputPerMinute = recentRuntimeEvents.length;

      let metrics = [] as ReturnType<typeof metricsFromDerived>;
      if (eventStore) {
        const eventsForMetrics = all.map((execution) => ({
          eventType: execution.status,
          status:
            execution.status === "SUCCEEDED"
              ? "COMPLETE"
              : execution.status === "FAILED"
                ? "FAILED"
                : execution.status === "TIMED_OUT"
                  ? "TIMED_OUT"
                  : execution.status === "CANCELLED"
                    ? "CANCELLED"
                    : "RUNNING",
          jobId: execution.executionId,
          durationMs: execution.metrics.durationMs ?? null,
        }));

        const derived = reduceEventsToMetrics(eventsForMetrics);
        metrics = metricsFromDerived(derived);
      }

      const workerList = workers.list();
      const heartbeatLagMs = workerList.length > 0
        ? Math.max(...workerList.map((worker) => Date.now() - new Date(worker.heartbeatAt).getTime()))
        : 0;

      const queueLatencyMs = queue.list().length > 0
        ? Math.max(...queue.list().map((item) => Date.now() - new Date(item.enqueuedAt).getTime()))
        : 0;

      const latestActive = all
        .filter((execution) => execution.status === "RUNNING" || execution.status === "DISPATCHED" || execution.status === "QUEUED")
        .sort((left, right) => right.timing.createdAt.localeCompare(left.timing.createdAt))[0];

      const executionLatencyMs = latestActive
        ? Date.now() - new Date(latestActive.timing.createdAt).getTime()
        : 0;

      const unhealthyWorkers = workerList.filter((worker) => worker.health !== "HEALTHY").length;
      const healthStatus = unhealthyWorkers > 0 || queueLatencyMs > 120_000
        ? unhealthyWorkers > 1 || queueLatencyMs > 300_000
          ? "CRITICAL"
          : "DEGRADED"
        : "HEALTHY";

      return {
        generatedAt: nowIso(),
        workspaceId,
        executions: all.sort((left, right) => right.timing.createdAt.localeCompare(left.timing.createdAt)),
        queue: {
          state: queueState,
          depth: queueDepth,
          activeByPriority: queueByPriority,
          paused: queueState !== "ACTIVE",
          retryDepth: queueMetrics.retryQueued,
          deadLetterDepth: queueMetrics.deadLettered,
          leasedDepth: queueMetrics.leased,
          expiredLeases: queueMetrics.expiredLeases,
        },
        workers: workerList,
        leases,
        deadLetters,
        workerUtilization: buildWorkerUtilization(),
        fabricMetrics: buildFabricMetrics(throughputPerMinute),
        alerts: notificationsList.filter((item) => item.kind === "warning" || item.kind === "error"),
        notifications: notificationsList,
        failedExecutions,
        retryQueue,
        activeApprovals,
        throughputPerMinute,
        runningJobs,
        health: {
          status: healthStatus,
          workerHeartbeatLagMs: heartbeatLagMs,
          queueLatencyMs,
          executionLatencyMs,
          databaseHealthy: true,
          eventThroughputPerMinute: throughputPerMinute,
          callbackLatencyMs: 0,
          apiFailureRate: 0,
          updatedAt: nowIso(),
        },
        metrics,
      };
    },

    async ensureRecovered() {
      if (recovered || !repository) {
        recovered = true;
        return;
      }

      try {
        const recoverable = await repository.loadRecoverableExecutions();
        for (const execution of recoverable) {
          const decided = recoverDecision(execution);
          executions.set(decided.executionId, decided);
          if (decided.jobId) {
            executionByJobId.set(decided.jobId, decided.executionId);
          }
        }
      } catch {
        // Do not fail runtime startup if persistence is temporarily unavailable.
      }

      recovered = true;
    },

    async flushPersistence() {
      await Promise.all([...persistenceTasks]);
    },

    acquireWorkLease(input) {
      const worker = workers.authenticate({
        workerId: input.workerId,
        tokenId: input.tokenId,
        protocolVersion: input.protocolVersion,
      });

      if (!worker) {
        return null;
      }

      const startedAt = Date.now();
      const acquired = queue.acquireLease({
        workerId: worker.workerId,
        workerType: input.workerType,
        workerCapabilities: input.workerCapabilities,
        workerCurrentLoad: worker.currentWorkload,
        workerMaxCapacity: worker.maxCapacity,
        workspaceId: worker.workspaceId,
        moduleId: worker.moduleId,
        protocolVersion: input.protocolVersion,
        tokenId: input.tokenId,
        leaseTtlMs: worker.leaseTtlMs,
        heartbeatWindowMs: worker.heartbeatIntervalMs,
      });

      if (!acquired) {
        return null;
      }

      const execution = executions.get(acquired.item.executionId);
      if (!execution) {
        queue.releaseLease({
          leaseId: acquired.lease.leaseId,
          workerId: acquired.lease.workerId,
          outcome: "ABANDONED",
          reason: "Execution not found during lease acquisition",
        });
        return null;
      }

      workers.assignWork(worker.workerId);
      const dispatched = transitionExecutionStatus(execution, "DISPATCHED", {
        worker,
        currentState: execution.currentState ?? "dispatched",
      });

      persist(dispatched);
      const elapsed = Date.now() - startedAt;
      leaseAcquisitionTimes.push(elapsed);
      dispatchTimes.push(elapsed);
      return {
        execution: dispatched,
        lease: acquired.lease,
      };
    },

    renewExecutionLease(input) {
      const worker = workers.heartbeat(input.workerId);
      if (!worker) {
        return null;
      }

      return queue.renewLease({
        leaseId: input.leaseId,
        workerId: input.workerId,
        leaseTtlMs: worker.leaseTtlMs,
        heartbeatWindowMs: worker.heartbeatIntervalMs,
      });
    },

    releaseExecutionLease(input) {
      const released = queue.releaseLease({
        leaseId: input.leaseId,
        workerId: input.workerId,
        outcome: input.outcome,
        reason: input.reason,
      });

      if (!released) {
        return null;
      }

      workers.releaseWork(input.workerId);
      const execution = executions.get(released.executionId);
      if (!execution) {
        return null;
      }

      if (input.outcome === "COMPLETED") {
        return persist(transitionExecutionStatus(execution, "SUCCEEDED"));
      }

      if (input.outcome === "FAILED") {
        return persist(transitionExecutionStatus(execution, "FAILED", {
          blockedReason: input.reason,
        }));
      }

      retryEventTimes.push(Date.now());
      const deadLettered = queue.listDeadLetters().find((entry) => entry.item.executionId === execution.executionId);
      if (deadLettered) {
        deadLetterEventTimes.push(Date.now());
        notifications.emit({
          title: "Execution moved to dead-letter queue",
          message: `${execution.executionId} moved to dead-letter queue: ${deadLettered.reason}`,
          kind: "error",
          audience: "operations",
          channel: "IN_APP",
          source: "RETRY_EXHAUSTED",
          workspaceId: execution.workspaceId,
          executionId: execution.executionId,
        });

        return persist(transitionExecutionStatus(execution, "BLOCKED", {
          approvalRequired: true,
          blockedReason: deadLettered.reason,
        }));
      }

      queue.enqueue({
        executionId: execution.executionId,
        workspaceId: execution.workspaceId,
        moduleId: execution.moduleId,
        workerType: execution.worker?.workerType ?? "ai",
        executionClass: execution.executionClass,
        priority: execution.priority,
        queueName: execution.queueName,
        requiredCapabilities: execution.worker?.capabilities ?? [],
        attempts: execution.retryHistory.length,
      });

      return persist(transitionExecutionStatus(execution, "RETRYING", {
        blockedReason: input.reason,
      }));
    },

    expireStaleLeases() {
      const staleWorkers = workers.evictStaleWorkers().map((worker) => worker.workerId);
      const expired = queue.expireLeases();

      for (const lease of expired) {
        const execution = executions.get(lease.executionId);
        if (!execution) {
          continue;
        }

        retryEventTimes.push(Date.now());
        persist(transitionExecutionStatus(execution, "RETRYING", {
          blockedReason: "Lease expired before completion",
        }));
      }

      return { expired, staleWorkers };
    },

    dispatchPending(limit = 100) {
      const dispatched: Array<{ execution: GenesisExecution; lease: GenesisExecutionLease }> = [];
      const workersByLoad = workers.list().sort((left, right) => {
        const leftRatio = left.currentWorkload / Math.max(1, left.maxCapacity);
        const rightRatio = right.currentWorkload / Math.max(1, right.maxCapacity);
        if (leftRatio !== rightRatio) {
          return leftRatio - rightRatio;
        }

        return left.workerId.localeCompare(right.workerId);
      });

      for (const worker of workersByLoad) {
        while (worker.currentWorkload + dispatched.filter((entry) => entry.lease.workerId === worker.workerId).length < worker.maxCapacity) {
          if (dispatched.length >= limit) {
            return dispatched;
          }

          const leased = this.acquireWorkLease({
            workerId: worker.workerId,
            workerType: worker.workerType,
            workerCapabilities: worker.capabilities,
            protocolVersion: worker.protocolVersion,
            tokenId: worker.tokenId,
          });

          if (!leased) {
            break;
          }

          dispatched.push(leased);
        }
      }

      return dispatched;
    },

    listExecutionLeases() {
      return queue.listLeases();
    },

    listDeadLetters() {
      return toDeadLetterEntries();
    },

    retryDeadLetter(executionId) {
      const queued = queue.retryDeadLetter(executionId);
      if (!queued) {
        return null;
      }

      const execution = executions.get(executionId);
      if (!execution) {
        return null;
      }

      return persist(transitionExecutionStatus(execution, "QUEUED", {
        blockedReason: undefined,
        approvalRequired: false,
      }));
    },

    archiveDeadLetter(executionId) {
      return queue.archiveDeadLetter(executionId);
    },

    reportExecutionProgress(input) {
      const lease = queue.renewLease({
        leaseId: input.leaseId,
        workerId: input.workerId,
      });

      if (!lease) {
        return null;
      }

      workers.heartbeat(input.workerId);
      const execution = executions.get(lease.executionId);
      if (!execution) {
        return null;
      }

      const updated: GenesisExecution = {
        ...execution,
        status: "RUNNING",
        currentState: input.currentState ?? execution.currentState,
        currentNodeId: input.currentNodeId ?? execution.currentNodeId,
        output: {
          ...(execution.output ?? {}),
          ...(input.outputPatch ?? {}),
        },
      };

      return persist(updated);
    },

    reportExecutionCompletion(input) {
      const updated = this.releaseExecutionLease({
        leaseId: input.leaseId,
        workerId: input.workerId,
        outcome: "COMPLETED",
      });

      if (!updated) {
        return null;
      }

      if (input.output) {
        return persist({
          ...updated,
          output: {
            ...(updated.output ?? {}),
            ...input.output,
          },
        });
      }

      return updated;
    },

    reportExecutionFailure(input) {
      return this.releaseExecutionLease({
        leaseId: input.leaseId,
        workerId: input.workerId,
        outcome: input.retryable === false ? "FAILED" : "RETRY",
        reason: input.reason,
      });
    },

    async getExecutionHistory(executionId) {
      if (!repository) {
        return [];
      }

      try {
        return await repository.listExecutionHistory(executionId);
      } catch {
        return [];
      }
    },

    async replayExecution(executionId, options = {}) {
      if (!repository) {
        return this.getExecutionById(executionId);
      }

      try {
        return await repository.replayExecution(executionId, {
          sequence: options.sequence,
          eventStore: options.eventStore,
        });
      } catch {
        return this.getExecutionById(executionId);
      }
    },

    async searchExecutions(query) {
      if (!repository) {
        const q = (query.q ?? "").toLowerCase();
        return this.listExecutions(query.limit).filter((execution) => {
          if (!q) {
            return true;
          }

          return [execution.executionId, execution.jobId, execution.correlationId]
            .filter((value): value is string => Boolean(value))
            .some((value) => value.toLowerCase().includes(q));
        });
      }

      try {
        return await repository.searchExecutions(query);
      } catch {
        return this.listExecutions(query.limit);
      }
    },

    async listDurableExecutions(query = {}) {
      if (!repository) {
        return this.listExecutions(query.limit);
      }

      try {
        return await repository.listExecutions(query);
      } catch {
        return this.listExecutions(query.limit);
      }
    },

    queue,
    workers,
    notifications,
  };
}
