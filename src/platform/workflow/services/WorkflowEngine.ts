import { randomUUID } from "node:crypto";
import type { MessageEnvelope, Publisher } from "@/platform/messaging";
import { getGenesisMessageBus } from "@/platform/messaging";
import { getGenesisAuthenticationService } from "@/platform/identity/services";
import type {
  WorkflowContext,
  WorkflowDefinition,
  WorkflowEventType,
  WorkflowInstance,
  WorkflowState,
} from "../contracts";
import { FileWorkflowPersistenceCoordinator, type WorkflowPersistenceCoordinator } from "../persistence";
import { CheckpointService } from "./CheckpointService";
import { CompensationService } from "./CompensationService";
import { ContextManager } from "./ContextManager";
import { ExecutionHistory } from "./ExecutionHistory";
import { StepExecutor } from "./StepExecutor";
import { TimeoutManager } from "./TimeoutManager";
import { TransitionEngine } from "./TransitionEngine";
import { VariableResolver } from "./VariableResolver";
import { WorkflowAuditWriter } from "./WorkflowAuditWriter";
import { WorkflowExecutor } from "./WorkflowExecutor";
import { WorkflowHealthService } from "./WorkflowHealthService";
import { WorkflowMetricsService } from "./WorkflowMetricsService";
import { WorkflowRegistry } from "./WorkflowRegistry";

export type WorkflowCapabilityMetadata = {
  capabilityId: "platform.workflow";
  capabilityName: "Genesis Enterprise Workflow Platform";
  version: string;
  dependencies: {
    messaging: "consumed";
    identity: "consumed";
    missionControl: "integrated";
  };
  supports: {
    pauseResume: boolean;
    cancellation: boolean;
    retries: boolean;
    compensation: boolean;
    checkpointing: boolean;
    timeoutHandling: boolean;
    audit: boolean;
    metrics: boolean;
    health: boolean;
    persistence: boolean;
    restartRecovery: boolean;
    concurrencyControl: boolean;
    idempotency: boolean;
  };
};

type WorkflowMessagingPublisher = Pick<Publisher, "publish"> & {
  healthSnapshot?: () => { status: string };
};

type CommandType = "execute" | "pause" | "resume" | "cancel";

type CommandOptions = {
  idempotencyKey?: string;
  expectedVersion?: number;
};

export class WorkflowEngine {
  private readonly registry: WorkflowRegistry;
  private readonly metrics: WorkflowMetricsService;
  private readonly auditWriter: WorkflowAuditWriter;
  private readonly healthService: WorkflowHealthService;
  private readonly executionHistory: ExecutionHistory;
  private readonly checkpoints: CheckpointService;
  private readonly workflowExecutor: WorkflowExecutor;
  private readonly messaging: WorkflowMessagingPublisher;
  private readonly persistence: WorkflowPersistenceCoordinator;
  private readonly instances = new Map<string, WorkflowInstance>();
  private readonly activeMutations = new Set<string>();
  private readonly ready: Promise<void>;

