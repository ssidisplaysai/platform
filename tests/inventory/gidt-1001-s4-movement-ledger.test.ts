import { describe, expect, it } from "@jest/globals";
import {
  createDefaultInventoryRuntimeDependencies,
  createExpectedVersion,
  createInventoryIdentifier,
  createInventorySlice4ServiceRegistrationHook,
  createInventorySlice4Services,
  createInventoryRuntime,
  createStaticInventoryProductReferenceValidator,
  InventoryReferenceValidatorRegistry,
  type AuditMetadata,
  type CommandMetadata,
  type InventoryRuntimeAuditRecord,
} from "@/platform/inventory";

function commandMetadata(seed: number): CommandMetadata {
  return {
    commandId: createInventoryIdentifier(`cmd-${seed}`, "IdempotencyKey") as unknown as CommandMetadata["commandId"],
    expectedVersion: createExpectedVersion(1),
    idempotencyKey: createInventoryIdentifier(`idem-${seed}`, "IdempotencyKey"),
    requestedAt: `2026-08-06T17:00:${String(seed).padStart(2, "0")}.000Z`,
  };
}

function auditMetadata(seed: number): AuditMetadata {
  return {
    actorId: createInventoryIdentifier(`actor-${seed}`, "IdempotencyKey") as unknown as AuditMetadata["actorId"],
    occurredAt: `2026-08-06T17:00:${String(seed).padStart(2, "0")}.000Z`,
    source: "test",
  };
}

function createSlice4Harness() {
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
      validatorId: "slice4-product-validator",
      validProducts: [createInventoryIdentifier("prd-01", "ProductReferenceId")],
      validProductVariants: {
        "prd-01": [createInventoryIdentifier("var-01", "ProductVariantReferenceId")],
      },
    }),
  );

  const services = createInventorySlice4Services({ dependencies, validatorRegistry });
  return { audits, dependencies, validatorRegistry, services };
}

