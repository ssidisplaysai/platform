import { describe, expect, it } from "@jest/globals";
import {
  createDefaultInventoryRuntimeDependencies,
  createExpectedVersion,
  createInventoryIdentifier,
  createInventoryRuntime,
  createInventorySlice6ServiceRegistrationHook,
  createInventorySlice6Services,
  createStaticInventoryProductReferenceValidator,
  InventoryReferenceValidatorRegistry,
  type AuditMetadata,
  type CommandMetadata,
  type InventoryRuntimeAuditRecord,
} from "@/platform/inventory";

function commandMetadata(seed: number, key?: string): CommandMetadata {
  return {
    commandId: createInventoryIdentifier(`cmd-${seed}`, "IdempotencyKey") as unknown as CommandMetadata["commandId"],
    expectedVersion: createExpectedVersion(1),
    idempotencyKey: createInventoryIdentifier(key ?? `idem-${seed}`, "IdempotencyKey"),
    requestedAt: `2026-08-06T19:00:${String(seed).padStart(2, "0")}.000Z`,
  };
}

function auditMetadata(seed: number): AuditMetadata {
  return {
    actorId: createInventoryIdentifier(`actor-${seed}`, "IdempotencyKey") as unknown as AuditMetadata["actorId"],
    occurredAt: `2026-08-06T19:00:${String(seed).padStart(2, "0")}.000Z`,
    source: "test",
  };
}

function createSlice6Harness() {
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
      validatorId: "slice6-product-validator",
      validProducts: [createInventoryIdentifier("prd-01", "ProductReferenceId"), createInventoryIdentifier("prd-02", "ProductReferenceId")],
      validProductVariants: {
        "prd-01": [createInventoryIdentifier("var-01", "ProductVariantReferenceId")],
        "prd-02": [createInventoryIdentifier("var-02", "ProductVariantReferenceId")],
      },
    }),
  );

  const services = createInventorySlice6Services({ dependencies, validatorRegistry });
  return { audits, dependencies, validatorRegistry, services };
}

