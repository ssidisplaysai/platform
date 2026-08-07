import { describe, expect, it } from "@jest/globals";
import {
  createDefaultInventoryRuntimeDependencies,
  createExpectedVersion,
  createInventoryIdentifier,
  createInventorySlice5ServiceRegistrationHook,
  createInventorySlice5Services,
  createInventoryRuntime,
  createStaticInventoryProductReferenceValidator,
  InventoryReferenceValidatorRegistry,
  type AuditMetadata,
  type CommandMetadata,
  type InventoryRuntimeAuditRecord,
} from "@/platform/inventory";

function commandMetadata(seed: number, idempotencyKey?: string): CommandMetadata {
  return {
    commandId: createInventoryIdentifier(`cmd-${seed}`, "IdempotencyKey") as unknown as CommandMetadata["commandId"],
    expectedVersion: createExpectedVersion(1),
    idempotencyKey: createInventoryIdentifier(idempotencyKey ?? `idem-${seed}`, "IdempotencyKey"),
    requestedAt: `2026-08-06T18:00:${String(seed).padStart(2, "0")}.000Z`,
  };
}

function auditMetadata(seed: number): AuditMetadata {
  return {
    actorId: createInventoryIdentifier(`actor-${seed}`, "IdempotencyKey") as unknown as AuditMetadata["actorId"],
    occurredAt: `2026-08-06T18:00:${String(seed).padStart(2, "0")}.000Z`,
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
      validatorId: "slice5-product-validator",
      validProducts: [createInventoryIdentifier("prd-01", "ProductReferenceId")],
      validProductVariants: {
        "prd-01": [createInventoryIdentifier("var-01", "ProductVariantReferenceId")],
      },
    }),
  );

  const services = createInventorySlice5Services({ dependencies, validatorRegistry });
  return { audits, services, validatorRegistry, dependencies };
}

async function seedFoundation(harness: ReturnType<typeof createSlice5Harness>) {
  const tenantId = createInventoryIdentifier("tenant-a", "TenantId");
  const item = await harness.services.slice4.foundation.inventoryItemService.registerInventoryItem({
    inventoryItemId: createInventoryIdentifier("item-1", "InventoryItemId"),
    tenantId,
    productReferenceId: createInventoryIdentifier("prd-01", "ProductReferenceId"),
    productVariantReferenceId: createInventoryIdentifier("var-01", "ProductVariantReferenceId"),
    unitOfMeasure: "EA",
    commandMetadata: commandMetadata(1),
    auditMetadata: auditMetadata(1),
  });
  const warehouse = await harness.services.slice4.foundation.warehouseService.registerWarehouse({
    warehouseId: createInventoryIdentifier("wh-1", "WarehouseId"),
    tenantId,
    warehouseCode: "WH-001",
    commandMetadata: commandMetadata(2),
    auditMetadata: auditMetadata(2),
  });
  const location = await harness.services.slice4.foundation.storageLocationService.registerStorageLocation({
    storageLocationId: createInventoryIdentifier("loc-1", "StorageLocationId"),
    warehouseId: warehouse.warehouseId,
    tenantId,
    locationCode: "LOC-A",
    locationType: "STORAGE",
    commandMetadata: commandMetadata(3),
    auditMetadata: auditMetadata(3),
  });
  const bin = await harness.services.slice4.foundation.binService.registerBin({
    binId: createInventoryIdentifier("bin-1", "BinId"),
    storageLocationId: location.storageLocationId,
    tenantId,
    binCode: "BIN-A",
    commandMetadata: commandMetadata(4),
    auditMetadata: auditMetadata(4),
  });

  const balance = await harness.services.slice4.foundation.inventoryBalanceService.initializeInventoryBalance({
    inventoryBalanceId: createInventoryIdentifier("bal-1", "InventoryBalanceId"),
    inventoryItemId: item.inventoryItemId,
    tenantId,
    warehouseId: warehouse.warehouseId,
    storageLocationId: location.storageLocationId,
    binId: bin.binId,
    initialQuantities: { onHandQuantity: 20 },
    commandMetadata: commandMetadata(5),
    auditMetadata: auditMetadata(5),
  });

  return { tenantId, item, warehouse, location, bin, balance };
}

