import { randomUUID } from "node:crypto";
import type { WorkflowCheckpoint, WorkflowContext, WorkflowState } from "../contracts";

export class CheckpointService {
  private readonly checkpointsByInstance = new Map<string, WorkflowCheckpoint[]>();

  checkpoint(input: { instanceId: string; stepId: string; state: WorkflowState; context: WorkflowContext }): WorkflowCheckpoint {
    const checkpoint: WorkflowCheckpoint = {
      checkpointId: randomUUID(),
      instanceId: input.instanceId,
      stepId: input.stepId,
      state: input.state,
      context: {
        tenant: input.context.tenant,
        workspace: input.context.workspace,
        initiatedBy: input.context.initiatedBy,
        variables: { ...input.context.variables },
      },
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
}
