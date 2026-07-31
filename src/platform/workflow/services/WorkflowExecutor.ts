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
    private readonly callbacks?: {
      onExecutionRecord?: (input: { instance: WorkflowInstance; stepId: string; attempt: number }) => Promise<void>;
      onCheckpoint?: (input: { instance: WorkflowInstance; stepId: string; state: WorkflowState }) => Promise<void>;
      onRetry?: (input: { instance: WorkflowInstance; stepId: string; attempt: number; reason: string }) => Promise<void>;
      onRetryResolved?: (input: { instance: WorkflowInstance; stepId: string }) => Promise<void>;
      onTimeout?: (input: { instance: WorkflowInstance; stepId: string; timeoutMs: number }) => Promise<void>;
      onTimeoutResolved?: (input: { instance: WorkflowInstance; stepId: string }) => Promise<void>;
      onCompensation?: (input: { instance: WorkflowInstance; stepId: string }) => Promise<void>;
      onCompensationFailure?: (input: { instance: WorkflowInstance; stepId: string; reason: string }) => Promise<void>;
      onStepDuration?: (durationMs: number) => void;
    },
  ) {}

  async execute(definition: WorkflowDefinition, instance: WorkflowInstance): Promise<WorkflowInstance> {
    while (instance.state === "RUNNING" && instance.currentStepId) {
      const step = definition.steps.find((entry) => entry.id === instance.currentStepId);
      if (!step) {
        instance.state = "FAILED";
        instance.failureReason = `workflow_step_not_found:${instance.currentStepId}`;
        instance.updatedAt = new Date().toISOString();
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
        const startedAt = Date.now();
        try {
          instance.attemptsByStep[step.id] = attempt;
          if (step.timeout) {
            await this.callbacks?.onTimeout?.({
              instance,
              stepId: step.id,
              timeoutMs: step.timeout.timeoutMs,
            });
          }

          const result = await this.stepExecutor.execute({
            workflow: { workflowId: instance.workflowId },
            definition,
            instance,
            context: instance.context,
            step,
          });

          this.metrics.trackStepDuration(Date.now() - startedAt);
          this.callbacks?.onStepDuration?.(Date.now() - startedAt);

          instance.context = this.contextManager.merge(instance.context, result.outputVariables);
          const record = {
            recordId: randomUUID(),
            instanceId: instance.instanceId,
            workflowId: instance.workflowId,
            stepId: step.id,
            attempt,
            result,
            executedAt: new Date().toISOString(),
          };
          this.executionHistory.append(record);
          await this.callbacks?.onExecutionRecord?.({ instance, stepId: step.id, attempt });

          if (step.timeout) {
            await this.callbacks?.onTimeoutResolved?.({ instance, stepId: step.id });
          }
          await this.callbacks?.onRetryResolved?.({ instance, stepId: step.id });

          if (result.status === "FAILURE") {
            throw new Error(result.error ?? "workflow_step_failure");
          }

          if (result.status === "PAUSE" || result.status === "WAIT") {
            instance.state = "PAUSED";
            instance.updatedAt = new Date().toISOString();
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
            this.metrics.trackCheckpoint();
            await this.callbacks?.onCheckpoint?.({ instance, stepId: step.id, state: instance.state });
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
            instance.lastExecutionCompletedAt = instance.completedAt;
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
          this.metrics.trackCheckpoint();
          await this.callbacks?.onCheckpoint?.({ instance, stepId: step.id, state: instance.state });
          break;
        } catch (error) {
          const reason = error instanceof Error ? error.message : "workflow_step_failure";
          if (attempt < maxAttempts) {
            this.metrics.trackRetry();
            await this.callbacks?.onRetry?.({ instance, stepId: step.id, attempt, reason });
            attempt += 1;
            continue;
          }

          instance.state = this.timeoutState(error);
          instance.failureReason = reason;
          instance.updatedAt = new Date().toISOString();
          instance.lastExecutionCompletedAt = instance.updatedAt;

          this.auditWriter.write({
            instanceId: instance.instanceId,
            workflowId: instance.workflowId,
            eventType: "STEP_FAILED",
            message: `Step failed: ${step.id}`,
            details: { reason },
          });
          this.metrics.trackAuditRecord();

          if (instance.executedStepIds.length > 0) {
            const previousState = instance.state;
            instance.state = "COMPENSATING";
            for (const executedStepId of [...instance.executedStepIds].reverse()) {
              try {
                await this.compensationService.compensate(definition, {
                  ...instance,
                  executedStepIds: [executedStepId],
                }, instance.context);
                await this.callbacks?.onCompensation?.({ instance, stepId: executedStepId });
              } catch (compensationError) {
                const compensationReason =
                  compensationError instanceof Error ? compensationError.message : "workflow_compensation_failed";
                await this.callbacks?.onCompensationFailure?.({
                  instance,
                  stepId: executedStepId,
                  reason: compensationReason,
                });
              }
            }
            this.metrics.trackCompensatedInstance();
            instance.state = previousState;
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
