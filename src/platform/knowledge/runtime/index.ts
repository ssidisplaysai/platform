import { resolve } from "node:path";
import type { KnowledgeHealth, KnowledgeMetrics, KnowledgeRecord, TenantId } from "../contracts";
import {
  createDefaultKnowledgeDependencies,
  type KnowledgePlatformDependencies,
} from "../integration";
import { FileKnowledgeStore, PersistenceCoordinator, type KnowledgeStore } from "../persistence";
import {
  KnowledgeAuditService,
  KnowledgeHealthService,
  KnowledgeMetricsService,
  KnowledgeRegistryService,
} from "../services";

export type GenesisKnowledgeRuntime = {
  store: KnowledgeStore;
  coordinator: PersistenceCoordinator;
  dependencies: KnowledgePlatformDependencies;
  audit: KnowledgeAuditService;
  metrics: KnowledgeMetricsService;
  health: KnowledgeHealthService;
  registry: KnowledgeRegistryService;
  snapshot(tenantId?: TenantId): KnowledgeRecord[];
  observability(): Promise<{
    capability: "platform.knowledge";
    metadata: {
      contractVersion: "1.0.0";
      runtimeVersion: "1.0.0";
      persistence: "file.knowledge-state.v1";
      providers: string[];
    };
    metrics: KnowledgeMetrics;
    health: KnowledgeHealth;
  }>;
};

export type GenesisKnowledgeRuntimeOptions = {
  rootDir?: string;
  store?: KnowledgeStore;
  dependencies?: KnowledgePlatformDependencies;
};

export async function createGenesisKnowledgeRuntime(
  options: GenesisKnowledgeRuntimeOptions = {},
): Promise<GenesisKnowledgeRuntime> {
  const store = options.store ?? new FileKnowledgeStore({
    rootDir: options.rootDir ?? process.env.GENESIS_DATA_ROOT ?? resolve(process.cwd(), "data"),
  });

  const dependencies = options.dependencies ?? createDefaultKnowledgeDependencies();
  const coordinator = new PersistenceCoordinator(store);
  await coordinator.load();

  const audit = new KnowledgeAuditService(coordinator);
  const metrics = new KnowledgeMetricsService(coordinator);
  const health = new KnowledgeHealthService(coordinator);
  const registry = new KnowledgeRegistryService(coordinator, audit);

  return {
    store,
    coordinator,
    dependencies,
    audit,
    metrics,
    health,
    registry,
    snapshot(tenantId?: TenantId) {
      return registry.listKnowledge(tenantId);
    },
    async observability() {
      return {
        capability: "platform.knowledge",
        metadata: {
          contractVersion: "1.0.0",
          runtimeVersion: "1.0.0",
          persistence: "file.knowledge-state.v1",
          providers: dependencies.providers.listProviders().map((provider) => provider.providerId),
        },
        metrics: metrics.snapshot(),
        health: await health.snapshot(),
      };
    },
  };
}

let singleton: Promise<GenesisKnowledgeRuntime> | null = null;

export async function getGenesisKnowledgeRuntime(): Promise<GenesisKnowledgeRuntime> {
  if (!singleton) {
    singleton = createGenesisKnowledgeRuntime();
  }
  return singleton;
}
