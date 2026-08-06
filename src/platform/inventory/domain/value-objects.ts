import { assertVersion, compareSemverVersions, isSemverVersion } from "../../shared/utilities";
import { assertRequiredString } from "../../shared/validation";
import type { ConcurrencyToken, ExpectedVersion, InventorySchemaVersion, VersionIdentifier } from "../contracts";
import { InventoryDomainError } from "./errors";

export type QuantityModel = Readonly<{
  onHandQuantity: number;
  reservedQuantity: number;
  allocatedQuantity: number;
  nonAllocatableHoldQuantity: number;
  availableQuantity: number;
}>;

function assertFiniteNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new InventoryDomainError("INVALID_QUANTITY", `${label} must be a finite number`, false);
  }
}

function assertNonNegative(value: number, label: string): void {
  if (value < 0) {
    throw new InventoryDomainError("INVALID_QUANTITY", `${label} must be >= 0`, false);
  }
}

export function calculateAvailableQuantity(
  onHandQuantity: number,
  reservedQuantity: number,
  nonAllocatableHoldQuantity: number,
): number {
  assertFiniteNumber(onHandQuantity, "onHandQuantity");
  assertFiniteNumber(reservedQuantity, "reservedQuantity");
  assertFiniteNumber(nonAllocatableHoldQuantity, "nonAllocatableHoldQuantity");

  const available = onHandQuantity - reservedQuantity - nonAllocatableHoldQuantity;
  if (available < 0) {
    throw new InventoryDomainError("INSUFFICIENT_AVAILABILITY", "available quantity would be negative", false);
  }
  return available;
}

export function createQuantityModel(input: {
  onHandQuantity: number;
  reservedQuantity: number;
  allocatedQuantity: number;
  nonAllocatableHoldQuantity?: number;
}): QuantityModel {
  assertNonNegative(input.onHandQuantity, "onHandQuantity");
  assertNonNegative(input.reservedQuantity, "reservedQuantity");
  assertNonNegative(input.allocatedQuantity, "allocatedQuantity");
  const nonAllocatableHoldQuantity = input.nonAllocatableHoldQuantity ?? 0;
  assertNonNegative(nonAllocatableHoldQuantity, "nonAllocatableHoldQuantity");

  if (input.allocatedQuantity > input.onHandQuantity) {
    throw new InventoryDomainError("INVALID_QUANTITY", "allocated quantity cannot exceed on-hand quantity", false);
  }

  const availableQuantity = calculateAvailableQuantity(
    input.onHandQuantity,
    input.reservedQuantity,
    nonAllocatableHoldQuantity,
  );

  if (input.reservedQuantity > availableQuantity) {
    throw new InventoryDomainError("INVALID_QUANTITY", "reserved quantity cannot exceed available quantity", false);
  }

  return {
    onHandQuantity: input.onHandQuantity,
    reservedQuantity: input.reservedQuantity,
    allocatedQuantity: input.allocatedQuantity,
    nonAllocatableHoldQuantity,
    availableQuantity,
  };
}

export function createExpectedVersion(value: number): ExpectedVersion {
  if (!Number.isInteger(value) || value < 0) {
    throw new InventoryDomainError("CONCURRENCY_CONFLICT", "expected version must be a non-negative integer", false);
  }
  return value as ExpectedVersion;
}

export function createVersionIdentifier(value: string): VersionIdentifier {
  assertRequiredString(value, "versionIdentifier");
  if (!isSemverVersion(value)) {
    throw new InventoryDomainError("VERSION_MONOTONICITY_VIOLATION", "version identifier must be semantic version", false);
  }
  return value as VersionIdentifier;
}

export function createConcurrencyToken(value: string): ConcurrencyToken {
  assertRequiredString(value, "concurrencyToken");
  return value as ConcurrencyToken;
}

export function assertVersionMonotonicity(previous: VersionIdentifier, next: VersionIdentifier): void {
  if (compareSemverVersions(previous, next) >= 0) {
    throw new InventoryDomainError("VERSION_MONOTONICITY_VIOLATION", "version must increase monotonically", false);
  }
}

export function createInventorySchemaVersion(value: string): InventorySchemaVersion {
  assertVersion(value, "inventory schema");
  return value as InventorySchemaVersion;
}

export function assertSchemaCompatibility(current: InventorySchemaVersion, minimum: InventorySchemaVersion): void {
  if (compareSemverVersions(current, minimum) < 0) {
    throw new InventoryDomainError("VERSION_MONOTONICITY_VIOLATION", "schema version is below minimum supported", false);
  }
}
