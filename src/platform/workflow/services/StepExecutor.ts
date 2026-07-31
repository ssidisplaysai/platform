import type { WorkflowActionInput, WorkflowContext, WorkflowDefinition, WorkflowInstance, WorkflowResult, WorkflowStep } from "../contracts";
import { TimeoutManager } from "./TimeoutManager";
import { VariableResolver } from "./VariableResolver";

export class StepExecutor {
  constructor(
    private readonly timeoutManager: TimeoutManager,
    private readonly variableResolver: VariableResolver,
  ) {}

  async execute(input: {
    workflow: { workflowId: string };
    definition: WorkflowDefinition;
    instance: WorkflowInstance;
    context: WorkflowContext;
    step: WorkflowStep;
  }): Promise<WorkflowResult> {
    const resolvedContext: WorkflowContext = {
      ...input.context,
      variables: this.variableResolver.resolve(input.context.variables, input.context.variables),
    };

    const actionInput: WorkflowActionInput = {
      workflow: {
        workflowId: input.workflow.workflowId,
        definitionId: input.definition.id,
        definitionVersion: input.definition.version,
        createdAt: input.instance.startedAt,
      },
      definition: input.definition,
      instance: input.instance,
      context: resolvedContext,
      step: input.step,
    };

    return this.timeoutManager.runWithTimeout(Promise.resolve(input.step.action(actionInput)), input.step.timeout);
  }
}
