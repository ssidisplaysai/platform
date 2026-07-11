import type { EntitySchema } from "../../domain/schema/EntitySchema";
import { MetadataDiscovery, type DiscoveredDefinition } from "./MetadataDiscovery";

export interface LoadedMetadata {
  definitions: EntitySchema[];
  discoveredDefinitions: DiscoveredDefinition[];
}

export class MetadataLoader {
  constructor(private readonly discovery: MetadataDiscovery = new MetadataDiscovery()) {}

  load(definitions: readonly EntitySchema[] | undefined | null): LoadedMetadata {
    const discoveredDefinitions = this.discovery.discover(definitions);

    return {
      definitions: discoveredDefinitions.map(({ definition }) => definition),
      discoveredDefinitions,
    };
  }
}
