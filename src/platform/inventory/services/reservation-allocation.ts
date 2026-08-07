import { compareDeterministicStrings } from "../../shared";
import type {
  AllocationContract,
  AllocationId,
  AllocationStatus,
  AuditMetadata,
  CommandMetadata,
  ExpectedVersion,
  InventoryBalanceContract,
  InventoryBalanceId,
  InventoryFailureClassification,
  InventoryItemId,
  ReservationContract,
  ReservationId,
  ReservationStatus,
  StorageLocationId,
  TenantId,
  WarehouseId,
} from "../contracts";
import { InventoryDomainError, assertValidTransition, allocationStatusTransitions, reservationStatusTransitions, sortInventoryRecords } from "../domain";
import type { InventoryRuntimeDependencies } from "../integration";
import type { InventoryRuntimeContext, InventoryRuntimeServiceRegistration, InventoryServiceRegistrationHook } from "../runtime";
import { createInventorySlice4Services, type InventorySlice4Services } from "./movement";
import {
  InventoryAllocationQueryService,
  InventoryReservationQueryService,
} from "../queries";
import type { InventoryReferenceValidatorRegistry } from "../integration";

export type ReservationCreateInput = Readonly<{
  reservationId: ReservationId;
  tenantId: TenantId;
  inventoryItemId: InventoryItemId;
  inventoryBalanceId: InventoryBalanceId;
  requestedQuantity: number;
  allowPartial?: boolean;
  warehouseId?: WarehouseId;
  storageLocationId?: StorageLocationId;
  externalRequestReference?: string;
  expiresAt?: string;
  expectedBalanceVersion: ExpectedVersion;
  commandMetadata: CommandMetadata;
  auditMetadata: AuditMetadata;
}>;

export type ReservationReleaseInput = Readonly<{
  reservationId: ReservationId;
  tenantId: TenantId;
  quantity?: number;
  expectedReservationVersion: ExpectedVersion;
  expectedBalanceVersion: ExpectedVersion;
  commandMetadata: CommandMetadata;
  auditMetadata: AuditMetadata;
}>;

export type ReservationExpireInput = Readonly<{
  reservationId: ReservationId;
  tenantId: TenantId;
  expectedReservationVersion: ExpectedVersion;
  expectedBalanceVersion: ExpectedVersion;
  commandMetadata: CommandMetadata;
  auditMetadata: AuditMetadata;
}>;

export type AllocationCreateInput = Readonly<{
  allocationId: AllocationId;
  tenantId: TenantId;
  inventoryItemId: InventoryItemId;
  inventoryBalanceId: InventoryBalanceId;
  requestedQuantity: number;
  allowPartial?: boolean;
  reservationId?: ReservationId;
  expectedReservationVersion?: ExpectedVersion;
  expectedBalanceVersion: ExpectedVersion;
  warehouseId?: WarehouseId;
  storageLocationId?: StorageLocationId;
  externalRequestReference?: string;
  commandMetadata: CommandMetadata;
  auditMetadata: AuditMetadata;
}>;

export type AllocationReleaseInput = Readonly<{
  allocationId: AllocationId;
  tenantId: TenantId;
  quantity?: number;
  expectedAllocationVersion: ExpectedVersion;
  expectedBalanceVersion: ExpectedVersion;
  commandMetadata: CommandMetadata;
  auditMetadata: AuditMetadata;
}>;

export type ReservationToAllocationConversionInput = Readonly<{
  allocationId: AllocationId;
  reservationId: ReservationId;
  tenantId: TenantId;
  inventoryItemId: InventoryItemId;
  inventoryBalanceId: InventoryBalanceId;
  quantity: number;
  expectedReservationVersion: ExpectedVersion;
  expectedBalanceVersion: ExpectedVersion;
  warehouseId?: WarehouseId;
  storageLocationId?: StorageLocationId;
  externalRequestReference?: string;
  commandMetadata: CommandMetadata;
  auditMetadata: AuditMetadata;
}>;

type Slice5IdempotencyRecord = Readonly<{
  tenantId: TenantId;
  idempotencyKey: CommandMetadata["idempotencyKey"];
  fingerprint: string;
  replayType: "reservation" | "allocation";
  replayId: string;
  recordedAt: string;
}>;

type Slice5State = {
  readonly reservations: Map<string, ReservationContract>;
  readonly allocations: Map<string, AllocationContract>;
  readonly idempotency: Map<string, Slice5IdempotencyRecord>;
};

function createSlice5State(): Slice5State {
  return {
    reservations: new Map(),
    allocations: new Map(),
    idempotency: new Map(),
  };
}

function reservationKey(tenantId: TenantId, reservationId: ReservationId): string {
  return `${tenantId}|${reservationId}`;
}

function allocationKey(tenantId: TenantId, allocationId: AllocationId): string {
  return `${tenantId}|${allocationId}`;
}

function idempotencyKey(tenantId: TenantId, key: CommandMetadata["idempotencyKey"]): string {
  return `${tenantId}|${key}`;
}

function nextVersion(version: number): number {
  return version + 1;
}

function assertPositiveQuantity(value: number, classification: InventoryFailureClassification, message: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new InventoryDomainError(classification, message, false);
  }
}

function assertVersion(
  currentVersion: number,
  expectedVersion: ExpectedVersion,
  classification: "STALE_RESERVATION_VERSION" | "STALE_ALLOCATION_VERSION" | "STALE_BALANCE_VERSION",
  label: string,
): void {
  if (currentVersion !== expectedVersion) {
    throw new InventoryDomainError(classification, `${label} stale expected version: expected ${expectedVersion}, current ${currentVersion}`, false);
  }
}

class Slice5AuditRecorder {
  constructor(private readonly dependencies: InventoryRuntimeDependencies) {}

  async record(eventType: string, message: string, commandMetadata: CommandMetadata, details: Record<string, unknown>): Promise<void> {
    await this.dependencies.auditSinkProvider.recordAudit({
      eventType,
      message,
      recordedAt: this.dependencies.clockProvider.now(),
      details: {
        ...details,
        commandId: commandMetadata.commandId,
        correlationId: commandMetadata.correlationId,
        causationId: commandMetadata.causationId,
        idempotencyKey: commandMetadata.idempotencyKey,
        expectedVersion: commandMetadata.expectedVersion,
      },
    });
  }
}

