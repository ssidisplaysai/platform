import { resolve } from "node:path";
import type {
  DocumentHealth,
  DocumentMetrics,
  DocumentRecord,
  DocumentTemplate,
  TenantId,
} from "../contracts";
import {
  createDefaultDocumentDependencies,
  type DocumentPlatformDependencies,
} from "../integration";
import { FileDocumentStore, PersistenceCoordinator, type DocumentStore } from "../persistence";
import {
  DocumentApprovalService,
  DocumentAssetReferenceService,
  DocumentAuditService,
  DocumentGenerationService,
  DocumentHealthService,
  DocumentLifecycleService,
  DocumentMetadataService,
  DocumentMetricsService,
  DocumentRegistryService,
  DocumentRelationshipService,
  DocumentRevisionService,
  DocumentSignatureService,
  DocumentTemplateService,
} from "../services";

export type GenesisDocumentRuntime = {
  store: DocumentStore;
  coordinator: PersistenceCoordinator;
  dependencies: DocumentPlatformDependencies;
  audit: DocumentAuditService;
  metrics: DocumentMetricsService;
  health: DocumentHealthService;
  registry: DocumentRegistryService;
  templates: DocumentTemplateService;
  revisions: DocumentRevisionService;
  generation: DocumentGenerationService;
  approvals: DocumentApprovalService;
  signatures: DocumentSignatureService;
  metadata: DocumentMetadataService;
  lifecycle: DocumentLifecycleService;
  relationships: DocumentRelationshipService;
  assetReferences: DocumentAssetReferenceService;
  snapshot(tenantId?: TenantId): DocumentRecord[];
  templatesSnapshot(tenantId?: TenantId): DocumentTemplate[];
  observability(): Promise<{
    capability: "platform.documents";
    metadata: {
      contractVersion: "1.0.0";
      runtimeVersion: "1.0.0";
      persistence: "file.document-state.v1";
      dependencies: Array<"assets" | "organization" | "contacts" | "workflow" | "ai">;
    };
    metrics: DocumentMetrics;
    health: DocumentHealth;
  }>;
};

export type GenesisDocumentRuntimeOptions = {
  rootDir?: string;
  store?: DocumentStore;
  dependencies?: DocumentPlatformDependencies;
};

export async function createGenesisDocumentRuntime(
  options: GenesisDocumentRuntimeOptions = {},
): Promise<GenesisDocumentRuntime> {
  const store = options.store ?? new FileDocumentStore({
    rootDir: options.rootDir ?? process.env.GENESIS_DATA_ROOT ?? resolve(process.cwd(), "data"),
  });

  const dependencies = options.dependencies ?? createDefaultDocumentDependencies();
  const coordinator = new PersistenceCoordinator(store);
  await coordinator.load();

  const audit = new DocumentAuditService(coordinator);
  const metrics = new DocumentMetricsService(coordinator);
  const health = new DocumentHealthService(coordinator);
  const registry = new DocumentRegistryService(coordinator, audit, dependencies);
  const templates = new DocumentTemplateService(coordinator, audit);
  const revisions = new DocumentRevisionService(coordinator, audit);
  const generation = new DocumentGenerationService(coordinator, templates, audit, dependencies);
  const approvals = new DocumentApprovalService(coordinator, audit, dependencies);
  const signatures = new DocumentSignatureService(coordinator, audit);
  const metadata = new DocumentMetadataService(registry);
  const lifecycle = new DocumentLifecycleService(registry);
  const relationships = new DocumentRelationshipService(coordinator, audit);
  const assetReferences = new DocumentAssetReferenceService(coordinator, audit, dependencies);

  return {
    store,
    coordinator,
    dependencies,
    audit,
    metrics,
    health,
    registry,
    templates,
    revisions,
    generation,
    approvals,
    signatures,
    metadata,
    lifecycle,
    relationships,
    assetReferences,
    snapshot(tenantId?: TenantId) {
      return registry.listDocuments(tenantId);
    },
    templatesSnapshot(tenantId?: TenantId) {
      return templates.listTemplates(tenantId);
    },
    async observability() {
      return {
        capability: "platform.documents",
        metadata: {
          contractVersion: "1.0.0",
          runtimeVersion: "1.0.0",
          persistence: "file.document-state.v1",
          dependencies: ["assets", "organization", "contacts", "workflow", "ai"],
        },
        metrics: metrics.snapshot(),
        health: await health.snapshot(),
      };
    },
  };
}

let singleton: Promise<GenesisDocumentRuntime> | null = null;

export async function getGenesisDocumentRuntime(): Promise<GenesisDocumentRuntime> {
  if (!singleton) {
    singleton = createGenesisDocumentRuntime();
  }
  return singleton;
}
