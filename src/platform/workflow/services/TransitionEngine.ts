import type { WorkflowContext, WorkflowResult, WorkflowStep } from "../contracts";

export class TransitionEngine {
  resolveNextStepId(step: WorkflowStep, context: WorkflowContext, result: WorkflowResult): string | null {
    if (result.nextStepId) {
      return result.nextStepId;
    }

    if (!step.transitions || step.transitions.length === 0) {
      return null;
    }

    const ordered = [...step.transitions].sort((a, b) => (a.priority ?? 1000) - (b.priority ?? 1000));
    for (const transition of ordered) {
      if (!transition.condition || transition.condition(context, result)) {
        return transition.toStepId;
      }
    }

    return null;
  }
}
