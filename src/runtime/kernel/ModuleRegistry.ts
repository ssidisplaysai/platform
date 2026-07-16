import type { RuntimeRegistryEntry } from "./types";

export class ModuleRegistry {
  private readonly modules = new Map<string, RuntimeRegistryEntry>();

  register(entry: RuntimeRegistryEntry): boolean {
    if (this.modules.has(entry.id)) {
      return false;
    }
    this.modules.set(entry.id, entry);
    return true;
  }

  list(): readonly RuntimeRegistryEntry[] {
    return Object.freeze([...this.modules.values()].sort((a, b) => a.id.localeCompare(b.id)));
  }
}
