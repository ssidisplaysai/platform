import { randomUUID } from "node:crypto";
import type { MessageEnvelope, Publisher } from "@/platform/messaging";
import { getGenesisMessageBus } from "@/platform/messaging";
import { getGenesisAuthenticationService } from "@/platform/identity/services";
import type { WorkflowContext, WorkflowDefinition, WorkflowEventType, WorkflowInstance } from "../contracts";
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
  };
};

type WorkflowMessagingPublisher = Pick<Publisher, "publish"> & {
  healthSnapshot?: () => { status: string };
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
  private readonly instances = new Map<string, WorkflowInstance>();

  constructor(options?: { messaging?: WorkflowMessagingPublisher }) {
    this.registry = new WorkflowRegistry();
    this.metrics = new WorkflowMetricsService();
    this.auditWriter = new WorkflowAuditWriter();
    this.healthService = new WorkflowHealthService();
    this.executionHistory = new ExecutionHistory();
    this.checkpoints = new CheckpointService();

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
    );

    this.messaging = options?.messaging ?? getGenesisMessageBus();
  }

  registerWorkflow(definition: WorkflowDefinition): void {
    this.registry.register(definition);
    this.metrics.trackRegisteredWorkflow();
  }

  createInstance(input: { definitionId: string; context: WorkflowContext }): WorkflowInstance {
    const definition = this.registry.get(input.definitionId);
    const now = new Date().toISOString();
    const instance: WorkflowInstance = {
      instanceId: randomUUID(),
      workflowId: definition.id,
      definitionId: definition.id,
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

    this.instances.set(instance.instanceId, instance);
    this.metrics.trackCreatedInstance();
    this.writeAudit(instance, "WORKFLOW_CREATED", "Workflow instance created");
    void this.publishLifecycleEvent(instance, "WORKFLOW_CREATED", { state: instance.state });
    return instance;
  }

  async execute(instanceId: string): Promise<WorkflowInstance> {
    const instance = this.getInstance(instanceId);
    if (instance.state === "CANCELLED" || instance.state === "COMPLETED") {
      return instance;
    }

    if (instance.state === "PAUSED") {
      throw new Error(`workflow_instance_paused:${instanceId}`);
    }

    const definition = this.registry.get(instance.definitionId);
    instance.state = "RUNNING";
    instance.updatedAt = new Date().toISOString();
    this.metrics.trackRunningInstance();
    this.writeAudit(instance, "WORKFLOW_STARTED", "Workflow execution started");
    void this.publishLifecycleEvent(instance, "WORKFLOW_STARTED", { stepId: instance.currentStepId ?? null });

    const resolved = await this.workflowExecutor.execute(definition, instance);
    this.instances.set(instance.instanceId, resolved);

    if (resolved.state === "COMPLETED") {
      this.writeAudit(resolved, "WORKFLOW_COMPLETED", "Workflow execution completed");
      void this.publishLifecycleEvent(resolved, "WORKFLOW_COMPLETED", { completedAt: resolved.completedAt ?? null });
    }

    if (resolved.state === "FAILED") {
      this.writeAudit(resolved, "WORKFLOW_FAILED", "Workflow execution failed", {
        reason: resolved.failureReason ?? "unknown",
      });
      void this.publishLifecycleEvent(resolved, "WORKFLOW_FAILED", {
        reason: resolved.failureReason ?? "unknown",
      });
    }

    if (resolved.state === "TIMED_OUT") {
      this.writeAudit(resolved, "WORKFLOW_TIMED_OUT", "Workflow execution timed out");
      void this.publishLifecycleEvent(resolved, "WORKFLOW_TIMED_OUT", {
        reason: resolved.failureReason ?? "workflow_step_timeout",
      });
    }

    if (resolved.state === "PAUSED") {
      void this.publishLifecycleEvent(resolved, "WORKFLOW_PAUSED", { stepId: resolved.currentStepId ?? null });
    }

    return resolved;
  }

  pause(instanceId: string, reason?: string): WorkflowInstance {
    const instance = this.getInstance(instanceId);
    if (instance.state === "RUNNING" || instance.state === "CREATED") {
      instance.state = "PAUSED";
      instance.updatedAt = new Date().toISOString();
      this.metrics.trackPausedInstance();
      this.writeAudit(instance, "WORKFLOW_PAUSED", reason ?? "Workflow paused manually");
      void this.publishLifecycleEvent(instance, "WORKFLOW_PAUSED", { reason: reason ?? "manual" });
    }

    return instance;
  }

  async resume(instanceId: string): Promise<WorkflowInstance> {
    const instance = this.getInstance(instanceId);
    if (instance.state !== "PAUSED") {
      throw new Error(`workflow_instance_not_paused:${instanceId}`);
    }

    instance.state = "CREATED";
    instance.updatedAt = new Date().toISOString();
    this.writeAudit(instance, "WORKFLOW_RESUMED", "Workflow resumed");
    void this.publishLifecycleEvent(instance, "WORKFLOW_RESUMED", { stepId: instance.currentStepId ?? null });
    return this.execute(instanceId);
  }

  cancel(instanceId: string, reason?: string): WorkflowInstance {
    const instance = this.getInstance(instanceId);
    if (instance.state === "COMPLETED") {
      return instance;
    }

    instance.state = "CANCELLED";
    instance.updatedAt = new Date().toISOString();
    instance.completedAt = instance.updatedAt;
    instance.failureReason = reason ?? "workflow_cancelled";
    this.metrics.trackCancelledInstance();
    this.writeAudit(instance, "WORKFLOW_CANCELLED", reason ?? "Workflow cancelled");
    void this.publishLifecycleEvent(instance, "WORKFLOW_CANCELLED", { reason: instance.failureReason });
    return instance;
  }

  getInstance(instanceId: string): WorkflowInstance {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`workflow_instance_not_found:${instanceId}`);
    }

    return instance;
  }

  getMetrics() {
    return this.metrics.snapshot();
  }

  async healthSnapshot() {
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
      runningInstances: metrics.runningInstances,
      pausedInstances: metrics.pausedInstances,
      completedInstances: metrics.completedInstances,
      failedInstances: metrics.failedInstances,
      timedOutInstances: metrics.timedOutInstances,
      retries: metrics.retriedSteps,
      compensationRuns: metrics.compensatedInstances,
    } as const;
  }

  capabilityMetadata(): WorkflowCapabilityMetadata {
    return {
      capabilityId: "platform.workflow",
      capabilityName: "Genesis Enterprise Workflow Platform",
      version: "1.0.0",
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
      },
    };
  }

  private writeAudit(
    instance: WorkflowInstance,
    eventType: WorkflowEventType,
    message: string,
    details?: Record<string, unknown>,
  ): void {
    this.auditWriter.write({
      instanceId: instance.instanceId,
      workflowId: instance.workflowId,
      eventType,
      message,
      details,
    });
    this.metrics.trackAuditRecord();
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
      // Workflow should continue even if lifecycle event publication is unavailable.
    }
  }
}

let singleton: WorkflowEngine | null = null;

export function getGenesisWorkflowEngine(): WorkflowEngine {
  if (!singleton) {
    singleton = new WorkflowEngine();
  }

  return singleton;
}
