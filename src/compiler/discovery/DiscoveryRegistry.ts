import type { KnowledgeSourceType } from "./KnowledgeSource";
import type { DiscoveryPlugin } from "./DiscoveryPlugin";
import { DiscoveryError } from "./DiscoveryError";

export class DiscoveryRegistry {
  private readonly plugins = new Map<KnowledgeSourceType, DiscoveryPlugin>();

  register(plugin: DiscoveryPlugin): void {
    this.plugins.set(plugin.sourceType, plugin);
  }

  resolve(sourceType: KnowledgeSourceType): DiscoveryPlugin {
    const plugin = this.plugins.get(sourceType);
    if (!plugin) {
      throw new DiscoveryError(
        "PLUGIN_NOT_REGISTERED",
        `No discovery plugin registered for source type: ${sourceType}`,
      );
    }

    return plugin;
  }

  list(): DiscoveryPlugin[] {
    return [...this.plugins.values()].sort((a, b) => a.sourceType.localeCompare(b.sourceType));
  }
}
