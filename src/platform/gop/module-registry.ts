import type { GenesisJobType, GenesisModuleManifest } from "./contracts";

export type GenesisModuleRegistry = {
  register(module: GenesisModuleManifest): void;
  get(moduleId: string): GenesisModuleManifest | null;
  list(): GenesisModuleManifest[];
  findByRoute(route: string): GenesisModuleManifest | null;
  findByJobType(jobType: GenesisJobType): GenesisModuleManifest[];
};

export function createGenesisModuleRegistry(initialModules: GenesisModuleManifest[] = []): GenesisModuleRegistry {
  const modules = new Map<string, GenesisModuleManifest>(initialModules.map((manifest) => [manifest.moduleId, manifest]));

  return {
    register(manifest: GenesisModuleManifest) {
      modules.set(manifest.moduleId, manifest);
    },

    get(moduleId: string) {
      return modules.get(moduleId) ?? null;
    },

    list() {
      return [...modules.values()].sort((left, right) => left.name.localeCompare(right.name));
    },

    findByRoute(route: string) {
      for (const manifest of modules.values()) {
        if (manifest.routes.some((item) => item.href === route)) {
          return manifest;
        }
      }

      return null;
    },

    findByJobType(jobType: GenesisJobType) {
      return [...modules.values()].filter((manifest) => manifest.supportedJobTypes.includes(jobType));
    },
  };
}

export const genesisModuleRegistry = createGenesisModuleRegistry();
