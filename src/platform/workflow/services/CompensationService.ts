import type { WorkflowCompensation, WorkflowContext, WorkflowDefinition, WorkflowInstance } from "../contracts";

export class CompensationService {
  async compensate(
    definition: WorkflowDefinition,
    instance: WorkflowInstance,
    context: WorkflowContext,
    maxAttempts = 2,
  ): Promise<WorkflowCompensation> {
    const compensatedStepIds: string[] = [];
    const stepsById = new Map(definition.steps.map((step) => [step.id, step]));

    for (const stepId of [...instance.executedStepIds].reverse()) {
      const step = stepsById.get(stepId);
      if (!step?.compensationAction) {
        continue;
      }

      let attempt = 1;
      while (attempt <= Math.max(1, maxAttempts)) {
        try {
          await Promise.resolve(step.compensationAction({
            workflow: {
              workflowId: instance.workflowId,
              definitionId: definition.id,
              definitionVersion: definition.version,
              createdAt: instance.startedAt,
            },
            definition,
            instance,
            context,
            step,
          }));
          break;
        } catch (error) {
          if (attempt >= Math.max(1, maxAttempts)) {
            throw error;
          }

          attempt += 1;
        }
      }
      compensatedStepIds.push(step.id);
    }

    return {
      instanceId: instance.instanceId,
      compensatedStepIds,
      completedAt: new Date().toISOString(),
    };
  }
}
