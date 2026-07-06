import type { EntitySchema } from "../../domain/schema/EntitySchema";

export interface DiscoveredDefinition {
  definition: EntitySchema;
  source: string;
}

export class MetadataDiscovery {
  discover(definitions: readonly EntitySchema[] | undefined | null): DiscoveredDefinition[] {
    const safeDefinitions = Array.isArray(definitions) ? definitions : [];

    return safeDefinitions
      .filter((definition): definition is EntitySchema => Boolean(definition))
      .map((definition, index) => ({
        definition,
        source: definition.display?.label
          ? `${definition.display.label} (${definition.entityType})`
          : `definition-${index + 1}`,
      }));
  }
}
