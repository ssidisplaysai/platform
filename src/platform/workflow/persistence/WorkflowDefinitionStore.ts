import type { WorkflowDefinition } from "../contracts";

export interface WorkflowDefinitionStore {
  save(definition: WorkflowDefinition): Promise<void>;
  get(definitionId: string): Promise<WorkflowDefinition | null>;
  list(): Promise<WorkflowDefinition[]>;
}
