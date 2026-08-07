import { describe, expect, it } from "@jest/globals";
import {
  createDefaultInventoryRuntimeDependencies,
  createExpectedVersion,
  createInventoryFoundationServiceRegistrationHook,
  createInventoryFoundationServices,
  createInventoryIdentifier,
  createInventoryRuntime,
  createStaticInventoryProductReferenceValidator,
  createVersionIdentifier,
  InventoryFoundationQueryService,
  InventoryReferenceService,
  InventoryReferenceValidatorRegistry,
  type AuditMetadata,
  type CommandMetadata,
  type InventoryLocationType,
  type InventoryRuntimeAuditRecord,
} from "@/platform/inventory";

function commandMetadata(seed: number): CommandMetadata {
  return {
    commandId: createInventoryIdentifier(`cmd-${seed}`, "IdempotencyKey") as unknown as CommandMetadata["commandId"],
    expectedVersion: createExpectedVersion(1),
    idempotencyKey: createInventoryIdentifier(`idem-${seed}`, "IdempotencyKey"),
    requestedAt: `2026-08-06T16:00:${String(seed).padStart(2, "0")}.000Z`,
  };
}

function auditMetadata(seed: number): AuditMetadata {
  return {
    actorId: createInventoryIdentifier(`actor-${seed}`, "IdempotencyKey") as unknown as AuditMetadata["actorId"],
    occurredAt: `2026-08-06T16:00:${String(seed).padStart(2, "0")}.000Z`,
    source: "test",
  };
}

function createFoundationHarness() {
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
      validatorId: "product-validator.test",
      validProducts: [createInventoryIdentifier("prd-01", "ProductReferenceId")],
      validProductVariants: {
        "prd-01": [createInventoryIdentifier("var-01", "ProductVariantReferenceId")],
      },
    }),
  );

  const services = createInventoryFoundationServices({ dependencies, validatorRegistry });
  const queries = new InventoryFoundationQueryService(services);
  return { audits, dependencies, validatorRegistry, services, queries };
}