export class ReservationService {
  constructor(
    private readonly slice4: InventorySlice4Services,
    private readonly state: Slice5State,
    private readonly audit: Slice5AuditRecorder,
    private readonly dependencies: InventoryRuntimeDependencies,
  ) {}

  async createReservation(input: ReservationCreateInput): Promise<ReservationContract> {
    const reservationStateKey = reservationKey(input.tenantId, input.reservationId);
    const idempotencyStateKey = idempotencyKey(input.tenantId, input.commandMetadata.idempotencyKey);
    const commandFingerprint = [
      "reservation.create",
      input.reservationId,
      input.tenantId,
      input.inventoryItemId,
      input.inventoryBalanceId,
      input.requestedQuantity,
      input.allowPartial ? "partial" : "full",
      input.warehouseId ?? "",
      input.storageLocationId ?? "",
      input.externalRequestReference ?? "",
      input.expiresAt ?? "",
      input.expectedBalanceVersion,
    ].join("|");

    try {
      const replay = this.resolveIdempotencyReplay(idempotencyStateKey, commandFingerprint, "reservation", input.commandMetadata);
      if (replay) {
        return replay;
      }
      if (this.state.reservations.has(reservationStateKey)) {
        throw new InventoryDomainError("DUPLICATE_RESERVATION_ID", "duplicate reservation identity", false);
      }

      this.assertInventoryItem(input.tenantId, input.inventoryItemId);
      const balance = this.slice4.foundation.inventoryBalanceService.requireBalance(input.tenantId, input.inventoryBalanceId);
      this.assertBalanceScope(balance, input.tenantId, input.inventoryItemId, input.warehouseId, input.storageLocationId);
      await this.validateExternalRequestReference(
        input.tenantId,
        input.inventoryItemId,
        input.externalRequestReference,
        input.commandMetadata,
      );
      assertVersion(balance.version, input.expectedBalanceVersion, "STALE_BALANCE_VERSION", "balance");
      assertPositiveQuantity(input.requestedQuantity, "INVALID_QUANTITY", "reservation quantity must be positive");

      const reservable = balance.availableQuantity;
      if (reservable <= 0) {
        throw new InventoryDomainError("INSUFFICIENT_RESERVABLE_QUANTITY", "no reservable quantity available", false);
      }

      const acceptedQuantity = input.requestedQuantity <= reservable
        ? input.requestedQuantity
        : input.allowPartial
          ? reservable
          : 0;

      if (acceptedQuantity <= 0) {
        throw new InventoryDomainError("OVER_RESERVATION", "requested reservation exceeds reservable quantity", false);
      }

      const updatedBalance = this.slice4.foundation.inventoryBalanceService.applyReserve(balance, {
        expectedVersion: input.expectedBalanceVersion,
        quantity: acceptedQuantity,
      });
      const timestamp = this.dependencies.clockProvider.now();
      const reservation: ReservationContract = {
        reservationId: input.reservationId,
        inventoryBalanceId: input.inventoryBalanceId,
        inventoryItemId: input.inventoryItemId,
        tenantId: input.tenantId,
        status: "ACTIVE",
        requestedQuantity: input.requestedQuantity,
        reservedQuantity: acceptedQuantity,
        remainingQuantity: acceptedQuantity,
        warehouseId: input.warehouseId,
        storageLocationId: input.storageLocationId,
        externalRequestReference: input.externalRequestReference,
        idempotencyKey: input.commandMetadata.idempotencyKey,
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
        expiresAt: input.expiresAt,
        commandMetadata: input.commandMetadata,
        auditMetadata: input.auditMetadata,
      };

      this.slice4.foundation.inventoryBalanceService.replaceBalances([updatedBalance]);
      this.state.reservations.set(reservationStateKey, structuredClone(reservation));
      this.state.idempotency.set(idempotencyStateKey, {
        tenantId: input.tenantId,
        idempotencyKey: input.commandMetadata.idempotencyKey,
        fingerprint: commandFingerprint,
        replayType: "reservation",
        replayId: input.reservationId,
        recordedAt: timestamp,
      });

      await this.audit.record(
        acceptedQuantity < input.requestedQuantity ? "inventory.reservation.partially-accepted" : "inventory.reservation.created",
        "reservation accepted",
        input.commandMetadata,
        {
          action: "CREATE_RESERVATION",
          tenantId: input.tenantId,
          inventoryItemId: input.inventoryItemId,
          reservationId: input.reservationId,
          inventoryBalanceId: input.inventoryBalanceId,
          quantity: acceptedQuantity,
          requestedQuantity: input.requestedQuantity,
          expectedBalanceVersion: input.expectedBalanceVersion,
          priorBalanceVersion: balance.version,
          resultingBalanceVersion: updatedBalance.version,
          resultClassification: acceptedQuantity < input.requestedQuantity ? "PARTIAL_ACCEPTED" : "ACCEPTED",
          success: true,
        },
      );
      return structuredClone(reservation);
    } catch (error) {
      await this.audit.record("inventory.reservation.rejected", "reservation rejected", input.commandMetadata, {
        action: "CREATE_RESERVATION",
        tenantId: input.tenantId,
        inventoryItemId: input.inventoryItemId,
        reservationId: input.reservationId,
        inventoryBalanceId: input.inventoryBalanceId,
        quantity: input.requestedQuantity,
        expectedBalanceVersion: input.expectedBalanceVersion,
        resultClassification: error instanceof InventoryDomainError ? error.classification : "INVALID_RESERVATION_COMMAND",
        success: false,
      });
      throw error;
    }
  }

