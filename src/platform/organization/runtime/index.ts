import { resolve } from "node:path";
import { OrganizationAuditWriter } from "../audit";
import type { OrganizationPlatformDependencies } from "../contracts";
import { OrganizationHealthService } from "../health";
import { MissionControlOrganizationIntegrationService } from "../integration";
import { OrganizationMetricsService } from "../metrics";
import { FileOrganizationStore, type OrganizationPersistence } from "../persistence";
import {
  OrganizationHierarchyService,
  OrganizationLifecycleService,
  OrganizationMetadataService,
  OrganizationRegistry,
  OrganizationRelationshipService,
  OrganizationSettingsService,
} from "../services";

export type GenesisOrganizationRuntime = {
  persistence: OrganizationPersistence;
  dependencies: OrganizationPlatformDependencies;
  audit: OrganizationAuditWriter;
  metrics: OrganizationMetricsService;
  health: OrganizationHealthService;
  registry: OrganizationRegistry;
  hierarchy: OrganizationHierarchyService;
  lifecycle: OrganizationLifecycleService;
  relationships: OrganizationRelationshipService;
  settings: OrganizationSettingsService;
  metadata: OrganizationMetadataService;
  integration: MissionControlOrganizationIntegrationService;
};

export type GenesisOrganizationRuntimeOptions = {
  rootDir?: string;
  persistence?: OrganizationPersistence;
  dependencies?: OrganizationPlatformDependencies;
};

function createDefaultDependencies(): OrganizationPlatformDependencies {
  const health = async () => ({ status: "HEALTHY" as const, detail: "not configured" });
  return {
    identity: {
      async resolveIdentity(actorId: string) {
        return { actorId };
      },
    },
    authorization: {
      async authorize() {
        return { allowed: true };
      },
    },
    messaging: { inspectHealth: health },
    workflow: { inspectHealth: health },
    scheduling: { inspectHealth: health },
    notifications: { inspectHealth: health },
    ai: { inspectHealth: health },
  };
}

export async function createGenesisOrganizationRuntime(
  options: GenesisOrganizationRuntimeOptions = {},
): Promise<GenesisOrganizationRuntime> {
  const dependencies = options.dependencies ?? createDefaultDependencies();
  const persistence = options.persistence ?? new FileOrganizationStore({
    rootDir: options.rootDir ?? resolve(process.cwd(), "data"),
  });

  const audit = new OrganizationAuditWriter();
  const metrics = new OrganizationMetricsService();
  const registry = new OrganizationRegistry(persistence, audit, metrics);
  await registry.load();
  const hierarchy = new OrganizationHierarchyService(registry, audit, metrics);
  const lifecycle = new OrganizationLifecycleService(registry);
  const relationships = new OrganizationRelationshipService(registry, audit, metrics);
  const settings = new OrganizationSettingsService(registry);
  const metadata = new OrganizationMetadataService(registry);
  const health = new OrganizationHealthService(metrics, audit);
  const integration = new MissionControlOrganizationIntegrationService(health, metrics, dependencies);

  return {
    persistence,
    dependencies,
    audit,
    metrics,
    health,
    registry,
    hierarchy,
    lifecycle,
    relationships,
    settings,
    metadata,
    integration,
  };
}

let singleton: GenesisOrganizationRuntime | null = null;

export async function getGenesisOrganizationRuntime(): Promise<GenesisOrganizationRuntime> {
  if (!singleton) {
    singleton = await createGenesisOrganizationRuntime();
  }
  return singleton;
}
