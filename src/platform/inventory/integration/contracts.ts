import type { RuntimeMetadata, SharedProvider } from "../../shared";
import type { TenantId } from "../contracts";

export type InventoryRuntimeObservation = Readonly<{
  capability: "platform.inventory.runtime";
  runtimeId: string;
  phase: "CREATED" | "INITIALIZING" | "READY" | "STOPPING" | "STOPPED" | "FAILED";
  ready: boolean;
  generatedAt: string;
  providers: readonly string[];
  services: readonly string[];
}>;

export type InventoryRuntimeAuditRecord = Readonly<{
  eventType: string;
  message: string;
  recordedAt: string;
  details?: Record<string, unknown>;
}>;

export type InventoryClockProvider = SharedProvider & {
  capability: "inventory.runtime.clock";
  now(): string;
};

export type InventoryIdentifierProvider = SharedProvider & {
  capability: "inventory.runtime.identifier";
  createIdentifier(scope: string): string;
};

export type InventoryTenantContextProvider = SharedProvider & {
  capability: "inventory.runtime.tenant-context";
  getTenantId(): TenantId | undefined;
};

export type InventoryRuntimeMetadataProvider = SharedProvider & {
  capability: "inventory.runtime.metadata";
  getRuntimeMetadata(): RuntimeMetadata;
};

export type InventoryAuditSinkProvider = SharedProvider & {
  capability: "inventory.runtime.audit-sink";
  recordAudit(record: InventoryRuntimeAuditRecord): Promise<void>;
};

export type InventoryObservationSinkProvider = SharedProvider & {
  capability: "inventory.runtime.observation-sink";
  publishObservation(observation: InventoryRuntimeObservation): Promise<void>;
};

export type InventoryReferenceValidatorRegistrationPoint = {
  registrationPointId: string;
  registerValidatorContract(contractName: string): void;
};

export type InventoryIntegrationAdapterContext = Readonly<{
  runtimeId: string;
  registerReferenceValidatorRegistrationPoint(point: InventoryReferenceValidatorRegistrationPoint): void;
}>;

export type InventoryIntegrationAdapter = {
  adapterId: string;
  register(context: InventoryIntegrationAdapterContext): Promise<void> | void;
  dispose?(): Promise<void> | void;
};

export type InventoryRuntimeDependencies = Readonly<{
  clockProvider: InventoryClockProvider;
  identifierProvider: InventoryIdentifierProvider;
  tenantContextProvider: InventoryTenantContextProvider;
  metadataProvider: InventoryRuntimeMetadataProvider;
  auditSinkProvider: InventoryAuditSinkProvider;
  observationSinkProvider: InventoryObservationSinkProvider;
}>;

export function createDefaultInventoryRuntimeDependencies(): InventoryRuntimeDependencies {
  const healthy = async () => ({ status: "HEALTHY" as const, detail: "ok" });

  return {
    clockProvider: {
      providerId: "inventory.runtime.clock.default",
      capability: "inventory.runtime.clock",
      now() {
        return new Date().toISOString();
      },
      inspectHealth: healthy,
    },
    identifierProvider: {
      providerId: "inventory.runtime.identifier.default",
      capability: "inventory.runtime.identifier",
      createIdentifier(scope: string) {
        return `${scope}-${Date.now().toString(36)}`;
      },
      inspectHealth: healthy,
    },
    tenantContextProvider: {
      providerId: "inventory.runtime.tenant-context.default",
      capability: "inventory.runtime.tenant-context",
      getTenantId() {
        return undefined;
      },
      inspectHealth: healthy,
    },
    metadataProvider: {
      providerId: "inventory.runtime.metadata.default",
      capability: "inventory.runtime.metadata",
      getRuntimeMetadata() {
        return {
          contractVersion: "1.0.0",
          runtimeVersion: "1.0.0",
          persistence: "none.slice-2",
          providers: [],
        };
      },
      inspectHealth: healthy,
    },
    auditSinkProvider: {
      providerId: "inventory.runtime.audit-sink.default",
      capability: "inventory.runtime.audit-sink",
      async recordAudit() {
        return undefined;
      },
      inspectHealth: healthy,
    },
    observationSinkProvider: {
      providerId: "inventory.runtime.observation-sink.default",
      capability: "inventory.runtime.observation-sink",
      async publishObservation() {
        return undefined;
      },
      inspectHealth: healthy,
    },
  };
}
