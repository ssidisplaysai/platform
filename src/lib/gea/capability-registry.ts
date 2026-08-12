import { geaId } from "./agent-models";

export type CapabilityDefinition = {
  capabilityId: string;
  capabilityKey: string;
  capabilityVersion: string;
  description: string;
  toolKeys: string[];
  enabled: boolean;
};

export type CapabilityRegistry = {
  list: () => CapabilityDefinition[];
  get: (capabilityKey: string) => CapabilityDefinition | null;
  upsert: (definition: Omit<CapabilityDefinition, "capabilityId"> & { capabilityId?: string }) => CapabilityDefinition;
};

export type CapabilityResolver = {
  resolve: (capabilityKeys: string[]) => CapabilityDefinition[];
};

const BASE_CAPABILITIES: CapabilityDefinition[] = [
  "marketing",
  "publishing",
  "analytics",
  "business_genome",
  "crm",
  "erp",
  "inventory",
  "finance",
  "workflow",
  "email",
  "calendar",
  "documents",
  "knowledge",
  "search",
  "reporting",
].map((key) => ({
  capabilityId: geaId("geacap"),
  capabilityKey: key,
  capabilityVersion: "gea-capability/v1",
  description: `${key} capability boundary`,
  toolKeys: [],
  enabled: true,
}));

export function createInMemoryCapabilityRegistry(seed: CapabilityDefinition[] = BASE_CAPABILITIES): CapabilityRegistry {
  const store = new Map(seed.map((entry) => [entry.capabilityKey, entry]));

  return {
    list: () => [...store.values()].sort((a, b) => a.capabilityKey.localeCompare(b.capabilityKey)),
    get: (capabilityKey) => store.get(capabilityKey) ?? null,
    upsert: (definition) => {
      const next: CapabilityDefinition = {
        capabilityId: definition.capabilityId ?? geaId("geacap"),
        capabilityKey: definition.capabilityKey,
        capabilityVersion: definition.capabilityVersion,
        description: definition.description,
        toolKeys: definition.toolKeys,
        enabled: definition.enabled,
      };
      store.set(next.capabilityKey, next);
      return next;
    },
  };
}

export function createAuthoritativeCapabilityRegistry(seed?: CapabilityDefinition[]): CapabilityRegistry {
  return createInMemoryCapabilityRegistry(seed ?? BASE_CAPABILITIES);
}

export function createCapabilityResolver(registry: CapabilityRegistry): CapabilityResolver {
  return {
    resolve(capabilityKeys) {
      return capabilityKeys
        .map((key) => registry.get(key))
        .filter((entry): entry is CapabilityDefinition => entry !== null && entry.enabled);
    },
  };
}