  constructor(options?: {
    messaging?: WorkflowMessagingPublisher;
    persistence?: WorkflowPersistenceCoordinator;
  }) {
    this.registry = new WorkflowRegistry();
    this.metrics = new WorkflowMetricsService();
    this.auditWriter = new WorkflowAuditWriter();
    this.healthService = new WorkflowHealthService();
    this.executionHistory = new ExecutionHistory();
    this.checkpoints = new CheckpointService();
    this.messaging = options?.messaging ?? getGenesisMessageBus();
    this.persistence = options?.persistence ?? new FileWorkflowPersistenceCoordinator();

    const contextManager = new ContextManager();
    const variableResolver = new VariableResolver();
    const timeoutManager = new TimeoutManager();
    const stepExecutor = new StepExecutor(timeoutManager, variableResolver);
    const transitionEngine = new TransitionEngine();
    const compensationService = new CompensationService();

    this.workflowExecutor = new WorkflowExecutor(
      stepExecutor,
      transitionEngine,
      contextManager,
      this.checkpoints,
      compensationService,
      this.executionHistory,
      this.auditWriter,
      this.metrics,
      {
        onExecutionRecord: async ({ instance, stepId, attempt }) => {
          const record = this.executionHistory.list(instance.instanceId).find((entry) => entry.stepId === stepId && entry.attempt === attempt);
          if (record) {
            await this.persistence.executionHistoryStore.append(record);
          }
        },
        onCheckpoint: async ({ instance, stepId, state }) => {
          const checkpoint = this.checkpoints.latest(instance.instanceId);
          if (!checkpoint || checkpoint.stepId !== stepId || checkpoint.state !== state) {
            throw new Error("workflow_checkpoint_integrity_failure");
          }

          await this.persistence.checkpointStore.append(checkpoint);
        },
        onRetry: async ({ instance, stepId, attempt, reason }) => {
          await this.persistence.retryStore.append({
            instanceId: instance.instanceId,
            stepId,
            attempt,
            reason,
            recordedAt: new Date().toISOString(),
          });
        },
        onRetryResolved: async ({ instance, stepId }) => {
          await this.persistence.retryStore.clear(instance.instanceId, stepId);
        },
        onTimeout: async ({ instance, stepId, timeoutMs }) => {
          await this.persistence.timeoutStore.upsert({
            instanceId: instance.instanceId,
            stepId,
            timeoutMs,
            recordedAt: new Date().toISOString(),
            status: "PENDING",
          });
        },
        onTimeoutResolved: async ({ instance, stepId }) => {
          await this.persistence.timeoutStore.resolve(instance.instanceId, stepId);
        },
        onCompensation: async ({ instance, stepId }) => {
          await this.persistence.compensationStore.append({
            instanceId: instance.instanceId,
            stepId,
            status: "SUCCESS",
            recordedAt: new Date().toISOString(),
          });
        },
        onCompensationFailure: async ({ instance, stepId, reason }) => {
          await this.persistence.compensationStore.append({
            instanceId: instance.instanceId,
            stepId,
            status: "FAILED",
            reason,
            recordedAt: new Date().toISOString(),
          });
        },
      },
    );

    this.ready = this.recover();
  }

  async waitUntilReady(): Promise<void> {
    await this.ready;
  }

  async registerWorkflow(definition: WorkflowDefinition): Promise<void> {
    await this.ready;
    this.registry.register(definition);
    this.metrics.trackRegisteredWorkflowDefinition();
    await this.persistence.definitionStore.save(definition);
    await this.persistMetrics();
  }

  async createInstance(input: { definitionId: string; context: WorkflowContext; idempotencyKey?: string }): Promise<WorkflowInstance> {
    await this.ready;
    const definition = this.registry.get(input.definitionId);
    const now = new Date().toISOString();
    const instance: WorkflowInstance = {
      instanceId: randomUUID(),
      workflowId: definition.id,
      definitionId: definition.id,
      idempotencyKey: input.idempotencyKey ?? randomUUID(),
      version: 1,
      state: "CREATED",
      currentStepId: definition.initialStepId,
      context: {
        tenant: input.context.tenant,
        workspace: input.context.workspace,
        initiatedBy: input.context.initiatedBy,
        variables: { ...input.context.variables },
      },
      attemptsByStep: {},
      executedStepIds: [],
      startedAt: now,
      updatedAt: now,
    };

    await this.persistNewInstance(instance);
    this.instances.set(instance.instanceId, instance);
    this.metrics.trackCreatedInstance();
    await this.writeAudit(instance, "WORKFLOW_CREATED", "Workflow instance created");
    await this.publishLifecycleEvent(instance, "WORKFLOW_CREATED", { state: instance.state });
    await this.refreshOperationalMetrics();
    return this.cloneInstance(instance);
  }

  async execute(instanceId: string, options?: CommandOptions): Promise<WorkflowInstance> {
    await this.ready;
    return this.runCommand(instanceId, "execute", options, async (instance) => {
      if (instance.state === "CANCELLED" || instance.state === "COMPLETED") {
        return instance;
      }

      if (instance.state === "PAUSED") {
        throw new Error(`workflow_instance_paused:${instanceId}`);
      }

      const definition = this.registry.get(instance.definitionId);
      instance.state = "RUNNING";
      instance.lastExecutionStartedAt = new Date().toISOString();
      instance.updatedAt = instance.lastExecutionStartedAt;
      await this.writeAudit(instance, "WORKFLOW_STARTED", "Workflow execution started");
      await this.publishLifecycleEvent(instance, "WORKFLOW_STARTED", { stepId: instance.currentStepId ?? null });

      const startedAt = Date.now();
      const resolved = await this.workflowExecutor.execute(definition, instance);
      resolved.lastExecutionCompletedAt = new Date().toISOString();
      this.metrics.trackExecutionDuration(Date.now() - startedAt);

      if (resolved.state === "COMPLETED") {
        await this.writeAudit(resolved, "WORKFLOW_COMPLETED", "Workflow execution completed");
        await this.publishLifecycleEvent(resolved, "WORKFLOW_COMPLETED", { completedAt: resolved.completedAt ?? null });
      }

      if (resolved.state === "FAILED") {
        await this.writeAudit(resolved, "WORKFLOW_FAILED", "Workflow execution failed", {
          reason: resolved.failureReason ?? "unknown",
        });
        await this.publishLifecycleEvent(resolved, "WORKFLOW_FAILED", {
          reason: resolved.failureReason ?? "unknown",
        });
      }

      if (resolved.state === "TIMED_OUT") {
        await this.writeAudit(resolved, "WORKFLOW_TIMED_OUT", "Workflow execution timed out", {
          reason: resolved.failureReason ?? "workflow_step_timeout",
        });
        await this.publishLifecycleEvent(resolved, "WORKFLOW_TIMED_OUT", {
          reason: resolved.failureReason ?? "workflow_step_timeout",
        });
      }

      if (resolved.state === "PAUSED") {
        await this.publishLifecycleEvent(resolved, "WORKFLOW_PAUSED", { stepId: resolved.currentStepId ?? null });
      }

      return resolved;
    });
  }

