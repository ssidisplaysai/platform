import type { EntityDefinition } from "../types/EntityDefinition";

export interface EntityBuilder<TOutput = unknown> {
  readonly kind: string;
  supports(definition: EntityDefinition): boolean;
  build(definition: EntityDefinition): TOutput;
}
