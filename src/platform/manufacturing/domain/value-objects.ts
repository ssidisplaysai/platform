import { compareSemverVersions, isSemverVersion } from "../../shared/utilities";
import type {
  CompletedQuantity,
  ConsumedMaterialQuantity,
  ConcurrencyToken,
  DowntimeDuration,
  DurationInMinutes,
  EffectiveDateRange,
  ExecutionVersion,
  IdempotencyKey,
  IssuedMaterialQuantity,
  LaborDuration,
  MachineDuration,
  MetadataCollection,
  PlannedQuantity,
  QuantityWithUnit,
  RequestedQuantity,
  RequiredMaterialQuantity,
  ReturnedMaterialQuantity,
  RejectedQuantity,
  ReworkQuantity,
  RunTime,
  ScrapQuantity,
  SetupTime,
  UnitOfMeasure,
  VersionIdentifier,
  YieldPercentage,
  CycleTime,
  ExpectedVersion,
} from "../contracts";
import { ManufacturingDomainError } from "./errors";
import { createExpectedVersion, createExecutionVersion } from "./identifiers";

function assertFinite(value: number, field: string): void {
  if (!Number.isFinite(value)) {
    throw new ManufacturingDomainError("INVALID_QUANTITY", `${field} must be finite`, false);
  }
}

function assertNonNegative(value: number, field: string): void {
  assertFinite(value, field);
  if (value < 0) {
    throw new ManufacturingDomainError("INVALID_QUANTITY", `${field} must be >= 0`, false);
  }
}

export function createUnitOfMeasure(value: string): UnitOfMeasure {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ManufacturingDomainError("INVALID_QUANTITY", "unit of measure is required", false);
  }
  return value as UnitOfMeasure;
}

export function createQuantityWithUnit(value: number, unitOfMeasure: UnitOfMeasure): QuantityWithUnit {
  assertNonNegative(value, "quantity.value");
  return Object.freeze({ value, unitOfMeasure });
}

export function createRequestedQuantity(value: number, unit: UnitOfMeasure): RequestedQuantity {
  return createQuantityWithUnit(value, unit) as RequestedQuantity;
}

export function createPlannedQuantity(value: number, unit: UnitOfMeasure): PlannedQuantity {
  return createQuantityWithUnit(value, unit) as PlannedQuantity;
}

export function createCompletedQuantity(value: number, unit: UnitOfMeasure): CompletedQuantity {
  return createQuantityWithUnit(value, unit) as CompletedQuantity;
}

export function createRejectedQuantity(value: number, unit: UnitOfMeasure): RejectedQuantity {
  return createQuantityWithUnit(value, unit) as RejectedQuantity;
}

export function createScrapQuantity(value: number, unit: UnitOfMeasure): ScrapQuantity {
  return createQuantityWithUnit(value, unit) as ScrapQuantity;
}

export function createReworkQuantity(value: number, unit: UnitOfMeasure): ReworkQuantity {
  return createQuantityWithUnit(value, unit) as ReworkQuantity;
}

export function createRequiredMaterialQuantity(value: number, unit: UnitOfMeasure): RequiredMaterialQuantity {
  return createQuantityWithUnit(value, unit) as RequiredMaterialQuantity;
}

export function createIssuedMaterialQuantity(value: number, unit: UnitOfMeasure): IssuedMaterialQuantity {
  return createQuantityWithUnit(value, unit) as IssuedMaterialQuantity;
}

export function createConsumedMaterialQuantity(value: number, unit: UnitOfMeasure): ConsumedMaterialQuantity {
  return createQuantityWithUnit(value, unit) as ConsumedMaterialQuantity;
}

export function createReturnedMaterialQuantity(value: number, unit: UnitOfMeasure): ReturnedMaterialQuantity {
  return createQuantityWithUnit(value, unit) as ReturnedMaterialQuantity;
}

