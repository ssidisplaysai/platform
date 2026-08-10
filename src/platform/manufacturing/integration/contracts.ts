import type { RuntimeMetadata, SharedProvider } from "../../shared";
import type { TenantId } from "../contracts";

export type ManufacturingRuntimeObservation = Readonly<{
  capability: "platform.manufacturing.runtime";
  runtimeId: string;
  phase: "CREATED" | "INITIALIZING" | "READY" | "STOPPING" | "STOPPED" | "FAILED";
  ready: boolean;
  generatedAt: string;
  providers: readonly string[];
  services: readonly string[];
  integrations: readonly string[];
}>;

export type ManufacturingRuntimeAuditRecord = Readonly<{
  eventType: string;
  message: string;
  recordedAt: string;
  details?: Record<string, unknown>;
}>;

export type ManufacturingClockProvider = SharedProvider & {
  capability: "manufacturing.runtime.clock";
  now(): string;
};

export type ManufacturingIdentifierProvider = SharedProvider & {
  capability: "manufacturing.runtime.identifier";
  createIdentifier(scope: string): string;
};

export type ManufacturingTenantContextProvider = SharedProvider & {
  capability: "manufacturing.runtime.tenant-context";
  getTenantId(): TenantId | undefined;
};

export type ManufacturingRuntimeMetadataProvider = SharedProvider & {
  capability: "manufacturing.runtime.metadata";
  getRuntimeMetadata(): RuntimeMetadata;
};

export type ManufacturingAuditSinkProvider = SharedProvider & {
  capability: "manufacturing.runtime.audit-sink";
  recordAudit(record: ManufacturingRuntimeAuditRecord): Promise<void>;
};

export type ManufacturingObservationSinkProvider = SharedProvider & {
  capability: "manufacturing.runtime.observation-sink";
  publishObservation(observation: ManufacturingRuntimeObservation): Promise<void>;
};

export type ManufacturingCorrelationProvider = SharedProvider & {
  capability: "manufacturing.runtime.correlation";
  createCorrelationId(scope: string): string;
};

export type ManufacturingIntegrationValidationResult =
  | Readonly<{
      valid: true;
      availableQuantity?: number;
      availabilityClassification?: string;
      eligibleScope?: string;
      referenceVersion?: string;
      reasonCode?: string;
      metadata?: Record<string, unknown>;
    }>
  | Readonly<{ valid: false; reason: string; reasonCode?: string }>;

export type ManufacturingIntegrationOperationResult =
  | Readonly<{
      accepted: true;
      referenceId: string;
      acceptedQuantity?: number;
      status?: string;
      metadata?: Record<string, unknown>;
    }>
  | Readonly<{ accepted: false; reason: string; reasonCode?: string }>;

export type ManufacturingProductIntegrationPort = Readonly<{
  validateProductReference(input: { tenantId: TenantId; productId: string }): Promise<ManufacturingIntegrationValidationResult>;
  validateVariantReference(input: { tenantId: TenantId; productVariantId: string }): Promise<ManufacturingIntegrationValidationResult>;
  validateProductVersionReference(input: {
    tenantId: TenantId;
    productVersionId: string;
  }): Promise<ManufacturingIntegrationValidationResult>;
  validateBomReference(input: { tenantId: TenantId; bomId: string }): Promise<ManufacturingIntegrationValidationResult>;
  validateRoutingReference(input: { tenantId: TenantId; routingId: string }): Promise<ManufacturingIntegrationValidationResult>;
  validateConfigurationReference(input: {
    tenantId: TenantId;
    configurationId: string;
  }): Promise<ManufacturingIntegrationValidationResult>;
}>;

