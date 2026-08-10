import { describe, expect, it } from "@jest/globals";
import {
  createDefaultManufacturingRuntimeDependencies,
  createManufacturingIdentifier,
  createManufacturingRuntime,
  createPlannedQuantity,
  createRequestedQuantity,
  createUnitOfMeasure,
  type CreateManufacturingWorkOrder,
  type ManufacturingExternalReferenceFamily,
  type ManufacturingExternalReferenceValidationPort,
  type ManufacturingIntegrationRegistration,
  type ManufacturingInventoryIntegrationPort,
  type ManufacturingProductIntegrationPort,
  type ManufacturingRuntime,
  type TenantId,
} from "@/platform/manufacturing";
import type { ManufacturingAuditEvent } from "@/platform/manufacturing/services/ManufacturingAuditService";
import { ManufacturingReferenceValidationService } from "@/platform/manufacturing/services/ManufacturingReferenceValidationService";

function asTenant(tenantId: string): TenantId {
  return tenantId as TenantId;
}

function id<T extends Parameters<typeof createManufacturingIdentifier>[1]>(value: string, brand: T) {
  return createManufacturingIdentifier(value, brand);
}

function createWorkOrder(tenantId = id("tenant-001", "TenantId"), suffix = "001"): CreateManufacturingWorkOrder {
  const unit = createUnitOfMeasure("EA");
  return {
    workOrderId: id(`wo-${suffix}`, "ManufacturingWorkOrderId"),
    workOrderNumber: id(`WO-${suffix}`, "WorkOrderNumber"),
    tenantId,
    productRef: { tenantId, productId: id(`prod-${suffix}`, "ProductIdentifier") },
    productVariantRef: { tenantId, productVariantId: id(`var-${suffix}`, "ProductVariantIdentifier") },
    productVersionRef: { tenantId, productVersionId: id(`pv-${suffix}`, "ProductVersionIdentifier") },
    productBomRef: { tenantId, productBomId: id(`bom-${suffix}`, "ProductBomIdentifier"), bomVersion: id("1.0.0", "VersionIdentifier") },
    requestedQuantity: createRequestedQuantity(10, unit),
    plannedQuantity: createPlannedQuantity(10, unit),
    priority: "HIGH",
    idempotencyKey: id(`idem-wo-${suffix}`, "IdempotencyKey"),
    correlationId: id(`corr-wo-${suffix}`, "CorrelationIdentifier"),
    command: {
      commandId: `cmd-wo-${suffix}`,
      expectedVersion: 0,
      requestedAt: "2026-08-08T00:00:00.000Z",
    },
  };
}

function createProductPort(): ManufacturingProductIntegrationPort {
  return {
    async validateProductReference() {
      return { valid: false, reason: "missing product" };
    },
    async validateVariantReference() {
      return { valid: false, reason: "missing variant" };
    },
    async validateProductVersionReference() {
      return { valid: false, reason: "missing product version" };
    },
    async validateBomReference() {
      return { valid: false, reason: "missing bom" };
    },
    async validateRoutingReference() {
      return { valid: false, reason: "missing routing" };
    },
    async validateConfigurationReference() {
      return { valid: false, reason: "missing configuration" };
    },
  };
}

function createInventoryPort(): ManufacturingInventoryIntegrationPort {
  return {
    async queryAvailability() {
      return { valid: false, reason: "missing inventory reference" };
    },
    async requestReservation() {
      return { accepted: true, referenceId: "reservation-1" };
    },
    async requestAllocation() {
      return { accepted: true, referenceId: "allocation-1" };
    },
    async releaseReservation() {
      return { accepted: true, referenceId: "release-reservation-1" };
    },
    async releaseAllocation() {
      return { accepted: true, referenceId: "release-allocation-1" };
    },
    async requestMaterialIssue() {
      return { accepted: true, referenceId: "issue-1" };
    },
    async requestMaterialReturn() {
      return { accepted: true, referenceId: "return-1" };
    },
    async requestFinishedGoodsReceipt() {
      return { accepted: true, referenceId: "receipt-1" };
    },
    async requestWriteOff() {
      return { accepted: true, referenceId: "writeoff-1" };
    },
    async validateInventoryMovement() {
      return { valid: true };
    },
    async validateLot() {
      return { valid: true };
    },
    async validateSerial() {
      return { valid: true };
    },
  };
}