  async releaseReservation(input: ReservationReleaseInput): Promise<ReservationContract> {
    const idempotencyStateKey = idempotencyKey(input.tenantId, input.commandMetadata.idempotencyKey);
    const commandFingerprint = [
      "reservation.release",
      input.reservationId,
      input.tenantId,
      input.quantity ?? "all",
      input.expectedReservationVersion,
      input.expectedBalanceVersion,
    ].join("|");

    try {
      const replay = this.resolveIdempotencyReplay(idempotencyStateKey, commandFingerprint, "reservation", input.commandMetadata);
      if (replay) {
        return replay;
      }

      const current = this.requireReservation(input.tenantId, input.reservationId);
      this.assertReservationMutable(current.status);
      assertVersion(current.version, input.expectedReservationVersion, "STALE_RESERVATION_VERSION", "reservation");

      const releaseQuantity = input.quantity ?? current.remainingQuantity;
      assertPositiveQuantity(releaseQuantity, "INVALID_RELEASE_QUANTITY", "release quantity must be positive");
      if (releaseQuantity > current.remainingQuantity) {
        throw new InventoryDomainError("INVALID_RELEASE_QUANTITY", "release quantity exceeds reservation remaining quantity", false);
      }

      const balance = this.slice4.foundation.inventoryBalanceService.requireBalance(input.tenantId, current.inventoryBalanceId);
      assertVersion(balance.version, input.expectedBalanceVersion, "STALE_BALANCE_VERSION", "balance");
      const updatedBalance = this.slice4.foundation.inventoryBalanceService.applyReleaseReserved(balance, {
        expectedVersion: input.expectedBalanceVersion,
        quantity: releaseQuantity,
      });

      const remainingQuantity = current.remainingQuantity - releaseQuantity;
      const status: ReservationStatus = remainingQuantity === 0 ? "RELEASED" : "PARTIALLY_RELEASED";
      assertValidTransition(reservationStatusTransitions, current.status, status, "RESERVATION_CONFLICT");

      const updated: ReservationContract = {
        ...current,
        status,
        reservedQuantity: current.reservedQuantity - releaseQuantity,
        remainingQuantity,
        version: nextVersion(current.version),
        updatedAt: this.dependencies.clockProvider.now(),
        commandMetadata: input.commandMetadata,
        auditMetadata: input.auditMetadata,
      };

      this.slice4.foundation.inventoryBalanceService.replaceBalances([updatedBalance]);
      this.state.reservations.set(reservationKey(input.tenantId, input.reservationId), structuredClone(updated));
      this.state.idempotency.set(idempotencyStateKey, {
        tenantId: input.tenantId,
        idempotencyKey: input.commandMetadata.idempotencyKey,
        fingerprint: commandFingerprint,
        replayType: "reservation",
        replayId: input.reservationId,
        recordedAt: this.dependencies.clockProvider.now(),
      });

      await this.audit.record("inventory.reservation.released", "reservation released", input.commandMetadata, {
        action: "RELEASE_RESERVATION",
        tenantId: input.tenantId,
        inventoryItemId: current.inventoryItemId,
        reservationId: current.reservationId,
        inventoryBalanceId: current.inventoryBalanceId,
        quantity: releaseQuantity,
        expectedReservationVersion: input.expectedReservationVersion,
        expectedBalanceVersion: input.expectedBalanceVersion,
        priorReservationVersion: current.version,
        resultingReservationVersion: updated.version,
        priorBalanceVersion: balance.version,
        resultingBalanceVersion: updatedBalance.version,
        resultClassification: "ACCEPTED",
        success: true,
      });

      return structuredClone(updated);
    } catch (error) {
      await this.audit.record("inventory.reservation.release.rejected", "reservation release rejected", input.commandMetadata, {
        action: "RELEASE_RESERVATION",
        tenantId: input.tenantId,
        reservationId: input.reservationId,
        quantity: input.quantity,
        resultClassification: error instanceof InventoryDomainError ? error.classification : "INVALID_RESERVATION_COMMAND",
        success: false,
      });
      throw error;
    }
  }

  async expireReservation(input: ReservationExpireInput): Promise<ReservationContract> {
    const idempotencyStateKey = idempotencyKey(input.tenantId, input.commandMetadata.idempotencyKey);
    const commandFingerprint = [
      "reservation.expire",
      input.reservationId,
      input.tenantId,
      input.expectedReservationVersion,
      input.expectedBalanceVersion,
    ].join("|");

    try {
      const replay = this.resolveIdempotencyReplay(idempotencyStateKey, commandFingerprint, "reservation", input.commandMetadata);
      if (replay) {
        return replay;
      }

      const current = this.requireReservation(input.tenantId, input.reservationId);
      this.assertReservationMutable(current.status);
      assertVersion(current.version, input.expectedReservationVersion, "STALE_RESERVATION_VERSION", "reservation");

      const balance = this.slice4.foundation.inventoryBalanceService.requireBalance(input.tenantId, current.inventoryBalanceId);
      assertVersion(balance.version, input.expectedBalanceVersion, "STALE_BALANCE_VERSION", "balance");

      const releaseQuantity = current.remainingQuantity;
      const updatedBalance = releaseQuantity > 0
        ? this.slice4.foundation.inventoryBalanceService.applyReleaseReserved(balance, {
            expectedVersion: input.expectedBalanceVersion,
            quantity: releaseQuantity,
          })
        : balance;

      const updated: ReservationContract = {
        ...current,
        status: "EXPIRED",
        reservedQuantity: current.reservedQuantity - releaseQuantity,
        remainingQuantity: 0,
        version: nextVersion(current.version),
        updatedAt: this.dependencies.clockProvider.now(),
        commandMetadata: input.commandMetadata,
        auditMetadata: input.auditMetadata,
      };

      if (releaseQuantity > 0) {
        this.slice4.foundation.inventoryBalanceService.replaceBalances([updatedBalance]);
      }
      this.state.reservations.set(reservationKey(input.tenantId, input.reservationId), structuredClone(updated));
      this.state.idempotency.set(idempotencyStateKey, {
        tenantId: input.tenantId,
        idempotencyKey: input.commandMetadata.idempotencyKey,
        fingerprint: commandFingerprint,
        replayType: "reservation",
        replayId: input.reservationId,
        recordedAt: this.dependencies.clockProvider.now(),
      });

      await this.audit.record("inventory.reservation.expired", "reservation expired", input.commandMetadata, {
        action: "EXPIRE_RESERVATION",
        tenantId: input.tenantId,
        inventoryItemId: current.inventoryItemId,
        reservationId: current.reservationId,
        inventoryBalanceId: current.inventoryBalanceId,
        quantity: releaseQuantity,
        expectedReservationVersion: input.expectedReservationVersion,
        expectedBalanceVersion: input.expectedBalanceVersion,
        priorReservationVersion: current.version,
        resultingReservationVersion: updated.version,
        priorBalanceVersion: balance.version,
        resultingBalanceVersion: updatedBalance.version,
        resultClassification: "ACCEPTED",
        success: true,
      });

      return structuredClone(updated);
    } catch (error) {
      await this.audit.record("inventory.reservation.expire.rejected", "reservation expiry rejected", input.commandMetadata, {
        action: "EXPIRE_RESERVATION",
        tenantId: input.tenantId,
        reservationId: input.reservationId,
        resultClassification: error instanceof InventoryDomainError ? error.classification : "INVALID_RESERVATION_COMMAND",
        success: false,
      });
      throw error;
    }
  }