  async pause(instanceId: string, reason?: string, options?: CommandOptions): Promise<WorkflowInstance> {
    await this.ready;
    return this.runCommand(instanceId, "pause", options, async (instance) => {
      if (instance.state === "RUNNING" || instance.state === "CREATED") {
        instance.state = "PAUSED";
        instance.updatedAt = new Date().toISOString();
        await this.writeAudit(instance, "WORKFLOW_PAUSED", reason ?? "Workflow paused manually");
        await this.publishLifecycleEvent(instance, "WORKFLOW_PAUSED", { reason: reason ?? "manual" });
      }

      return instance;
    });
  }

  async resume(instanceId: string, options?: CommandOptions): Promise<WorkflowInstance> {
    await this.ready;
    await this.runCommand(instanceId, "resume", options, async (instance) => {
      if (instance.state !== "PAUSED") {
        throw new Error(`workflow_instance_not_paused:${instanceId}`);
      }

      const checkpoint = this.checkpoints.latest(instance.instanceId);
      if (!checkpoint) {
        throw new Error(`workflow_checkpoint_missing:${instance.instanceId}`);
      }

      instance.state = "CREATED";
      instance.currentStepId = checkpoint.stepId;
      instance.updatedAt = new Date().toISOString();
      await this.writeAudit(instance, "WORKFLOW_RESUMED", "Workflow resumed");
      await this.publishLifecycleEvent(instance, "WORKFLOW_RESUMED", { stepId: instance.currentStepId ?? null });
      return instance;
    });

    return this.execute(instanceId, options);
  }

  async cancel(instanceId: string, reason?: string, options?: CommandOptions): Promise<WorkflowInstance> {
    await this.ready;
    return this.runCommand(instanceId, "cancel", options, async (instance) => {
      if (instance.state === "COMPLETED") {
        return instance;
      }

      instance.state = "CANCELLED";
      instance.updatedAt = new Date().toISOString();
      instance.completedAt = instance.updatedAt;
      instance.failureReason = reason ?? "workflow_cancelled";
      await this.writeAudit(instance, "WORKFLOW_CANCELLED", reason ?? "Workflow cancelled");
      await this.publishLifecycleEvent(instance, "WORKFLOW_CANCELLED", { reason: instance.failureReason });
      return instance;
    });
  }