async function createS9Runtime(options?: {
  externalValidators?: Array<{
    integrationId: string;
    validator: ManufacturingExternalReferenceValidationPort;
    externalReferenceFamilies?: readonly ManufacturingExternalReferenceFamily[];
  }>;
  runtimeId?: string;
}): Promise<ManufacturingRuntime> {
  const baseDependencies = createDefaultManufacturingRuntimeDependencies();
  const externalReferenceIntegrations: ManufacturingIntegrationRegistration[] = (options?.externalValidators ?? []).map((item) => ({
    integrationId: item.integrationId,
    integrationType: "EXTERNAL_REFERENCE_VALIDATOR",
    port: item.validator,
    externalReferenceFamilies: item.externalReferenceFamilies,
  }));

  return createManufacturingRuntime({
    runtimeId: options?.runtimeId ?? "gmdt-1001-s9-runtime",
    dependencies: {
      ...baseDependencies,
      metadataProvider: {
        ...baseDependencies.metadataProvider,
        getRuntimeMetadata: () => ({
          contractVersion: "v1.0.0",
          generatedAt: "2025-01-01T00:00:00.000Z",
          generatedBy: "gmdt-1001-s9-test",
        }),
      },
      clockProvider: {
        ...baseDependencies.clockProvider,
        now: () => "2025-01-01T00:00:00.000Z",
      },
      auditSinkProvider: {
        ...baseDependencies.auditSinkProvider,
        recordAudit: async () => undefined,
      },
    },
    productIntegration: {
      integrationId: "product-default",
      port: createProductPort(),
    },
    inventoryIntegration: {
      integrationId: "inventory-default",
      port: createInventoryPort(),
    },
    externalReferenceIntegrations,
  });
}

function lastAuditEvent(runtime: ManufacturingRuntime): ManufacturingAuditEvent | undefined {
  const query = runtime.services.require("manufacturing.query.observation").value;
  const entries = query.listManufacturingAuditEvents();
  return entries[entries.length - 1];
}

function createReferenceValidationServiceForAuthorityTests(): ManufacturingReferenceValidationService {
  const dependencies = createDefaultManufacturingRuntimeDependencies();
  return new ManufacturingReferenceValidationService({
    clock: dependencies.clockProvider,
    audit: dependencies.auditSinkProvider,
    productPort: createProductPort(),
    inventoryPort: createInventoryPort(),
    externalValidators: [],
  });
}