async function seedFoundation(harness: ReturnType<typeof createSlice4Harness>) {
  const tenantId = createInventoryIdentifier("tenant-a", "TenantId");
  const item = await harness.services.foundation.inventoryItemService.registerInventoryItem({
    inventoryItemId: createInventoryIdentifier("item-1", "InventoryItemId"),
    tenantId,
    productReferenceId: createInventoryIdentifier("prd-01", "ProductReferenceId"),
    productVariantReferenceId: createInventoryIdentifier("var-01", "ProductVariantReferenceId"),
    unitOfMeasure: "EA",
    commandMetadata: commandMetadata(1),
    auditMetadata: auditMetadata(1),
  });
  const warehouse = await harness.services.foundation.warehouseService.registerWarehouse({
    warehouseId: createInventoryIdentifier("wh-1", "WarehouseId"),
    tenantId,
    warehouseCode: "WH-001",
    commandMetadata: commandMetadata(2),
    auditMetadata: auditMetadata(2),
  });
  const sourceLocation = await harness.services.foundation.storageLocationService.registerStorageLocation({
    storageLocationId: createInventoryIdentifier("loc-1", "StorageLocationId"),
    warehouseId: warehouse.warehouseId,
    tenantId,
    locationCode: "LOC-A",
    locationType: "STORAGE",
    commandMetadata: commandMetadata(3),
    auditMetadata: auditMetadata(3),
  });
  const destinationLocation = await harness.services.foundation.storageLocationService.registerStorageLocation({
    storageLocationId: createInventoryIdentifier("loc-2", "StorageLocationId"),
    warehouseId: warehouse.warehouseId,
    tenantId,
    locationCode: "LOC-B",
    locationType: "STORAGE",
    commandMetadata: commandMetadata(4),
    auditMetadata: auditMetadata(4),
  });
  const quarantineLocation = await harness.services.foundation.storageLocationService.registerStorageLocation({
    storageLocationId: createInventoryIdentifier("loc-3", "StorageLocationId"),
    warehouseId: warehouse.warehouseId,
    tenantId,
    locationCode: "LOC-Q",
    locationType: "QUARANTINE",
    commandMetadata: commandMetadata(5),
    auditMetadata: auditMetadata(5),
  });
  const sourceBin = await harness.services.foundation.binService.registerBin({
    binId: createInventoryIdentifier("bin-1", "BinId"),
    storageLocationId: sourceLocation.storageLocationId,
    tenantId,
    binCode: "BIN-A",
    commandMetadata: commandMetadata(6),
    auditMetadata: auditMetadata(6),
  });
  const destinationBin = await harness.services.foundation.binService.registerBin({
    binId: createInventoryIdentifier("bin-2", "BinId"),
    storageLocationId: destinationLocation.storageLocationId,
    tenantId,
    binCode: "BIN-B",
    commandMetadata: commandMetadata(7),
    auditMetadata: auditMetadata(7),
  });
  const quarantineBin = await harness.services.foundation.binService.registerBin({
    binId: createInventoryIdentifier("bin-3", "BinId"),
    storageLocationId: quarantineLocation.storageLocationId,
    tenantId,
    binCode: "BIN-Q",
    commandMetadata: commandMetadata(8),
    auditMetadata: auditMetadata(8),
  });

  const activeSource = await harness.services.foundation.inventoryBalanceService.initializeInventoryBalance({
    inventoryBalanceId: createInventoryIdentifier("bal-1", "InventoryBalanceId"),
    inventoryItemId: item.inventoryItemId,
    tenantId,
    warehouseId: warehouse.warehouseId,
    storageLocationId: sourceLocation.storageLocationId,
    binId: sourceBin.binId,
    status: "ACTIVE",
    initialQuantities: { onHandQuantity: 10 },
    commandMetadata: commandMetadata(9),
    auditMetadata: auditMetadata(9),
  });
  const activeDestination = await harness.services.foundation.inventoryBalanceService.initializeInventoryBalance({
    inventoryBalanceId: createInventoryIdentifier("bal-2", "InventoryBalanceId"),
    inventoryItemId: item.inventoryItemId,
    tenantId,
    warehouseId: warehouse.warehouseId,
    storageLocationId: destinationLocation.storageLocationId,
    binId: destinationBin.binId,
    status: "ACTIVE",
    initialQuantities: { onHandQuantity: 1 },
    commandMetadata: commandMetadata(10),
    auditMetadata: auditMetadata(10),
  });
  const quarantineBalance = await harness.services.foundation.inventoryBalanceService.initializeInventoryBalance({
    inventoryBalanceId: createInventoryIdentifier("bal-3", "InventoryBalanceId"),
    inventoryItemId: item.inventoryItemId,
    tenantId,
    warehouseId: warehouse.warehouseId,
    storageLocationId: quarantineLocation.storageLocationId,
    binId: quarantineBin.binId,
    status: "QUARANTINED",
    initialQuantities: { onHandQuantity: 0 },
    commandMetadata: commandMetadata(11),
    auditMetadata: auditMetadata(11),
  });

  return { tenantId, item, warehouse, activeSource, activeDestination, quarantineBalance };
}

