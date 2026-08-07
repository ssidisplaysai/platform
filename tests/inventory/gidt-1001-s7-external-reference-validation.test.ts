import { describe, expect, it } from "@jest/globals";
import {
  createDefaultInventoryRuntimeDependencies,
  createExpectedVersion,
  createInventoryIdentifier,
  createInventoryRuntime,
  createInventorySlice5Services,
  createInventorySlice6ServiceRegistrationHook,
  createStaticInventoryProductReferenceValidator,
  createStaticInventoryReferenceValidator,
  InventoryReferenceService,
  InventoryReferenceValidatorRegistry,
  type AuditMetadata,
  type CommandMetadata,
  type InventoryRuntimeAuditRecord,
} from "@/platform/inventory";

function commandMetadata(seed: number, key?: string): CommandMetadata {
  return {
    commandId: createInventoryIdentifier(`cmd-s7-${seed}`, "IdempotencyKey") as unknown as CommandMetadata["commandId"],
    expectedVersion: createExpectedVersion(1),
    idempotencyKey: createInventoryIdentifier(key ?? `idem-s7-${seed}`, "IdempotencyKey"),
    requestedAt: `2026-08-06T20:00:${String(seed).padStart(2, "0")}.000Z`,
  };
}

function auditMetadata(seed: number): AuditMetadata {
  return {
    actorId: createInventoryIdentifier(`actor-s7-${seed}`, "IdempotencyKey") as unknown as AuditMetadata["actorId"],
    occurredAt: `2026-08-06T20:00:${String(seed).padStart(2, "0")}.000Z`,
    source: "test",
  };
}

function createSlice5Harness() {
  const audits: InventoryRuntimeAuditRecord[] = [];
  const dependencies = createDefaultInventoryRuntimeDependencies();
  dependencies.auditSinkProvider = {
    ...dependencies.auditSinkProvider,
    async recordAudit(record) {
      audits.push(record);
    },
  };

  const validatorRegistry = new InventoryReferenceValidatorRegistry();
  validatorRegistry.registerProductValidator(
    createStaticInventoryProductReferenceValidator({
      validatorId: "slice7-product-validator",
      validProducts: [createInventoryIdentifier("prd-01", "ProductReferenceId")],
      validProductVariants: {
        "prd-01": [createInventoryIdentifier("var-01", "ProductVariantReferenceId")],
      },
    }),
  );

  const services = createInventorySlice5Services({ dependencies, validatorRegistry });
  return { audits, dependencies, validatorRegistry, services };
}

async function seedSlice5(harness: ReturnType<typeof createSlice5Harness>) {
  const tenantId = createInventoryIdentifier("tenant-a", "TenantId");
  const item = await harness.services.slice4.foundation.inventoryItemService.registerInventoryItem({
    inventoryItemId: createInventoryIdentifier("item-a", "InventoryItemId"),
    tenantId,
    productReferenceId: createInventoryIdentifier("prd-01", "ProductReferenceId"),
    productVariantReferenceId: createInventoryIdentifier("var-01", "ProductVariantReferenceId"),
    unitOfMeasure: "EA",
    commandMetadata: commandMetadata(1),
    auditMetadata: auditMetadata(1),
  });

  const warehouse = await harness.services.slice4.foundation.warehouseService.registerWarehouse({
    warehouseId: createInventoryIdentifier("wh-a", "WarehouseId"),
    tenantId,
    warehouseCode: "WH-A",
    commandMetadata: commandMetadata(2),
    auditMetadata: auditMetadata(2),
  });

  const location = await harness.services.slice4.foundation.storageLocationService.registerStorageLocation({
    storageLocationId: createInventoryIdentifier("loc-a", "StorageLocationId"),
    warehouseId: warehouse.warehouseId,
    tenantId,
    locationCode: "LOC-A",
    locationType: "STORAGE",
    commandMetadata: commandMetadata(3),
    auditMetadata: auditMetadata(3),
  });

  const bin = await harness.services.slice4.foundation.binService.registerBin({
    binId: createInventoryIdentifier("bin-a", "BinId"),
    storageLocationId: location.storageLocationId,
    tenantId,
    binCode: "BIN-A",
    commandMetadata: commandMetadata(4),
    auditMetadata: auditMetadata(4),
  });

  const balance = await harness.services.slice4.foundation.inventoryBalanceService.initializeInventoryBalance({
    inventoryBalanceId: createInventoryIdentifier("bal-a", "InventoryBalanceId"),
    inventoryItemId: item.inventoryItemId,
    tenantId,
    warehouseId: warehouse.warehouseId,
    storageLocationId: location.storageLocationId,
    binId: bin.binId,
    initialQuantities: { onHandQuantity: 10 },
    commandMetadata: commandMetadata(5),
    auditMetadata: auditMetadata(5),
  });

  return { tenantId, item, warehouse, location, balance };
}

