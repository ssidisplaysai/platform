export type KnowledgeProvider = {
  providerId: string;
  capability: "registry" | "governance" | "metadata";
  inspectHealth(): Promise<{ status: "HEALTHY" | "DEGRADED"; detail: string }>;
};

export type KnowledgeProviderRegistry = {
  register(provider: KnowledgeProvider): void;
  getProvider(providerId: string): KnowledgeProvider | undefined;
  listProviders(): KnowledgeProvider[];
};

export type KnowledgePlatformDependencies = {
  providers: KnowledgeProviderRegistry;
};

export function createDefaultKnowledgeProviderRegistry(): KnowledgeProviderRegistry {
  const providers = new Map<string, KnowledgeProvider>();
  const foundationProvider: KnowledgeProvider = {
    providerId: "knowledge-foundation-provider",
    capability: "registry",
    async inspectHealth() {
      return { status: "HEALTHY", detail: "knowledge foundation provider active" };
    },
  };

  providers.set(foundationProvider.providerId, foundationProvider);

  return {
    register(provider: KnowledgeProvider) {
      if (!provider.providerId || providers.has(provider.providerId)) {
        throw new Error(`knowledge provider registration conflict: ${provider.providerId}`);
      }
      providers.set(provider.providerId, provider);
    },
    getProvider(providerId: string) {
      return providers.get(providerId);
    },
    listProviders() {
      return [...providers.values()];
    },
  };
}

export function createDefaultKnowledgeDependencies(): KnowledgePlatformDependencies {
  return {
    providers: createDefaultKnowledgeProviderRegistry(),
  };
}