async function seedFoundation(harness: ReturnType<typeof createSlice6Harness>) {
  const tenantA = createInventoryIdentifier("tenant-a", "TenantId");
  const tenantB = createInventoryIdentifier("tenant-b", "TenantId");

  const itemA = await harness.services.slice5.slice4.foundation.inventoryItemService.registerInventoryItem({
    inventoryItemId: createInventoryIdentifier("item-a", "InventoryItemId"),
    tenantId: tenantA,
    productReferenceId: createInventoryIdentifier("prd-01", "ProductReferenceId"),
    productVariantReferenceId: createInventoryIdentifier("var-01", "ProductVariantReferenceId"),
    unitOfMeasure: "EA",
    commandMetadata: commandMetadata(1),
    auditMetadata: auditMetadata(1),
  });

  const itemB = await harness.services.slice5.slice4.foundation.inventoryItemService.registerInventoryItem({
    inventoryItemId: createInventoryIdentifier("item-b", "InventoryItemId"),
    tenantId: tenantA,
    productReferenceId: createInventoryIdentifier("prd-02", "ProductReferenceId"),
    productVariantReferenceId: createInventoryIdentifier("var-02", "ProductVariantReferenceId"),
    unitOfMeasure: "EA",
    commandMetadata: commandMetadata(2),
    auditMetadata: auditMetadata(2),
  });

  const whA = await harness.services.slice5.slice4.foundation.warehouseService.registerWarehouse({
    warehouseId: createInventoryIdentifier("wh-a", "WarehouseId"),
    tenantId: tenantA,
    warehouseCode: "WH-A",
    commandMetadata: commandMetadata(3),
    auditMetadata: auditMetadata(3),
  });

  const locA = await harness.services.slice5.slice4.foundation.storageLocationService.registerStorageLocation({
    storageLocationId: createInventoryIdentifier("loc-a", "StorageLocationId"),
    warehouseId: whA.warehouseId,
    tenantId: tenantA,
    locationCode: "LOC-A",
    locationType: "STORAGE",
    commandMetadata: commandMetadata(4),
    auditMetadata: auditMetadata(4),
  });

  const locB = await harness.services.slice5.slice4.foundation.storageLocationService.registerStorageLocation({
    storageLocationId: createInventoryIdentifier("loc-b", "StorageLocationId"),
    warehouseId: whA.warehouseId,
    tenantId: tenantA,
    locationCode: "LOC-B",
    locationType: "STORAGE",
    commandMetadata: commandMetadata(5),
    auditMetadata: auditMetadata(5),
  });

  const binA = await harness.services.slice5.slice4.foundation.binService.registerBin({
    binId: createInventoryIdentifier("bin-a", "BinId"),
    storageLocationId: locA.storageLocationId,
    tenantId: tenantA,
    binCode: "BIN-A",
    commandMetadata: commandMetadata(6),
    auditMetadata: auditMetadata(6),
  });

  const binB = await harness.services.slice5.slice4.foundation.binService.registerBin({
    binId: createInventoryIdentifier("bin-b", "BinId"),
    storageLocationId: locB.storageLocationId,
    tenantId: tenantA,
    binCode: "BIN-B",
    commandMetadata: commandMetadata(7),
    auditMetadata: auditMetadata(7),
  });

  const balanceA = await harness.services.slice5.slice4.foundation.inventoryBalanceService.initializeInventoryBalance({
    inventoryBalanceId: createInventoryIdentifier("bal-a", "InventoryBalanceId"),
    inventoryItemId: itemA.inventoryItemId,
    tenantId: tenantA,
    warehouseId: whA.warehouseId,
    storageLocationId: locA.storageLocationId,
    binId: binA.binId,
    initialQuantities: { onHandQuantity: 20 },
    commandMetadata: commandMetadata(8),
    auditMetadata: auditMetadata(8),
  });

  const balanceB = await harness.services.slice5.slice4.foundation.inventoryBalanceService.initializeInventoryBalance({
    inventoryBalanceId: createInventoryIdentifier("bal-b", "InventoryBalanceId"),
    inventoryItemId: itemA.inventoryItemId,
    tenantId: tenantA,
    warehouseId: whA.warehouseId,
    storageLocationId: locB.storageLocationId,
    binId: binB.binId,
    initialQuantities: { onHandQuantity: 5 },
    commandMetadata: commandMetadata(9),
    auditMetadata: auditMetadata(9),
  });

  return { tenantA, tenantB, itemA, itemB, whA, locA, locB, balanceA, balanceB };
}