describe("GIDT-1001-S5 reservation and allocation", () => {
  it("creates reservations, supports release/expiry, and lists deterministically", async () => {
    const harness = createSlice5Harness();
    const seed = await seedFoundation(harness);

    const reservation = await harness.services.reservationService.createReservation({
      reservationId: createInventoryIdentifier("res-1", "ReservationId"),
      tenantId: seed.tenantId,
      inventoryItemId: seed.item.inventoryItemId,
      inventoryBalanceId: seed.balance.inventoryBalanceId,
      requestedQuantity: 6,
      expectedBalanceVersion: createExpectedVersion(seed.balance.version),
      warehouseId: seed.warehouse.warehouseId,
      storageLocationId: seed.location.storageLocationId,
      commandMetadata: commandMetadata(6),
      auditMetadata: auditMetadata(6),
    });

    const afterCreate = harness.services.slice4.foundation.inventoryBalanceService.getInventoryBalance(seed.tenantId, seed.balance.inventoryBalanceId)!;
    expect(reservation.reservedQuantity).toBe(6);
    expect(afterCreate.reservedQuantity).toBe(6);

    const released = await harness.services.reservationService.releaseReservation({
      reservationId: reservation.reservationId,
      tenantId: seed.tenantId,
      quantity: 2,
      expectedReservationVersion: createExpectedVersion(reservation.version),
      expectedBalanceVersion: createExpectedVersion(afterCreate.version),
      commandMetadata: commandMetadata(7),
      auditMetadata: auditMetadata(7),
    });
    expect(released.status).toBe("PARTIALLY_RELEASED");
    expect(released.remainingQuantity).toBe(4);

    const afterRelease = harness.services.slice4.foundation.inventoryBalanceService.getInventoryBalance(seed.tenantId, seed.balance.inventoryBalanceId)!;
    const expired = await harness.services.reservationService.expireReservation({
      reservationId: reservation.reservationId,
      tenantId: seed.tenantId,
      expectedReservationVersion: createExpectedVersion(released.version),
      expectedBalanceVersion: createExpectedVersion(afterRelease.version),
      commandMetadata: commandMetadata(8),
      auditMetadata: auditMetadata(8),
    });

    expect(expired.status).toBe("EXPIRED");
    expect(expired.remainingQuantity).toBe(0);
    expect(harness.services.reservationQueryService.listReservations(seed.tenantId).map((entry) => entry.reservationId)).toEqual(["res-1"]);
    expect(harness.services.reservationQueryService.listExpiredReservations(seed.tenantId)).toHaveLength(1);
  });

  it("rejects over-reservation, stale balance version, and terminal reservation mutation", async () => {
    const harness = createSlice5Harness();
    const seed = await seedFoundation(harness);

    await expect(
      harness.services.reservationService.createReservation({
        reservationId: createInventoryIdentifier("res-over", "ReservationId"),
        tenantId: seed.tenantId,
        inventoryItemId: seed.item.inventoryItemId,
        inventoryBalanceId: seed.balance.inventoryBalanceId,
        requestedQuantity: 999,
        expectedBalanceVersion: createExpectedVersion(seed.balance.version),
        commandMetadata: commandMetadata(9),
        auditMetadata: auditMetadata(9),
      }),
    ).rejects.toMatchObject({ classification: "OVER_RESERVATION" });

    await expect(
      harness.services.reservationService.createReservation({
        reservationId: createInventoryIdentifier("res-stale", "ReservationId"),
        tenantId: seed.tenantId,
        inventoryItemId: seed.item.inventoryItemId,
        inventoryBalanceId: seed.balance.inventoryBalanceId,
        requestedQuantity: 1,
        expectedBalanceVersion: createExpectedVersion(999),
        commandMetadata: commandMetadata(10),
        auditMetadata: auditMetadata(10),
      }),
    ).rejects.toMatchObject({ classification: "STALE_BALANCE_VERSION" });

    const created = await harness.services.reservationService.createReservation({
      reservationId: createInventoryIdentifier("res-terminal", "ReservationId"),
      tenantId: seed.tenantId,
      inventoryItemId: seed.item.inventoryItemId,
      inventoryBalanceId: seed.balance.inventoryBalanceId,
      requestedQuantity: 2,
      expectedBalanceVersion: createExpectedVersion(seed.balance.version),
      commandMetadata: commandMetadata(11),
      auditMetadata: auditMetadata(11),
    });
    const balanceAfter = harness.services.slice4.foundation.inventoryBalanceService.getInventoryBalance(seed.tenantId, seed.balance.inventoryBalanceId)!;
    const expired = await harness.services.reservationService.expireReservation({
      reservationId: created.reservationId,
      tenantId: seed.tenantId,
      expectedReservationVersion: createExpectedVersion(created.version),
      expectedBalanceVersion: createExpectedVersion(balanceAfter.version),
      commandMetadata: commandMetadata(12),
      auditMetadata: auditMetadata(12),
    });

    await expect(
      harness.services.reservationService.releaseReservation({
        reservationId: expired.reservationId,
        tenantId: seed.tenantId,
        expectedReservationVersion: createExpectedVersion(expired.version),
        expectedBalanceVersion: createExpectedVersion(
          harness.services.slice4.foundation.inventoryBalanceService.getInventoryBalance(seed.tenantId, seed.balance.inventoryBalanceId)!.version,
        ),
        commandMetadata: commandMetadata(13),
        auditMetadata: auditMetadata(13),
      }),
    ).rejects.toMatchObject({ classification: "EXPIRED_RESERVATION" });
  });

  it("creates allocations, supports release, and rejects insufficient allocatable quantity", async () => {
    const harness = createSlice5Harness();
    const seed = await seedFoundation(harness);

    const allocation = await harness.services.allocationService.createAllocation({
      allocationId: createInventoryIdentifier("all-1", "AllocationId"),
      tenantId: seed.tenantId,
      inventoryItemId: seed.item.inventoryItemId,
      inventoryBalanceId: seed.balance.inventoryBalanceId,
      requestedQuantity: 5,
      expectedBalanceVersion: createExpectedVersion(seed.balance.version),
      commandMetadata: commandMetadata(14),
      auditMetadata: auditMetadata(14),
    });

    expect(allocation.allocatedQuantity).toBe(5);

    const balanceAfterCreate = harness.services.slice4.foundation.inventoryBalanceService.getInventoryBalance(seed.tenantId, seed.balance.inventoryBalanceId)!;
    const released = await harness.services.allocationService.releaseAllocation({
      allocationId: allocation.allocationId,
      tenantId: seed.tenantId,
      quantity: 2,
      expectedAllocationVersion: createExpectedVersion(allocation.version),
      expectedBalanceVersion: createExpectedVersion(balanceAfterCreate.version),
      commandMetadata: commandMetadata(15),
      auditMetadata: auditMetadata(15),
    });

    expect(released.status).toBe("PARTIALLY_RELEASED");
    expect(released.remainingQuantity).toBe(3);

    await expect(
      harness.services.allocationService.createAllocation({
        allocationId: createInventoryIdentifier("all-over", "AllocationId"),
        tenantId: seed.tenantId,
        inventoryItemId: seed.item.inventoryItemId,
        inventoryBalanceId: seed.balance.inventoryBalanceId,
        requestedQuantity: 500,
        expectedBalanceVersion: createExpectedVersion(
          harness.services.slice4.foundation.inventoryBalanceService.getInventoryBalance(seed.tenantId, seed.balance.inventoryBalanceId)!.version,
        ),
        commandMetadata: commandMetadata(16),
        auditMetadata: auditMetadata(16),
      }),
    ).rejects.toMatchObject({ classification: "OVER_ALLOCATION" });
  });

  it("converts reservation to allocation atomically and rejects stale/oversized conversion", async () => {
    const harness = createSlice5Harness();
    const seed = await seedFoundation(harness);

    const reservation = await harness.services.reservationService.createReservation({
      reservationId: createInventoryIdentifier("res-conv", "ReservationId"),
      tenantId: seed.tenantId,
      inventoryItemId: seed.item.inventoryItemId,
      inventoryBalanceId: seed.balance.inventoryBalanceId,
      requestedQuantity: 8,
      expectedBalanceVersion: createExpectedVersion(seed.balance.version),
      commandMetadata: commandMetadata(17),
      auditMetadata: auditMetadata(17),
    });

    const balanceAfterReservation = harness.services.slice4.foundation.inventoryBalanceService.getInventoryBalance(seed.tenantId, seed.balance.inventoryBalanceId)!;

    await expect(
      harness.services.allocationService.convertReservationToAllocation({
        allocationId: createInventoryIdentifier("all-too-much", "AllocationId"),
        reservationId: reservation.reservationId,
        tenantId: seed.tenantId,
        inventoryItemId: seed.item.inventoryItemId,
        inventoryBalanceId: seed.balance.inventoryBalanceId,
        quantity: 9,
        expectedReservationVersion: createExpectedVersion(reservation.version),
        expectedBalanceVersion: createExpectedVersion(balanceAfterReservation.version),
        commandMetadata: commandMetadata(18),
        auditMetadata: auditMetadata(18),
      }),
    ).rejects.toMatchObject({ classification: "INVALID_CONVERSION_QUANTITY" });

    const beforeFailedBalance = harness.services.slice4.foundation.inventoryBalanceService.getInventoryBalance(seed.tenantId, seed.balance.inventoryBalanceId)!;
    expect(beforeFailedBalance.reservedQuantity).toBe(8);
    expect(beforeFailedBalance.allocatedQuantity).toBe(0);

    const allocation = await harness.services.allocationService.convertReservationToAllocation({
      allocationId: createInventoryIdentifier("all-conv", "AllocationId"),
      reservationId: reservation.reservationId,
      tenantId: seed.tenantId,
      inventoryItemId: seed.item.inventoryItemId,
      inventoryBalanceId: seed.balance.inventoryBalanceId,
      quantity: 3,
      expectedReservationVersion: createExpectedVersion(reservation.version),
      expectedBalanceVersion: createExpectedVersion(balanceAfterReservation.version),
      commandMetadata: commandMetadata(19),
      auditMetadata: auditMetadata(19),
    });

    expect(allocation.allocatedQuantity).toBe(3);
    const reservationAfter = harness.services.reservationQueryService.getReservation(seed.tenantId, reservation.reservationId)!;
    expect(reservationAfter.remainingQuantity).toBe(5);

    const balanceAfter = harness.services.slice4.foundation.inventoryBalanceService.getInventoryBalance(seed.tenantId, seed.balance.inventoryBalanceId)!;
    expect(balanceAfter.reservedQuantity).toBe(5);
    expect(balanceAfter.allocatedQuantity).toBe(3);

    await expect(
      harness.services.allocationService.convertReservationToAllocation({
        allocationId: createInventoryIdentifier("all-stale", "AllocationId"),
        reservationId: reservation.reservationId,
        tenantId: seed.tenantId,
        inventoryItemId: seed.item.inventoryItemId,
        inventoryBalanceId: seed.balance.inventoryBalanceId,
        quantity: 1,
        expectedReservationVersion: createExpectedVersion(reservation.version),
        expectedBalanceVersion: createExpectedVersion(balanceAfter.version),
        commandMetadata: commandMetadata(20),
        auditMetadata: auditMetadata(20),
      }),
    ).rejects.toMatchObject({ classification: "STALE_RESERVATION_VERSION" });
  });

  it("enforces tenant-scoped idempotency and deterministic conflicting-payload rejection", async () => {
    const harness = createSlice5Harness();
    const seed = await seedFoundation(harness);

    const sameKey = "idem-shared-1";
    const created = await harness.services.reservationService.createReservation({
      reservationId: createInventoryIdentifier("res-idem", "ReservationId"),
      tenantId: seed.tenantId,
      inventoryItemId: seed.item.inventoryItemId,
      inventoryBalanceId: seed.balance.inventoryBalanceId,
      requestedQuantity: 4,
      expectedBalanceVersion: createExpectedVersion(seed.balance.version),
      commandMetadata: commandMetadata(21, sameKey),
      auditMetadata: auditMetadata(21),
    });

    const replay = await harness.services.reservationService.createReservation({
      reservationId: createInventoryIdentifier("res-idem", "ReservationId"),
      tenantId: seed.tenantId,
      inventoryItemId: seed.item.inventoryItemId,
      inventoryBalanceId: seed.balance.inventoryBalanceId,
      requestedQuantity: 4,
      expectedBalanceVersion: createExpectedVersion(seed.balance.version),
      commandMetadata: commandMetadata(22, sameKey),
      auditMetadata: auditMetadata(22),
    });

    expect(replay.reservationId).toBe(created.reservationId);
    expect(harness.services.reservationQueryService.listReservations(seed.tenantId)).toHaveLength(1);

    await expect(
      harness.services.reservationService.createReservation({
        reservationId: createInventoryIdentifier("res-idem-other", "ReservationId"),
        tenantId: seed.tenantId,
        inventoryItemId: seed.item.inventoryItemId,
        inventoryBalanceId: seed.balance.inventoryBalanceId,
        requestedQuantity: 3,
        expectedBalanceVersion: createExpectedVersion(seed.balance.version),
        commandMetadata: commandMetadata(23, sameKey),
        auditMetadata: auditMetadata(23),
      }),
    ).rejects.toMatchObject({ classification: "CONFLICTING_IDEMPOTENCY_PAYLOAD" });
  });

  it("prevents over-reserve and over-allocate races via optimistic concurrency classification", async () => {
    const harness = createSlice5Harness();
    const seed = await seedFoundation(harness);

    await harness.services.reservationService.createReservation({
      reservationId: createInventoryIdentifier("res-race-a", "ReservationId"),
      tenantId: seed.tenantId,
      inventoryItemId: seed.item.inventoryItemId,
      inventoryBalanceId: seed.balance.inventoryBalanceId,
      requestedQuantity: 10,
      expectedBalanceVersion: createExpectedVersion(seed.balance.version),
      commandMetadata: commandMetadata(24),
      auditMetadata: auditMetadata(24),
    });

    await expect(
      harness.services.reservationService.createReservation({
        reservationId: createInventoryIdentifier("res-race-b", "ReservationId"),
        tenantId: seed.tenantId,
        inventoryItemId: seed.item.inventoryItemId,
        inventoryBalanceId: seed.balance.inventoryBalanceId,
        requestedQuantity: 11,
        expectedBalanceVersion: createExpectedVersion(seed.balance.version),
        commandMetadata: commandMetadata(25),
        auditMetadata: auditMetadata(25),
      }),
    ).rejects.toMatchObject({ classification: "STALE_BALANCE_VERSION" });

    const latestBalance = harness.services.slice4.foundation.inventoryBalanceService.getInventoryBalance(seed.tenantId, seed.balance.inventoryBalanceId)!;
    await harness.services.allocationService.createAllocation({
      allocationId: createInventoryIdentifier("all-race-a", "AllocationId"),
      tenantId: seed.tenantId,
      inventoryItemId: seed.item.inventoryItemId,
      inventoryBalanceId: seed.balance.inventoryBalanceId,
      requestedQuantity: 5,
      expectedBalanceVersion: createExpectedVersion(latestBalance.version),
      commandMetadata: commandMetadata(26),
      auditMetadata: auditMetadata(26),
    });

    await expect(
      harness.services.allocationService.createAllocation({
        allocationId: createInventoryIdentifier("all-race-b", "AllocationId"),
        tenantId: seed.tenantId,
        inventoryItemId: seed.item.inventoryItemId,
        inventoryBalanceId: seed.balance.inventoryBalanceId,
        requestedQuantity: 1,
        expectedBalanceVersion: createExpectedVersion(latestBalance.version),
        commandMetadata: commandMetadata(27),
        auditMetadata: auditMetadata(27),
      }),
    ).rejects.toMatchObject({ classification: "STALE_BALANCE_VERSION" });
  });

  it("registers Slice 5 runtime services deterministically without persistence or Slice 6 services", async () => {
    const registry = new InventoryReferenceValidatorRegistry();
    registry.registerProductValidator(
      createStaticInventoryProductReferenceValidator({
        validatorId: "runtime-s5-product-validator",
        validProducts: [createInventoryIdentifier("prd-01", "ProductReferenceId")],
      }),
    );

    const runtime = await createInventoryRuntime({
      runtimeId: "inventory-runtime-s5-test",
      dependencies: createDefaultInventoryRuntimeDependencies(),
      serviceRegistrationHooks: [createInventorySlice5ServiceRegistrationHook({ validatorRegistry: registry })],
    });

    const serviceIds = runtime.snapshot().state.serviceIds;
    expect(serviceIds).toContain("inventory.service.reservation");
    expect(serviceIds).toContain("inventory.service.allocation");
    expect(serviceIds).toContain("inventory.service.reservation-query");
    expect(serviceIds).toContain("inventory.service.allocation-query");
    expect(serviceIds.some((id) => id.includes("slice-6") || id.includes("persistence") || id.includes("lot") || id.includes("serial"))).toBe(false);

    await runtime.stop();
  });

  it("emits audit evidence for accepted, rejected, replayed, and stale-version outcomes", async () => {
    const harness = createSlice5Harness();
    const seed = await seedFoundation(harness);

    await harness.services.reservationService.createReservation({
      reservationId: createInventoryIdentifier("res-audit", "ReservationId"),
      tenantId: seed.tenantId,
      inventoryItemId: seed.item.inventoryItemId,
      inventoryBalanceId: seed.balance.inventoryBalanceId,
      requestedQuantity: 3,
      expectedBalanceVersion: createExpectedVersion(seed.balance.version),
      commandMetadata: commandMetadata(28, "idem-audit-1"),
      auditMetadata: auditMetadata(28),
    });

    await harness.services.reservationService.createReservation({
      reservationId: createInventoryIdentifier("res-audit", "ReservationId"),
      tenantId: seed.tenantId,
      inventoryItemId: seed.item.inventoryItemId,
      inventoryBalanceId: seed.balance.inventoryBalanceId,
      requestedQuantity: 3,
      expectedBalanceVersion: createExpectedVersion(seed.balance.version),
      commandMetadata: commandMetadata(29, "idem-audit-1"),
      auditMetadata: auditMetadata(29),
    });

    await expect(
      harness.services.reservationService.createReservation({
        reservationId: createInventoryIdentifier("res-audit-fail", "ReservationId"),
        tenantId: seed.tenantId,
        inventoryItemId: seed.item.inventoryItemId,
        inventoryBalanceId: seed.balance.inventoryBalanceId,
        requestedQuantity: 1,
        expectedBalanceVersion: createExpectedVersion(seed.balance.version),
        commandMetadata: commandMetadata(30, "idem-audit-1"),
        auditMetadata: auditMetadata(30),
      }),
    ).rejects.toMatchObject({ classification: "CONFLICTING_IDEMPOTENCY_PAYLOAD" });

    await expect(
      harness.services.reservationService.createReservation({
        reservationId: createInventoryIdentifier("res-audit-stale", "ReservationId"),
        tenantId: seed.tenantId,
        inventoryItemId: seed.item.inventoryItemId,
        inventoryBalanceId: seed.balance.inventoryBalanceId,
        requestedQuantity: 1,
        expectedBalanceVersion: createExpectedVersion(seed.balance.version),
        commandMetadata: commandMetadata(31),
        auditMetadata: auditMetadata(31),
      }),
    ).rejects.toMatchObject({ classification: "STALE_BALANCE_VERSION" });

    const eventTypes = harness.audits.map((audit) => audit.eventType);
    expect(eventTypes).toContain("inventory.reservation.created");
    expect(eventTypes).toContain("inventory.idempotency.replay");
    expect(eventTypes).toContain("inventory.reservation.rejected");
  });
});