  getReservation(tenantId: TenantId, reservationId: ReservationId): ReservationContract | undefined {
    const found = this.state.reservations.get(reservationKey(tenantId, reservationId));
    return found ? structuredClone(found) : undefined;
  }

  listReservations(tenantId: TenantId): ReservationContract[] {
    return sortInventoryRecords(
      [...this.state.reservations.values()].filter((reservation) => reservation.tenantId === tenantId),
      (reservation) => `${reservation.createdAt}:${reservation.reservationId}`,
    ).map((reservation) => structuredClone(reservation));
  }

  private assertInventoryItem(tenantId: TenantId, inventoryItemId: InventoryItemId): void {
    const item = this.slice4.foundation.inventoryItemService.getInventoryItem(tenantId, inventoryItemId);
    if (!item) {
      throw new InventoryDomainError("INVALID_REFERENCE", "inventory item not found", false);
    }
  }

  private assertBalanceScope(
    balance: InventoryBalanceContract,
    tenantId: TenantId,
    inventoryItemId: InventoryItemId,
    warehouseId?: WarehouseId,
    storageLocationId?: StorageLocationId,
  ): void {
    if (balance.tenantId !== tenantId) {
      throw new InventoryDomainError("TENANT_ISOLATION_VIOLATION", "balance tenant mismatch", false);
    }
    if (balance.inventoryItemId !== inventoryItemId) {
      throw new InventoryDomainError("INVENTORY_ITEM_MISMATCH", "balance inventory item mismatch", false);
    }
    if (warehouseId && balance.warehouseId !== warehouseId) {
      throw new InventoryDomainError("INVALID_WAREHOUSE", "reservation warehouse scope mismatch", false);
    }
    if (storageLocationId && balance.storageLocationId !== storageLocationId) {
      throw new InventoryDomainError("INVALID_LOCATION", "reservation location scope mismatch", false);
    }
  }

  private assertReservationMutable(status: ReservationStatus): void {
    if (status === "EXPIRED") {
      throw new InventoryDomainError("EXPIRED_RESERVATION", "reservation is expired", false);
    }
    if (status === "CANCELLED" || status === "RELEASED" || status === "FULFILLED") {
      throw new InventoryDomainError("TERMINAL_RESERVATION_MUTATION", "reservation is in terminal state", false);
    }
  }

  private async validateExternalRequestReference(
    tenantId: TenantId,
    inventoryItemId: InventoryItemId,
    externalRequestReference: string | undefined,
    commandMetadata: CommandMetadata,
  ): Promise<void> {
    if (!externalRequestReference) {
      return;
    }

    await this.slice4.foundation.referenceValidationService.validate(
      {
        referenceType: "DOCUMENT",
        referenceId: externalRequestReference,
        tenantId,
        policy: "OPTIONAL",
        metadata: {
          inventoryItemId,
        },
      },
      commandMetadata,
    );
  }

  private requireReservation(tenantId: TenantId, reservationId: ReservationId): ReservationContract {
    const found = this.state.reservations.get(reservationKey(tenantId, reservationId));
    if (!found) {
      throw new InventoryDomainError("INVALID_RESERVATION", "reservation not found", false);
    }
    return structuredClone(found);
  }

  private resolveIdempotencyReplay(
    idempotencyStateKey: string,
    fingerprint: string,
    replayType: Slice5IdempotencyRecord["replayType"],
    commandMetadata: CommandMetadata,
  ): ReservationContract | undefined {
    const idempotencyRecord = this.state.idempotency.get(idempotencyStateKey);
    if (!idempotencyRecord) {
      return undefined;
    }
    if (idempotencyRecord.fingerprint !== fingerprint || idempotencyRecord.replayType !== replayType) {
      throw new InventoryDomainError("CONFLICTING_IDEMPOTENCY_PAYLOAD", "conflicting idempotency payload", false);
    }

    const replayReservation = this.state.reservations.get(reservationKey(idempotencyRecord.tenantId, idempotencyRecord.replayId as ReservationId));
    if (!replayReservation) {
      throw new InventoryDomainError("ATOMICITY_FAILURE", "idempotency replay target missing", false);
    }

    void this.audit.record("inventory.idempotency.replay", "reservation command replayed", commandMetadata, {
      action: "IDEMPOTENT_REPLAY",
      tenantId: replayReservation.tenantId,
      reservationId: replayReservation.reservationId,
      inventoryItemId: replayReservation.inventoryItemId,
      inventoryBalanceId: replayReservation.inventoryBalanceId,
      quantity: replayReservation.remainingQuantity,
      resultClassification: "IDEMPOTENT_REPLAY",
      success: true,
    });

    return structuredClone(replayReservation);
  }
}

export class AllocationService {
  constructor(
    private readonly slice4: InventorySlice4Services,
    private readonly state: Slice5State,
    private readonly audit: Slice5AuditRecorder,
    private readonly dependencies: InventoryRuntimeDependencies,
  ) {}

