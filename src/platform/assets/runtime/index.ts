import { resolve } from "node:path";
import type { AssetHealth, AssetMetrics, AssetRecord, TenantId } from "../contracts";
import { FileAssetStore, PersistenceCoordinator, type AssetStore } from "../persistence";
import { createDefaultAssetProviderRegistry, type AssetProviderRegistry } from "../integration";
import { AssetAuditService, AssetHealthService, AssetMetricsService, AssetRegistryService } from "../services";

export type AssetPlatformDependencies = {
  providers: AssetProviderRegistry;
};

export type GenesisAssetRuntime = {
  store: AssetStore;
  coordinator: PersistenceCoordinator;
  dependencies: AssetPlatformDependencies;
  audit: AssetAuditService;
  metrics: AssetMetricsService;
  health: AssetHealthService;
  registry: AssetRegistryService;
  snapshot(tenantId?: TenantId): AssetRecord[];
  observability(): Promise<{
    capability: "platform.assets";
    metadata: {
      contractVersion: "1.0.0";
      runtimeVersion: "1.0.0";
      persistence: "file.asset-state.v1";
      providers: string[];
    };
    metrics: AssetMetrics;
    health: AssetHealth;
  }>;
};

export type GenesisAssetRuntimeOptions = {
  rootDir?: string;
  store?: AssetStore;
  dependencies?: AssetPlatformDependencies;
};

function createDefaultDependencies(): AssetPlatformDependencies {
  return {
    providers: createDefaultAssetProviderRegistry(),
  };
}

export async function createGenesisAssetRuntime(options: GenesisAssetRuntimeOptions = {}): Promise<GenesisAssetRuntime> {
  const store = options.store ?? new FileAssetStore({
    rootDir: options.rootDir ?? process.env.GENESIS_DATA_ROOT ?? resolve(process.cwd(), "data"),
  });

  const dependencies = options.dependencies ?? createDefaultDependencies();
  const coordinator = new PersistenceCoordinator(store);
  await coordinator.load();

  const audit = new AssetAuditService(coordinator);
  const metrics = new AssetMetricsService(coordinator);
  const health = new AssetHealthService(coordinator);
  const registry = new AssetRegistryService(coordinator, audit);

  return {
    store,
    coordinator,
    dependencies,
    audit,
    metrics,
    health,
    registry,
    snapshot(tenantId?: TenantId) {
      return registry.listAssets(tenantId);
    },
    async observability() {
      return {
        capability: "platform.assets",
        metadata: {
          contractVersion: "1.0.0",
          runtimeVersion: "1.0.0",
          persistence: "file.asset-state.v1",
          providers: dependencies.providers.listProviders().map((provider) => provider.providerId),
        },
        metrics: metrics.snapshot(),
        health: await health.snapshot(),
      };
    },
  };
}

let singleton: Promise<GenesisAssetRuntime> | null = null;

export async function getGenesisAssetRuntime(): Promise<GenesisAssetRuntime> {
  if (!singleton) {
    singleton = createGenesisAssetRuntime();
  }
  return singleton;
}
