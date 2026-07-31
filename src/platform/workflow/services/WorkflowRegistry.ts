import type { WorkflowDefinition } from "../contracts";

export class WorkflowRegistry {
  private readonly definitions = new Map<string, WorkflowDefinition>();

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
}