  async createAllocation(input: AllocationCreateInput): Promise<AllocationContract> {
    if (input.reservationId) {
      if (input.expectedReservationVersion === undefined) {
        throw new InventoryDomainError("INVALID_ALLOCATION_COMMAND", "expected reservation version is required when reservation is supplied", false);
      }
      return this.convertReservationToAllocation({
        allocationId: input.allocationId,
        reservationId: input.reservationId,
        tenantId: input.tenantId,
        inventoryItemId: input.inventoryItemId,
        inventoryBalanceId: input.inventoryBalanceId,
        quantity: input.requestedQuantity,
        expectedReservationVersion: input.expectedReservationVersion,
        expectedBalanceVersion: input.expectedBalanceVersion,
        warehouseId: input.warehouseId,
        storageLocationId: input.storageLocationId,
        externalRequestReference: input.externalRequestReference,
        commandMetadata: input.commandMetadata,
        auditMetadata: input.auditMetadata,
      });
    }

    const allocationStateKey = allocationKey(input.tenantId, input.allocationId);
    const idempotencyStateKey = idempotencyKey(input.tenantId, input.commandMetadata.idempotencyKey);
    const commandFingerprint = [
      "allocation.create",
      input.allocationId,
      input.tenantId,
      input.inventoryItemId,
      input.inventoryBalanceId,
      input.requestedQuantity,
      input.allowPartial ? "partial" : "full",
      input.warehouseId ?? "",
      input.storageLocationId ?? "",
      input.externalRequestReference ?? "",
      input.expectedBalanceVersion,
    ].join("|");

    try {
      const replay = this.resolveIdempotencyReplay(idempotencyStateKey, commandFingerprint, "allocation", input.commandMetadata);
      if (replay) {
        return replay;
      }
      if (this.state.allocations.has(allocationStateKey)) {
        throw new InventoryDomainError("DUPLICATE_ALLOCATION_ID", "duplicate allocation identity", false);
      }

      this.assertInventoryItem(input.tenantId, input.inventoryItemId);
      const balance = this.slice4.foundation.inventoryBalanceService.requireBalance(input.tenantId, input.inventoryBalanceId);
      this.assertBalanceScope(balance, input.tenantId, input.inventoryItemId, input.warehouseId, input.storageLocationId);
      await this.validateExternalRequestReference(
        input.tenantId,
        input.inventoryItemId,
        input.externalRequestReference,
        input.commandMetadata,
      );
      assertVersion(balance.version, input.expectedBalanceVersion, "STALE_BALANCE_VERSION", "balance");
      assertPositiveQuantity(input.requestedQuantity, "INVALID_QUANTITY", "allocation quantity must be positive");

      const allocatable = balance.availableQuantity;
      if (allocatable <= 0) {
        throw new InventoryDomainError("INSUFFICIENT_ALLOCATABLE_QUANTITY", "no allocatable quantity available", false);
      }

      const acceptedQuantity = input.requestedQuantity <= allocatable
        ? input.requestedQuantity
        : input.allowPartial
          ? allocatable
          : 0;

      if (acceptedQuantity <= 0) {
        throw new InventoryDomainError("OVER_ALLOCATION", "requested allocation exceeds allocatable quantity", false);
      }

      const updatedBalance = this.slice4.foundation.inventoryBalanceService.applyAllocate(balance, {
        expectedVersion: input.expectedBalanceVersion,
        quantity: acceptedQuantity,
      });
      const timestamp = this.dependencies.clockProvider.now();
      const allocation: AllocationContract = {
        allocationId: input.allocationId,
        inventoryBalanceId: input.inventoryBalanceId,
        reservationId: undefined,
        inventoryItemId: input.inventoryItemId,
        tenantId: input.tenantId,
        status: "ACTIVE",
        allocatedQuantity: acceptedQuantity,
        remainingQuantity: acceptedQuantity,
        warehouseId: input.warehouseId,
        storageLocationId: input.storageLocationId,
        binId: balance.binId,
        externalRequestReference: input.externalRequestReference,
        idempotencyKey: input.commandMetadata.idempotencyKey,
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
        commandMetadata: input.commandMetadata,
        auditMetadata: input.auditMetadata,
      };

      this.slice4.foundation.inventoryBalanceService.replaceBalances([updatedBalance]);
      this.state.allocations.set(allocationStateKey, structuredClone(allocation));
      this.state.idempotency.set(idempotencyStateKey, {
        tenantId: input.tenantId,
        idempotencyKey: input.commandMetadata.idempotencyKey,
        fingerprint: commandFingerprint,
        replayType: "allocation",
        replayId: input.allocationId,
        recordedAt: timestamp,
      });

      await this.audit.record("inventory.allocation.created", "allocation accepted", input.commandMetadata, {
        action: "CREATE_ALLOCATION",
        tenantId: input.tenantId,
        inventoryItemId: input.inventoryItemId,
        allocationId: input.allocationId,
        inventoryBalanceId: input.inventoryBalanceId,
        quantity: acceptedQuantity,
        requestedQuantity: input.requestedQuantity,
        expectedBalanceVersion: input.expectedBalanceVersion,
        priorBalanceVersion: balance.version,
        resultingBalanceVersion: updatedBalance.version,
        resultClassification: acceptedQuantity < input.requestedQuantity ? "PARTIAL_ACCEPTED" : "ACCEPTED",
        success: true,
      });

      return structuredClone(allocation);
    } catch (error) {
      await this.audit.record("inventory.allocation.rejected", "allocation rejected", input.commandMetadata, {
        action: "CREATE_ALLOCATION",
        tenantId: input.tenantId,
        inventoryItemId: input.inventoryItemId,
        allocationId: input.allocationId,
        inventoryBalanceId: input.inventoryBalanceId,
        quantity: input.requestedQuantity,
        resultClassification: error instanceof InventoryDomainError ? error.classification : "INVALID_ALLOCATION_COMMAND",
        success: false,
      });
      throw error;
    }
  }

