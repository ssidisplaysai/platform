import { mkdtempSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";
import {
  createDefaultInventoryRuntimeDependencies,
  createExpectedVersion,
  createInventoryIdentifier,
  createInventoryRuntime,
  createInventorySlice9ServiceRegistrationHook,
  createStaticInventoryProductReferenceValidator,
  InventoryReferenceValidatorRegistry,
  type AuditMetadata,
  type CommandMetadata,
  type InventoryRuntime,
} from "@/platform/inventory";

function commandMetadata(seed: number, key?: string): CommandMetadata {
  return {
    commandId: createInventoryIdentifier(`cmd-s9-${seed}`, "IdempotencyKey") as unknown as CommandMetadata["commandId"],
    expectedVersion: createExpectedVersion(1),
    idempotencyKey: createInventoryIdentifier(key ?? `idem-s9-${seed}`, "IdempotencyKey"),
    requestedAt: `2026-08-06T22:00:${String(seed).padStart(2, "0")}.000Z`,
  };
}

function auditMetadata(seed: number): AuditMetadata {
  return {
    actorId: createInventoryIdentifier(`actor-s9-${seed}`, "IdempotencyKey") as unknown as AuditMetadata["actorId"],
    occurredAt: `2026-08-06T22:00:${String(seed).padStart(2, "0")}.000Z`,
    source: "test",
  };
}

function tenantPartitionPath(rootDir: string, tenantId: string): string {
  return join(rootDir, "tenants", `${Buffer.from(tenantId.trim(), "utf8").toString("hex")}.json`);
}

async function readPersistedTenant(rootDir: string, tenantId: string): Promise<any> {
  return JSON.parse(await readFile(tenantPartitionPath(rootDir, tenantId), "utf8"));
}

async function writePersistedTenant(rootDir: string, tenantId: string, value: unknown): Promise<void> {
  await writeFile(tenantPartitionPath(rootDir, tenantId), JSON.stringify(value, null, 2), "utf8");
}

async function writePersistedManifest(rootDir: string, value: unknown): Promise<void> {
  await writeFile(join(rootDir, "inventory-manifest.json"), JSON.stringify(value, null, 2), "utf8");
}

async function cleanupPath(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true }).catch(() => undefined);
}

function createHarness(rootDir: string) {
  const dependencies = createDefaultInventoryRuntimeDependencies();
  const validatorRegistry = new InventoryReferenceValidatorRegistry();
  validatorRegistry.registerProductValidator(
    createStaticInventoryProductReferenceValidator({
      validatorId: "slice9-product-validator",
      validProducts: [createInventoryIdentifier("prd-01", "ProductReferenceId")],
      validProductVariants: {
        "prd-01": [createInventoryIdentifier("var-01", "ProductVariantReferenceId")],
      },
    }),
  );

  return {
    dependencies,
    validatorRegistry,
    async createRuntime() {
      return createInventoryRuntime({
        runtimeId: "inventory-runtime-s9",
        dependencies,
        serviceRegistrationHooks: [
          createInventorySlice9ServiceRegistrationHook({
            rootDir,
            validatorRegistry,
          }),
        ],
      });
    },
  };
}

function getService(runtime: InventoryRuntime, serviceId: string): any {
  return runtime.services.require(serviceId).value;
}