describe("GMDT-1001 Slice 9 - reference validation, observability, mission control", () => {
  it("accepts one external validator registration for an authoritative family", async () => {
    const runtime = await createS9Runtime({
      externalValidators: [
        {
          integrationId: "external-document-authority",
          externalReferenceFamilies: ["DOCUMENT"],
          validator: {
            async validateExternalReference() {
              return { valid: true, reasonCode: "DOC_OK" };
            },
          },
        },
      ],
    });

    const service = runtime.services.require("manufacturing.service.reference-validation").value;
    const result = await service.validateReference({
      tenantId: asTenant("tenant-alpha"),
      family: "DOCUMENT",
      referenceId: "doc-001",
    });

    expect(result.valid).toBe(true);
    expect(result.reasonCode).toBe("REFERENCE_VALID");

    await runtime.stop();
  });

  it("starts successfully with multiple distinct external validator family authorities", async () => {
    const runtime = await createS9Runtime({
      externalValidators: [
        {
          integrationId: "external-document",
          externalReferenceFamilies: ["DOCUMENT"],
          validator: {
            async validateExternalReference() {
              return { valid: false, reasonCode: "DOC_UNAVAILABLE", reason: "document source offline" };
            },
          },
        },
        {
          integrationId: "external-knowledge",
          externalReferenceFamilies: ["KNOWLEDGE"],
          validator: {
            async validateExternalReference() {
              return { valid: false, reasonCode: "KNOWLEDGE_UNAVAILABLE", reason: "knowledge source offline" };
            },
          },
        },
        {
          integrationId: "external-asset",
          externalReferenceFamilies: ["ASSET"],
          validator: {
            async validateExternalReference() {
              return { valid: false, reasonCode: "ASSET_UNAVAILABLE", reason: "asset source offline" };
            },
          },
        },
      ],
    });

    const service = runtime.services.require("manufacturing.service.reference-validation").value;

    const document = await service.validateReference({
      tenantId: asTenant("tenant-alpha"),
      family: "DOCUMENT",
      referenceId: "doc-001",
    });
    const knowledge = await service.validateReference({
      tenantId: asTenant("tenant-alpha"),
      family: "KNOWLEDGE",
      referenceId: "know-001",
    });
    const asset = await service.validateReference({
      tenantId: asTenant("tenant-alpha"),
      family: "ASSET",
      referenceId: "asset-001",
    });

    expect(document.reasonCode).toBe("DOC_UNAVAILABLE");
    expect(knowledge.reasonCode).toBe("KNOWLEDGE_UNAVAILABLE");
    expect(asset.reasonCode).toBe("ASSET_UNAVAILABLE");

    await runtime.stop();
  });

  it("fails runtime startup closed when duplicate authoritative external family is registered", async () => {
    await expect(
      createS9Runtime({
        externalValidators: [
          {
            integrationId: "external-document-a",
            externalReferenceFamilies: ["DOCUMENT"],
            validator: {
              async validateExternalReference() {
                return { valid: true };
              },
            },
          },
          {
            integrationId: "external-document-b",
            externalReferenceFamilies: ["DOCUMENT"],
            validator: {
              async validateExternalReference() {
                return { valid: true };
              },
            },
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "PARTIAL_INITIALIZATION_REJECTED" });
  });

  it("rejects duplicate same-family registration and preserves original authoritative validator", async () => {
    const service = createReferenceValidationServiceForAuthorityTests();
    const primary = {
      validatorId: "validator.document.primary",
      source: "external" as const,
      validate: async () => ({
        status: "UNAVAILABLE" as const,
        tenantCompatible: true,
        reasonCode: "DOC_PRIMARY",
      }),
    };
    const conflicting = {
      validatorId: "validator.document.conflicting",
      source: "external" as const,
      validate: async () => ({
        status: "UNAVAILABLE" as const,
        tenantCompatible: true,
        reasonCode: "DOC_CONFLICTING",
      }),
    };

    service.registerValidator("DOCUMENT", primary);
    expect(() => service.registerValidator("DOCUMENT", conflicting)).toThrow("duplicate validator authority for family DOCUMENT");

    const result = await service.validateReference({
      tenantId: asTenant("tenant-alpha"),
      family: "DOCUMENT",
      referenceId: "doc-keep-authority",
    });
    expect(result.reasonCode).toBe("DOC_PRIMARY");
    expect(result.validatorId).toBe("validator.document.primary");
  });

  it("rejects duplicate same-family registration in either order without silent authority overwrite", async () => {
    const first = createReferenceValidationServiceForAuthorityTests();
    first.registerValidator("DOCUMENT", {
      validatorId: "validator.document.a",
      source: "external",
      validate: async () => ({
        status: "UNAVAILABLE",
        tenantCompatible: true,
        reasonCode: "DOC_A",
      }),
    });
    expect(() =>
      first.registerValidator("DOCUMENT", {
        validatorId: "validator.document.b",
        source: "external",
        validate: async () => ({
          status: "UNAVAILABLE",
          tenantCompatible: true,
          reasonCode: "DOC_B",
        }),
      }),
    ).toThrow("duplicate validator authority for family DOCUMENT");
    const firstResult = await first.validateReference({
      tenantId: asTenant("tenant-alpha"),
      family: "DOCUMENT",
      referenceId: "doc-a",
    });
    expect(firstResult.validatorId).toBe("validator.document.a");

    const second = createReferenceValidationServiceForAuthorityTests();
    second.registerValidator("DOCUMENT", {
      validatorId: "validator.document.b",
      source: "external",
      validate: async () => ({
        status: "UNAVAILABLE",
        tenantCompatible: true,
        reasonCode: "DOC_B",
      }),
    });
    expect(() =>
      second.registerValidator("DOCUMENT", {
        validatorId: "validator.document.a",
        source: "external",
        validate: async () => ({
          status: "UNAVAILABLE",
          tenantCompatible: true,
          reasonCode: "DOC_A",
        }),
      }),
    ).toThrow("duplicate validator authority for family DOCUMENT");
    const secondResult = await second.validateReference({
      tenantId: asTenant("tenant-alpha"),
      family: "DOCUMENT",
      referenceId: "doc-b",
    });
    expect(secondResult.validatorId).toBe("validator.document.b");
  });

  it("registers 09g services and exposes read-only observability query", async () => {
    const runtime = await createS9Runtime();

    expect(runtime.services.require("manufacturing.service.reference-validation")).toBeDefined();
    expect(runtime.services.require("manufacturing.service.work-order-reference-validator")).toBeDefined();
    expect(runtime.services.require("manufacturing.service.audit")).toBeDefined();
    expect(runtime.services.require("manufacturing.service.metrics")).toBeDefined();
    expect(runtime.services.require("manufacturing.service.health")).toBeDefined();
    expect(runtime.services.require("manufacturing.service.observation-publisher")).toBeDefined();
    expect(runtime.services.require("manufacturing.query.observation")).toBeDefined();

    const trace = runtime.snapshot().state.trace;
    expect(trace).toContain("09g.register-slice9-reference-validation-observability-services");

    await runtime.stop();
  });

  it("validates product references and emits deterministic audit result", async () => {
    const runtime = await createS9Runtime();
    const service = runtime.services.require("manufacturing.service.reference-validation").value;

    const tenant = asTenant("tenant-alpha");
    await expect(
      service.assertReference({
        tenantId: tenant,
        family: "PRODUCT",
        referenceId: "product-does-not-exist",
        correlationId: id("corr-product-missing", "CorrelationIdentifier"),
      }),
    ).rejects.toMatchObject({ classification: "MANDATORY_REFERENCE_INVALID" });

    const event = lastAuditEvent(runtime);
    expect(event).toBeDefined();
    expect(event?.category).toBe("REFERENCE");
    expect(event?.record.details?.referenceId).toBe("product-does-not-exist");

    await runtime.stop();
  });

  it("supports external validators and maps unavailable optional reference classification", async () => {
    const validator: ManufacturingExternalReferenceValidationPort = {
      async validateExternalReference() {
        return {
          valid: false,
          reasonCode: "OPTIONAL_REFERENCE_UNAVAILABLE",
          reason: "external system offline",
        };
      },
    };

    const runtime = await createS9Runtime({
      externalValidators: [
        {
          integrationId: "quality-hub",
          validator,
        },
      ],
    });
    const service = runtime.services.require("manufacturing.service.reference-validation").value;

    const result = await service.validateReference({
      tenantId: asTenant("tenant-alpha"),
      family: "ORGANIZATION",
      referenceId: "ext-quality-001",
      correlationId: id("corr-external-optional", "CorrelationIdentifier"),
    });

    expect(result.valid).toBe(false);
    expect(result.status).toBe("UNAVAILABLE");
    expect(result.reasonCode).toBe("OPTIONAL_REFERENCE_UNAVAILABLE");

    await runtime.stop();
  });

  it("rejects unknown external validator with deterministic classification", async () => {
    const runtime = await createS9Runtime();
    const service = runtime.services.require("manufacturing.service.reference-validation").value;

    const result = await service.validateReference({
      tenantId: asTenant("tenant-alpha"),
      family: "ORGANIZATION",
      referenceId: "ext-unknown",
    });

    expect(result.valid).toBe(false);
    expect(result.status).toBe("UNAVAILABLE");
    expect(result.reasonCode).toBe("MISSING_REFERENCE_VALIDATOR");

    await runtime.stop();
  });

  it("distinguishes tenant mismatch in work-order bounded validator", async () => {
    const runtime = await createS9Runtime();
    const workOrders = runtime.services.require("manufacturing.service.work-order").value;

    const tenantA = id("tenant-a", "TenantId");
    const tenantB = id("tenant-b", "TenantId");

    const created = await workOrders.createWorkOrder(createWorkOrder(tenantA));

    const validator = runtime.services.require("manufacturing.service.work-order-reference-validator").value;

    const validation = validator.validateManufacturingWorkOrderReference({
      tenantId: tenantB,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
    });

    expect(validation.valid).toBe(false);
    expect(validation.tenantCompatible).toBe(false);
    expect(validation.reasonCode).toBe("REFERENCE_TENANT_MISMATCH");

    await runtime.stop();
  });

  it("builds mission-control observation and records publication failure without throwing", async () => {
    const runtime = await createS9Runtime({
      runtimeId: "gmdt-1001-s9-observation-failure",
    });

    const publisher = runtime.services.require("manufacturing.service.observation-publisher").value;
    publisher.registerObserver("failing-observer", async () => {
      throw new Error("observer exploded");
    });

    await expect(publisher.publishManufacturingObservation()).rejects.toMatchObject({
      classification: "OBSERVATION_PUBLICATION_FAILURE",
    });

    const query = runtime.services.require("manufacturing.query.observation").value;
    const metrics = query.getManufacturingMetrics();
    expect(metrics.values.observationPublishFailureCount).toBeGreaterThanOrEqual(1);

    const failureEvent = query
      .listManufacturingAuditEvents()
      .find((event: ManufacturingAuditEvent) => event.record.eventType === "manufacturing.observation.publish.rejected");
    expect(failureEvent).toBeDefined();

    await runtime.stop();
  });

  it("keeps observability query read-only and mutation resistant", async () => {
    const runtime = await createS9Runtime();
    const auditService = runtime.services.require("manufacturing.service.audit").value;

    expect(() => auditService.rejectMutation()).toThrow("manufacturing audit mutation is prohibited");
    expect(() => auditService.rejectDeletion()).toThrow("manufacturing audit deletion is prohibited");

    await runtime.stop();
  });

  it("reports runtime readiness and integration health deterministically", async () => {
    const runtime = await createS9Runtime();
    const query = runtime.services.require("manufacturing.query.observation").value;

    const readiness = query.getManufacturingRuntimeReadiness();
    expect(readiness.ready).toBe(true);
    expect(readiness.phase).toBe("READY");
    expect(readiness.durableReadiness).toBe(false);
    expect(readiness.durabilityMode).toBe("EPHEMERAL_UNCONFIGURED");
    expect(readiness.durablePersistenceConfigured).toBe(false);

    const productHealth = query.getProductIntegrationHealth();
    expect(productHealth.validatorAvailable).toBe(true);

    const inventoryHealth = query.getInventoryIntegrationHealth();
    expect(inventoryHealth.validatorAvailable).toBe(true);

    await runtime.stop();
  });

  it("provides deterministic reference health projection from the validation service", async () => {
    const runtime = await createS9Runtime();
    const service = runtime.services.require("manufacturing.service.reference-validation").value;

    const tenant = asTenant("tenant-alpha");
    await service.validateReference({
        tenantId: tenant,
        family: "PRODUCT",
        referenceId: "missing-product",
      });
    await service.validateReference({
        tenantId: tenant,
        family: "ORGANIZATION",
        referenceId: "missing-material",
      });

    const query = runtime.services.require("manufacturing.query.observation").value;
    const health = query.getManufacturingReferenceHealth();
    expect(health.summary.missingValidatorCount).toBeGreaterThanOrEqual(1);
    expect(["HEALTHY", "DEGRADED", "UNHEALTHY"]).toContain(health.status);

    await runtime.stop();
  });
});
