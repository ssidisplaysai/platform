import type { RuntimeRegistryEntry } from "./types";

export class PluginRegistry {
  private readonly plugins = new Map<string, RuntimeRegistryEntry>();

  discover(entries: readonly RuntimeRegistryEntry[]): void {
    for (const entry of [...entries].sort((a, b) => a.id.localeCompare(b.id))) {
      if (!this.plugins.has(entry.id)) {
        this.plugins.set(entry.id, entry);
      }
    }
  }

  deactivate(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return;
    }
    this.plugins.set(pluginId, {
      ...plugin,
      activationState: "inactive",
      lifecycle: "Stopped",
    });
  }

  list(): readonly RuntimeRegistryEntry[] {
    return Object.freeze([...this.plugins.values()].sort((a, b) => a.id.localeCompare(b.id)));
  }
}