function createDuration(value: number, field: string): DurationInMinutes {
  if (!Number.isFinite(value) || value < 0) {
    throw new ManufacturingDomainError("INVALID_QUANTITY", `${field} must be a non-negative finite duration`, false);
  }
  return value as DurationInMinutes;
}

export function createCycleTime(minutes: number): CycleTime {
  return createDuration(minutes, "cycleTime") as CycleTime;
}

export function createSetupTime(minutes: number): SetupTime {
  return createDuration(minutes, "setupTime") as SetupTime;
}

export function createRunTime(minutes: number): RunTime {
  return createDuration(minutes, "runTime") as RunTime;
}

export function createDowntimeDuration(minutes: number): DowntimeDuration {
  return createDuration(minutes, "downtimeDuration") as DowntimeDuration;
}

export function createLaborDuration(minutes: number): LaborDuration {
  return createDuration(minutes, "laborDuration") as LaborDuration;
}

export function createMachineDuration(minutes: number): MachineDuration {
  return createDuration(minutes, "machineDuration") as MachineDuration;
}

export function createYieldPercentage(value: number): YieldPercentage {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new ManufacturingDomainError("INVALID_QUANTITY", "yield percentage must be within 0-100", false);
  }
  return value as YieldPercentage;
}

export function createEffectiveDateRange(startAt: string, endAt: string): EffectiveDateRange {
  const start = Date.parse(startAt);
  const end = Date.parse(endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new ManufacturingDomainError("INVALID_COMMAND", "effective date range values must be valid ISO timestamps", false);
  }
  if (end < start) {
    throw new ManufacturingDomainError("INVALID_COMMAND", "effective date range end must be >= start", false);
  }
  return Object.freeze({ startAt, endAt });
}

export function createVersionIdentifier(value: string): VersionIdentifier {
  if (!isSemverVersion(value)) {
    throw new ManufacturingDomainError("INVALID_IDENTIFIER", "version identifier must be semantic version", false);
  }
  return value as VersionIdentifier;
}

export function createConcurrencyToken(value: string): ConcurrencyToken {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ManufacturingDomainError("INVALID_IDENTIFIER", "concurrency token is required", false);
  }
  return value as ConcurrencyToken;
}

export function createIdempotencyKey(value: string): IdempotencyKey {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ManufacturingDomainError("INVALID_IDENTIFIER", "idempotency key is required", false);
  }
  return value as IdempotencyKey;
}

export function assertExpectedVersionMatches(currentVersion: number, expectedVersion: ExpectedVersion): void {
  if (currentVersion !== expectedVersion) {
    throw new ManufacturingDomainError(
      "STALE_EXPECTED_VERSION",
      `stale expected version: expected ${expectedVersion}, current ${currentVersion}`,
      false,
    );
  }
}

export function assertExecutionVersionMonotonic(previous: ExecutionVersion, next: ExecutionVersion): void {
  if (next <= previous) {
    throw new ManufacturingDomainError("STALE_EXPECTED_VERSION", "execution version must increase monotonically", false);
  }
}

export function nextExecutionVersion(current: ExecutionVersion): ExecutionVersion {
  return createExecutionVersion(current + 1);
}

export function assertVersionIdentifierMonotonic(previous: VersionIdentifier, next: VersionIdentifier): void {
  if (compareSemverVersions(previous, next) >= 0) {
    throw new ManufacturingDomainError("STALE_EXPECTED_VERSION", "semantic version identifier must increase monotonically", false);
  }
}

export function createMetadataCollection(input: Record<string, string | number | boolean | null>): MetadataCollection {
  const keys = Object.keys(input);
  if (keys.some((key) => key.trim().length === 0)) {
    throw new ManufacturingDomainError("INVALID_COMMAND", "metadata keys must be non-empty", false);
  }
  return Object.freeze({ ...input });
}

export function createExpectedVersionPrimitive(value: number): ExpectedVersion {
  return createExpectedVersion(value);
}
