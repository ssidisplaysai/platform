import { resolve } from "node:path";
import { getGenesisAuthorizationService } from "@/platform/gop/auth/authorization";
import { getGenesisMessageBus } from "@/platform/messaging";
import { getGenesisWorkflowEngine } from "@/platform/workflow";
import { getGenesisSchedulingEngine } from "@/platform/scheduling";
import { getGenesisNotificationHealth } from "@/platform/notifications/services/runtime";
import { getGenesisAIOrchestrationRuntime } from "@/platform/ai";
import {
  type Contact,
  type ContactErrorSeverity,
  type ContactHealth,
  type ContactMetrics,
  type ContactPlatformDependencies,
  type TenantId,
} from "../contracts";
import { createOrganizationDependency } from "../integration";
import { FileContactStore, PersistenceCoordinator, type ContactStore } from "../persistence";
import {
  CommunicationEligibilityService,
  ConsentService,
  ContactAuditWriter,
  ContactClassificationService,
  ContactDeduplicationService,
  ContactHealthService,
  ContactIdentityService,
  ContactLifecycleService,
  ContactMergeService,
  ContactMethodService,
  ContactMetricsService,
  ContactPreferenceService,
  ContactRegistry,
  OrganizationAffiliationService,
} from "../services";

export type GenesisContactRuntime = {
  store: ContactStore;
  coordinator: PersistenceCoordinator;
  dependencies: ContactPlatformDependencies;
  audit: ContactAuditWriter;
  metrics: ContactMetricsService;
  health: ContactHealthService;
  registry: ContactRegistry;
  identity: ContactIdentityService;
  methods: ContactMethodService;
  affiliations: OrganizationAffiliationService;
  classifications: ContactClassificationService;
  preferences: ContactPreferenceService;
  consent: ConsentService;
  eligibility: CommunicationEligibilityService;
  lifecycle: ContactLifecycleService;
  deduplication: ContactDeduplicationService;
  merge: ContactMergeService;
  snapshot(): Contact[];
  snapshotByTenant(tenantId: TenantId): Contact[];
  observability(): Promise<{
    capability: "platform.contact";
    metadata: {
      contractVersion: "1.0.0";
      runtimeVersion: "1.0.0";
      persistence: "file.contact-state.v1";
      severityThreshold: ContactErrorSeverity;
    };
    metrics: ContactMetrics;
    health: ContactHealth;
  }>;
};

export type GenesisContactRuntimeOptions = {
  rootDir?: string;
  store?: ContactStore;
  dependencies?: ContactPlatformDependencies;
  severityThreshold?: ContactErrorSeverity;
  mergeIdempotencyTtlMs?: number;
};