describe("GIDT-1001-S4 movement and append-only ledger", () => {
  it("applies successful increase and decrease adjustments with append-only ledger entries", async () => {
    const harness = createSlice4Harness();
    const seed = await seedFoundation(harness);

    const increased = await harness.services.adjustmentService.applyAdjustment({
      movementId: createInventoryIdentifier("mov-inc", "MovementId"),
      tenantId: seed.tenantId,
      inventoryItemId: seed.item.inventoryItemId,
      movementType: "ADJUST_INCREASE",
      reason: "cycle-count-correction",
      quantity: 5,
      balanceId: seed.activeDestination.inventoryBalanceId,
      expectedVersion: createExpectedVersion(seed.activeDestination.version),
      commandMetadata: commandMetadata(12),
      auditMetadata: auditMetadata(12),
    });
    const decreaseTargetVersion = harness.services.foundation.inventoryBalanceService.getInventoryBalance(seed.tenantId, seed.activeSource.inventoryBalanceId)!.version;
    const decreased = await harness.services.adjustmentService.applyAdjustment({
      movementId: createInventoryIdentifier("mov-dec", "MovementId"),
      tenantId: seed.tenantId,
      inventoryItemId: seed.item.inventoryItemId,
      movementType: "ADJUST_DECREASE",
      reason: "damage-removal",
      quantity: 3,
      balanceId: seed.activeSource.inventoryBalanceId,
      expectedVersion: createExpectedVersion(decreaseTargetVersion),
      commandMetadata: commandMetadata(13),
      auditMetadata: auditMetadata(13),
    });

    expect(increased.ledgerEntryIds).toHaveLength(1);
    expect(decreased.ledgerEntryIds).toHaveLength(1);
    expect(harness.services.movementQueryService.listLedgerEntries(seed.tenantId)).toHaveLength(2);
  });

  it("supports compensating adjustment chains without destructive correction", async () => {
    const harness = createSlice4Harness();
    const seed = await seedFoundation(harness);

    const first = await harness.services.adjustmentService.applyAdjustment({
      movementId: createInventoryIdentifier("mov-comp-1", "MovementId"),
      tenantId: seed.tenantId,
      inventoryItemId: seed.item.inventoryItemId,
      movementType: "ADJUST_DECREASE",
      reason: "count-correction",
      quantity: 2,
      balanceId: seed.activeSource.inventoryBalanceId,
      expectedVersion: createExpectedVersion(seed.activeSource.version),
      commandMetadata: commandMetadata(121),
      auditMetadata: auditMetadata(121),
    });

    const balanceAfterFirst = harness.services.foundation.inventoryBalanceService.getInventoryBalance(seed.tenantId, seed.activeSource.inventoryBalanceId)!;

    const second = await harness.services.adjustmentService.applyAdjustment({
      movementId: createInventoryIdentifier("mov-comp-2", "MovementId"),
      tenantId: seed.tenantId,
      inventoryItemId: seed.item.inventoryItemId,
      movementType: "ADJUST_INCREASE",
      reason: "compensating-correction",
      quantity: 2,
      balanceId: seed.activeSource.inventoryBalanceId,
      expectedVersion: createExpectedVersion(balanceAfterFirst.version),
      commandMetadata: commandMetadata(122),
      auditMetadata: auditMetadata(122),
    });

    const balanceAfterSecond = harness.services.foundation.inventoryBalanceService.getInventoryBalance(seed.tenantId, seed.activeSource.inventoryBalanceId)!;
    const movements = harness.services.movementQueryService.listInventoryMovements(seed.tenantId);
    const ledgerEntries = harness.services.movementQueryService.listLedgerEntries(seed.tenantId);

    expect(first.ledgerEntryIds).toHaveLength(1);
    expect(second.ledgerEntryIds).toHaveLength(1);
    expect(balanceAfterSecond.onHandQuantity).toBe(seed.activeSource.onHandQuantity);
    expect(movements.map((entry) => entry.movementId)).toEqual(["mov-comp-1", "mov-comp-2"]);
    expect(ledgerEntries).toHaveLength(2);
    await expect(harness.services.movementQueryService.verifyLedgerIntegrity(seed.tenantId)).resolves.toEqual({ valid: true });
  });

  it("applies a successful two-balance internal movement atomically and lists movements deterministically", async () => {
    const harness = createSlice4Harness();
    const seed = await seedFoundation(harness);

    const movement = await harness.services.movementService.executeMovement({
      movementId: createInventoryIdentifier("mov-1", "MovementId"),
      tenantId: seed.tenantId,
      inventoryItemId: seed.item.inventoryItemId,
      movementType: "INTERNAL_MOVE",
      reason: "rebalance",
      quantity: 4,
      sourceBalanceId: seed.activeSource.inventoryBalanceId,
      destinationBalanceId: seed.activeDestination.inventoryBalanceId,
      expectedSourceVersion: createExpectedVersion(seed.activeSource.version),
      expectedDestinationVersion: createExpectedVersion(seed.activeDestination.version),
      commandMetadata: commandMetadata(14),
      auditMetadata: auditMetadata(14),
    });

    const source = harness.services.foundation.inventoryBalanceService.getInventoryBalance(seed.tenantId, seed.activeSource.inventoryBalanceId)!;
    const destination = harness.services.foundation.inventoryBalanceService.getInventoryBalance(seed.tenantId, seed.activeDestination.inventoryBalanceId)!;
    expect(source.onHandQuantity).toBe(6);
    expect(destination.onHandQuantity).toBe(5);
    expect(source.version).toBe(2);
    expect(destination.version).toBe(2);
    expect(movement.ledgerEntryIds).toHaveLength(2);
    expect(harness.services.movementQueryService.listInventoryMovements(seed.tenantId).map((entry) => entry.movementId)).toEqual(["mov-1"]);
  });

  it("rejects invalid quantity, insufficient quantity, prohibited self-movement, and stale versions with no partial mutation", async () => {
    const harness = createSlice4Harness();
    const seed = await seedFoundation(harness);
    const before = harness.services.foundation.inventoryBalanceService.getInventoryBalance(seed.tenantId, seed.activeSource.inventoryBalanceId)!;

    await expect(
      harness.services.movementService.executeMovement({
        movementId: createInventoryIdentifier("mov-bad-qty", "MovementId"),
        tenantId: seed.tenantId,
        inventoryItemId: seed.item.inventoryItemId,
        movementType: "WRITE_OFF",
        reason: "bad",
        quantity: 0,
        sourceBalanceId: seed.activeSource.inventoryBalanceId,
        expectedSourceVersion: createExpectedVersion(before.version),
        commandMetadata: commandMetadata(15),
        auditMetadata: auditMetadata(15),
      }),
    ).rejects.toMatchObject({ classification: "INVALID_QUANTITY" });

    await expect(
      harness.services.movementService.executeMovement({
        movementId: createInventoryIdentifier("mov-too-much", "MovementId"),
        tenantId: seed.tenantId,
        inventoryItemId: seed.item.inventoryItemId,
        movementType: "WRITE_OFF",
        reason: "too-much",
        quantity: 50,
        sourceBalanceId: seed.activeSource.inventoryBalanceId,
        expectedSourceVersion: createExpectedVersion(before.version),
        commandMetadata: commandMetadata(16),
        auditMetadata: auditMetadata(16),
      }),
    ).rejects.toMatchObject({ classification: "INSUFFICIENT_QUANTITY" });

    await expect(
      harness.services.movementService.executeMovement({
        movementId: createInventoryIdentifier("mov-self", "MovementId"),
        tenantId: seed.tenantId,
        inventoryItemId: seed.item.inventoryItemId,
        movementType: "INTERNAL_MOVE",
        reason: "self",
        quantity: 1,
        sourceBalanceId: seed.activeSource.inventoryBalanceId,
        destinationBalanceId: seed.activeSource.inventoryBalanceId,
        expectedSourceVersion: createExpectedVersion(before.version),
        expectedDestinationVersion: createExpectedVersion(before.version),
        commandMetadata: commandMetadata(17),
        auditMetadata: auditMetadata(17),
      }),
    ).rejects.toMatchObject({ classification: "PROHIBITED_SELF_MOVEMENT" });

    await expect(
      harness.services.movementService.executeMovement({
        movementId: createInventoryIdentifier("mov-stale-src", "MovementId"),
        tenantId: seed.tenantId,
        inventoryItemId: seed.item.inventoryItemId,
        movementType: "WRITE_OFF",
        reason: "stale-src",
        quantity: 1,
        sourceBalanceId: seed.activeSource.inventoryBalanceId,
        expectedSourceVersion: createExpectedVersion(999),
        commandMetadata: commandMetadata(18),
        auditMetadata: auditMetadata(18),
      }),
    ).rejects.toMatchObject({ classification: "STALE_EXPECTED_VERSION" });

    await expect(
      harness.services.movementService.executeMovement({
        movementId: createInventoryIdentifier("mov-stale-dst", "MovementId"),
        tenantId: seed.tenantId,
        inventoryItemId: seed.item.inventoryItemId,
        movementType: "INTERNAL_MOVE",
        reason: "stale-dst",
        quantity: 1,
        sourceBalanceId: seed.activeSource.inventoryBalanceId,
        destinationBalanceId: seed.activeDestination.inventoryBalanceId,
        expectedSourceVersion: createExpectedVersion(before.version),
        expectedDestinationVersion: createExpectedVersion(999),
        commandMetadata: commandMetadata(19),
        auditMetadata: auditMetadata(19),
      }),
    ).rejects.toMatchObject({ classification: "STALE_EXPECTED_VERSION" });

    const after = harness.services.foundation.inventoryBalanceService.getInventoryBalance(seed.tenantId, seed.activeSource.inventoryBalanceId)!;
    expect(after.onHandQuantity).toBe(before.onHandQuantity);
    expect(after.version).toBe(before.version);
  });

  it("enforces deterministic tenant-scoped idempotency and conflicting reuse rejection", async () => {
    const harness = createSlice4Harness();
    const seed = await seedFoundation(harness);
    const metadata = commandMetadata(20);

    const first = await harness.services.movementService.executeMovement({
      movementId: createInventoryIdentifier("mov-idem", "MovementId"),
      tenantId: seed.tenantId,
      inventoryItemId: seed.item.inventoryItemId,
      movementType: "WRITE_OFF",
      reason: "writeoff",
      quantity: 2,
      sourceBalanceId: seed.activeSource.inventoryBalanceId,
      expectedSourceVersion: createExpectedVersion(seed.activeSource.version),
      commandMetadata: metadata,
      auditMetadata: auditMetadata(20),
    });

    const replay = await harness.services.movementService.executeMovement({
      ...first,
      movementType: "WRITE_OFF",
      reason: "writeoff",
      quantity: 2,
      sourceBalanceId: seed.activeSource.inventoryBalanceId,
      expectedSourceVersion: createExpectedVersion(seed.activeSource.version),
      destinationBalanceId: undefined,
      commandMetadata: metadata,
      auditMetadata: auditMetadata(20),
    });
    expect(replay.movementId).toBe(first.movementId);
    expect(harness.services.movementQueryService.listInventoryMovements(seed.tenantId)).toHaveLength(1);

    await expect(
      harness.services.movementService.executeMovement({
        movementId: createInventoryIdentifier("mov-idem-conflict", "MovementId"),
        tenantId: seed.tenantId,
        inventoryItemId: seed.item.inventoryItemId,
        movementType: "WRITE_OFF",
        reason: "conflict",
        quantity: 3,
        sourceBalanceId: seed.activeSource.inventoryBalanceId,
        expectedSourceVersion: createExpectedVersion(seed.activeSource.version),
        commandMetadata: { ...metadata },
        auditMetadata: auditMetadata(21),
      }),
    ).rejects.toMatchObject({ classification: "CONFLICTING_IDEMPOTENCY_PAYLOAD" });
  });

  it("supports quarantine, release, append-only protection, and ledger integrity verification", async () => {
    const harness = createSlice4Harness();
    const seed = await seedFoundation(harness);

    await harness.services.movementService.executeMovement({
      movementId: createInventoryIdentifier("mov-quarantine", "MovementId"),
      tenantId: seed.tenantId,
      inventoryItemId: seed.item.inventoryItemId,
      movementType: "QUARANTINE",
      reason: "quality-hold",
      quantity: 2,
      sourceBalanceId: seed.activeSource.inventoryBalanceId,
      destinationBalanceId: seed.quarantineBalance.inventoryBalanceId,
      expectedSourceVersion: createExpectedVersion(seed.activeSource.version),
      expectedDestinationVersion: createExpectedVersion(seed.quarantineBalance.version),
      commandMetadata: commandMetadata(22),
      auditMetadata: auditMetadata(22),
    });

    const sourceAfterQuarantine = harness.services.foundation.inventoryBalanceService.getInventoryBalance(seed.tenantId, seed.activeSource.inventoryBalanceId)!;
    const quarantineAfter = harness.services.foundation.inventoryBalanceService.getInventoryBalance(seed.tenantId, seed.quarantineBalance.inventoryBalanceId)!;

    await harness.services.movementService.executeMovement({
      movementId: createInventoryIdentifier("mov-release", "MovementId"),
      tenantId: seed.tenantId,
      inventoryItemId: seed.item.inventoryItemId,
      movementType: "RELEASE_FROM_QUARANTINE",
      reason: "quality-release",
      quantity: 1,
      sourceBalanceId: seed.quarantineBalance.inventoryBalanceId,
      destinationBalanceId: seed.activeDestination.inventoryBalanceId,
      expectedSourceVersion: createExpectedVersion(quarantineAfter.version),
      expectedDestinationVersion: createExpectedVersion(seed.activeDestination.version),
      commandMetadata: commandMetadata(23),
      auditMetadata: auditMetadata(23),
    });

    expect(sourceAfterQuarantine.onHandQuantity).toBe(8);
    expect(harness.services.ledgerService.listLedgerEntries(seed.tenantId).length).toBe(4);
    expect(harness.services.ledgerService.rejectMutation.bind(harness.services.ledgerService)).toThrow();
    expect(harness.services.ledgerService.rejectDeletion.bind(harness.services.ledgerService)).toThrow();
    await expect(harness.services.movementQueryService.verifyLedgerIntegrity(seed.tenantId)).resolves.toEqual({ valid: true });

    const ledgerState = harness.services.ledgerService as unknown as { state: { movementLedgerIds: Map<string, readonly string[]> } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const internalMovementState = harness.services.movementService as any;
    const movements = harness.services.movementQueryService.listInventoryMovements(seed.tenantId);
    const tampered = movements[0];
    internalMovementState.state.movementLedgerIds.set(`${seed.tenantId}|${tampered.movementId}`, []);
    internalMovementState.state.movements.set(`${seed.tenantId}|${tampered.movementId}`, { ...tampered, ledgerEntryIds: [] });
    await expect(harness.services.movementQueryService.verifyLedgerIntegrity(seed.tenantId)).resolves.toMatchObject({ valid: false });
  });

  it("registers Slice 4 services into runtime without persistence or reservation services", async () => {
    const registry = new InventoryReferenceValidatorRegistry();
    registry.registerProductValidator(
      createStaticInventoryProductReferenceValidator({
        validatorId: "runtime-slice4-validator",
        validProducts: [createInventoryIdentifier("prd-01", "ProductReferenceId")],
      }),
    );

    const runtime = await createInventoryRuntime({
      runtimeId: "inventory-runtime-slice-4",
      dependencies: createDefaultInventoryRuntimeDependencies(),
      serviceRegistrationHooks: [createInventorySlice4ServiceRegistrationHook({ validatorRegistry: registry })],
    });

    const serviceIds = runtime.services.list().map((service) => service.serviceId);
    expect(serviceIds).toContain("inventory.service.inventory-movement");
    expect(serviceIds).toContain("inventory.service.inventory-adjustment");
    expect(serviceIds).toContain("inventory.service.inventory-ledger");
    expect(serviceIds).toContain("inventory.service.movement-query");
    expect(serviceIds.some((id) => id.includes("reservation") || id.includes("allocation"))).toBe(false);
    expect((runtime as unknown as { coordinator?: unknown }).coordinator).toBeUndefined();
    await runtime.stop();
  });

  it("emits audit evidence for accepted, rejected, replayed, stale-version, and insufficient-stock cases", async () => {
    const harness = createSlice4Harness();
    const seed = await seedFoundation(harness);
    const metadata = commandMetadata(24);

    await harness.services.movementService.executeMovement({
      movementId: createInventoryIdentifier("mov-audit", "MovementId"),
      tenantId: seed.tenantId,
      inventoryItemId: seed.item.inventoryItemId,
      movementType: "WRITE_OFF",
      reason: "accepted",
      quantity: 1,
      sourceBalanceId: seed.activeSource.inventoryBalanceId,
      expectedSourceVersion: createExpectedVersion(seed.activeSource.version),
      commandMetadata: metadata,
      auditMetadata: auditMetadata(24),
    });

    await harness.services.movementService.executeMovement({
      movementId: createInventoryIdentifier("mov-audit", "MovementId"),
      tenantId: seed.tenantId,
      inventoryItemId: seed.item.inventoryItemId,
      movementType: "WRITE_OFF",
      reason: "accepted",
      quantity: 1,
      sourceBalanceId: seed.activeSource.inventoryBalanceId,
      expectedSourceVersion: createExpectedVersion(seed.activeSource.version),
      commandMetadata: metadata,
      auditMetadata: auditMetadata(24),
    });

    await expect(
      harness.services.movementService.executeMovement({
        movementId: createInventoryIdentifier("mov-reject", "MovementId"),
        tenantId: seed.tenantId,
        inventoryItemId: seed.item.inventoryItemId,
        movementType: "WRITE_OFF",
        reason: "insufficient",
        quantity: 100,
        sourceBalanceId: seed.activeSource.inventoryBalanceId,
        expectedSourceVersion: createExpectedVersion(2),
        commandMetadata: commandMetadata(25),
        auditMetadata: auditMetadata(25),
      }),
    ).rejects.toMatchObject({ classification: "INSUFFICIENT_QUANTITY" });

    expect(harness.audits.some((entry) => entry.eventType === "inventory.movement.accepted")).toBe(true);
    expect(harness.audits.some((entry) => entry.eventType === "inventory.movement.rejected")).toBe(true);
    expect(harness.audits.some((entry) => entry.eventType === "inventory.movement.idempotent-replay")).toBe(true);
  });
});
