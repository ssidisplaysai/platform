export type ProductProvider = {
  providerId: string;
  capability: "catalog" | "reference-validation" | "observability";
  inspectHealth(): Promise<{ status: "HEALTHY" | "DEGRADED"; detail: string }>;
};

export type MissionControlObserver = {
  observerId: string;
  receiveObservation(input: {
    capability: "platform.product";
    generatedAt: string;
    metrics: Record<string, number>;
    health: { status: "HEALTHY" | "DEGRADED" | "FAILED" };
  }): Promise<void>;
};

export type ProductProviderRegistry = {
  register(provider: ProductProvider): void;
  getProvider(providerId: string): ProductProvider | undefined;
  listProviders(): ProductProvider[];
};

export type ProductObserverRegistry = {
  register(observer: MissionControlObserver): void;
  listObservers(): MissionControlObserver[];
};

export type ProductPlatformDependencies = {
  providers: ProductProviderRegistry;
  observers: ProductObserverRegistry;
};

export function createDefaultProductProviderRegistry(): ProductProviderRegistry {
  const providers = new Map<string, ProductProvider>();
  const foundationProvider: ProductProvider = {
    providerId: "product-foundation-provider",
    capability: "catalog",
    async inspectHealth() {
      return { status: "HEALTHY", detail: "product foundation provider active" };
    },
  };

  providers.set(foundationProvider.providerId, foundationProvider);

  return {
    register(provider: ProductProvider) {
      if (!provider.providerId || providers.has(provider.providerId)) {
        throw new Error(`product provider registration conflict: ${provider.providerId}`);
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

export function createDefaultProductObserverRegistry(): ProductObserverRegistry {
  const observers = new Map<string, MissionControlObserver>();
  return {
    register(observer: MissionControlObserver) {
      if (!observer.observerId || observers.has(observer.observerId)) {
        throw new Error(`mission control observer registration conflict: ${observer.observerId}`);
      }
      observers.set(observer.observerId, observer);
    },
    listObservers() {
      return [...observers.values()];
    },
  };
}

export function createDefaultProductDependencies(): ProductPlatformDependencies {
  return {
    providers: createDefaultProductProviderRegistry(),
    observers: createDefaultProductObserverRegistry(),
  };
}