  async releaseAllocation(input: AllocationReleaseInput): Promise<AllocationContract> {
    const idempotencyStateKey = idempotencyKey(input.tenantId, input.commandMetadata.idempotencyKey);
    const commandFingerprint = [
      "allocation.release",
      input.allocationId,
      input.tenantId,
      input.quantity ?? "all",
      input.expectedAllocationVersion,
      input.expectedBalanceVersion,
    ].join("|");

    try {
      const replay = this.resolveIdempotencyReplay(idempotencyStateKey, commandFingerprint, "allocation", input.commandMetadata);
      if (replay) {
        return replay;
      }

      const current = this.requireAllocation(input.tenantId, input.allocationId);
      this.assertAllocationMutable(current.status);
      assertVersion(current.version, input.expectedAllocationVersion, "STALE_ALLOCATION_VERSION", "allocation");

      const releaseQuantity = input.quantity ?? current.remainingQuantity;
      assertPositiveQuantity(releaseQuantity, "INVALID_RELEASE_QUANTITY", "release quantity must be positive");
      if (releaseQuantity > current.remainingQuantity) {
        throw new InventoryDomainError("INVALID_RELEASE_QUANTITY", "release quantity exceeds allocation remaining quantity", false);
      }

      const balance = this.slice4.foundation.inventoryBalanceService.requireBalance(input.tenantId, current.inventoryBalanceId);
      assertVersion(balance.version, input.expectedBalanceVersion, "STALE_BALANCE_VERSION", "balance");
      const updatedBalance = this.slice4.foundation.inventoryBalanceService.applyReleaseAllocated(balance, {
        expectedVersion: input.expectedBalanceVersion,
        quantity: releaseQuantity,
      });

      const remainingQuantity = current.remainingQuantity - releaseQuantity;
      const status: AllocationStatus = remainingQuantity === 0 ? "RELEASED" : "PARTIALLY_RELEASED";
      assertValidTransition(allocationStatusTransitions, current.status, status, "ALLOCATION_CONFLICT");

      const updated: AllocationContract = {
        ...current,
        status,
        remainingQuantity,
        version: nextVersion(current.version),
        updatedAt: this.dependencies.clockProvider.now(),
        commandMetadata: input.commandMetadata,
        auditMetadata: input.auditMetadata,
      };

      this.slice4.foundation.inventoryBalanceService.replaceBalances([updatedBalance]);
      this.state.allocations.set(allocationKey(input.tenantId, input.allocationId), structuredClone(updated));
      this.state.idempotency.set(idempotencyStateKey, {
        tenantId: input.tenantId,
        idempotencyKey: input.commandMetadata.idempotencyKey,
        fingerprint: commandFingerprint,
        replayType: "allocation",
        replayId: input.allocationId,
        recordedAt: this.dependencies.clockProvider.now(),
      });

      await this.audit.record("inventory.allocation.released", "allocation released", input.commandMetadata, {
        action: "RELEASE_ALLOCATION",
        tenantId: input.tenantId,
        inventoryItemId: current.inventoryItemId,
        allocationId: current.allocationId,
        inventoryBalanceId: current.inventoryBalanceId,
        quantity: releaseQuantity,
        expectedAllocationVersion: input.expectedAllocationVersion,
        expectedBalanceVersion: input.expectedBalanceVersion,
        priorAllocationVersion: current.version,
        resultingAllocationVersion: updated.version,
        priorBalanceVersion: balance.version,
        resultingBalanceVersion: updatedBalance.version,
        resultClassification: "ACCEPTED",
        success: true,
      });

      return structuredClone(updated);
    } catch (error) {
      await this.audit.record("inventory.allocation.release.rejected", "allocation release rejected", input.commandMetadata, {
        action: "RELEASE_ALLOCATION",
        tenantId: input.tenantId,
        allocationId: input.allocationId,
        quantity: input.quantity,
        resultClassification: error instanceof InventoryDomainError ? error.classification : "INVALID_ALLOCATION_COMMAND",
        success: false,
      });
      throw error;
    }
  }

  async convertReservationToAllocation(input: ReservationToAllocationConversionInput): Promise<AllocationContract> {
    const allocationStateKey = allocationKey(input.tenantId, input.allocationId);
    const idempotencyStateKey = idempotencyKey(input.tenantId, input.commandMetadata.idempotencyKey);
    const commandFingerprint = [
      "reservation.convert",
      input.allocationId,
      input.reservationId,
      input.tenantId,
      input.inventoryItemId,
      input.inventoryBalanceId,
      input.quantity,
      input.expectedReservationVersion,
      input.expectedBalanceVersion,
      input.warehouseId ?? "",
      input.storageLocationId ?? "",
      input.externalRequestReference ?? "",
    ].join("|");

    try {
      const replay = this.resolveIdempotencyReplay(idempotencyStateKey, commandFingerprint, "allocation", input.commandMetadata);
      if (replay) {
        return replay;
      }
      if (this.state.allocations.has(allocationStateKey)) {
        throw new InventoryDomainError("DUPLICATE_ALLOCATION_ID", "duplicate allocation identity", false);
      }

      const reservation = this.requireReservation(input.tenantId, input.reservationId);
      if (reservation.status === "EXPIRED") {
        throw new InventoryDomainError("EXPIRED_RESERVATION", "reservation is expired", false);
      }
      if (reservation.status === "CANCELLED" || reservation.status === "RELEASED" || reservation.status === "FULFILLED") {
        throw new InventoryDomainError("TERMINAL_RESERVATION_MUTATION", "reservation is in terminal state", false);
      }
      if (reservation.inventoryItemId !== input.inventoryItemId) {
        throw new InventoryDomainError("INVENTORY_ITEM_MISMATCH", "reservation inventory item mismatch", false);
      }
      if (reservation.inventoryBalanceId !== input.inventoryBalanceId) {
        throw new InventoryDomainError("INVALID_BALANCE", "reservation balance mismatch", false);
      }
      assertVersion(reservation.version, input.expectedReservationVersion, "STALE_RESERVATION_VERSION", "reservation");
      assertPositiveQuantity(input.quantity, "INVALID_CONVERSION_QUANTITY", "conversion quantity must be positive");
      if (input.quantity > reservation.remainingQuantity) {
        throw new InventoryDomainError("INVALID_CONVERSION_QUANTITY", "conversion quantity exceeds reservation remaining quantity", false);
      }

      const balance = this.slice4.foundation.inventoryBalanceService.requireBalance(input.tenantId, input.inventoryBalanceId);
      this.assertBalanceScope(balance, input.tenantId, input.inventoryItemId, input.warehouseId, input.storageLocationId);
      await this.validateExternalRequestReference(
        input.tenantId,
        input.inventoryItemId,
        input.externalRequestReference,
        input.commandMetadata,
      );
      assertVersion(balance.version, input.expectedBalanceVersion, "STALE_BALANCE_VERSION", "balance");

      const updatedBalance = this.slice4.foundation.inventoryBalanceService.applyConvertReservedToAllocated(balance, {
        expectedVersion: input.expectedBalanceVersion,
        quantity: input.quantity,
      });
      const nextReservationRemaining = reservation.remainingQuantity - input.quantity;
      const nextReservationStatus: ReservationStatus = nextReservationRemaining === 0 ? "FULFILLED" : "ACTIVE";
      assertValidTransition(reservationStatusTransitions, reservation.status, nextReservationStatus, "RESERVATION_CONFLICT");
      const updatedReservation: ReservationContract = {
        ...reservation,
        status: nextReservationStatus,
        reservedQuantity: reservation.reservedQuantity - input.quantity,
        remainingQuantity: nextReservationRemaining,
        version: nextVersion(reservation.version),
        updatedAt: this.dependencies.clockProvider.now(),
        commandMetadata: input.commandMetadata,
        auditMetadata: input.auditMetadata,
      };

      const timestamp = this.dependencies.clockProvider.now();
      const allocation: AllocationContract = {
        allocationId: input.allocationId,
        inventoryBalanceId: input.inventoryBalanceId,
        reservationId: input.reservationId,
        inventoryItemId: input.inventoryItemId,
        tenantId: input.tenantId,
        status: "ACTIVE",
        allocatedQuantity: input.quantity,
        remainingQuantity: input.quantity,
        warehouseId: input.warehouseId,
        storageLocationId: input.storageLocationId,
        binId: balance.binId,
        externalRequestReference: input.externalRequestReference,
        idempotencyKey: input.commandMetadata.idempotencyKey,
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
        commandMetadata: input.commandMetadata,
        auditMetadata: input.auditMetadata,
      };

      this.slice4.foundation.inventoryBalanceService.replaceBalances([updatedBalance]);
      this.state.reservations.set(reservationKey(input.tenantId, input.reservationId), structuredClone(updatedReservation));
      this.state.allocations.set(allocationStateKey, structuredClone(allocation));
      this.state.idempotency.set(idempotencyStateKey, {
        tenantId: input.tenantId,
        idempotencyKey: input.commandMetadata.idempotencyKey,
        fingerprint: commandFingerprint,
        replayType: "allocation",
        replayId: input.allocationId,
        recordedAt: timestamp,
      });

      await this.audit.record("inventory.reservation.converted", "reservation converted to allocation", input.commandMetadata, {
        action: "CONVERT_RESERVATION_TO_ALLOCATION",
        tenantId: input.tenantId,
        inventoryItemId: input.inventoryItemId,
        reservationId: input.reservationId,
        allocationId: input.allocationId,
        inventoryBalanceId: input.inventoryBalanceId,
        quantity: input.quantity,
        expectedReservationVersion: input.expectedReservationVersion,
        expectedBalanceVersion: input.expectedBalanceVersion,
        priorReservationVersion: reservation.version,
        resultingReservationVersion: updatedReservation.version,
        priorBalanceVersion: balance.version,
        resultingBalanceVersion: updatedBalance.version,
        resultClassification: "ACCEPTED",
        success: true,
      });

      return structuredClone(allocation);
    } catch (error) {
      await this.audit.record("inventory.reservation.convert.rejected", "reservation conversion rejected", input.commandMetadata, {
        action: "CONVERT_RESERVATION_TO_ALLOCATION",
        tenantId: input.tenantId,
        reservationId: input.reservationId,
        allocationId: input.allocationId,
        inventoryItemId: input.inventoryItemId,
        quantity: input.quantity,
        resultClassification: error instanceof InventoryDomainError ? error.classification : "INVALID_ALLOCATION_COMMAND",
        success: false,
      });
      throw error;
    }
  }

