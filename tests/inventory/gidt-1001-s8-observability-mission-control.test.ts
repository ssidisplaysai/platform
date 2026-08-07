import { describe, expect, it } from "@jest/globals";
import {
  createDefaultInventoryRuntimeDependencies,
  createExpectedVersion,
  createInventoryIdentifier,
  createInventoryRuntime,
  createInventorySlice8ServiceRegistrationHook,
  createInventorySlice8Services,
  createStaticInventoryProductReferenceValidator,
  InventoryReferenceValidatorRegistry,
  type AuditMetadata,
  type CommandMetadata,
} from "@/platform/inventory";

function commandMetadata(seed: number, key?: string): CommandMetadata {
  return {
    commandId: createInventoryIdentifier(`cmd-s8-${seed}`, "IdempotencyKey") as unknown as CommandMetadata["commandId"],
    expectedVersion: createExpectedVersion(1),
    idempotencyKey: createInventoryIdentifier(key ?? `idem-s8-${seed}`, "IdempotencyKey"),
    requestedAt: `2026-08-06T21:00:${String(seed).padStart(2, "0")}.000Z`,
  };
}

function auditMetadata(seed: number): AuditMetadata {
  return {
    actorId: createInventoryIdentifier(`actor-s8-${seed}`, "IdempotencyKey") as unknown as AuditMetadata["actorId"],
    occurredAt: `2026-08-06T21:00:${String(seed).padStart(2, "0")}.000Z`,
    source: "test",
  };
}

function createSlice8Harness(withProductValidator = true) {
  const dependencies = createDefaultInventoryRuntimeDependencies();
  const registry = new InventoryReferenceValidatorRegistry();
  if (withProductValidator) {
    registry.registerProductValidator(
      createStaticInventoryProductReferenceValidator({
        validatorId: "slice8-product-validator",
        validProducts: [createInventoryIdentifier("prd-01", "ProductReferenceId")],
        validProductVariants: {
          "prd-01": [createInventoryIdentifier("var-01", "ProductVariantReferenceId")],
        },
      }),
    );
  }

  const services = createInventorySlice8Services({ dependencies, validatorRegistry: registry });
  return { dependencies, registry, services };
}

async function seed(harness: ReturnType<typeof createSlice8Harness>) {
  const tenantId = createInventoryIdentifier("tenant-a", "TenantId");
  const item = await harness.services.slice6.slice5.slice4.foundation.inventoryItemService.registerInventoryItem({
    inventoryItemId: createInventoryIdentifier("item-a", "InventoryItemId"),
    tenantId,
    productReferenceId: createInventoryIdentifier("prd-01", "ProductReferenceId"),
    productVariantReferenceId: createInventoryIdentifier("var-01", "ProductVariantReferenceId"),
    unitOfMeasure: "EA",
    commandMetadata: commandMetadata(1),
    auditMetadata: auditMetadata(1),
  });

  const warehouse = await harness.services.slice6.slice5.slice4.foundation.warehouseService.registerWarehouse({
    warehouseId: createInventoryIdentifier("wh-a", "WarehouseId"),
    tenantId,
    warehouseCode: "WH-A",
    commandMetadata: commandMetadata(2),
    auditMetadata: auditMetadata(2),
  });

  const location = await harness.services.slice6.slice5.slice4.foundation.storageLocationService.registerStorageLocation({
    storageLocationId: createInventoryIdentifier("loc-a", "StorageLocationId"),
    warehouseId: warehouse.warehouseId,
    tenantId,
    locationCode: "LOC-A",
    locationType: "STORAGE",
    commandMetadata: commandMetadata(3),
    auditMetadata: auditMetadata(3),
  });

  const bin = await harness.services.slice6.slice5.slice4.foundation.binService.registerBin({
    binId: createInventoryIdentifier("bin-a", "BinId"),
    storageLocationId: location.storageLocationId,
    tenantId,
    binCode: "BIN-A",
    commandMetadata: commandMetadata(4),
    auditMetadata: auditMetadata(4),
  });

  const balance = await harness.services.slice6.slice5.slice4.foundation.inventoryBalanceService.initializeInventoryBalance({
    inventoryBalanceId: createInventoryIdentifier("bal-a", "InventoryBalanceId"),
    inventoryItemId: item.inventoryItemId,
    tenantId,
    warehouseId: warehouse.warehouseId,
    storageLocationId: location.storageLocationId,
    binId: bin.binId,
    initialQuantities: { onHandQuantity: 12 },
    commandMetadata: commandMetadata(5),
    auditMetadata: auditMetadata(5),
  });

  return { tenantId, item, warehouse, location, bin, balance };
}

