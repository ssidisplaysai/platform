import type { ScheduleCommand, ScheduleDefinition } from "../contracts";

export type WorkflowSchedulingReference = {
  workflowId?: string;
  workflowInstanceId?: string;
  stepId?: string;
  correlationId?: string;
  causationId?: string;
};

export class WorkflowSchedulingAdapter {
  buildWorkflowTimerCommand(input: {
    schedule: ScheduleDefinition;
    reference?: WorkflowSchedulingReference;
    payload?: Record<string, unknown>;
  }): ScheduleCommand {
    return {
      commandType: "WORKFLOW_TIMER",
      topic: "workflow.timer",
      correlationId: input.reference?.correlationId,
      causationId: input.reference?.causationId,
      workflowInstanceId: input.reference?.workflowInstanceId,
      payload: {
        scheduleId: input.schedule.scheduleId,
        workflowId: input.reference?.workflowId,
        workflowInstanceId: input.reference?.workflowInstanceId,
        stepId: input.reference?.stepId,
        ...(input.payload ?? {}),
      },
      idempotencyKey: `${input.schedule.scheduleId}:${input.reference?.workflowInstanceId ?? "none"}`,
    };
  }

  buildWorkflowResumeCommand(input: {
    schedule: ScheduleDefinition;
    reference: WorkflowSchedulingReference;
    payload?: Record<string, unknown>;
  }): ScheduleCommand {
    return {
      commandType: "WORKFLOW_RESUME",
      topic: "workflow.resume",
      correlationId: input.reference.correlationId,
      causationId: input.reference.causationId,
      workflowInstanceId: input.reference.workflowInstanceId,
      payload: {
        scheduleId: input.schedule.scheduleId,
        workflowId: input.reference.workflowId,
        workflowInstanceId: input.reference.workflowInstanceId,
        ...(input.payload ?? {}),
      },
      idempotencyKey: `${input.schedule.scheduleId}:${input.reference.workflowInstanceId ?? "none"}:resume`,
    };
  }
}
