import type { WorkflowDefinition } from "../contracts";

export class WorkflowRegistry {
  private readonly definitions = new Map<string, WorkflowDefinition>();

  private cloneDefinition(definition: WorkflowDefinition): WorkflowDefinition {
    return {
      ...definition,
      version: { ...definition.version },
      steps: definition.steps.map((step) => ({
        ...step,
        timeout: step.timeout ? { ...step.timeout } : undefined,
        retryPolicy: step.retryPolicy ? { ...step.retryPolicy } : undefined,
        transitions: step.transitions?.map((transition) => ({ ...transition })),
      })),
    };
  }

  register(definition: WorkflowDefinition): void {
    if (this.definitions.has(definition.id)) {
      throw new Error(`workflow_already_registered:${definition.id}`);
    }

    this.definitions.set(definition.id, definition);
  }

  get(definitionId: string): WorkflowDefinition {
    const definition = this.definitions.get(definitionId);
    if (!definition) {
      throw new Error(`workflow_not_found:${definitionId}`);
    }

    return definition;
  }

  count(): number {
    return this.definitions.size;
  }

  list(): WorkflowDefinition[] {
    return [...this.definitions.values()];
  }

  restore(definitions: WorkflowDefinition[]): void {
    this.definitions.clear();
    for (const definition of definitions) {
      this.definitions.set(definition.id, this.cloneDefinition(definition));
    }
  }
}
