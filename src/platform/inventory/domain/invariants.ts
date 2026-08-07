import { compareDeterministicStrings } from "../../shared/utilities";
import type {
  IdempotencyKey,
  InventoryItemContract,
  LedgerEntryContract,
  ReservationStatus,
  SerialNumberContract,
  TenantId,
} from "../contracts";
import { InventoryDomainError } from "./errors";
import { calculateAvailableQuantity, type QuantityModel } from "./value-objects";

export type InvariantFailure = Readonly<{
  ruleId: string;
  classification: string;
  message: string;
}>;

export function assertQuantityInvariant(quantity: QuantityModel): void {
  if (quantity.onHandQuantity < 0 || quantity.reservedQuantity < 0 || quantity.allocatedQuantity < 0) {
    throw new InventoryDomainError("INVALID_QUANTITY", "quantity values must be >= 0", false);
  }

  if (quantity.allocatedQuantity > quantity.onHandQuantity) {
    throw new InventoryDomainError("INVALID_QUANTITY", "allocated quantity cannot exceed on-hand quantity", false);
  }

  if (quantity.reservedQuantity + quantity.allocatedQuantity > quantity.onHandQuantity) {
    throw new InventoryDomainError("INVALID_QUANTITY", "reserved plus allocated quantity cannot exceed on-hand quantity", false);
  }

  const recalculatedAvailable = calculateAvailableQuantity(
    quantity.onHandQuantity,
    quantity.reservedQuantity,
    quantity.allocatedQuantity,
    quantity.nonAllocatableHoldQuantity,
  );
  if (recalculatedAvailable !== quantity.availableQuantity) {
    throw new InventoryDomainError("INVALID_QUANTITY", "available quantity does not match canonical calculation", false);
  }
}

export function assertUniqueInventoryItemIds(items: readonly InventoryItemContract[]): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.inventoryItemId)) {
      throw new InventoryDomainError("UNIQUE_CONSTRAINT_VIOLATION", "duplicate inventory item id detected", false);
    }
    seen.add(item.inventoryItemId);
  }
}

export function assertUniqueProductReferences(items: readonly InventoryItemContract[]): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.productReferenceId)) {
      throw new InventoryDomainError("UNIQUE_CONSTRAINT_VIOLATION", "duplicate product reference detected", false);
    }
    seen.add(item.productReferenceId);
  }
}

export function assertOneActiveSerialLocation(serials: readonly SerialNumberContract[]): void {
  const activeLocationBySerialId = new Map<string, string>();

  for (const serial of serials) {
    if (serial.status === "ACTIVE" || serial.status === "RESERVED" || serial.status === "ALLOCATED") {
      if (!serial.storageLocationId) {
        throw new InventoryDomainError("INVALID_SERIAL", "active serial requires storage location", false);
      }
      const previousLocation = activeLocationBySerialId.get(serial.serialNumberId);
      if (previousLocation && previousLocation !== serial.storageLocationId) {
        throw new InventoryDomainError("INVALID_SERIAL", "serial has multiple active locations", false);
      }
      activeLocationBySerialId.set(serial.serialNumberId, serial.storageLocationId);
    }
  }
}

export function assertTenantIsolation(tenantId: TenantId, candidates: readonly TenantId[]): void {
  for (const candidate of candidates) {
    if (candidate !== tenantId) {
      throw new InventoryDomainError("TENANT_ISOLATION_VIOLATION", "cross-tenant access is prohibited", false);
    }
  }
}

export function assertNoRecursiveContainment(
  relationships: readonly Readonly<{ nodeId: string; parentNodeId?: string }>[],
): void {
  const parentByNode = new Map<string, string>();
  for (const relationship of relationships) {
    if (relationship.parentNodeId) {
      parentByNode.set(relationship.nodeId, relationship.parentNodeId);
    }
  }

  for (const relationship of relationships) {
    const visited = new Set<string>();
    let current: string | undefined = relationship.nodeId;
    while (current) {
      if (visited.has(current)) {
        throw new InventoryDomainError("RECURSIVE_CONTAINMENT_VIOLATION", "recursive containment detected", false);
      }
      visited.add(current);
      current = parentByNode.get(current);
    }
  }
}

export function assertAppendOnlyLedger(
  previousLedger: readonly LedgerEntryContract[],
  currentLedger: readonly LedgerEntryContract[],
): void {
  if (currentLedger.length < previousLedger.length) {
    throw new InventoryDomainError("LEDGER_APPEND_ONLY_VIOLATION", "ledger cannot shrink", false);
  }

  for (let index = 0; index < previousLedger.length; index += 1) {
    const previous = previousLedger[index];
    const current = currentLedger[index];
    if (!current || previous.ledgerEntryId !== current.ledgerEntryId) {
      throw new InventoryDomainError("LEDGER_APPEND_ONLY_VIOLATION", "ledger history cannot be rewritten", false);
    }
  }
}

export function assertVersionMonotonicity(previousVersion: number, nextVersion: number): void {
  if (!Number.isInteger(previousVersion) || !Number.isInteger(nextVersion) || nextVersion <= previousVersion) {
    throw new InventoryDomainError("VERSION_MONOTONICITY_VIOLATION", "version must increase monotonically", false);
  }
}

export function assertNoDuplicateIdempotencyKeys(
  records: readonly Readonly<{ idempotencyKey: IdempotencyKey; commandFingerprint: string }>[],
): void {
  const sorted = [...records].sort((left, right) =>
    compareDeterministicStrings(left.idempotencyKey, right.idempotencyKey),
  );

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (previous.idempotencyKey === current.idempotencyKey) {
      throw new InventoryDomainError("DUPLICATE_IDEMPOTENCY_KEY", "duplicate idempotency key detected", false);
    }
  }
}

export function assertReservationStatus(status: string): asserts status is ReservationStatus {
  const allowed: ReservationStatus[] = ["PENDING", "ACTIVE", "PARTIALLY_RELEASED", "RELEASED", "EXPIRED", "CANCELLED", "FULFILLED"];
  if (!allowed.includes(status as ReservationStatus)) {
    throw new InventoryDomainError("RESERVATION_CONFLICT", `invalid reservation status: ${status}`, false);
  }
}
