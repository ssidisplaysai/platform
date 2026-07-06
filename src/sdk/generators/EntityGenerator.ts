import type { EntityDefinition } from "../types/EntityDefinition";

export interface EntityGenerator<TOutput = unknown> {
  readonly kind: string;
  supports(definition: EntityDefinition): boolean;
  generate(definition: EntityDefinition): TOutput;
}