  async getInstance(instanceId: string): Promise<WorkflowInstance> {
    await this.ready;
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`workflow_instance_not_found:${instanceId}`);
    }

    return this.cloneInstance(instance);
  }

  getMetrics() {
    return this.metrics.snapshot();
  }

  async healthSnapshot() {
    await this.ready;
    const messagingHealth = this.messaging.healthSnapshot ? this.messaging.healthSnapshot() : { status: "HEALTHY" };
    const authenticationHealth = await getGenesisAuthenticationService().healthSnapshot();

    return this.healthService.snapshot({
      metrics: this.metrics,
      dependencyHealth: {
        messaging: { status: messagingHealth.status },
        identity: { status: authenticationHealth.status },
      },
    });
  }

  getAuditRecords() {
    return this.auditWriter.list();
  }

  getExecutionHistory(instanceId: string) {
    return this.executionHistory.list(instanceId);
  }

  getCheckpoints(instanceId: string) {
    return this.checkpoints.list(instanceId);
  }

  getOperationalReadiness() {
    const metrics = this.metrics.snapshot();
    return {
      activeWorkflowInstances: metrics.activeWorkflowInstances,
      pausedInstances: metrics.pausedInstances,
      completedInstances: metrics.completedInstances,
      failedInstances: metrics.failedInstances,
      cancelledInstances: metrics.cancelledInstances,
      timedOutInstances: metrics.timedOutInstances,
      compensatingInstances: metrics.compensatingInstances,
      retries: metrics.retryCount,
      checkpointCount: metrics.checkpointCount,
      recoveryCount: metrics.recoveryCount,
      concurrencyConflictCount: metrics.concurrencyConflictCount,
      duplicateCommandCount: metrics.duplicateCommandCount,
      lifecyclePublishFailureCount: metrics.lifecyclePublishFailureCount,
      oldestActiveWorkflowAgeMs: metrics.oldestActiveWorkflowAgeMs,
      oldestPendingRetryAgeMs: metrics.oldestPendingRetryAgeMs,
      durability: "FILE_PERSISTED",
      multiNodeReadiness: "PERSISTENCE_COORDINATED_SINGLE_WRITER",
    } as const;
  }

  capabilityMetadata(): WorkflowCapabilityMetadata {
    return {
      capabilityId: "platform.workflow",
      capabilityName: "Genesis Enterprise Workflow Platform",
      version: "1.1.0",
      dependencies: {
        messaging: "consumed",
        identity: "consumed",
        missionControl: "integrated",
      },
      supports: {
        pauseResume: true,
        cancellation: true,
        retries: true,
        compensation: true,
        checkpointing: true,
        timeoutHandling: true,
        audit: true,
        metrics: true,
        health: true,
        persistence: true,
        restartRecovery: true,
        concurrencyControl: true,
        idempotency: true,
      },
    };
  }

  private async recover(): Promise<void> {
    const snapshot = await this.persistence.loadRecoverySnapshot();

    this.registry.restore(snapshot.definitions);

    const validCheckpoints = snapshot.checkpoints.filter((entry) => {
      const valid = Boolean(entry.instanceId && entry.stepId && entry.createdAt);
      if (!valid) {
        this.metrics.trackContextPersistenceFailure();
      }
      return valid;
    });

    this.checkpoints.restore(validCheckpoints);
    this.executionHistory.restore(snapshot.executionHistory);
    this.auditWriter.restore(snapshot.audits);

    this.instances.clear();
    for (const instance of snapshot.instances) {
      const restored = this.cloneInstance({
        ...instance,
        version: instance.version ?? 1,
        idempotencyKey: instance.idempotencyKey ?? instance.instanceId,
      });

      if (restored.state === "RUNNING") {
        restored.state = "PAUSED";
        restored.failureReason = "workflow_recovered_from_running_state";
      }

      this.instances.set(restored.instanceId, restored);
    }

    if (snapshot.metrics) {
      this.metrics.hydrate(snapshot.metrics);
    }

    this.metrics.trackRecovery(snapshot.instances.length);
    await this.refreshOperationalMetrics();
  }

  private async runCommand(
    instanceId: string,
    commandType: CommandType,
    options: CommandOptions | undefined,
    operation: (instance: WorkflowInstance) => Promise<WorkflowInstance>,
  ): Promise<WorkflowInstance> {
    const commandKey = this.commandKey(instanceId, commandType, options?.idempotencyKey);
    if (commandKey) {
      const duplicate = await this.persistence.commandStore.get(commandKey);
      if (duplicate) {
        this.metrics.trackDuplicateCommand();
        await this.persistMetrics();
        return this.getInstance(instanceId);
      }
    }

    if (this.activeMutations.has(instanceId)) {
      this.metrics.trackConcurrencyConflict();
      await this.persistMetrics();
      throw new Error(`workflow_concurrency_conflict:${instanceId}`);
    }

    this.activeMutations.add(instanceId);
    try {
      const current = this.instances.get(instanceId);
      if (!current) {
        throw new Error(`workflow_instance_not_found:${instanceId}`);
      }

      if (options?.expectedVersion !== undefined && current.version !== options.expectedVersion) {
        this.metrics.trackConcurrencyConflict();
        await this.persistMetrics();
        throw new Error(`workflow_stale_instance_version:${instanceId}`);
      }

      const working = this.cloneInstance(current);
      const expectedVersion = working.version;
      const result = await operation(working);
      result.version = expectedVersion + 1;
      result.updatedAt = new Date().toISOString();

      const persisted = await this.persistence.instanceStore.update(result, expectedVersion);
      if (persisted !== "UPDATED") {
        this.metrics.trackConcurrencyConflict();
        await this.persistMetrics();
        throw new Error(`workflow_stale_instance_version:${instanceId}`);
      }

      this.instances.set(instanceId, this.cloneInstance(result));

      if (commandKey) {
        await this.persistence.commandStore.append({
          commandKey,
          instanceId,
          commandType,
          idempotencyKey: options?.idempotencyKey ?? "",
          resultingState: result.state,
          recordedAt: new Date().toISOString(),
        });
      }

      await this.refreshOperationalMetrics();
      return this.cloneInstance(result);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("workflow_checkpoint")) {
        await this.writeAudit(
          this.instances.get(instanceId) ?? {
            instanceId,
            workflowId: "unknown",
            definitionId: "unknown",
            idempotencyKey: "unknown",
            version: 1,
            state: "FAILED",
            currentStepId: null,
            context: { tenant: "unknown", workspace: "unknown", variables: {} },
            attemptsByStep: {},
            executedStepIds: [],
            startedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          "WORKFLOW_FAILED",
          "Workflow command failed due to checkpoint integrity",
          { reason: error.message },
        );
      }
      throw error;
    } finally {
      this.activeMutations.delete(instanceId);
    }
  }

  private async persistNewInstance(instance: WorkflowInstance): Promise<void> {
    try {
      await this.persistence.instanceStore.create(instance);
    } catch {
      this.metrics.trackContextPersistenceFailure();
      await this.persistMetrics();
      throw new Error("workflow_context_persistence_failed");
    }
  }

  private async writeAudit(
    instance: WorkflowInstance,
    eventType: WorkflowEventType,
    message: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    const record = this.auditWriter.write({
      instanceId: instance.instanceId,
      workflowId: instance.workflowId,
      eventType,
      message,
      details,
    });
    this.metrics.trackAuditRecord();

    try {
      await this.persistence.auditStore.append(record);
    } catch {
      this.metrics.trackAuditPersistenceFailure();
    }
  }

  private async publishLifecycleEvent(
    instance: WorkflowInstance,
    eventType: WorkflowEventType,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const envelope: MessageEnvelope<Record<string, unknown>> = {
      messageId: randomUUID(),
      correlationId: instance.instanceId,
      causationId: instance.instanceId,
      tenant: instance.context.tenant,
      workspace: instance.context.workspace,
      sourceApplication: "genesis-platform",
      sourceCapability: "platform.workflow",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      priority: "NORMAL",
      headers: {
        workflowId: instance.workflowId,
        workflowState: instance.state,
      },
      payload: {
        instanceId: instance.instanceId,
        workflowId: instance.workflowId,
        eventType,
        ...payload,
      },
      metadata: {
        orderingKey: instance.instanceId,
        idempotencyKey: `${instance.instanceId}:${eventType}:${instance.updatedAt}`,
      },
    };

    try {
      await this.messaging.publish({
        topic: "workflow.lifecycle",
        mode: "PUBLISH_SUBSCRIBE",
        envelope,
      });
    } catch {
      this.metrics.trackLifecyclePublishFailure();
      await this.writeAudit(instance, "WORKFLOW_FAILED", "Workflow lifecycle event publish failed", {
        eventType,
      });
    }
  }

  private async refreshOperationalMetrics(): Promise<void> {
    const [instances, retries] = await Promise.all([
      this.persistence.instanceStore.list(),
      this.persistence.retryStore.list(),
    ]);

    this.metrics.refreshStateGauges(instances, retries);
    await this.persistMetrics();
  }

  private async persistMetrics(): Promise<void> {
    await this.persistence.metricsStore.save(this.metrics.snapshot());
  }

  private commandKey(instanceId: string, commandType: CommandType, idempotencyKey: string | undefined): string | null {
    if (!idempotencyKey) {
      return null;
    }

    return `${instanceId}:${commandType}:${idempotencyKey}`;
  }

  private cloneInstance(instance: WorkflowInstance): WorkflowInstance {
    return {
      ...instance,
      context: {
        tenant: instance.context.tenant,
        workspace: instance.context.workspace,
        initiatedBy: instance.context.initiatedBy,
        variables: { ...instance.context.variables },
      },
      attemptsByStep: { ...instance.attemptsByStep },
      executedStepIds: [...instance.executedStepIds],
    };
  }
}

let singleton: WorkflowEngine | null = null;

export function getGenesisWorkflowEngine(): WorkflowEngine {
  if (!singleton) {
    singleton = new WorkflowEngine();
  }

  return singleton;
}