describe("GIDT-1001-S3 Inventory foundation", () => {
  it("registers inventory items and lists them deterministically", async () => {
    const { services, queries } = createFoundationHarness();

    await services.inventoryItemService.registerInventoryItem({
      inventoryItemId: createInventoryIdentifier("item-b", "InventoryItemId"),
      tenantId: createInventoryIdentifier("tenant-a", "TenantId"),
      productReferenceId: createInventoryIdentifier("prd-01", "ProductReferenceId"),
      productVariantReferenceId: createInventoryIdentifier("var-01", "ProductVariantReferenceId"),
      unitOfMeasure: "EA",
      commandMetadata: commandMetadata(1),
      auditMetadata: auditMetadata(1),
    });

    await services.inventoryItemService.registerInventoryItem({
      inventoryItemId: createInventoryIdentifier("item-a", "InventoryItemId"),
      tenantId: createInventoryIdentifier("tenant-b", "TenantId"),
      productReferenceId: createInventoryIdentifier("prd-01", "ProductReferenceId"),
      productVariantReferenceId: createInventoryIdentifier("var-01", "ProductVariantReferenceId"),
      unitOfMeasure: "EA",
      commandMetadata: commandMetadata(2),
      auditMetadata: auditMetadata(2),
    });

    const items = queries.listInventoryItems(createInventoryIdentifier("tenant-a", "TenantId"));
    expect(items).toHaveLength(1);
    expect(items[0].inventoryItemId).toBe("item-b");
  });

  it("rejects invalid product references, duplicate identities, and duplicate product mappings", async () => {
    const { services, audits } = createFoundationHarness();
    const tenantId = createInventoryIdentifier("tenant-a", "TenantId");
    const itemId = createInventoryIdentifier("item-a", "InventoryItemId");
    const productReferenceId = createInventoryIdentifier("prd-01", "ProductReferenceId");

    await services.inventoryItemService.registerInventoryItem({
      inventoryItemId: itemId,
      tenantId,
      productReferenceId,
      productVariantReferenceId: createInventoryIdentifier("var-01", "ProductVariantReferenceId"),
      unitOfMeasure: "EA",
      commandMetadata: commandMetadata(3),
      auditMetadata: auditMetadata(3),
    });

    await expect(
      services.inventoryItemService.registerInventoryItem({
        inventoryItemId: createInventoryIdentifier("item-b", "InventoryItemId"),
        tenantId,
        productReferenceId: createInventoryIdentifier("prd-missing", "ProductReferenceId"),
        unitOfMeasure: "EA",
        commandMetadata: commandMetadata(4),
        auditMetadata: auditMetadata(4),
      }),
    ).rejects.toMatchObject({ classification: "INVALID_PRODUCT_REFERENCE" });

    await expect(
      services.inventoryItemService.registerInventoryItem({
        inventoryItemId: itemId,
        tenantId,
        productReferenceId: createInventoryIdentifier("prd-01", "ProductReferenceId"),
        productVariantReferenceId: createInventoryIdentifier("var-01", "ProductVariantReferenceId"),
        unitOfMeasure: "EA",
        commandMetadata: commandMetadata(5),
        auditMetadata: auditMetadata(5),
      }),
    ).rejects.toMatchObject({ classification: "DUPLICATE_INVENTORY_ITEM" });

    expect(audits.some((audit) => audit.eventType === "inventory.item.register.rejected")).toBe(true);
  });

  it("enforces immutable identity, lifecycle transitions, and tenant isolation on inventory items", async () => {
    const { services } = createFoundationHarness();
    const tenantId = createInventoryIdentifier("tenant-a", "TenantId");
    const created = await services.inventoryItemService.registerInventoryItem({
      inventoryItemId: createInventoryIdentifier("item-a", "InventoryItemId"),
      tenantId,
      productReferenceId: createInventoryIdentifier("prd-01", "ProductReferenceId"),
      productVariantReferenceId: createInventoryIdentifier("var-01", "ProductVariantReferenceId"),
      unitOfMeasure: "EA",
      commandMetadata: commandMetadata(6),
      auditMetadata: auditMetadata(6),
    });

    await expect(
      services.inventoryItemService.updateInventoryItemMetadata({
        tenantId,
        inventoryItemId: created.inventoryItemId,
        expectedVersion: createExpectedVersion(created.version),
        metadata: { tracked: true },
        publishedIdentifier: createInventoryIdentifier("other-id", "IdempotencyKey") as never,
        commandMetadata: commandMetadata(7),
      }),
    ).rejects.toMatchObject({ classification: "IMMUTABLE_IDENTITY_VIOLATION" });

    const transitioned = await services.inventoryItemService.transitionInventoryItemLifecycle({
      tenantId,
      inventoryItemId: created.inventoryItemId,
      nextLifecycleState: "ACTIVE",
      expectedVersion: createExpectedVersion(created.version),
      commandMetadata: commandMetadata(8),
    });
    expect(transitioned.lifecycleState).toBe("ACTIVE");

    expect(services.inventoryItemService.getInventoryItem(createInventoryIdentifier("tenant-b", "TenantId"), created.inventoryItemId)).toBeUndefined();
  });

  it("registers warehouses and enforces duplicate code and stale version rejection", async () => {
    const { services } = createFoundationHarness();
    const tenantId = createInventoryIdentifier("tenant-a", "TenantId");
    const created = await services.warehouseService.registerWarehouse({
      warehouseId: createInventoryIdentifier("wh-1", "WarehouseId"),
      tenantId,
      warehouseCode: "WH-001",
      commandMetadata: commandMetadata(9),
      auditMetadata: auditMetadata(9),
    });

    await expect(
      services.warehouseService.registerWarehouse({
        warehouseId: createInventoryIdentifier("wh-2", "WarehouseId"),
        tenantId,
        warehouseCode: "WH-001",
        commandMetadata: commandMetadata(10),
        auditMetadata: auditMetadata(10),
      }),
    ).rejects.toMatchObject({ classification: "DUPLICATE_WAREHOUSE_CODE" });

    await services.warehouseService.transitionWarehouseLifecycle({
      tenantId,
      warehouseId: created.warehouseId,
      nextStatus: "INACTIVE",
      expectedVersion: createExpectedVersion(created.version),
      commandMetadata: commandMetadata(11),
    });

    await expect(
      services.warehouseService.transitionWarehouseLifecycle({
        tenantId,
        warehouseId: created.warehouseId,
        nextStatus: "ACTIVE",
        expectedVersion: createExpectedVersion(created.version),
        commandMetadata: commandMetadata(12),
      }),
    ).rejects.toMatchObject({ classification: "STALE_EXPECTED_VERSION" });
  });

  it("registers locations with valid warehouse parent and rejects invalid parents and recursive containment", async () => {
    const { services, queries } = createFoundationHarness();
    const tenantId = createInventoryIdentifier("tenant-a", "TenantId");
    const warehouse = await services.warehouseService.registerWarehouse({
      warehouseId: createInventoryIdentifier("wh-1", "WarehouseId"),
      tenantId,
      warehouseCode: "WH-001",
      commandMetadata: commandMetadata(13),
      auditMetadata: auditMetadata(13),
    });

    const first = await services.storageLocationService.registerStorageLocation({
      storageLocationId: createInventoryIdentifier("loc-2", "StorageLocationId"),
      warehouseId: warehouse.warehouseId,
      tenantId,
      locationCode: "B-STORAGE",
      locationType: "STORAGE",
      commandMetadata: commandMetadata(14),
      auditMetadata: auditMetadata(14),
    });

    const second = await services.storageLocationService.registerStorageLocation({
      storageLocationId: createInventoryIdentifier("loc-1", "StorageLocationId"),
      warehouseId: warehouse.warehouseId,
      tenantId,
      locationCode: "A-RECV",
      locationType: "RECEIVING",
      parentLocationId: first.storageLocationId,
      commandMetadata: commandMetadata(15),
      auditMetadata: auditMetadata(15),
    });

    const listed = queries.listLocationsByWarehouse(tenantId, warehouse.warehouseId);
    expect(listed.map((location) => location.locationCode)).toEqual(["A-RECV", "B-STORAGE"]);

    await expect(
      services.storageLocationService.registerStorageLocation({
        storageLocationId: createInventoryIdentifier("loc-bad", "StorageLocationId"),
        warehouseId: createInventoryIdentifier("wh-missing", "WarehouseId"),
        tenantId,
        locationCode: "BAD",
        locationType: "STAGING",
        commandMetadata: commandMetadata(16),
        auditMetadata: auditMetadata(16),
      }),
    ).rejects.toMatchObject({ classification: "INVALID_WAREHOUSE" });

    await expect(
      services.storageLocationService.reparentStorageLocation({
        tenantId,
        storageLocationId: first.storageLocationId,
        parentLocationId: second.storageLocationId,
        expectedVersion: createExpectedVersion(first.version),
        commandMetadata: commandMetadata(17),
      }),
    ).rejects.toMatchObject({ classification: "RECURSIVE_CONTAINMENT_VIOLATION" });
  });

  it("rejects duplicate service registration when Slice 3 hooks collide", async () => {
    const registry = new InventoryReferenceValidatorRegistry();
    registry.registerProductValidator(
      createStaticInventoryProductReferenceValidator({
        validatorId: "duplicate-hook-validator",
        validProducts: [createInventoryIdentifier("prd-01", "ProductReferenceId")],
      }),
    );

    await expect(
      createInventoryRuntime({
        runtimeId: "inventory-runtime-slice-3-duplicate",
        dependencies: createDefaultInventoryRuntimeDependencies(),
        serviceRegistrationHooks: [
          createInventoryFoundationServiceRegistrationHook({
            validatorRegistry: registry,
            referenceValidationService: new InventoryReferenceService(registry, createDefaultInventoryRuntimeDependencies()),
            queryServiceFactory: (services) => new InventoryFoundationQueryService(services),
          }),
          ({ host }) => {
            host.registerService({
              serviceId: "inventory.service.inventory-item",
              contract: "inventory.service.inventory-item",
              description: "duplicate",
              value: {},
            });
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "DUPLICATE_SERVICE_REGISTRATION" });
  });

  it("registers bins and rejects invalid parents and duplicate bin code", async () => {
    const { services, queries } = createFoundationHarness();
    const tenantId = createInventoryIdentifier("tenant-a", "TenantId");
    const warehouse = await services.warehouseService.registerWarehouse({
      warehouseId: createInventoryIdentifier("wh-1", "WarehouseId"),
      tenantId,
      warehouseCode: "WH-001",
      commandMetadata: commandMetadata(18),
      auditMetadata: auditMetadata(18),
    });
    const location = await services.storageLocationService.registerStorageLocation({
      storageLocationId: createInventoryIdentifier("loc-1", "StorageLocationId"),
      warehouseId: warehouse.warehouseId,
      tenantId,
      locationCode: "LOC-1",
      locationType: "STORAGE",
      commandMetadata: commandMetadata(19),
      auditMetadata: auditMetadata(19),
    });

    await services.binService.registerBin({
      binId: createInventoryIdentifier("bin-2", "BinId"),
      storageLocationId: location.storageLocationId,
      tenantId,
      binCode: "B-02",
      commandMetadata: commandMetadata(20),
      auditMetadata: auditMetadata(20),
    });
    await services.binService.registerBin({
      binId: createInventoryIdentifier("bin-1", "BinId"),
      storageLocationId: location.storageLocationId,
      tenantId,
      binCode: "A-01",
      commandMetadata: commandMetadata(21),
      auditMetadata: auditMetadata(21),
    });

    expect(queries.listBinsByLocation(tenantId, location.storageLocationId).map((bin) => bin.binCode)).toEqual(["A-01", "B-02"]);

    await expect(
      services.binService.registerBin({
        binId: createInventoryIdentifier("bin-x", "BinId"),
        storageLocationId: createInventoryIdentifier("loc-missing", "StorageLocationId"),
        tenantId,
        binCode: "C-03",
        commandMetadata: commandMetadata(22),
        auditMetadata: auditMetadata(22),
      }),
    ).rejects.toMatchObject({ classification: "INVALID_LOCATION" });
  });

  it("initializes zero balances, enforces dimensional uniqueness, validates references, and exposes read-only queries", async () => {
    const { services, queries } = createFoundationHarness();
    const tenantId = createInventoryIdentifier("tenant-a", "TenantId");
    const item = await services.inventoryItemService.registerInventoryItem({
      inventoryItemId: createInventoryIdentifier("item-1", "InventoryItemId"),
      tenantId,
      productReferenceId: createInventoryIdentifier("prd-01", "ProductReferenceId"),
      productVariantReferenceId: createInventoryIdentifier("var-01", "ProductVariantReferenceId"),
      unitOfMeasure: "EA",
      commandMetadata: commandMetadata(23),
      auditMetadata: auditMetadata(23),
    });
    const warehouse = await services.warehouseService.registerWarehouse({
      warehouseId: createInventoryIdentifier("wh-1", "WarehouseId"),
      tenantId,
      warehouseCode: "WH-001",
      commandMetadata: commandMetadata(24),
      auditMetadata: auditMetadata(24),
    });
    const location = await services.storageLocationService.registerStorageLocation({
      storageLocationId: createInventoryIdentifier("loc-1", "StorageLocationId"),
      warehouseId: warehouse.warehouseId,
      tenantId,
      locationCode: "LOC-1",
      locationType: "STORAGE" as InventoryLocationType,
      commandMetadata: commandMetadata(25),
      auditMetadata: auditMetadata(25),
    });
    const bin = await services.binService.registerBin({
      binId: createInventoryIdentifier("bin-1", "BinId"),
      storageLocationId: location.storageLocationId,
      tenantId,
      binCode: "BIN-1",
      commandMetadata: commandMetadata(26),
      auditMetadata: auditMetadata(26),
    });

    const balance = await services.inventoryBalanceService.initializeInventoryBalance({
      inventoryBalanceId: createInventoryIdentifier("bal-1", "InventoryBalanceId"),
      inventoryItemId: item.inventoryItemId,
      tenantId,
      warehouseId: warehouse.warehouseId,
      storageLocationId: location.storageLocationId,
      binId: bin.binId,
      commandMetadata: commandMetadata(27),
      auditMetadata: auditMetadata(27),
    });
    expect(balance.onHandQuantity).toBe(0);
    expect(queries.getAvailability(tenantId, balance.inventoryBalanceId)).toBe(0);

    await expect(
      services.inventoryBalanceService.initializeInventoryBalance({
        inventoryBalanceId: createInventoryIdentifier("bal-2", "InventoryBalanceId"),
        inventoryItemId: item.inventoryItemId,
        tenantId,
        warehouseId: warehouse.warehouseId,
        storageLocationId: location.storageLocationId,
        binId: bin.binId,
        commandMetadata: commandMetadata(28),
        auditMetadata: auditMetadata(28),
      }),
    ).rejects.toMatchObject({ classification: "DUPLICATE_BALANCE" });

    await expect(
      services.inventoryBalanceService.initializeInventoryBalance({
        inventoryBalanceId: createInventoryIdentifier("bal-3", "InventoryBalanceId"),
        inventoryItemId: createInventoryIdentifier("item-missing", "InventoryItemId"),
        tenantId,
        warehouseId: warehouse.warehouseId,
        commandMetadata: commandMetadata(29),
        auditMetadata: auditMetadata(29),
      }),
    ).rejects.toMatchObject({ classification: "INVALID_REFERENCE" });

    await expect(
      services.inventoryBalanceService.initializeInventoryBalance({
        inventoryBalanceId: createInventoryIdentifier("bal-4", "InventoryBalanceId"),
        inventoryItemId: item.inventoryItemId,
        tenantId: createInventoryIdentifier("tenant-b", "TenantId"),
        warehouseId: warehouse.warehouseId,
        commandMetadata: commandMetadata(30),
        auditMetadata: auditMetadata(30),
      }),
    ).rejects.toMatchObject({ classification: "TENANT_ISOLATION_VIOLATION" });

    await expect(
      services.inventoryBalanceService.initializeInventoryBalance({
        inventoryBalanceId: createInventoryIdentifier("bal-5", "InventoryBalanceId"),
        inventoryItemId: item.inventoryItemId,
        tenantId,
        warehouseId: createInventoryIdentifier("wh-missing", "WarehouseId"),
        commandMetadata: commandMetadata(33),
        auditMetadata: auditMetadata(33),
      }),
    ).rejects.toMatchObject({ classification: "INVALID_WAREHOUSE" });

    const listed = queries.listBalancesByWarehouse(tenantId, warehouse.warehouseId);
    const mutated = listed[0];
    mutated.metadata = { hacked: true };
    expect(queries.getInventoryBalance(tenantId, balance.inventoryBalanceId)?.metadata).toEqual({});
  });

  it("registers Slice 3 services into runtime deterministically without persistence or later-slice services", async () => {
    const registry = new InventoryReferenceValidatorRegistry();
    registry.registerProductValidator(
      createStaticInventoryProductReferenceValidator({
        validatorId: "runtime-product-validator",
        validProducts: [createInventoryIdentifier("prd-01", "ProductReferenceId")],
      }),
    );

    const runtimeDependencies = createDefaultInventoryRuntimeDependencies();
    const runtime = await createInventoryRuntime({
      runtimeId: "inventory-runtime-slice-3",
      dependencies: runtimeDependencies,
      serviceRegistrationHooks: [
        createInventoryFoundationServiceRegistrationHook({
          validatorRegistry: registry,
          referenceValidationService: new InventoryReferenceService(registry, runtimeDependencies),
          queryServiceFactory: (services) => new InventoryFoundationQueryService(services),
        }),
      ],
    });

    const serviceIds = runtime.services.list().map((service) => service.serviceId);
    expect(serviceIds).toEqual([
      "inventory.runtime.audit-sink",
      "inventory.runtime.clock-provider",
      "inventory.runtime.dependencies",
      "inventory.runtime.identifier-provider",
      "inventory.runtime.metadata",
      "inventory.runtime.observation-sink",
      "inventory.runtime.platform-identifier",
      "inventory.runtime.tenant-context-provider",
      "inventory.service.bin",
      "inventory.service.foundation-query",
      "inventory.service.inventory-balance",
      "inventory.service.inventory-item",
      "inventory.service.reference-validation",
      "inventory.service.reference-validator-registry",
      "inventory.service.storage-location",
      "inventory.service.warehouse",
    ]);
    expect(serviceIds.some((id) => id.includes("movement") || id.includes("reservation") || id.includes("allocation"))).toBe(false);
    expect((runtime as unknown as { coordinator?: unknown }).coordinator).toBeUndefined();
    await runtime.stop();
  });

  it("emits stable audit evidence classifications for accepted and rejected actions", async () => {
    const { services, audits } = createFoundationHarness();
    const tenantId = createInventoryIdentifier("tenant-a", "TenantId");
    await services.warehouseService.registerWarehouse({
      warehouseId: createInventoryIdentifier("wh-a", "WarehouseId"),
      tenantId,
      warehouseCode: "WH-001",
      commandMetadata: commandMetadata(31),
      auditMetadata: auditMetadata(31),
    });

    expect(audits.some((entry) => entry.eventType === "inventory.warehouse.register.accepted")).toBe(true);

    await expect(
      services.inventoryItemService.registerInventoryItem({
        inventoryItemId: createInventoryIdentifier("item-z", "InventoryItemId"),
        tenantId,
        productReferenceId: createInventoryIdentifier("prd-missing", "ProductReferenceId"),
        unitOfMeasure: "EA",
        commandMetadata: commandMetadata(32),
        auditMetadata: auditMetadata(32),
      }),
    ).rejects.toMatchObject({ classification: "INVALID_PRODUCT_REFERENCE" });

    expect(audits.some((entry) => entry.eventType === "inventory.item.register.rejected")).toBe(true);
  });
});