export type ManufacturingInventoryIntegrationPort = Readonly<{
  queryAvailability(input: {
    tenantId: TenantId;
    inventoryItemId: string;
    quantity: number;
    unitOfMeasure: string;
  }): Promise<ManufacturingIntegrationValidationResult>;
  requestReservation(input: {
    tenantId: TenantId;
    inventoryItemId: string;
    quantity: number;
    unitOfMeasure: string;
  }): Promise<ManufacturingIntegrationOperationResult>;
  requestAllocation(input: {
    tenantId: TenantId;
    reservationId: string;
  }): Promise<ManufacturingIntegrationOperationResult>;
  releaseReservation(input: { tenantId: TenantId; reservationId: string }): Promise<ManufacturingIntegrationOperationResult>;
  releaseAllocation(input: { tenantId: TenantId; allocationId: string }): Promise<ManufacturingIntegrationOperationResult>;
  requestMaterialIssue(input: {
    tenantId: TenantId;
    inventoryItemId: string;
    quantity: number;
    unitOfMeasure: string;
  }): Promise<ManufacturingIntegrationOperationResult>;
  requestMaterialReturn(input: {
    tenantId: TenantId;
    inventoryItemId: string;
    quantity: number;
    unitOfMeasure: string;
  }): Promise<ManufacturingIntegrationOperationResult>;
  requestFinishedGoodsReceipt(input: {
    tenantId: TenantId;
    inventoryItemId: string;
    quantity: number;
    unitOfMeasure: string;
  }): Promise<ManufacturingIntegrationOperationResult>;
  requestWriteOff(input: {
    tenantId: TenantId;
    inventoryItemId: string;
    quantity: number;
    unitOfMeasure: string;
  }): Promise<ManufacturingIntegrationOperationResult>;
  validateInventoryMovement(input: {
    tenantId: TenantId;
    inventoryMovementId: string;
  }): Promise<ManufacturingIntegrationValidationResult>;
  validateInventoryLot?(input: { tenantId: TenantId; lotId: string }): Promise<ManufacturingIntegrationValidationResult>;
  validateInventorySerial?(input: {
    tenantId: TenantId;
    serialId: string;
  }): Promise<ManufacturingIntegrationValidationResult>;
  validateLot(input: { tenantId: TenantId; lotId: string }): Promise<ManufacturingIntegrationValidationResult>;
  validateSerial(input: { tenantId: TenantId; serialId: string }): Promise<ManufacturingIntegrationValidationResult>;
}>;

export type ManufacturingExternalReferenceValidationPort = Readonly<{
  validateExternalReference(input: {
    tenantId: TenantId;
    referenceType: string;
    referenceId: string;
  }): Promise<ManufacturingIntegrationValidationResult>;
}>;

export type ManufacturingIntegrationType = "PRODUCT" | "INVENTORY" | "EXTERNAL_REFERENCE_VALIDATOR";

export type ManufacturingIntegrationPort =
  | ManufacturingProductIntegrationPort
  | ManufacturingInventoryIntegrationPort
  | ManufacturingExternalReferenceValidationPort;

export type ManufacturingIntegrationRegistration = Readonly<{
  integrationId: string;
  integrationType: ManufacturingIntegrationType;
  port: ManufacturingIntegrationPort;
  dispose?(): Promise<void> | void;
}>;

export type ManufacturingRuntimeDependencies = Readonly<{
  clockProvider: ManufacturingClockProvider;
  identifierProvider: ManufacturingIdentifierProvider;
  tenantContextProvider: ManufacturingTenantContextProvider;
  metadataProvider: ManufacturingRuntimeMetadataProvider;
  auditSinkProvider: ManufacturingAuditSinkProvider;
  observationSinkProvider: ManufacturingObservationSinkProvider;
  correlationProvider: ManufacturingCorrelationProvider;
}>;

export function createDefaultManufacturingRuntimeDependencies(): ManufacturingRuntimeDependencies {
  const healthy = async () => ({ status: "HEALTHY" as const, detail: "ok" });
  let identifierSequence = 0;
  let correlationSequence = 0;

  return {
    clockProvider: {
      providerId: "manufacturing.runtime.clock.default",
      capability: "manufacturing.runtime.clock",
      now() {
        return new Date().toISOString();
      },
      inspectHealth: healthy,
    },
    identifierProvider: {
      providerId: "manufacturing.runtime.identifier.default",
      capability: "manufacturing.runtime.identifier",
      createIdentifier(scope: string) {
        identifierSequence += 1;
        return `${scope}-${Date.now().toString(36)}-${identifierSequence.toString(36)}`;
      },
      inspectHealth: healthy,
    },
    tenantContextProvider: {
      providerId: "manufacturing.runtime.tenant-context.default",
      capability: "manufacturing.runtime.tenant-context",
      getTenantId() {
        return undefined;
      },
      inspectHealth: healthy,
    },
    metadataProvider: {
      providerId: "manufacturing.runtime.metadata.default",
      capability: "manufacturing.runtime.metadata",
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
      providerId: "manufacturing.runtime.audit-sink.default",
      capability: "manufacturing.runtime.audit-sink",
      async recordAudit() {
        return undefined;
      },
      inspectHealth: healthy,
    },
    observationSinkProvider: {
      providerId: "manufacturing.runtime.observation-sink.default",
      capability: "manufacturing.runtime.observation-sink",
      async publishObservation() {
        return undefined;
      },
      inspectHealth: healthy,
    },
    correlationProvider: {
      providerId: "manufacturing.runtime.correlation.default",
      capability: "manufacturing.runtime.correlation",
      createCorrelationId(scope: string) {
        correlationSequence += 1;
        return `${scope}-corr-${Date.now().toString(36)}-${correlationSequence.toString(36)}`;
      },
      inspectHealth: healthy,
    },
  };
}