describe("GIDT-1001-S6 lot serial and expiration", () => {
  it("registers lot, enforces duplicate lot code, lifecycle transitions, quarantine/release/retire, stale rejection, and deterministic listing", async () => {
    const harness = createSlice6Harness();
    const seed = await seedFoundation(harness);

    const lot = await harness.services.lotService.registerLot({
      lotId: createInventoryIdentifier("lot-1", "LotId"),
      tenantId: seed.tenantA,
      inventoryItemId: seed.itemA.inventoryItemId,
      lotCode: "LOT-001",
      trackedQuantity: 10,
      inventoryBalanceId: seed.balanceA.inventoryBalanceId,
      manufactureDate: "2026-07-01T00:00:00.000Z",
      bestBeforeDate: "2026-08-10T00:00:00.000Z",
      expirationDate: "2026-08-20T00:00:00.000Z",
      commandMetadata: commandMetadata(10),
      auditMetadata: auditMetadata(10),
    });

    await expect(
      harness.services.lotService.registerLot({
        lotId: createInventoryIdentifier("lot-2", "LotId"),
        tenantId: seed.tenantA,
        inventoryItemId: seed.itemA.inventoryItemId,
        lotCode: "LOT-001",
        commandMetadata: commandMetadata(11),
        auditMetadata: auditMetadata(11),
      }),
    ).rejects.toMatchObject({ classification: "DUPLICATE_LOT_CODE" });

    const quarantined = await harness.services.lotService.quarantineLot({
      lotId: lot.lotId,
      tenantId: seed.tenantA,
      expectedVersion: createExpectedVersion(lot.version),
      commandMetadata: commandMetadata(12),
      auditMetadata: auditMetadata(12),
    });
    expect(quarantined.status).toBe("QUARANTINED");

    const released = await harness.services.lotService.releaseLotFromQuarantine({
      lotId: lot.lotId,
      tenantId: seed.tenantA,
      expectedVersion: createExpectedVersion(quarantined.version),
      commandMetadata: commandMetadata(13),
      auditMetadata: auditMetadata(13),
    });
    expect(released.status).toBe("ACTIVE");

    const retired = await harness.services.lotService.retireLot({
      lotId: lot.lotId,
      tenantId: seed.tenantA,
      expectedVersion: createExpectedVersion(released.version),
      commandMetadata: commandMetadata(14),
      auditMetadata: auditMetadata(14),
    });
    expect(retired.status).toBe("DISPOSED");

    await expect(
      harness.services.lotService.retireLot({
        lotId: lot.lotId,
        tenantId: seed.tenantA,
        expectedVersion: createExpectedVersion(released.version),
        commandMetadata: commandMetadata(15),
        auditMetadata: auditMetadata(15),
      }),
    ).rejects.toMatchObject({ classification: "STALE_EXPECTED_VERSION" });

    expect(harness.services.lotQueryService.listLots(seed.tenantA).map((entry) => entry.lotCode)).toEqual(["LOT-001"]);
  });

  it("registers serials, enforces duplicate serial code, one-active-location assignment rules, lot association, and deterministic listing", async () => {
    const harness = createSlice6Harness();
    const seed = await seedFoundation(harness);

    const lot = await harness.services.lotService.registerLot({
      lotId: createInventoryIdentifier("lot-3", "LotId"),
      tenantId: seed.tenantA,
      inventoryItemId: seed.itemA.inventoryItemId,
      lotCode: "LOT-003",
      commandMetadata: commandMetadata(16),
      auditMetadata: auditMetadata(16),
    });

    const serial = await harness.services.serialNumberService.registerSerialNumber({
      serialNumberId: createInventoryIdentifier("sn-1", "SerialNumberId"),
      tenantId: seed.tenantA,
      inventoryItemId: seed.itemA.inventoryItemId,
      serialCode: "SER-001",
      inventoryBalanceId: seed.balanceA.inventoryBalanceId,
      lotId: lot.lotId,
      commandMetadata: commandMetadata(17),
      auditMetadata: auditMetadata(17),
    });

    await expect(
      harness.services.serialNumberService.registerSerialNumber({
        serialNumberId: createInventoryIdentifier("sn-2", "SerialNumberId"),
        tenantId: seed.tenantA,
        inventoryItemId: seed.itemA.inventoryItemId,
        serialCode: "SER-001",
        inventoryBalanceId: seed.balanceA.inventoryBalanceId,
        commandMetadata: commandMetadata(18),
        auditMetadata: auditMetadata(18),
      }),
    ).rejects.toMatchObject({ classification: "DUPLICATE_SERIAL_CODE" });

    await expect(
      harness.services.serialNumberService.bindSerial({
        serialNumberId: serial.serialNumberId,
        tenantId: seed.tenantA,
        expectedVersion: createExpectedVersion(serial.version),
        inventoryBalanceId: seed.balanceB.inventoryBalanceId,
        commandMetadata: commandMetadata(19),
        auditMetadata: auditMetadata(19),
      }),
    ).rejects.toMatchObject({ classification: "SERIAL_ALREADY_ACTIVE_ELSEWHERE" });

    const rebound = await harness.services.serialNumberService.bindSerial({
      serialNumberId: serial.serialNumberId,
      tenantId: seed.tenantA,
      expectedVersion: createExpectedVersion(serial.version),
      inventoryBalanceId: seed.balanceB.inventoryBalanceId,
      movementReferenceId: createInventoryIdentifier("mov-approved-1", "MovementId"),
      commandMetadata: commandMetadata(20),
      auditMetadata: auditMetadata(20),
    });
    expect(rebound.inventoryBalanceId).toBe(seed.balanceB.inventoryBalanceId);

    await expect(
      harness.services.serialNumberService.registerSerialNumber({
        serialNumberId: createInventoryIdentifier("sn-bad-lot", "SerialNumberId"),
        tenantId: seed.tenantA,
        inventoryItemId: seed.itemB.inventoryItemId,
        serialCode: "SER-009",
        lotId: lot.lotId,
        commandMetadata: commandMetadata(21),
        auditMetadata: auditMetadata(21),
      }),
    ).rejects.toMatchObject({ classification: "INVALID_LOT_SERIAL_ASSOCIATION" });

    expect(harness.services.serialQueryService.listSerials(seed.tenantA).map((entry) => entry.serialCode)).toEqual(["SER-001"]);
  });

  it("supports serial quarantine/release/retirement and stale version rejection", async () => {
    const harness = createSlice6Harness();
    const seed = await seedFoundation(harness);

    const serial = await harness.services.serialNumberService.registerSerialNumber({
      serialNumberId: createInventoryIdentifier("sn-3", "SerialNumberId"),
      tenantId: seed.tenantA,
      inventoryItemId: seed.itemA.inventoryItemId,
      serialCode: "SER-003",
      inventoryBalanceId: seed.balanceA.inventoryBalanceId,
      commandMetadata: commandMetadata(22),
      auditMetadata: auditMetadata(22),
    });

    const quarantined = await harness.services.serialNumberService.quarantineSerial({
      serialNumberId: serial.serialNumberId,
      tenantId: seed.tenantA,
      expectedVersion: createExpectedVersion(serial.version),
      commandMetadata: commandMetadata(23),
      auditMetadata: auditMetadata(23),
    });
    expect(quarantined.status).toBe("QUARANTINED");

    const released = await harness.services.serialNumberService.releaseSerialFromQuarantine({
      serialNumberId: serial.serialNumberId,
      tenantId: seed.tenantA,
      expectedVersion: createExpectedVersion(quarantined.version),
      commandMetadata: commandMetadata(24),
      auditMetadata: auditMetadata(24),
    });
    expect(released.status).toBe("ACTIVE");

    const retired = await harness.services.serialNumberService.retireSerial({
      serialNumberId: serial.serialNumberId,
      tenantId: seed.tenantA,
      expectedVersion: createExpectedVersion(released.version),
      commandMetadata: commandMetadata(25),
      auditMetadata: auditMetadata(25),
    });
    expect(retired.status).toBe("RETIRED");

    await expect(
      harness.services.serialNumberService.quarantineSerial({
        serialNumberId: serial.serialNumberId,
        tenantId: seed.tenantA,
        expectedVersion: createExpectedVersion(released.version),
        commandMetadata: commandMetadata(26),
        auditMetadata: auditMetadata(26),
      }),
    ).rejects.toMatchObject({ classification: "STALE_EXPECTED_VERSION" });
  });

  it("evaluates expiration deterministically, rejects invalid date ordering, and does not mutate quantity during evaluation", async () => {
    const harness = createSlice6Harness();
    const seed = await seedFoundation(harness);

    const lot = await harness.services.lotService.registerLot({
      lotId: createInventoryIdentifier("lot-exp", "LotId"),
      tenantId: seed.tenantA,
      inventoryItemId: seed.itemA.inventoryItemId,
      lotCode: "LOT-EXP",
      inventoryBalanceId: seed.balanceA.inventoryBalanceId,
      trackedQuantity: 5,
      commandMetadata: commandMetadata(27),
      auditMetadata: auditMetadata(27),
    });

    const beforeBalance = harness.services.slice5.slice4.foundation.inventoryBalanceService.getInventoryBalance(seed.tenantA, seed.balanceA.inventoryBalanceId)!;

    const near = await harness.services.expirationService.evaluateExpiration({
      expirationRecordId: createInventoryIdentifier("exp-near", "ExpirationRecordId"),
      tenantId: seed.tenantA,
      inventoryItemId: seed.itemA.inventoryItemId,
      lotId: lot.lotId,
      manufactureDate: "2026-07-01T00:00:00.000Z",
      bestBeforeDate: "2026-08-01T00:00:00.000Z",
      expirationDate: "2026-12-01T00:00:00.000Z",
      commandMetadata: commandMetadata(28),
      auditMetadata: auditMetadata(28),
    });
    expect(near.state).toBe("NEAR_EXPIRY");

    const expired = await harness.services.expirationService.evaluateExpiration({
      expirationRecordId: createInventoryIdentifier("exp-old", "ExpirationRecordId"),
      tenantId: seed.tenantA,
      inventoryItemId: seed.itemA.inventoryItemId,
      lotId: lot.lotId,
      manufactureDate: "2020-01-01T00:00:00.000Z",
      bestBeforeDate: "2020-06-01T00:00:00.000Z",
      expirationDate: "2020-08-01T00:00:00.000Z",
      commandMetadata: commandMetadata(29),
      auditMetadata: auditMetadata(29),
    });
    expect(expired.state).toBe("EXPIRED");

    const afterBalance = harness.services.slice5.slice4.foundation.inventoryBalanceService.getInventoryBalance(seed.tenantA, seed.balanceA.inventoryBalanceId)!;
    expect(afterBalance.onHandQuantity).toBe(beforeBalance.onHandQuantity);
    expect(afterBalance.reservedQuantity).toBe(beforeBalance.reservedQuantity);
    expect(afterBalance.allocatedQuantity).toBe(beforeBalance.allocatedQuantity);

    await expect(
      harness.services.expirationService.evaluateExpiration({
        expirationRecordId: createInventoryIdentifier("exp-bad", "ExpirationRecordId"),
        tenantId: seed.tenantA,
        inventoryItemId: seed.itemA.inventoryItemId,
        lotId: lot.lotId,
        manufactureDate: "2026-08-10T00:00:00.000Z",
        bestBeforeDate: "2026-08-01T00:00:00.000Z",
        expirationDate: "2026-09-01T00:00:00.000Z",
        commandMetadata: commandMetadata(30),
        auditMetadata: auditMetadata(30),
      }),
    ).rejects.toMatchObject({ classification: "INVALID_EXPIRATION_DATES" });
  });

  it("prevents release of expired lot and expired serial from quarantine", async () => {
    const harness = createSlice6Harness();
    const seed = await seedFoundation(harness);

    const lot = await harness.services.lotService.registerLot({
      lotId: createInventoryIdentifier("lot-exp-release", "LotId"),
      tenantId: seed.tenantA,
      inventoryItemId: seed.itemA.inventoryItemId,
      lotCode: "LOT-EXP-R",
      commandMetadata: commandMetadata(31),
      auditMetadata: auditMetadata(31),
    });

    const quarantined = await harness.services.lotService.quarantineLot({
      lotId: lot.lotId,
      tenantId: seed.tenantA,
      expectedVersion: createExpectedVersion(lot.version),
      commandMetadata: commandMetadata(32),
      auditMetadata: auditMetadata(32),
    });

    await harness.services.expirationService.evaluateExpiration({
      expirationRecordId: createInventoryIdentifier("exp-rel-lot", "ExpirationRecordId"),
      tenantId: seed.tenantA,
      inventoryItemId: seed.itemA.inventoryItemId,
      lotId: lot.lotId,
      expirationDate: "2020-01-01T00:00:00.000Z",
      commandMetadata: commandMetadata(33),
      auditMetadata: auditMetadata(33),
    });

    await expect(
      harness.services.lotService.releaseLotFromQuarantine({
        lotId: lot.lotId,
        tenantId: seed.tenantA,
        expectedVersion: createExpectedVersion(quarantined.version),
        commandMetadata: commandMetadata(34),
        auditMetadata: auditMetadata(34),
      }),
    ).rejects.toMatchObject({ classification: "EXPIRED_ENTITY_RELEASE_PROHIBITED" });

    const serial = await harness.services.serialNumberService.registerSerialNumber({
      serialNumberId: createInventoryIdentifier("sn-exp-release", "SerialNumberId"),
      tenantId: seed.tenantA,
      inventoryItemId: seed.itemA.inventoryItemId,
      serialCode: "SER-EXP-R",
      inventoryBalanceId: seed.balanceA.inventoryBalanceId,
      commandMetadata: commandMetadata(35),
      auditMetadata: auditMetadata(35),
    });

    const serialQ = await harness.services.serialNumberService.quarantineSerial({
      serialNumberId: serial.serialNumberId,
      tenantId: seed.tenantA,
      expectedVersion: createExpectedVersion(serial.version),
      commandMetadata: commandMetadata(36),
      auditMetadata: auditMetadata(36),
    });

    await harness.services.expirationService.evaluateExpiration({
      expirationRecordId: createInventoryIdentifier("exp-rel-serial", "ExpirationRecordId"),
      tenantId: seed.tenantA,
      inventoryItemId: seed.itemA.inventoryItemId,
      serialNumberId: serial.serialNumberId,
      expirationDate: "2020-01-01T00:00:00.000Z",
      commandMetadata: commandMetadata(37),
      auditMetadata: auditMetadata(37),
    });

    await expect(
      harness.services.serialNumberService.releaseSerialFromQuarantine({
        serialNumberId: serial.serialNumberId,
        tenantId: seed.tenantA,
        expectedVersion: createExpectedVersion(serialQ.version),
        commandMetadata: commandMetadata(38),
        auditMetadata: auditMetadata(38),
      }),
    ).rejects.toMatchObject({ classification: "EXPIRED_ENTITY_RELEASE_PROHIBITED" });
  });

  it("enforces idempotent lot and serial registration replay with conflicting payload rejection", async () => {
    const harness = createSlice6Harness();
    const seed = await seedFoundation(harness);

    const lotReplayKey = "idem-lot-replay";
    const lot = await harness.services.lotService.registerLot({
      lotId: createInventoryIdentifier("lot-idem", "LotId"),
      tenantId: seed.tenantA,
      inventoryItemId: seed.itemA.inventoryItemId,
      lotCode: "LOT-IDEM",
      commandMetadata: commandMetadata(39, lotReplayKey),
      auditMetadata: auditMetadata(39),
    });
    const lotReplay = await harness.services.lotService.registerLot({
      lotId: createInventoryIdentifier("lot-idem", "LotId"),
      tenantId: seed.tenantA,
      inventoryItemId: seed.itemA.inventoryItemId,
      lotCode: "LOT-IDEM",
      commandMetadata: commandMetadata(40, lotReplayKey),
      auditMetadata: auditMetadata(40),
    });
    expect(lotReplay.lotId).toBe(lot.lotId);

    await expect(
      harness.services.lotService.registerLot({
        lotId: createInventoryIdentifier("lot-idem-conflict", "LotId"),
        tenantId: seed.tenantA,
        inventoryItemId: seed.itemA.inventoryItemId,
        lotCode: "LOT-IDEM-ALT",
        commandMetadata: commandMetadata(41, lotReplayKey),
        auditMetadata: auditMetadata(41),
      }),
    ).rejects.toMatchObject({ classification: "CONFLICTING_IDEMPOTENCY_PAYLOAD" });

    const serialReplayKey = "idem-serial-replay";
    const serial = await harness.services.serialNumberService.registerSerialNumber({
      serialNumberId: createInventoryIdentifier("sn-idem", "SerialNumberId"),
      tenantId: seed.tenantA,
      inventoryItemId: seed.itemA.inventoryItemId,
      serialCode: "SER-IDEM",
      inventoryBalanceId: seed.balanceA.inventoryBalanceId,
      commandMetadata: commandMetadata(42, serialReplayKey),
      auditMetadata: auditMetadata(42),
    });
    const serialReplay = await harness.services.serialNumberService.registerSerialNumber({
      serialNumberId: createInventoryIdentifier("sn-idem", "SerialNumberId"),
      tenantId: seed.tenantA,
      inventoryItemId: seed.itemA.inventoryItemId,
      serialCode: "SER-IDEM",
      inventoryBalanceId: seed.balanceA.inventoryBalanceId,
      commandMetadata: commandMetadata(43, serialReplayKey),
      auditMetadata: auditMetadata(43),
    });
    expect(serialReplay.serialNumberId).toBe(serial.serialNumberId);
  });

  it("emits accepted/rejected/replay audit evidence for lot, serial, and expiration actions", async () => {
    const harness = createSlice6Harness();
    const seed = await seedFoundation(harness);

    await harness.services.lotService.registerLot({
      lotId: createInventoryIdentifier("lot-audit", "LotId"),
      tenantId: seed.tenantA,
      inventoryItemId: seed.itemA.inventoryItemId,
      lotCode: "LOT-AUDIT",
      commandMetadata: commandMetadata(44, "idem-audit-lot"),
      auditMetadata: auditMetadata(44),
    });

    await harness.services.lotService.registerLot({
      lotId: createInventoryIdentifier("lot-audit", "LotId"),
      tenantId: seed.tenantA,
      inventoryItemId: seed.itemA.inventoryItemId,
      lotCode: "LOT-AUDIT",
      commandMetadata: commandMetadata(45, "idem-audit-lot"),
      auditMetadata: auditMetadata(45),
    });

    await expect(
      harness.services.serialNumberService.registerSerialNumber({
        serialNumberId: createInventoryIdentifier("sn-audit-fail", "SerialNumberId"),
        tenantId: seed.tenantA,
        inventoryItemId: seed.itemA.inventoryItemId,
        serialCode: "SER-AUDIT-FAIL",
        lotId: createInventoryIdentifier("lot-missing", "LotId"),
        commandMetadata: commandMetadata(46),
        auditMetadata: auditMetadata(46),
      }),
    ).rejects.toMatchObject({ classification: "INVALID_LOT_SERIAL_ASSOCIATION" });

    await harness.services.expirationService.evaluateExpiration({
      expirationRecordId: createInventoryIdentifier("exp-audit", "ExpirationRecordId"),
      tenantId: seed.tenantA,
      inventoryItemId: seed.itemA.inventoryItemId,
      lotId: createInventoryIdentifier("lot-audit", "LotId"),
      expirationDate: "2020-01-01T00:00:00.000Z",
      commandMetadata: commandMetadata(47),
      auditMetadata: auditMetadata(47),
    });

    const eventTypes = harness.audits.map((audit) => audit.eventType);
    expect(eventTypes).toContain("inventory.lot.registered");
    expect(eventTypes).toContain("inventory.idempotency.replay");
    expect(eventTypes).toContain("inventory.serial.rejected");
    expect(eventTypes).toContain("inventory.expiration.evaluated");
  });

  it("registers Slice 6 runtime services and excludes slice-7 or persistence services", async () => {
    const registry = new InventoryReferenceValidatorRegistry();
    registry.registerProductValidator(
      createStaticInventoryProductReferenceValidator({
        validatorId: "runtime-s6-validator",
        validProducts: [createInventoryIdentifier("prd-01", "ProductReferenceId")],
      }),
    );

    const runtime = await createInventoryRuntime({
      runtimeId: "inventory-runtime-s6-test",
      dependencies: createDefaultInventoryRuntimeDependencies(),
      serviceRegistrationHooks: [createInventorySlice6ServiceRegistrationHook({ validatorRegistry: registry })],
    });

    const serviceIds = runtime.snapshot().state.serviceIds;
    expect(serviceIds).toContain("inventory.service.lot");
    expect(serviceIds).toContain("inventory.service.serial-number");
    expect(serviceIds).toContain("inventory.service.expiration");
    expect(serviceIds).toContain("inventory.service.lot-query");
    expect(serviceIds).toContain("inventory.service.serial-query");
    expect(serviceIds).toContain("inventory.service.expiration-query");
    expect(serviceIds.some((id) => id.includes("slice-7") || id.includes("reorder") || id.includes("persistence") || id.includes("receiving") || id.includes("picking"))).toBe(false);

    await runtime.stop();
  });
});
