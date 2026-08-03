import { randomUUID } from "node:crypto";
import type { WorkflowCheckpoint, WorkflowContext, WorkflowState, WorkflowVersion } from "../contracts";

export class CheckpointService {
  private readonly checkpointsByInstance = new Map<string, WorkflowCheckpoint[]>();

  checkpoint(input: {
    instanceId: string;
    workflowVersion: WorkflowVersion;
    workflowInstanceVersion: number;
    stepId: string;
    executionPositionStepId: string | null;
    completedStepIds: string[];
    state: WorkflowState;
    context: WorkflowContext;
    transitionVersion: number;
    executionSequence: number;
    recoveryVersion: number;
  }): WorkflowCheckpoint {
    const checkpoint: WorkflowCheckpoint = {
      checkpointId: randomUUID(),
      instanceId: input.instanceId,
      workflowVersion: { ...input.workflowVersion },
      workflowInstanceVersion: input.workflowInstanceVersion,
      stepId: input.stepId,
      executionPositionStepId: input.executionPositionStepId,
      completedStepIds: [...input.completedStepIds],
      state: input.state,
      context: {
        tenant: input.context.tenant,
        workspace: input.context.workspace,
        initiatedBy: input.context.initiatedBy,
        variables: { ...input.context.variables },
      },
      transitionVersion: input.transitionVersion,
      executionSequence: input.executionSequence,
      recoveryVersion: input.recoveryVersion,
      createdAt: new Date().toISOString(),
    };

    const existing = this.checkpointsByInstance.get(input.instanceId) ?? [];
    existing.push(checkpoint);
    this.checkpointsByInstance.set(input.instanceId, existing);
    return checkpoint;
  }

  latest(instanceId: string): WorkflowCheckpoint | null {
    const checkpoints = this.checkpointsByInstance.get(instanceId);
    if (!checkpoints || checkpoints.length === 0) {
      return null;
    }

    return checkpoints[checkpoints.length - 1];
  }

  list(instanceId: string): WorkflowCheckpoint[] {
    return [...(this.checkpointsByInstance.get(instanceId) ?? [])];
  }

  listAll(): WorkflowCheckpoint[] {
    return [...this.checkpointsByInstance.values()].flat().map((item) => ({
      ...item,
      workflowVersion: { ...item.workflowVersion },
      completedStepIds: [...item.completedStepIds],
      context: {
        tenant: item.context.tenant,
        workspace: item.context.workspace,
        initiatedBy: item.context.initiatedBy,
        variables: { ...item.context.variables },
      },
    }));
  }

  restore(checkpoints: WorkflowCheckpoint[]): void {
    this.checkpointsByInstance.clear();
    for (const checkpoint of checkpoints) {
      const existing = this.checkpointsByInstance.get(checkpoint.instanceId) ?? [];
      existing.push({
        ...checkpoint,
        workflowVersion: { ...checkpoint.workflowVersion },
        completedStepIds: [...checkpoint.completedStepIds],
        context: {
          tenant: checkpoint.context.tenant,
          workspace: checkpoint.context.workspace,
          initiatedBy: checkpoint.context.initiatedBy,
          variables: { ...checkpoint.context.variables },
        },
      });
      this.checkpointsByInstance.set(checkpoint.instanceId, existing);
    }
  }
}