describe("GIDT-1001-S7 external reference validation", () => {
  it("registers typed validators deterministically and rejects duplicates", () => {
    const registry = new InventoryReferenceValidatorRegistry();
    registry.registerProductValidator(
      createStaticInventoryProductReferenceValidator({
        validatorId: "slice7-product-validator",
        validProducts: [createInventoryIdentifier("prd-01", "ProductReferenceId")],
      }),
    );

    registry.registerValidator(
      "DOCUMENT",
      createStaticInventoryReferenceValidator({
        validatorId: "slice7-document-validator",
        referenceType: "DOCUMENT",
        contractVersion: "1.0.0",
        activeReferences: ["DOC-1", "DOC-2"],
      }),
    );

    expect(registry.supportedReferenceTypes()).toEqual(["DOCUMENT", "PRODUCT", "PRODUCT_VARIANT"]);
    expect(registry.listValidatorIds()).toEqual(["slice7-document-validator", "slice7-product-validator"]);

    expect(() =>
      registry.registerValidator(
        "DOCUMENT",
        createStaticInventoryReferenceValidator({
          validatorId: "slice7-document-validator-2",
          referenceType: "DOCUMENT",
          contractVersion: "1.0.0",
          activeReferences: ["DOC-3"],
        }),
      ),
    ).toThrow(/registration conflict/i);
  });

  it("fails closed for mandatory product reference validation and preserves atomicity", async () => {
    const dependencies = createDefaultInventoryRuntimeDependencies();
    const registry = new InventoryReferenceValidatorRegistry();
    const services = createInventorySlice5Services({ dependencies, validatorRegistry: registry });

    await expect(
      services.slice4.foundation.inventoryItemService.registerInventoryItem({
        inventoryItemId: createInventoryIdentifier("item-missing-validator", "InventoryItemId"),
        tenantId: createInventoryIdentifier("tenant-a", "TenantId"),
        productReferenceId: createInventoryIdentifier("prd-01", "ProductReferenceId"),
        unitOfMeasure: "EA",
        commandMetadata: commandMetadata(6),
        auditMetadata: auditMetadata(6),
      }),
    ).rejects.toMatchObject({ classification: "MISSING_REQUIRED_VALIDATOR" });

    const after = services.slice4.foundation.inventoryItemService.listInventoryItems(createInventoryIdentifier("tenant-a", "TenantId"));
    expect(after).toHaveLength(0);
  });

  it("treats external request references as optional and records missing validator evidence", async () => {
    const harness = createSlice5Harness();
    const seed = await seedSlice5(harness);

    const reservation = await harness.services.reservationService.createReservation({
      reservationId: createInventoryIdentifier("res-a", "ReservationId"),
      tenantId: seed.tenantId,
      inventoryItemId: seed.item.inventoryItemId,
      inventoryBalanceId: seed.balance.inventoryBalanceId,
      requestedQuantity: 3,
      externalRequestReference: "DOC-MISSING-VALIDATOR",
      expectedBalanceVersion: createExpectedVersion(seed.balance.version),
      commandMetadata: commandMetadata(7),
      auditMetadata: auditMetadata(7),
    });

    expect(reservation.remainingQuantity).toBe(3);
    const metrics = harness.services.slice4.foundation.referenceValidationService.getMetrics();
    expect(metrics.missingValidatorCount).toBe(1);
    expect(metrics.optionalReferenceFailureCount).toBe(1);
    expect(harness.audits.some((entry) => entry.eventType === "inventory.reference.validation.missing-validator")).toBe(true);
  });

  it("validates optional external references when a document validator is registered", async () => {
    const harness = createSlice5Harness();
    harness.validatorRegistry.registerValidator(
      "DOCUMENT",
      createStaticInventoryReferenceValidator({
        validatorId: "slice7-document-validator",
        referenceType: "DOCUMENT",
        contractVersion: "1.0.0",
        activeReferences: ["DOC-APPROVED"],
      }),
    );

    const seed = await seedSlice5(harness);
    await harness.services.reservationService.createReservation({
      reservationId: createInventoryIdentifier("res-b", "ReservationId"),
      tenantId: seed.tenantId,
      inventoryItemId: seed.item.inventoryItemId,
      inventoryBalanceId: seed.balance.inventoryBalanceId,
      requestedQuantity: 2,
      externalRequestReference: "DOC-APPROVED",
      expectedBalanceVersion: createExpectedVersion(seed.balance.version),
      commandMetadata: commandMetadata(8),
      auditMetadata: auditMetadata(8),
    });

    const metrics = harness.services.slice4.foundation.referenceValidationService.getMetrics();
    expect(metrics.referenceValidationCount).toBeGreaterThanOrEqual(1);
    expect(metrics.referenceValidationFailureCount).toBe(0);
  });

  it("registers Slice 7 reference validation service in runtime service map", async () => {
    const dependencies = createDefaultInventoryRuntimeDependencies();
    const validatorRegistry = new InventoryReferenceValidatorRegistry();
    validatorRegistry.registerProductValidator(
      createStaticInventoryProductReferenceValidator({
        validatorId: "runtime-slice7-product-validator",
        validProducts: [createInventoryIdentifier("prd-01", "ProductReferenceId")],
      }),
    );

    const runtime = await createInventoryRuntime({
      runtimeId: "inventory-runtime-slice-7",
      dependencies,
      serviceRegistrationHooks: [
        createInventorySlice6ServiceRegistrationHook({
          validatorRegistry,
        }),
      ],
    });

    const serviceIds = runtime.services.list().map((service) => service.serviceId);
    expect(serviceIds.includes("inventory.service.reference-validation")).toBe(true);
    expect(serviceIds.some((id) => id.includes("http") || id.includes("persistence"))).toBe(false);
    await runtime.stop();
  });

  it("exposes bounded health and metric snapshots", async () => {
    const dependencies = createDefaultInventoryRuntimeDependencies();
    const registry = new InventoryReferenceValidatorRegistry();
    registry.registerProductValidator(
      createStaticInventoryProductReferenceValidator({
        validatorId: "metric-product-validator",
        validProducts: [createInventoryIdentifier("prd-01", "ProductReferenceId")],
      }),
    );

    const service = new InventoryReferenceService(registry, dependencies);
    const health = service.getHealth();
    const metrics = service.getMetrics();

    expect(health.requiredProductValidatorRegistered).toBe(true);
    expect(health.degraded).toBe(false);
    expect(metrics.referenceValidationCount).toBe(0);
    expect(metrics.referenceValidationFailureCount).toBe(0);
  });
});
