import type { WorkflowContext } from "../contracts";

export class ContextManager {
  create(base: WorkflowContext): WorkflowContext {
    return {
      tenant: base.tenant,
      workspace: base.workspace,
      initiatedBy: base.initiatedBy,
      variables: { ...base.variables },
    };
  }

  merge(context: WorkflowContext, patch?: Record<string, unknown>): WorkflowContext {
    if (!patch) {
      return this.create(context);
    }

    return {
      ...this.create(context),
      variables: {
        ...context.variables,
        ...patch,
      },
    };
  }
}
