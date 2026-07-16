import type { RuntimeRegistryEntry } from "./types";

export class ServiceRegistry {
  private readonly entries = new Map<string, RuntimeRegistryEntry>();

  register(entry: RuntimeRegistryEntry): boolean {
    if (this.entries.has(entry.id)) {
      return false;
    }
    this.entries.set(entry.id, entry);
    return true;
  }

  list(): readonly RuntimeRegistryEntry[] {
    return Object.freeze([...this.entries.values()].sort((a, b) => a.id.localeCompare(b.id)));
  }
}