function createDefaultDependencies(): ContactPlatformDependencies {
  const normalizedHealth = (status: "HEALTHY" | "DEGRADED" | "CRITICAL"): "HEALTHY" | "DEGRADED" =>
    status === "HEALTHY" ? "HEALTHY" : "DEGRADED";

  return {
    identity: {
      async resolveIdentity(actorId: string) {
        return { actorId };
      },
    },
    authorization: {
      async authorize(input) {
        if (!input.actorId || !input.tenantId) {
          return { allowed: false, reason: "actorId and tenantId are required" };
        }
        const result = getGenesisAuthorizationService().authorize({
          requestId: `contact_${Date.now()}`,
          principalId: input.actorId,
          principalName: input.actorId,
          actionId: input.action,
          actionType: "resource_access",
          workspaceId: input.tenantId,
          moduleId: "platform.contact",
          roles: ["VIEWER"],
          memberships: [],
          permissionSet: {
            directPermissions: ["read", "write", "admin"],
            inheritedPermissions: [],
            capabilityPermissions: [],
            workspacePermissions: [],
            resourcePermissions: [],
          },
          capabilities: [],
          resource: {
            resourceType: "SERVICE",
            resourceId: input.contactId,
            workspaceId: input.tenantId,
            moduleId: "platform.contact",
            route: "/api/gop/contact",
          },
          contractVersion: "1.0.0",
          requestedAt: new Date().toISOString(),
        });
        return {
          allowed: result.allowed,
          reason: result.reason,
        };
      },
    },
    organization: createOrganizationDependency(),
    messaging: {
      async inspectHealth() {
        const health = getGenesisMessageBus().healthSnapshot();
        return {
          status: normalizedHealth(health.status),
          detail: `checks=${health.checks.length}`,
        };
      },
    },
    workflow: {
      async inspectHealth() {
        const health = await getGenesisWorkflowEngine().healthSnapshot();
        return {
          status: normalizedHealth(health.status),
          detail: `checks=${health.checks.length}`,
        };
      },
    },
    scheduling: {
      async inspectHealth() {
        const health = await getGenesisSchedulingEngine().healthSnapshot();
        return {
          status: normalizedHealth(health.status),
          detail: `checks=${health.checks.length}`,
        };
      },
    },
    notifications: {
      async inspectHealth() {
        const health = await getGenesisNotificationHealth();
        return {
          status: normalizedHealth(health.status),
          detail: `checks=${health.checks.length}`,
        };
      },
    },
    ai: {
      async inspectHealth() {
        const health = await getGenesisAIOrchestrationRuntime().health.snapshot();
        return {
          status: normalizedHealth(health.status),
          detail: `checks=${health.checks.length}`,
        };
      },
    },
  };
}

export async function createGenesisContactRuntime(
  options: GenesisContactRuntimeOptions = {},
): Promise<GenesisContactRuntime> {
  const store = options.store ?? new FileContactStore({
    rootDir: options.rootDir ?? process.env.GENESIS_DATA_ROOT ?? resolve(process.cwd(), "data"),
  });
  const dependencies = options.dependencies ?? createDefaultDependencies();
  const coordinator = new PersistenceCoordinator(store);
  const audit = new ContactAuditWriter(coordinator);
  const metrics = new ContactMetricsService();
  const registry = new ContactRegistry(coordinator, audit, metrics, dependencies);
  await registry.initialize();

  const identity = new ContactIdentityService(registry);
  const methods = new ContactMethodService(registry, audit);
  const affiliations = new OrganizationAffiliationService(registry, audit, dependencies);
  const classifications = new ContactClassificationService(registry, audit);
  const preferences = new ContactPreferenceService(registry, audit);
  const consent = new ConsentService(registry, audit);
  const eligibility = new CommunicationEligibilityService(consent, audit);
  const lifecycle = new ContactLifecycleService(registry, audit);
  const deduplication = new ContactDeduplicationService(registry, audit, coordinator);
  const merge = new ContactMergeService(registry, audit, coordinator, metrics, options.mergeIdempotencyTtlMs ?? 86_400_000);
  const health = new ContactHealthService(metrics, audit, dependencies);

  return {
    store,
    coordinator,
    dependencies,
    audit,
    metrics,
    health,
    registry,
    identity,
    methods,
    affiliations,
    classifications,
    preferences,
    consent,
    eligibility,
    lifecycle,
    deduplication,
    merge,
    snapshot() {
      return registry.listContacts();
    },
    snapshotByTenant(tenantId: TenantId) {
      return registry.listContacts(tenantId);
    },
    async observability() {
      return {
        capability: "platform.contact",
        metadata: {
          contractVersion: "1.0.0",
          runtimeVersion: "1.0.0",
          persistence: "file.contact-state.v1",
          severityThreshold: options.severityThreshold ?? "MEDIUM",
        },
        metrics: metrics.snapshot(),
        health: await health.snapshot(),
      };
    },
  };
}

let singleton: Promise<GenesisContactRuntime> | null = null;

export async function getGenesisContactRuntime(): Promise<GenesisContactRuntime> {
  if (!singleton) {
    singleton = createGenesisContactRuntime();
  }
  return singleton;
}
