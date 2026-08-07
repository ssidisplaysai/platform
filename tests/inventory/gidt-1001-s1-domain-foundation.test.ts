import { describe, expect, it } from "@jest/globals";
import {
  allocationStatusTransitions,
  assertAppendOnlyLedger,
  assertNoDuplicateIdempotencyKeys,
  assertNoRecursiveContainment,
  assertOneActiveSerialLocation,
  assertQuantityInvariant,
  assertUniqueInventoryItemIds,
  assertUniqueProductReferences,
  assertValidTransition,
  calculateAvailableQuantity,
  compareInventoryKeys,
  createExpectedVersion,
  createInventoryIdentifier,
  createQuantityModel,
  createVersionIdentifier,
  deterministicTransitionStates,
  sortInventoryRecords,
  uniqueInventoryKeys,
} from "@/platform/inventory/domain";
import type { InventoryItemContract } from "@/platform/inventory/contracts";

describe("GIDT-1001-S1 Inventory domain foundation", () => {
  it("creates branded identifiers and rejects invalid identifier format", () => {
    const itemId = createInventoryIdentifier("item.001", "InventoryItemId");
    expect(itemId).toBe("item.001");

    expect(() => createInventoryIdentifier("?", "InventoryItemId")).toThrow("invalid InventoryItemId");
  });

  it("enforces quantity invariants and available quantity calculation", () => {
    const available = calculateAvailableQuantity(12, 4, 3, 0);
    expect(available).toBe(5);

    const quantity = createQuantityModel({
      onHandQuantity: 12,
      reservedQuantity: 4,
      allocatedQuantity: 3,
      nonAllocatableHoldQuantity: 3,
    });
    assertQuantityInvariant(quantity);

    expect(() =>
      createQuantityModel({
        onHandQuantity: 5,
        reservedQuantity: 4,
        allocatedQuantity: 2,
        nonAllocatableHoldQuantity: 0,
      }),
    ).toThrow("reserved plus allocated quantity cannot exceed on-hand quantity");
  });

  it("enforces unique identifiers and unique product references", () => {
    const one = {
      inventoryItemId: createInventoryIdentifier("item-01", "InventoryItemId"),
      tenantId: createInventoryIdentifier("tenant-01", "TenantId"),
      productReferenceId: createInventoryIdentifier("prd-01", "ProductReferenceId"),
      lifecycleState: "ACTIVE",
      unitOfMeasure: "EA",
      publishedIdentifier: "published-item-01",
      versionIdentifier: "1.0.0",
    } as InventoryItemContract;

    const two = {
      ...one,
      inventoryItemId: createInventoryIdentifier("item-02", "InventoryItemId"),
      publishedIdentifier: "published-item-02",
      versionIdentifier: "1.0.1",
    } as InventoryItemContract;

    assertUniqueInventoryItemIds([one, two]);

    expect(() => assertUniqueInventoryItemIds([one, one])).toThrow("duplicate inventory item id");
    expect(() => assertUniqueProductReferences([one, two])).toThrow("duplicate product reference");
  });

  it("enforces one active serial location invariant", () => {
    const serialId = createInventoryIdentifier("serial-01", "SerialNumberId");
    const serialA = {
      serialNumberId: serialId,
      tenantId: createInventoryIdentifier("tenant-01", "TenantId"),
      inventoryItemId: createInventoryIdentifier("item-01", "InventoryItemId"),
      serialCode: "SN-001",
      status: "ACTIVE",
      storageLocationId: createInventoryIdentifier("loc-01", "StorageLocationId"),
      publishedIdentifier: "pub-serial-01",
      versionIdentifier: "1.0.0",
    } as const;

    const serialB = {
      ...serialA,
      storageLocationId: createInventoryIdentifier("loc-02", "StorageLocationId"),
    } as const;

    expect(() => assertOneActiveSerialLocation([serialA, serialB])).toThrow("multiple active locations");
  });

  it("enforces append-only ledger and idempotency uniqueness", () => {
    const previous = [
      {
        ledgerEntryId: createInventoryIdentifier("led-001", "LedgerEntryId"),
        movementId: createInventoryIdentifier("mov-001", "MovementId"),
        tenantId: createInventoryIdentifier("tenant-01", "TenantId"),
        inventoryItemId: createInventoryIdentifier("item-01", "InventoryItemId"),
        sequence: 1,
        occurredAt: "2026-08-06T00:00:00.000Z",
        movementType: "RECEIVE",
        quantityDelta: 10,
        onHandBefore: 0,
        onHandAfter: 10,
        reservedBefore: 0,
        reservedAfter: 0,
        allocatedBefore: 0,
        allocatedAfter: 0,
      },
    ] as const;

    const current = [
      ...previous,
      {
        ledgerEntryId: createInventoryIdentifier("led-002", "LedgerEntryId"),
        movementId: createInventoryIdentifier("mov-002", "MovementId"),
        tenantId: createInventoryIdentifier("tenant-01", "TenantId"),
        inventoryItemId: createInventoryIdentifier("item-01", "InventoryItemId"),
        sequence: 2,
        occurredAt: "2026-08-06T00:01:00.000Z",
        movementType: "PUT_AWAY",
        quantityDelta: 0,
        onHandBefore: 10,
        onHandAfter: 10,
        reservedBefore: 0,
        reservedAfter: 0,
        allocatedBefore: 0,
        allocatedAfter: 0,
      },
    ] as const;

    assertAppendOnlyLedger(previous, current);

    expect(() => assertAppendOnlyLedger(current, previous)).toThrow("ledger cannot shrink");
    expect(() =>
      assertNoDuplicateIdempotencyKeys([
        { idempotencyKey: createInventoryIdentifier("idem-01", "IdempotencyKey"), commandFingerprint: "a" },
        { idempotencyKey: createInventoryIdentifier("idem-01", "IdempotencyKey"), commandFingerprint: "b" },
      ]),
    ).toThrow("duplicate idempotency key");
  });

  it("validates lifecycle transitions deterministically", () => {
    assertValidTransition(allocationStatusTransitions, "PENDING", "ACTIVE", "ALLOCATION_CONFLICT");
    expect(() =>
      assertValidTransition(allocationStatusTransitions, "FULFILLED", "ACTIVE", "ALLOCATION_CONFLICT"),
    ).toThrow("invalid lifecycle transition");

    const deterministic = deterministicTransitionStates(allocationStatusTransitions, "ACTIVE");
    const sorted = [...deterministic].sort(compareInventoryKeys);
    expect(deterministic).toEqual(sorted);
  });

  it("supports deterministic ordering helpers", () => {
    const ordered = sortInventoryRecords(
      [
        { id: "b.002", value: 2 },
        { id: "a.010", value: 1 },
        { id: "a.002", value: 3 },
      ],
      (item) => item.id,
    );
    expect(ordered.map((item) => item.id)).toEqual(["a.002", "a.010", "b.002"]);

    expect(uniqueInventoryKeys(["z", "a", "a", "b"])).toEqual(["a", "b", "z"]);
  });

  it("validates version primitives and containment invariants", () => {
    const expectedVersion = createExpectedVersion(3);
    expect(expectedVersion).toBe(3);

    const version = createVersionIdentifier("1.2.3");
    expect(version).toBe("1.2.3");

    expect(() => createExpectedVersion(-1)).toThrow("expected version must be a non-negative integer");

    expect(() =>
      assertNoRecursiveContainment([
        { nodeId: "w1", parentNodeId: "l1" },
        { nodeId: "l1", parentNodeId: "b1" },
        { nodeId: "b1", parentNodeId: "w1" },
      ]),
    ).toThrow("recursive containment");
  });
});
