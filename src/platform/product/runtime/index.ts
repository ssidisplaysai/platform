import { resolve } from "node:path";
import type { ProductHealth, ProductMetrics, ProductPersistedState } from "../contracts";
import {
  createDefaultProductDependencies,
  type ProductPlatformDependencies,
} from "../integration";
import { FileProductStore, PersistenceCoordinator, type ProductStore } from "../persistence";
import {
  ProductAuditService,
  ProductHealthService,
  ProductMetricsService,
  ProductRegistryService,
} from "../services";

export type GenesisProductRuntime = {
  store: ProductStore;
  coordinator: PersistenceCoordinator;
  dependencies: ProductPlatformDependencies;
  audit: ProductAuditService;
  metrics: ProductMetricsService;
  health: ProductHealthService;
  registry: ProductRegistryService;
  snapshot(): ProductPersistedState;
  observability(): Promise<{
    capability: "platform.product";
    metadata: {
      contractVersion: "1.0.0";
      runtimeVersion: "1.0.0";
      persistence: "file.product-state.v1";
      providers: string[];
    };
    metrics: ProductMetrics;
    health: ProductHealth;
  }>;
  publishMissionControlObservation(): Promise<void>;
};

export type GenesisProductRuntimeOptions = {
  rootDir?: string;
  store?: ProductStore;
  dependencies?: ProductPlatformDependencies;
};

export async function createGenesisProductRuntime(
  options: GenesisProductRuntimeOptions = {},
): Promise<GenesisProductRuntime> {
  const store = options.store ?? new FileProductStore({
    rootDir: options.rootDir ?? process.env.GENESIS_DATA_ROOT ?? resolve(process.cwd(), "data"),
  });

  const dependencies = options.dependencies ?? createDefaultProductDependencies();
  const coordinator = new PersistenceCoordinator(store);
  await coordinator.load();

  const audit = new ProductAuditService(coordinator);
  const metrics = new ProductMetricsService(coordinator);
  const health = new ProductHealthService(coordinator, dependencies.providers);
  const registry = new ProductRegistryService(coordinator, audit);

  const buildObservability = async () => ({
    capability: "platform.product" as const,
    metadata: {
      contractVersion: "1.0.0" as const,
      runtimeVersion: "1.0.0" as const,
      persistence: "file.product-state.v1" as const,
      providers: dependencies.providers.listProviders().map((provider) => provider.providerId),
    },
    metrics: metrics.snapshot(),
    health: await health.snapshot(),
  });

  return {
    store,
    coordinator,
    dependencies,
    audit,
    metrics,
    health,
    registry,
    snapshot() {
      return coordinator.snapshot();
    },
    async observability() {
      return buildObservability();
    },
    async publishMissionControlObservation() {
      const observation = await buildObservability();
      const payload = {
        capability: observation.capability,
        generatedAt: observation.health.generatedAt,
        metrics: {
          productTotal: observation.metrics.productTotal,
          variantTotal: observation.metrics.variantTotal,
          activeProducts: observation.metrics.activeProducts,
          retiredProducts: observation.metrics.retiredProducts,
        },
        health: { status: observation.health.status },
      };

      for (const observer of dependencies.observers.listObservers()) {
        await observer.receiveObservation(payload);
      }
    },
  };
}

let singleton: Promise<GenesisProductRuntime> | null = null;

export async function getGenesisProductRuntime(): Promise<GenesisProductRuntime> {
  if (!singleton) {
    singleton = createGenesisProductRuntime();
  }
  return singleton;
}