  getAllocation(tenantId: TenantId, allocationId: AllocationId): AllocationContract | undefined {
    const found = this.state.allocations.get(allocationKey(tenantId, allocationId));
    return found ? structuredClone(found) : undefined;
  }

  listAllocations(tenantId: TenantId): AllocationContract[] {
    return sortInventoryRecords(
      [...this.state.allocations.values()].filter((allocation) => allocation.tenantId === tenantId),
      (allocation) => `${allocation.createdAt}:${allocation.allocationId}`,
    ).map((allocation) => structuredClone(allocation));
  }

  private assertInventoryItem(tenantId: TenantId, inventoryItemId: InventoryItemId): void {
    const item = this.slice4.foundation.inventoryItemService.getInventoryItem(tenantId, inventoryItemId);
    if (!item) {
      throw new InventoryDomainError("INVALID_REFERENCE", "inventory item not found", false);
    }
  }

  private assertBalanceScope(
    balance: InventoryBalanceContract,
    tenantId: TenantId,
    inventoryItemId: InventoryItemId,
    warehouseId?: WarehouseId,
    storageLocationId?: StorageLocationId,
  ): void {
    if (balance.tenantId !== tenantId) {
      throw new InventoryDomainError("TENANT_ISOLATION_VIOLATION", "balance tenant mismatch", false);
    }
    if (balance.inventoryItemId !== inventoryItemId) {
      throw new InventoryDomainError("INVENTORY_ITEM_MISMATCH", "balance inventory item mismatch", false);
    }
    if (warehouseId && balance.warehouseId !== warehouseId) {
      throw new InventoryDomainError("INVALID_WAREHOUSE", "allocation warehouse scope mismatch", false);
    }
    if (storageLocationId && balance.storageLocationId !== storageLocationId) {
      throw new InventoryDomainError("INVALID_LOCATION", "allocation location scope mismatch", false);
    }
  }

  private assertAllocationMutable(status: AllocationStatus): void {
    if (status === "CANCELLED" || status === "RELEASED" || status === "FULFILLED") {
      throw new InventoryDomainError("TERMINAL_ALLOCATION_MUTATION", "allocation is in terminal state", false);
    }
  }

  private async validateExternalRequestReference(
    tenantId: TenantId,
    inventoryItemId: InventoryItemId,
    externalRequestReference: string | undefined,
    commandMetadata: CommandMetadata,
  ): Promise<void> {
    if (!externalRequestReference) {
      return;
    }

    await this.slice4.foundation.referenceValidationService.validate(
      {
        referenceType: "DOCUMENT",
        referenceId: externalRequestReference,
        tenantId,
        policy: "OPTIONAL",
        metadata: {
          inventoryItemId,
        },
      },
      commandMetadata,
    );
  }

  private requireReservation(tenantId: TenantId, reservationId: ReservationId): ReservationContract {
    const found = this.state.reservations.get(reservationKey(tenantId, reservationId));
    if (!found) {
      throw new InventoryDomainError("INVALID_RESERVATION", "reservation not found", false);
    }
    return structuredClone(found);
  }

  private requireAllocation(tenantId: TenantId, allocationId: AllocationId): AllocationContract {
    const found = this.state.allocations.get(allocationKey(tenantId, allocationId));
    if (!found) {
      throw new InventoryDomainError("INVALID_ALLOCATION", "allocation not found", false);
    }
    return structuredClone(found);
  }