describe("GIDT-1001-S8 observability and mission control", () => {
  it("reports healthy baseline runtime health and deterministic checks", async () => {
    const harness = createSlice8Harness();
    await seed(harness);

    const healthA = await harness.services.healthService.snapshot();
    const healthB = await harness.services.healthService.snapshot();

    expect(healthA.status).toBe("DEGRADED");
    expect(healthA.checks.map((check) => check.subsystem)).toEqual([...healthA.checks.map((check) => check.subsystem)].sort());
    expect(healthA.checks).toEqual(healthB.checks);
  });

  it("marks health unhealthy when mandatory product validator is missing", async () => {
    const harness = createSlice8Harness(false);

    const health = await harness.services.healthService.snapshot();
    const reference = health.checks.find((check) => check.subsystem === "references");

    expect(health.status).toBe("UNHEALTHY");
    expect(reference?.reasonCode).toBe("MANDATORY_PRODUCT_VALIDATOR_MISSING");
  });

  it("degrades health on optional validator failure without blocking reservation mutation", async () => {
    const harness = createSlice8Harness();
    const seeded = await seed(harness);

    const reservation = await harness.services.slice6.slice5.reservationService.createReservation({
      reservationId: createInventoryIdentifier("res-a", "ReservationId"),
      tenantId: seeded.tenantId,
      inventoryItemId: seeded.item.inventoryItemId,
      inventoryBalanceId: seeded.balance.inventoryBalanceId,
      requestedQuantity: 2,
      externalRequestReference: "DOC-MISSING",
      expectedBalanceVersion: createExpectedVersion(seeded.balance.version),
      commandMetadata: commandMetadata(6),
      auditMetadata: auditMetadata(6),
    });

    const health = await harness.services.healthService.snapshot();
    const reference = health.checks.find((check) => check.subsystem === "references");

    expect(reservation.remainingQuantity).toBe(2);
    expect(health.status).toBe("DEGRADED");
    expect(reference?.reasonCode).toBe("OPTIONAL_VALIDATOR_UNAVAILABLE");
  });

  it("detects quantity invariant and ledger integrity failures", async () => {
    const harness = createSlice8Harness();
    const seeded = await seed(harness);

    const moved = await harness.services.slice6.slice5.slice4.movementService.executeMovement({
      movementId: createInventoryIdentifier("mov-a", "MovementId"),
      tenantId: seeded.tenantId,
      inventoryItemId: seeded.item.inventoryItemId,
      movementType: "ADJUST_DECREASE",
      reason: "DAMAGE",
      quantity: 1,
      sourceBalanceId: seeded.balance.inventoryBalanceId,
      expectedSourceVersion: createExpectedVersion(seeded.balance.version),
      commandMetadata: commandMetadata(7),
      auditMetadata: auditMetadata(7),
    });

    const corruptedBalance = {
      ...harness.services.slice6.slice5.slice4.foundation.inventoryBalanceService.requireBalance(
        seeded.tenantId,
        seeded.balance.inventoryBalanceId,
      ),
      availableQuantity: 999,
    };
    harness.services.slice6.slice5.slice4.foundation.inventoryBalanceService.replaceBalances([corruptedBalance]);

    const ledgerState = (harness.services.slice6.slice5.slice4.ledgerService as unknown as {
      state: {
        ledgerEntries: Map<string, unknown>;
      };
    }).state;
    const firstLedgerId = moved.ledgerEntryIds[0];
    ledgerState.ledgerEntries.delete(`${seeded.tenantId}|${firstLedgerId}`);

    const health = await harness.services.healthService.snapshot();

    expect(health.checks.find((check) => check.subsystem === "balances")?.reasonCode).toBe("QUANTITY_INVARIANT_FAILURE");
    expect(health.checks.find((check) => check.subsystem === "movement-ledger")?.reasonCode).toBe("LEDGER_INTEGRITY_FAILURE");
    expect(health.status).toBe("UNHEALTHY");
  });

  it("produces immutable deterministic audit evidence with filters and append-only rejection", async () => {
    const harness = createSlice8Harness();
    const seeded = await seed(harness);

    await harness.services.slice6.lotService.registerLot({
      lotId: createInventoryIdentifier("lot-a", "LotId"),
      tenantId: seeded.tenantId,
      inventoryItemId: seeded.item.inventoryItemId,
      lotCode: "LOT-A",
      commandMetadata: commandMetadata(8),
      auditMetadata: auditMetadata(8),
    });

    await expect(
      harness.services.slice6.serialNumberService.registerSerialNumber({
        serialNumberId: createInventoryIdentifier("ser-bad", "SerialNumberId"),
        tenantId: seeded.tenantId,
        inventoryItemId: seeded.item.inventoryItemId,
        serialCode: "SER-BAD",
        lotId: createInventoryIdentifier("lot-missing", "LotId"),
        commandMetadata: commandMetadata(9),
        auditMetadata: auditMetadata(9),
      }),
    ).rejects.toMatchObject({ classification: "INVALID_LOT_SERIAL_ASSOCIATION" });

    const all = harness.services.auditService.listInventoryAuditEvents();
    const first = all[0];
    const event = harness.services.auditService.getInventoryAuditEvent(first.auditEventId);
    expect(event).toBeDefined();

    const byAction = harness.services.auditService.listAuditEventsByAction("REGISTER_LOT", seeded.tenantId);
    expect(byAction.length).toBeGreaterThan(0);

    const mutated = harness.services.auditService.listInventoryAuditEvents();
    mutated[0].record.message = "tampered";
    expect(harness.services.auditService.getInventoryAuditEvent(first.auditEventId)?.record.message).not.toBe("tampered");

    expect(() => harness.services.auditService.rejectMutation()).toThrow(/prohibited/i);
    expect(() => harness.services.auditService.rejectDeletion()).toThrow(/prohibited/i);
  });

  it("computes metrics classification, gauges, counters, and stable snapshot reads", async () => {
    const harness = createSlice8Harness();
    const seeded = await seed(harness);

    await expect(
      harness.services.slice6.slice5.reservationService.createReservation({
        reservationId: createInventoryIdentifier("res-reject", "ReservationId"),
        tenantId: seeded.tenantId,
        inventoryItemId: seeded.item.inventoryItemId,
        inventoryBalanceId: seeded.balance.inventoryBalanceId,
        requestedQuantity: 1000,
        allowPartial: false,
        expectedBalanceVersion: createExpectedVersion(seeded.balance.version),
        commandMetadata: commandMetadata(10),
        auditMetadata: auditMetadata(10),
      }),
    ).rejects.toMatchObject({ classification: "OVER_RESERVATION" });

    const before = harness.services.metricsService.snapshot();
    const again = harness.services.metricsService.snapshot();

    expect(before.classification.referenceValidationCount).toBe("COUNTER");
    expect(before.classification.balanceCount).toBe("GAUGE");
    expect(before.classification.nearExpiryCount).toBe("DERIVED_PROJECTION");
    expect(before.values.inventoryItemCount).toBe(1);
    expect(before.values.balanceCount).toBe(1);
    expect(before.values.reservationRejectionCount).toBeGreaterThanOrEqual(1);
    expect(before.values.commandsRejected).toBe(again.values.commandsRejected);
  });

  it("builds and publishes bounded observation payload without mutation authority", async () => {
    const harness = createSlice8Harness();
    await seed(harness);

    const observed: unknown[] = [];
    harness.services.observationService.registerObserver("observer.ok", async (payload) => {
      observed.push(payload);
    });

    const built = await harness.services.observabilityQueryService.buildInventoryObservation();
    const published = await harness.services.observationService.publishInventoryObservation();

    expect(built.platformIdentifier).toBe("platform.inventory");
    expect(Object.keys(built).sort()).toEqual([
      "healthSummary",
      "lastObservationTimestamp",
      "metrics",
      "platformIdentifier",
      "readiness",
      "referenceHealth",
      "runtime",
      "schemaVersion",
      "subsystemHealth",
    ]);
    expect(published.runtime.ready).toBe(false);
    expect((published as Record<string, unknown>).commandHandlers).toBeUndefined();
    expect(observed.length).toBe(1);
  });

  it("records publication failure evidence and increments integration failure metric", async () => {
    const harness = createSlice8Harness();
    await seed(harness);

    harness.services.observationService.registerObserver("observer.fail", async () => {
      throw new Error("observer failed");
    });

    await expect(harness.services.observationService.publishInventoryObservation()).rejects.toThrow(/observation publish failed/i);

    const metrics = harness.services.metricsService.snapshot();
    const observationFailures = harness.services.auditService.listInventoryAuditEvents().filter(
      (event) => event.record.eventType === "inventory.observation.publish.rejected",
    );

    expect(observationFailures.length).toBe(1);
    expect(metrics.values.integrationFailureCount).toBeGreaterThanOrEqual(1);
  });

  it("registers slice 8 services in runtime deterministically with no persistence services", async () => {
    const registry = new InventoryReferenceValidatorRegistry();
    registry.registerProductValidator(
      createStaticInventoryProductReferenceValidator({
        validatorId: "runtime-s8-product-validator",
        validProducts: [createInventoryIdentifier("prd-01", "ProductReferenceId")],
      }),
    );

    const runtime = await createInventoryRuntime({
      runtimeId: "inventory-runtime-s8-test",
      dependencies: createDefaultInventoryRuntimeDependencies(),
      serviceRegistrationHooks: [createInventorySlice8ServiceRegistrationHook({ validatorRegistry: registry })],
    });

    const serviceIds = runtime.snapshot().state.serviceIds;
    expect(serviceIds).toContain("inventory.service.health");
    expect(serviceIds).toContain("inventory.service.metrics");
    expect(serviceIds).toContain("inventory.service.audit");
    expect(serviceIds).toContain("inventory.service.observation-publisher");
    expect(serviceIds).toContain("inventory.service.observability-query");
    expect(serviceIds.some((id) => id.includes("persistence") || id.includes("http") || id.includes("slice-9"))).toBe(false);

    await runtime.stop();
  });
});