async function seedCoreInventory(runtime: InventoryRuntime) {
  const tenantId = createInventoryIdentifier("tenant-a", "TenantId");
  const inventoryItemService = getService(runtime, "inventory.service.inventory-item");
  const warehouseService = getService(runtime, "inventory.service.warehouse");
  const locationService = getService(runtime, "inventory.service.storage-location");
  const binService = getService(runtime, "inventory.service.bin");
  const balanceService = getService(runtime, "inventory.service.inventory-balance");

  const item = await inventoryItemService.registerInventoryItem({
    inventoryItemId: createInventoryIdentifier("item-a", "InventoryItemId"),
    tenantId,
    productReferenceId: createInventoryIdentifier("prd-01", "ProductReferenceId"),
    productVariantReferenceId: createInventoryIdentifier("var-01", "ProductVariantReferenceId"),
    unitOfMeasure: "EA",
    commandMetadata: commandMetadata(1),
    auditMetadata: auditMetadata(1),
  });

  const warehouse = await warehouseService.registerWarehouse({
    warehouseId: createInventoryIdentifier("wh-a", "WarehouseId"),
    tenantId,
    warehouseCode: "WH-A",
    commandMetadata: commandMetadata(2),
    auditMetadata: auditMetadata(2),
  });

  const location = await locationService.registerStorageLocation({
    storageLocationId: createInventoryIdentifier("loc-a", "StorageLocationId"),
    warehouseId: warehouse.warehouseId,
    tenantId,
    locationCode: "LOC-A",
    locationType: "STORAGE",
    commandMetadata: commandMetadata(3),
    auditMetadata: auditMetadata(3),
  });

  const bin = await binService.registerBin({
    binId: createInventoryIdentifier("bin-a", "BinId"),
    storageLocationId: location.storageLocationId,
    tenantId,
    binCode: "BIN-A",
    commandMetadata: commandMetadata(4),
    auditMetadata: auditMetadata(4),
  });

  const balance = await balanceService.initializeInventoryBalance({
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

async function seedRichInventory(runtime: InventoryRuntime) {
  const seeded = await seedCoreInventory(runtime);
  const reservationService = getService(runtime, "inventory.service.reservation");
  const movementService = getService(runtime, "inventory.service.inventory-movement");
  const lotService = getService(runtime, "inventory.service.lot");
  const serialService = getService(runtime, "inventory.service.serial-number");
  const expirationService = getService(runtime, "inventory.service.expiration");

  const reservation = await reservationService.createReservation({
    reservationId: createInventoryIdentifier("res-a", "ReservationId"),
    tenantId: seeded.tenantId,
    inventoryItemId: seeded.item.inventoryItemId,
    inventoryBalanceId: seeded.balance.inventoryBalanceId,
    requestedQuantity: 2,
    expectedBalanceVersion: createExpectedVersion(seeded.balance.version),
    commandMetadata: commandMetadata(6, "idem-reservation-replay"),
    auditMetadata: auditMetadata(6),
  });

  const refreshedBalance = getService(runtime, "inventory.service.inventory-balance").getInventoryBalance(
    seeded.tenantId,
    seeded.balance.inventoryBalanceId,
  ) ?? seeded.balance;

  const movement = await movementService.executeMovement({
    movementId: createInventoryIdentifier("mov-a", "MovementId"),
    tenantId: seeded.tenantId,
    inventoryItemId: seeded.item.inventoryItemId,
    movementType: "ADJUST_DECREASE",
    reason: "DAMAGE",
    quantity: 1,
    sourceBalanceId: seeded.balance.inventoryBalanceId,
    expectedSourceVersion: createExpectedVersion(refreshedBalance.version),
    commandMetadata: commandMetadata(7, "idem-movement-a"),
    auditMetadata: auditMetadata(7),
  });

  const lot = await lotService.registerLot({
    lotId: createInventoryIdentifier("lot-a", "LotId"),
    tenantId: seeded.tenantId,
    inventoryItemId: seeded.item.inventoryItemId,
    lotCode: "LOT-A",
    commandMetadata: commandMetadata(8),
    auditMetadata: auditMetadata(8),
  });

  const serial = await serialService.registerSerialNumber({
    serialNumberId: createInventoryIdentifier("ser-a", "SerialNumberId"),
    tenantId: seeded.tenantId,
    inventoryItemId: seeded.item.inventoryItemId,
    serialCode: "SER-A",
    inventoryBalanceId: seeded.balance.inventoryBalanceId,
    lotId: lot.lotId,
    commandMetadata: commandMetadata(9),
    auditMetadata: auditMetadata(9),
  });

  const expiration = await expirationService.evaluateExpiration({
    expirationRecordId: createInventoryIdentifier("exp-a", "ExpirationRecordId"),
    tenantId: seeded.tenantId,
    inventoryItemId: seeded.item.inventoryItemId,
    lotId: lot.lotId,
    expirationDate: "2026-08-07T00:00:00.000Z",
    commandMetadata: commandMetadata(10),
    auditMetadata: auditMetadata(10),
  });

  return {
    ...seeded,
    reservation,
    movement,
    lot,
    serial,
    expiration,
  };
}

async function loadPersistence(runtime: InventoryRuntime) {
  return getService(runtime, "inventory.service.persistence") as {
    getMetrics(): Record<string, number>;
    getStatus(): { lastLoadStatus: string; lastRecoveryStatus: string; corruptionDetected: boolean };
    fileStore?: { saveAll(envelope: unknown): Promise<void> };
  };
}

describe("GIDT-1001-S9 durable persistence and deterministic recovery", () => {
  it("marks first-run recovery explicitly when no persisted state exists", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "inventory-first-run-"));
    try {
      const runtime = await createHarness(rootDir).createRuntime();
      const persistence = await loadPersistence(runtime);

      expect(persistence.getStatus().lastLoadStatus).toBe("FIRST_RUN");
      expect(persistence.getStatus().lastRecoveryStatus).toBe("SUCCESS");
      expect(runtime.snapshot().state.ready).toBe(true);
      await runtime.stop();
    } finally {
      void rootDir;
    }
  });

  it("round-trips inventory state across restart", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "inventory-persistence-"));
    try {
      const harness = createHarness(rootDir);
      const runtime = await harness.createRuntime();
      const seeded = await seedCoreInventory(runtime);
      const persistence = await loadPersistence(runtime);

      expect(persistence.getMetrics().persistenceWriteCount).toBeGreaterThan(0);
      expect(persistence.getStatus().lastLoadStatus).toBe("FIRST_RUN");
      await runtime.stop();

      const restarted = await harness.createRuntime();
      const restartedItemService = getService(restarted, "inventory.service.inventory-item");
      const restartedBalanceService = getService(restarted, "inventory.service.inventory-balance");
      const restartedPersistence = await loadPersistence(restarted);

      expect(restartedItemService.listInventoryItems(seeded.tenantId)).toHaveLength(1);
      expect(restartedBalanceService.listInventoryBalances(seeded.tenantId)).toHaveLength(1);
      expect(restartedPersistence.getMetrics().persistenceLoadCount).toBeGreaterThan(0);
      expect(restartedPersistence.getMetrics().recoveryCount).toBeGreaterThan(0);
      await restarted.stop();

      const manifest = JSON.parse(await readFile(join(rootDir, "inventory-manifest.json"), "utf8")) as {
        manifest: { tenantIds: string[] };
      };
      expect(manifest.manifest.tenantIds).toEqual([seeded.tenantId]);
    } finally {
      await cleanupPath(rootDir);
    }
  });

  it("rebuilds projections and metrics deterministically after restart", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "inventory-metrics-"));
    try {
      const harness = createHarness(rootDir);
      const runtime = await harness.createRuntime();
      const seeded = await seedRichInventory(runtime);
      const metricsService = getService(runtime, "inventory.service.metrics") as { snapshot(): { values: Record<string, number> } };
      const before = metricsService.snapshot();
      await runtime.stop();

      const restarted = await harness.createRuntime();
      const restartedMetricsService = getService(restarted, "inventory.service.metrics") as { snapshot(): { values: Record<string, number> } };
      const after = restartedMetricsService.snapshot();

      expect(after.values).toEqual(before.values);
      expect(after.values.movementCount).toBeGreaterThan(0);
      expect(after.values.referenceValidationCount).toBeGreaterThan(0);
      expect(after.values.ledgerEntryCount).toBeGreaterThan(0);
      await restarted.stop();

      const manifest = JSON.parse(await readFile(join(rootDir, "inventory-manifest.json"), "utf8")) as {
        manifest: { tenantIds: string[] };
      };
      expect(manifest.manifest.tenantIds).toEqual([seeded.tenantId]);
    } finally {
      await cleanupPath(rootDir);
    }
  });

  it("rejects malformed JSON, unsupported schema, and invalid top-level shape", async () => {
    const malformedRoot = mkdtempSync(join(tmpdir(), "inventory-malformed-"));
    const unsupportedRoot = mkdtempSync(join(tmpdir(), "inventory-unsupported-"));
    const invalidShapeRoot = mkdtempSync(join(tmpdir(), "inventory-invalid-shape-"));
    try {
      await writeFile(join(malformedRoot, "inventory-manifest.json"), "{not-json", "utf8");
      await writePersistedManifest(unsupportedRoot, {
        manifest: {
          schemaVersion: "9.9.9",
          runtimeId: "inventory-runtime-s9",
          tenantIds: [],
        },
        tenants: [],
      });
      await writePersistedManifest(invalidShapeRoot, {
        manifest: null,
        tenants: {},
      });

      await expect(createHarness(malformedRoot).createRuntime()).rejects.toThrow(/valid JSON|persisted inventory envelope/i);
      await expect(createHarness(unsupportedRoot).createRuntime()).rejects.toThrow(/unsupported schema version/i);
      await expect(createHarness(invalidShapeRoot).createRuntime()).rejects.toThrow(/persisted inventory manifest is invalid|persisted inventory tenants are invalid/i);
    } finally {
      await rm(malformedRoot, { recursive: true, force: true });
      await rm(unsupportedRoot, { recursive: true, force: true });
      await rm(invalidShapeRoot, { recursive: true, force: true });
    }
  });

  it("preserves the prior committed state when a durable write fails", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "inventory-write-failure-"));
    try {
      const harness = createHarness(rootDir);
      const runtime = await harness.createRuntime();
      const seeded = await seedCoreInventory(runtime);
      const persistence = await loadPersistence(runtime);

      if (!persistence.fileStore) {
        throw new Error("expected inventory persistence file store to be available");
      }

      const originalSaveAll = persistence.fileStore.saveAll.bind(persistence.fileStore);
      persistence.fileStore.saveAll = async () => {
        throw new Error("simulated durable write failure");
      };

      const inventoryItemService = getService(runtime, "inventory.service.inventory-item") as {
        transitionInventoryItemLifecycle(input: Record<string, unknown>): Promise<unknown>;
      };

      await expect(
        inventoryItemService.transitionInventoryItemLifecycle({
          tenantId: seeded.tenantId,
          inventoryItemId: seeded.item.inventoryItemId,
          nextLifecycleState: "ACTIVE",
          expectedVersion: createExpectedVersion(seeded.item.version),
          commandMetadata: commandMetadata(11),
        }),
      ).rejects.toThrow(/simulated durable write failure/i);

      persistence.fileStore.saveAll = originalSaveAll;
      await runtime.stop();

      const restarted = await harness.createRuntime();
      const restartedItemService = getService(restarted, "inventory.service.inventory-item") as {
        getInventoryItem(tenantId: string, inventoryItemId: string): { lifecycleState: string; version: number } | undefined;
      };

      expect(restartedItemService.getInventoryItem(seeded.tenantId, seeded.item.inventoryItemId)?.lifecycleState).toBe("DRAFT");
      expect(restartedItemService.getInventoryItem(seeded.tenantId, seeded.item.inventoryItemId)?.version).toBe(1);
      await restarted.stop();
    } finally {
      void rootDir;
    }
  });

  it("replays idempotent writes across restart and rejects conflicting payloads", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "inventory-idempotency-"));
    try {
      const harness = createHarness(rootDir);
      const runtime = await harness.createRuntime();
      const seeded = await seedCoreInventory(runtime);
      const reservationService = getService(runtime, "inventory.service.reservation") as {
        createReservation(input: Record<string, unknown>): Promise<{ reservationId: string; remainingQuantity: number }>;
        listReservations(tenantId: string): Array<{ reservationId: string }>;
      };

      const reservation = await reservationService.createReservation({
        reservationId: createInventoryIdentifier("res-idem", "ReservationId"),
        tenantId: seeded.tenantId,
        inventoryItemId: seeded.item.inventoryItemId,
        inventoryBalanceId: seeded.balance.inventoryBalanceId,
        requestedQuantity: 2,
        expectedBalanceVersion: createExpectedVersion(seeded.balance.version),
        commandMetadata: commandMetadata(12, "idem-reservation-replay"),
        auditMetadata: auditMetadata(12),
      });
      expect(reservation.remainingQuantity).toBe(2);
      await runtime.stop();

      const restarted = await harness.createRuntime();
      const restartedReservationService = getService(restarted, "inventory.service.reservation") as {
        createReservation(input: Record<string, unknown>): Promise<{ reservationId: string; remainingQuantity: number }>;
        listReservations(tenantId: string): Array<{ reservationId: string }>;
      };

      const replay = await restartedReservationService.createReservation({
        reservationId: createInventoryIdentifier("res-idem", "ReservationId"),
        tenantId: seeded.tenantId,
        inventoryItemId: seeded.item.inventoryItemId,
        inventoryBalanceId: seeded.balance.inventoryBalanceId,
        requestedQuantity: 2,
        expectedBalanceVersion: createExpectedVersion(seeded.balance.version),
        commandMetadata: commandMetadata(12, "idem-reservation-replay"),
        auditMetadata: auditMetadata(12),
      });
      expect(replay.reservationId).toBe(reservation.reservationId);
      expect(restartedReservationService.listReservations(seeded.tenantId)).toHaveLength(1);

      await expect(
        restartedReservationService.createReservation({
          reservationId: createInventoryIdentifier("res-idem-conflict", "ReservationId"),
          tenantId: seeded.tenantId,
          inventoryItemId: seeded.item.inventoryItemId,
          inventoryBalanceId: seeded.balance.inventoryBalanceId,
          requestedQuantity: 3,
          expectedBalanceVersion: createExpectedVersion(seeded.balance.version),
          commandMetadata: commandMetadata(12, "idem-reservation-replay"),
          auditMetadata: auditMetadata(12),
        }),
      ).rejects.toThrow(/conflicting idempotency payload/i);

      await restarted.stop();
    } finally {
      await cleanupPath(rootDir);
    }
  });

  it("preserves versions across restart and rejects stale writes after recovery", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "inventory-version-"));
    try {
      const harness = createHarness(rootDir);
      const runtime = await harness.createRuntime();
      const seeded = await seedCoreInventory(runtime);
      const inventoryItemService = getService(runtime, "inventory.service.inventory-item") as {
        transitionInventoryItemLifecycle(input: Record<string, unknown>): Promise<{ inventoryItemId: string; version: number; lifecycleState: string }>;
        getInventoryItem(tenantId: string, inventoryItemId: string): { version: number; lifecycleState: string } | undefined;
      };

      const transitioned = await inventoryItemService.transitionInventoryItemLifecycle({
        tenantId: seeded.tenantId,
        inventoryItemId: seeded.item.inventoryItemId,
        nextLifecycleState: "ACTIVE",
        expectedVersion: createExpectedVersion(seeded.item.version),
        commandMetadata: commandMetadata(13),
      });
      expect(transitioned.version).toBe(2);
      await runtime.stop();

      const restarted = await harness.createRuntime();
      const restartedItemService = getService(restarted, "inventory.service.inventory-item") as {
        getInventoryItem(tenantId: string, inventoryItemId: string): { version: number; lifecycleState: string } | undefined;
        transitionInventoryItemLifecycle(input: Record<string, unknown>): Promise<unknown>;
      };

      expect(restartedItemService.getInventoryItem(seeded.tenantId, seeded.item.inventoryItemId)?.version).toBe(2);
      await expect(
        restartedItemService.transitionInventoryItemLifecycle({
          tenantId: seeded.tenantId,
          inventoryItemId: seeded.item.inventoryItemId,
          nextLifecycleState: "RETIRED",
          expectedVersion: createExpectedVersion(1),
          commandMetadata: commandMetadata(14),
        }),
      ).rejects.toThrow(/stale expected version/i);

      await restarted.stop();
    } finally {
      await cleanupPath(rootDir);
    }
  });

  it("preserves movement and ledger durability across restart and rejects duplicate ledger state", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "inventory-ledger-"));
    try {
      const harness = createHarness(rootDir);
      const runtime = await harness.createRuntime();
      const seeded = await seedRichInventory(runtime);
      const movementQueryService = getService(runtime, "inventory.service.movement-query") as {
        listInventoryMovements(tenantId: string): Array<{ movementId: string }>;
        listLedgerEntries(tenantId: string): Array<{ ledgerEntryId: string }>;
        verifyLedgerIntegrity(tenantId: string): Promise<{ valid: true } | { valid: false; reason: string }>;
      };

      expect((await movementQueryService.verifyLedgerIntegrity(seeded.tenantId)).valid).toBe(true);
      expect(movementQueryService.listInventoryMovements(seeded.tenantId)).toHaveLength(1);
      expect(movementQueryService.listLedgerEntries(seeded.tenantId)).toHaveLength(1);
      await runtime.stop();

      const restarted = await harness.createRuntime();
      const restartedMovementQueryService = getService(restarted, "inventory.service.movement-query") as {
        listInventoryMovements(tenantId: string): Array<{ movementId: string }>;
        listLedgerEntries(tenantId: string): Array<{ ledgerEntryId: string }>;
        verifyLedgerIntegrity(tenantId: string): Promise<{ valid: true } | { valid: false; reason: string }>;
      };

      expect(restartedMovementQueryService.listInventoryMovements(seeded.tenantId)).toHaveLength(1);
      expect(restartedMovementQueryService.listLedgerEntries(seeded.tenantId)).toHaveLength(1);
      expect((await restartedMovementQueryService.verifyLedgerIntegrity(seeded.tenantId)).valid).toBe(true);
      await restarted.stop();

      const tenant = await readPersistedTenant(rootDir, seeded.tenantId);
      tenant.movement.ledgerEntries.push(tenant.movement.ledgerEntries[0]);
      await writePersistedTenant(rootDir, seeded.tenantId, tenant);

      await expect(harness.createRuntime()).rejects.toThrow(/duplicate ledger|inconsistent movement\/ledger relationship/i);
    } finally {
      await cleanupPath(rootDir);
    }
  });

  it("rejects tenant mismatch, quantity corruption, containment corruption, and duplicate serial assignment on recovery", async () => {
    const tenantMismatchRoot = mkdtempSync(join(tmpdir(), "inventory-tenant-mismatch-"));
    const quantityRoot = mkdtempSync(join(tmpdir(), "inventory-quantity-"));
    const containmentRoot = mkdtempSync(join(tmpdir(), "inventory-containment-"));
    const serialRoot = mkdtempSync(join(tmpdir(), "inventory-serial-"));
    try {
      const tenantMismatchHarness = createHarness(tenantMismatchRoot);
      const tenantMismatchRuntime = await tenantMismatchHarness.createRuntime();
      const tenantMismatchSeed = await seedRichInventory(tenantMismatchRuntime);
      await tenantMismatchRuntime.stop();
      const tenantMismatchTenant = await readPersistedTenant(tenantMismatchRoot, tenantMismatchSeed.tenantId);
      tenantMismatchTenant.foundation.balances[0].tenantId = createInventoryIdentifier("tenant-b", "TenantId");
      await writePersistedTenant(tenantMismatchRoot, tenantMismatchSeed.tenantId, tenantMismatchTenant);
      await expect(tenantMismatchHarness.createRuntime()).rejects.toThrow(/cross-tenant balance|tenant mismatch/i);

      const quantityHarness = createHarness(quantityRoot);
      const quantityRuntime = await quantityHarness.createRuntime();
      const quantitySeed = await seedCoreInventory(quantityRuntime);
      await quantityRuntime.stop();
      const quantityTenant = await readPersistedTenant(quantityRoot, quantitySeed.tenantId);
      quantityTenant.foundation.balances[0].availableQuantity = 999;
      await writePersistedTenant(quantityRoot, quantitySeed.tenantId, quantityTenant);
      await expect(quantityHarness.createRuntime()).rejects.toThrow(/balance quantity invariant failure/i);

      const containmentHarness = createHarness(containmentRoot);
      const containmentRuntime = await containmentHarness.createRuntime();
      const containmentSeed = await seedCoreInventory(containmentRuntime);
      await containmentRuntime.stop();
      const containmentTenant = await readPersistedTenant(containmentRoot, containmentSeed.tenantId);
      containmentTenant.foundation.bins[0].storageLocationId = createInventoryIdentifier("loc-missing", "StorageLocationId");
      await writePersistedTenant(containmentRoot, containmentSeed.tenantId, containmentTenant);
      await expect(containmentHarness.createRuntime()).rejects.toThrow(/broken bin containment/i);

      const serialHarness = createHarness(serialRoot);
      const serialRuntime = await serialHarness.createRuntime();
      const serialSeed = await seedRichInventory(serialRuntime);
      await serialRuntime.stop();
      const serialTenant = await readPersistedTenant(serialRoot, serialSeed.tenantId);
      serialTenant.slice6.serials.push(serialTenant.slice6.serials[0]);
      await writePersistedTenant(serialRoot, serialSeed.tenantId, serialTenant);
      await expect(serialHarness.createRuntime()).rejects.toThrow(/duplicate serial/i);
    } finally {
      await rm(tenantMismatchRoot, { recursive: true, force: true });
      await rm(quantityRoot, { recursive: true, force: true });
      await rm(containmentRoot, { recursive: true, force: true });
      await rm(serialRoot, { recursive: true, force: true });
    }
  });

  it("rejects blocking recovery failures before ready state", async () => {
    const blockingRoot = mkdtempSync(join(tmpdir(), "inventory-blocking-"));
    try {
      await writePersistedManifest(blockingRoot, {
        manifest: {
          schemaVersion: "9.9.9",
          runtimeId: "inventory-runtime-s9",
          tenantIds: [],
        },
        tenants: [],
      });

      await expect(createHarness(blockingRoot).createRuntime()).rejects.toThrow(/unsupported schema version/i);
    } finally {
      await rm(blockingRoot, { recursive: true, force: true });
    }
  });
});
