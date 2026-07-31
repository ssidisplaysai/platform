import { randomUUID } from "node:crypto";
import type { WorkflowDefinition, WorkflowInstance, WorkflowState } from "../contracts";
import { CheckpointService } from "./CheckpointService";
import { CompensationService } from "./CompensationService";
import { ContextManager } from "./ContextManager";
import { ExecutionHistory } from "./ExecutionHistory";
import { StepExecutor } from "./StepExecutor";
import { TransitionEngine } from "./TransitionEngine";
import { WorkflowAuditWriter } from "./WorkflowAuditWriter";
import { WorkflowMetricsService } from "./WorkflowMetricsService";

export class WorkflowExecutor {
  constructor(
    private readonly stepExecutor: StepExecutor,
    private readonly transitionEngine: TransitionEngine,
    private readonly contextManager: ContextManager,
    private readonly checkpointService: CheckpointService,
    private readonly compensationService: CompensationService,
    private readonly executionHistory: ExecutionHistory,
    private readonly auditWriter: WorkflowAuditWriter,
    private readonly metrics: WorkflowMetricsService,
  ) {}

  async execute(definition: WorkflowDefinition, instance: WorkflowInstance): Promise<WorkflowInstance> {
    while (instance.state === "RUNNING" && instance.currentStepId) {
      const step = definition.steps.find((entry) => entry.id === instance.currentStepId);
      if (!step) {
        instance.state = "FAILED";
        instance.failureReason = `workflow_step_not_found:${instance.currentStepId}`;
        instance.updatedAt = new Date().toISOString();
        this.metrics.trackFailedInstance();
        return instance;
      }

      this.auditWriter.write({
        instanceId: instance.instanceId,
        workflowId: instance.workflowId,
        eventType: "STEP_STARTED",
        message: `Step started: ${step.id}`,
      });
      this.metrics.trackAuditRecord();

      const maxAttempts = Math.max(1, step.retryPolicy?.maxAttempts ?? 1);
      let attempt = (instance.attemptsByStep[step.id] ?? 0) + 1;

      while (attempt <= maxAttempts) {
        try {
          instance.attemptsByStep[step.id] = attempt;
          const result = await this.stepExecutor.execute({
            workflow: { workflowId: instance.workflowId },
            definition,
            instance,
            context: instance.context,
            step,
          });

          instance.context = this.contextManager.merge(instance.context, result.outputVariables);
          this.executionHistory.append({
            recordId: randomUUID(),
            instanceId: instance.instanceId,
            workflowId: instance.workflowId,
            stepId: step.id,
            attempt,
            result,
            executedAt: new Date().toISOString(),
          });

          if (result.status === "FAILURE") {
            throw new Error(result.error ?? "workflow_step_failure");
          }

          if (result.status === "PAUSE" || result.status === "WAIT") {
            instance.state = "PAUSED";
            instance.updatedAt = new Date().toISOString();
            this.metrics.trackPausedInstance();
            this.auditWriter.write({
              instanceId: instance.instanceId,
              workflowId: instance.workflowId,
              eventType: "WORKFLOW_PAUSED",
              message: `Workflow paused at step ${step.id}`,
            });
            this.metrics.trackAuditRecord();
            this.checkpointService.checkpoint({
              instanceId: instance.instanceId,
              stepId: step.id,
              state: instance.state,
              context: instance.context,
            });
            this.auditWriter.write({
              instanceId: instance.instanceId,
              workflowId: instance.workflowId,
              eventType: "WORKFLOW_CHECKPOINTED",
              message: `Checkpoint created at step ${step.id}`,
            });
            this.metrics.trackAuditRecord();
            return instance;
          }

          instance.executedStepIds.push(step.id);
          const nextStepId = this.transitionEngine.resolveNextStepId(step, instance.context, result);

          this.auditWriter.write({
            instanceId: instance.instanceId,
            workflowId: instance.workflowId,
            eventType: "STEP_COMPLETED",
            message: `Step completed: ${step.id}`,
          });
          this.metrics.trackAuditRecord();

          if (!nextStepId) {
            instance.state = "COMPLETED";
            instance.currentStepId = null;
            instance.completedAt = new Date().toISOString();
            instance.updatedAt = instance.completedAt;
            this.metrics.trackCompletedInstance();
            return instance;
          }

          instance.currentStepId = nextStepId;
          instance.updatedAt = new Date().toISOString();
          this.checkpointService.checkpoint({
            instanceId: instance.instanceId,
            stepId: step.id,
            state: instance.state,
            context: instance.context,
          });
          this.auditWriter.write({
            instanceId: instance.instanceId,
            workflowId: instance.workflowId,
            eventType: "WORKFLOW_CHECKPOINTED",
            message: `Checkpoint created at step ${step.id}`,
          });
          this.metrics.trackAuditRecord();
          break;
        } catch (error) {
          if (attempt < maxAttempts) {
            attempt += 1;
            this.metrics.trackRetriedStep();
            continue;
          }

          instance.state = this.timeoutState(error);
          instance.failureReason = error instanceof Error ? error.message : "workflow_step_failure";
          instance.updatedAt = new Date().toISOString();

          this.auditWriter.write({
            instanceId: instance.instanceId,
            workflowId: instance.workflowId,
            eventType: "STEP_FAILED",
            message: `Step failed: ${step.id}`,
            details: { reason: instance.failureReason },
          });
          this.metrics.trackAuditRecord();

          if (instance.executedStepIds.length > 0) {
            const previousState: WorkflowState = instance.state;
            instance.state = "COMPENSATING";
            const compensation = await this.compensationService.compensate(definition, instance, instance.context);
            instance.state = previousState;
            this.metrics.trackCompensatedInstance();
            this.auditWriter.write({
              instanceId: instance.instanceId,
              workflowId: instance.workflowId,
              eventType: "WORKFLOW_COMPENSATED",
              message: `Compensation completed for ${compensation.compensatedStepIds.length} step(s)` ,
            });
            this.metrics.trackAuditRecord();
          }

          if (instance.state === "TIMED_OUT") {
            this.metrics.trackTimedOutInstance();
          } else {
            this.metrics.trackFailedInstance();
          }

          return instance;
        }
      }
    }

    return instance;
  }

  private timeoutState(error: unknown): WorkflowState {
    if (error instanceof Error && error.message === "workflow_step_timeout") {
      return "TIMED_OUT";
    }

    return "FAILED";
  }
}