  private resolveIdempotencyReplay(
    idempotencyStateKey: string,
    fingerprint: string,
    replayType: Slice5IdempotencyRecord["replayType"],
    commandMetadata: CommandMetadata,
  ): AllocationContract | undefined {
    const idempotencyRecord = this.state.idempotency.get(idempotencyStateKey);
    if (!idempotencyRecord) {
      return undefined;
    }
    if (idempotencyRecord.fingerprint !== fingerprint || idempotencyRecord.replayType !== replayType) {
      throw new InventoryDomainError("CONFLICTING_IDEMPOTENCY_PAYLOAD", "conflicting idempotency payload", false);
    }

    const replayAllocation = this.state.allocations.get(allocationKey(idempotencyRecord.tenantId, idempotencyRecord.replayId as AllocationId));
    if (!replayAllocation) {
      throw new InventoryDomainError("ATOMICITY_FAILURE", "idempotency replay target missing", false);
    }

    void this.audit.record("inventory.idempotency.replay", "allocation command replayed", commandMetadata, {
      action: "IDEMPOTENT_REPLAY",
      tenantId: replayAllocation.tenantId,
      allocationId: replayAllocation.allocationId,
      inventoryItemId: replayAllocation.inventoryItemId,
      inventoryBalanceId: replayAllocation.inventoryBalanceId,
      quantity: replayAllocation.remainingQuantity,
      resultClassification: "IDEMPOTENT_REPLAY",
      success: true,
    });

    return structuredClone(replayAllocation);
  }
}

export type InventorySlice5Services = Readonly<{
  slice4: InventorySlice4Services;
  reservationService: ReservationService;
  allocationService: AllocationService;
  reservationQueryService: InventoryReservationQueryService;
  allocationQueryService: InventoryAllocationQueryService;
}>;

export function createInventorySlice5Services(options: {
  dependencies: InventoryRuntimeDependencies;
  validatorRegistry: InventoryReferenceValidatorRegistry;
}): InventorySlice5Services {
  const slice4 = createInventorySlice4Services({
    dependencies: options.dependencies,
    validatorRegistry: options.validatorRegistry,
  });
  const state = createSlice5State();
  const audit = new Slice5AuditRecorder(options.dependencies);
  const reservationService = new ReservationService(slice4, state, audit, options.dependencies);
  const allocationService = new AllocationService(slice4, state, audit, options.dependencies);
  const reservationQueryService = new InventoryReservationQueryService(reservationService);
  const allocationQueryService = new InventoryAllocationQueryService(allocationService);

  return {
    slice4,
    reservationService,
    allocationService,
    reservationQueryService,
    allocationQueryService,
  };
}

export function createInventorySlice5ServiceRegistrationHook(options: {
  validatorRegistry: InventoryReferenceValidatorRegistry;
}): InventoryServiceRegistrationHook {
  return (context: InventoryRuntimeContext) => {
    const services = createInventorySlice5Services({
      dependencies: context.dependencies,
      validatorRegistry: options.validatorRegistry,
    });

    const registrations: InventoryRuntimeServiceRegistration[] = [
      {
        serviceId: "inventory.service.allocation",
        contract: "inventory.service.allocation",
        description: "Slice 5 allocation command service.",
        value: services.allocationService,
      },
      {
        serviceId: "inventory.service.allocation-query",
        contract: "inventory.service.allocation-query",
        description: "Slice 5 allocation query surface.",
        value: services.allocationQueryService,
      },
      {
        serviceId: "inventory.service.bin",
        contract: "inventory.service.bin",
        description: "Slice 3 bin foundation service.",
        value: services.slice4.foundation.binService,
      },
      {
        serviceId: "inventory.service.foundation-query",
        contract: "inventory.service.foundation-query",
        description: "Slice 3 deterministic foundation query service.",
        value: services.slice4.foundationQueries,
      },
      {
        serviceId: "inventory.service.inventory-adjustment",
        contract: "inventory.service.inventory-adjustment",
        description: "Slice 4 inventory adjustment service.",
        value: services.slice4.adjustmentService,
      },
      {
        serviceId: "inventory.service.inventory-balance",
        contract: "inventory.service.inventory-balance",
        description: "Slice 3 inventory balance foundation service.",
        value: services.slice4.foundation.inventoryBalanceService,
      },
      {
        serviceId: "inventory.service.inventory-item",
        contract: "inventory.service.inventory-item",
        description: "Slice 3 inventory item foundation service.",
        value: services.slice4.foundation.inventoryItemService,
      },
      {
        serviceId: "inventory.service.inventory-ledger",
        contract: "inventory.service.inventory-ledger",
        description: "Slice 4 append-only inventory ledger service.",
        value: services.slice4.ledgerService,
      },
      {
        serviceId: "inventory.service.inventory-movement",
        contract: "inventory.service.inventory-movement",
        description: "Slice 4 inventory movement service.",
        value: services.slice4.movementService,
      },
      {
        serviceId: "inventory.service.movement-query",
        contract: "inventory.service.movement-query",
        description: "Slice 4 movement and ledger query service.",
        value: services.slice4.movementQueryService,
      },
      {
        serviceId: "inventory.service.reference-validator-registry",
        contract: "inventory.service.reference-validator-registry",
        description: "Slice 3 bounded reference validator registry.",
        value: options.validatorRegistry,
      },
      {
        serviceId: "inventory.service.reference-validation",
        contract: "inventory.service.reference-validation",
        description: "Slice 7 external reference validation service.",
        value: services.slice4.foundation.referenceValidationService,
      },
      {
        serviceId: "inventory.service.reservation",
        contract: "inventory.service.reservation",
        description: "Slice 5 reservation command service.",
        value: services.reservationService,
      },
      {
        serviceId: "inventory.service.reservation-query",
        contract: "inventory.service.reservation-query",
        description: "Slice 5 reservation query surface.",
        value: services.reservationQueryService,
      },
      {
        serviceId: "inventory.service.storage-location",
        contract: "inventory.service.storage-location",
        description: "Slice 3 storage location foundation service.",
        value: services.slice4.foundation.storageLocationService,
      },
      {
        serviceId: "inventory.service.warehouse",
        contract: "inventory.service.warehouse",
        description: "Slice 3 warehouse foundation service.",
        value: services.slice4.foundation.warehouseService,
      },
    ];

    for (const registration of registrations.sort((left, right) => compareDeterministicStrings(left.serviceId, right.serviceId))) {
      context.host.registerService(registration);
    }
  };
}
