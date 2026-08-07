import { compareDeterministicStrings } from "../../shared";
import type {
  AuditMetadata,
  CommandMetadata,
  ExpectedVersion,
  InventoryBalanceContract,
  InventoryBalanceId,
  InventoryFailureClassification,
  InventoryItemId,
  InventoryLedgerEntryType,
  InventoryMovementReason,
  LedgerEntryContract,
  LedgerEntryId,
  MovementContract,
  MovementId,
  MovementType,
  TenantId,
} from "../contracts";
import { InventoryDomainError } from "../domain";
import { sortInventoryRecords } from "../domain";
import type { InventoryRuntimeAuditRecord, InventoryRuntimeDependencies } from "../integration";
import type { InventoryRuntimeContext, InventoryRuntimeServiceRegistration, InventoryServiceRegistrationHook } from "../runtime";
import {
  createInventoryFoundationServices,
  type InventoryFoundationServices,
} from "./foundation";
import { InventoryFoundationQueryService } from "../queries";
import type { InventoryReferenceValidatorRegistry } from "../integration";

export type InventoryMovementInput = Readonly<{
  movementId: MovementId;
  tenantId: TenantId;
  inventoryItemId: InventoryItemId;
  movementType: Extract<MovementType, "ADJUST_INCREASE" | "ADJUST_DECREASE" | "INTERNAL_MOVE" | "QUARANTINE" | "RELEASE_FROM_QUARANTINE" | "WRITE_OFF">;
  reason: InventoryMovementReason;
  quantity: number;
  sourceBalanceId?: InventoryBalanceId;
  destinationBalanceId?: InventoryBalanceId;
  expectedSourceVersion?: ExpectedVersion;
  expectedDestinationVersion?: ExpectedVersion;
  commandMetadata: CommandMetadata;
  auditMetadata: AuditMetadata;
}>;

export type InventoryAdjustmentInput = Readonly<{
  movementId: MovementId;
  tenantId: TenantId;
  inventoryItemId: InventoryItemId;
  movementType: Extract<MovementType, "ADJUST_INCREASE" | "ADJUST_DECREASE">;
  reason: InventoryMovementReason;
  quantity: number;
  balanceId: InventoryBalanceId;
  expectedVersion: ExpectedVersion;
  commandMetadata: CommandMetadata;
  auditMetadata: AuditMetadata;
}>;

type InventoryIdempotencyRecord = Readonly<{
  tenantId: TenantId;
  idempotencyKey: CommandMetadata["idempotencyKey"];
  fingerprint: string;
  movementId: MovementId;
  recordedAt: string;
}>;

type MovementState = {
  readonly movements: Map<string, MovementContract>;
  readonly movementLedgerIds: Map<string, readonly LedgerEntryId[]>;
  readonly ledgerEntries: Map<string, LedgerEntryContract>;
  readonly idempotency: Map<string, InventoryIdempotencyRecord>;
  sequence: number;
};

function movementKey(tenantId: TenantId, movementId: MovementId): string {
  return `${tenantId}|${movementId}`;
}

function ledgerKey(tenantId: TenantId, ledgerEntryId: LedgerEntryId): string {
  return `${tenantId}|${ledgerEntryId}`;
}

function idempotencyKey(tenantId: TenantId, key: CommandMetadata["idempotencyKey"]): string {
  return `${tenantId}|${key}`;
}

function createMovementState(): MovementState {
  return {
    movements: new Map(),
    movementLedgerIds: new Map(),
    ledgerEntries: new Map(),
    idempotency: new Map(),
    sequence: 0,
  };
}

function fingerprint(input: InventoryMovementInput): string {
  return [
    input.movementId,
    input.tenantId,
    input.inventoryItemId,
    input.movementType,
    input.reason,
    String(input.quantity),
    input.sourceBalanceId,
    input.destinationBalanceId,
    String(input.expectedSourceVersion ?? ""),
    String(input.expectedDestinationVersion ?? ""),
  ].join("|");
}

class InventoryMovementAuditRecorder {
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

export class InventoryLedgerService {
  constructor(private readonly state: MovementState, private readonly audit: InventoryMovementAuditRecorder) {}

  ensureAppendable(entries: readonly LedgerEntryContract[]): void {
    for (const entry of entries) {
      if (this.state.ledgerEntries.has(ledgerKey(entry.tenantId, entry.ledgerEntryId))) {
        throw new InventoryDomainError("DUPLICATE_LEDGER_ID", "duplicate ledger id", false);
      }
    }
  }

  append(entries: readonly LedgerEntryContract[]): void {
    this.ensureAppendable(entries);
    for (const entry of entries) {
      this.state.ledgerEntries.set(ledgerKey(entry.tenantId, entry.ledgerEntryId), structuredClone(entry));
    }
  }

  rejectMutation(): never {
    throw new InventoryDomainError("APPEND_ONLY_VIOLATION", "ledger mutation is prohibited", false);
  }

  rejectDeletion(): never {
    throw new InventoryDomainError("APPEND_ONLY_VIOLATION", "ledger deletion is prohibited", false);
  }

  getLedgerEntry(tenantId: TenantId, ledgerEntryId: LedgerEntryId): LedgerEntryContract | undefined {
    const found = this.state.ledgerEntries.get(ledgerKey(tenantId, ledgerEntryId));
    return found ? structuredClone(found) : undefined;
  }

  listLedgerEntries(tenantId: TenantId): LedgerEntryContract[] {
    return sortInventoryRecords(
      [...this.state.ledgerEntries.values()].filter((entry) => entry.tenantId === tenantId),
      (entry) => entry.orderingKey,
    ).map((entry) => structuredClone(entry));
  }

  listLedgerByInventoryItem(tenantId: TenantId, inventoryItemId: InventoryItemId): LedgerEntryContract[] {
    return this.listLedgerEntries(tenantId).filter((entry) => entry.inventoryItemId === inventoryItemId);
  }

  listLedgerByBalance(tenantId: TenantId, balanceId: InventoryBalanceId): LedgerEntryContract[] {
    return this.listLedgerEntries(tenantId).filter((entry) => entry.affectedBalanceId === balanceId);
  }

  listLedgerByMovement(tenantId: TenantId, movementId: MovementId): LedgerEntryContract[] {
    return this.listLedgerEntries(tenantId).filter((entry) => entry.movementId === movementId);
  }

  async verifyLedgerIntegrity(movements: readonly MovementContract[]): Promise<{ valid: true } | { valid: false; reason: string }> {
    for (const movement of movements) {
      const entries = this.listLedgerByMovement(movement.tenantId, movement.movementId);
      if (entries.length !== movement.ledgerEntryIds.length) {
        await this.audit.record("inventory.ledger.integrity.rejected", "ledger integrity rejected", movement.commandMetadata, {
          action: "VERIFY_LEDGER_INTEGRITY",
          tenantId: movement.tenantId,
          movementId: movement.movementId,
          rejectionClassification: "LEDGER_INTEGRITY_VIOLATION",
        });
        return { valid: false, reason: `movement ${movement.movementId} ledger count mismatch` };
      }
    }
    return { valid: true };
  }
}

export class InventoryMovementService {
  constructor(
    private readonly foundation: InventoryFoundationServices,
    private readonly state: MovementState,
    private readonly ledger: InventoryLedgerService,
    private readonly audit: InventoryMovementAuditRecorder,
    private readonly dependencies: InventoryRuntimeDependencies,
  ) {}

  async executeMovement(input: InventoryMovementInput): Promise<MovementContract> {
    const movementStateKey = movementKey(input.tenantId, input.movementId);
    const idempotencyStateKey = idempotencyKey(input.tenantId, input.commandMetadata.idempotencyKey);
    const movementFingerprint = fingerprint(input);

    try {
      this.assertMovementCommand(input);

      const existingIdempotency = this.state.idempotency.get(idempotencyStateKey);
      if (existingIdempotency) {
        if (existingIdempotency.fingerprint !== movementFingerprint) {
          throw new InventoryDomainError("CONFLICTING_IDEMPOTENCY_PAYLOAD", "conflicting idempotency payload", false);
        }
        const replay = this.state.movements.get(movementKey(input.tenantId, existingIdempotency.movementId));
        if (!replay) {
          throw new InventoryDomainError("ATOMICITY_FAILURE", "idempotency replay target missing", false);
        }
        await this.audit.record("inventory.movement.idempotent-replay", "movement idempotent replay", input.commandMetadata, {
          action: "EXECUTE_MOVEMENT",
          tenantId: input.tenantId,
          movementId: replay.movementId,
          success: true,
          replay: true,
        });
        return structuredClone(replay);
      }

      if (this.state.movements.has(movementStateKey)) {
        throw new InventoryDomainError("DUPLICATE_MOVEMENT_ID", "duplicate movement id", false);
      }

      const source = input.sourceBalanceId
        ? this.foundation.inventoryBalanceService.requireBalance(input.tenantId, input.sourceBalanceId)
        : undefined;
      const destination = input.destinationBalanceId
        ? this.foundation.inventoryBalanceService.requireBalance(input.tenantId, input.destinationBalanceId)
        : undefined;

      this.assertMovementReferences(input, source, destination);
      const proposals = this.computeProposedBalances(input, source, destination);
      const entries = this.createLedgerEntries(input, source, destination, proposals);
      this.ledger.ensureAppendable(entries);
      this.assertLedgerCountMatches(input, proposals, entries);

      const movement: MovementContract = {
        movementId: input.movementId,
        tenantId: input.tenantId,
        movementType: input.movementType,
        reason: input.reason,
        inventoryItemId: input.inventoryItemId,
        quantity: input.quantity,
        sourceBalanceId: input.sourceBalanceId,
        sourceWarehouseId: source?.warehouseId,
        sourceStorageLocationId: source?.storageLocationId,
        sourceBinId: source?.binId,
        destinationBalanceId: input.destinationBalanceId,
        destinationWarehouseId: destination?.warehouseId ?? proposals.destination?.warehouseId,
        destinationStorageLocationId: destination?.storageLocationId ?? proposals.destination?.storageLocationId,
        destinationBinId: destination?.binId ?? proposals.destination?.binId,
        expectedSourceVersion: input.expectedSourceVersion,
        expectedDestinationVersion: input.expectedDestinationVersion,
        resultingSourceVersion: proposals.source?.version,
        resultingDestinationVersion: proposals.destination?.version,
        ledgerEntryIds: entries.map((entry) => entry.ledgerEntryId),
        createdAt: this.dependencies.clockProvider.now(),
        commandMetadata: input.commandMetadata,
        auditMetadata: input.auditMetadata,
      };

      this.foundation.inventoryBalanceService.replaceBalances([proposals.source, proposals.destination].filter(Boolean) as InventoryBalanceContract[]);
      this.ledger.append(entries);
      this.state.movements.set(movementStateKey, structuredClone(movement));
      this.state.movementLedgerIds.set(movementStateKey, movement.ledgerEntryIds);
      this.state.idempotency.set(idempotencyStateKey, {
        tenantId: input.tenantId,
        idempotencyKey: input.commandMetadata.idempotencyKey,
        fingerprint: movementFingerprint,
        movementId: movement.movementId,
        recordedAt: this.dependencies.clockProvider.now(),
      });

      await this.audit.record("inventory.movement.accepted", "movement accepted", input.commandMetadata, {
        action: "EXECUTE_MOVEMENT",
        tenantId: input.tenantId,
        inventoryItemId: input.inventoryItemId,
        movementId: input.movementId,
        ledgerEntryIds: movement.ledgerEntryIds,
        quantity: input.quantity,
        success: true,
        resultingSourceVersion: movement.resultingSourceVersion,
        resultingDestinationVersion: movement.resultingDestinationVersion,
      });
      return structuredClone(movement);
    } catch (error) {
      await this.audit.record("inventory.movement.rejected", "movement rejected", input.commandMetadata, {
        action: "EXECUTE_MOVEMENT",
        tenantId: input.tenantId,
        inventoryItemId: input.inventoryItemId,
        movementId: input.movementId,
        quantity: input.quantity,
        success: false,
        rejectionClassification: error instanceof InventoryDomainError ? error.classification : "INVALID_MOVEMENT_COMMAND",
      });
      throw error;
    }
  }

  getInventoryMovement(tenantId: TenantId, movementId: MovementId): MovementContract | undefined {
    const found = this.state.movements.get(movementKey(tenantId, movementId));
    return found ? structuredClone(found) : undefined;
  }

  listInventoryMovements(tenantId: TenantId): MovementContract[] {
    return sortInventoryRecords(
      [...this.state.movements.values()].filter((movement) => movement.tenantId === tenantId),
      (movement) => `${movement.createdAt}:${movement.movementId}`,
    ).map((movement) => structuredClone(movement));
  }

  listMovementsByInventoryItem(tenantId: TenantId, inventoryItemId: InventoryItemId): MovementContract[] {
    return this.listInventoryMovements(tenantId).filter((movement) => movement.inventoryItemId === inventoryItemId);
  }

  listMovementsByBalance(tenantId: TenantId, balanceId: InventoryBalanceId): MovementContract[] {
    return this.listInventoryMovements(tenantId).filter(
      (movement) => movement.sourceBalanceId === balanceId || movement.destinationBalanceId === balanceId,
    );
  }

  private assertMovementCommand(input: InventoryMovementInput): void {
    const allowed: MovementType[] = [
      "ADJUST_INCREASE",
      "ADJUST_DECREASE",
      "INTERNAL_MOVE",
      "QUARANTINE",
      "RELEASE_FROM_QUARANTINE",
      "WRITE_OFF",
    ];
    if (!allowed.includes(input.movementType)) {
      throw new InventoryDomainError("INVALID_MOVEMENT_TYPE", `unsupported movement type: ${input.movementType}`, false);
    }
    if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
      throw new InventoryDomainError("INVALID_QUANTITY", "movement quantity must be positive", false);
    }
    if (!input.reason || input.reason.trim().length === 0) {
      throw new InventoryDomainError("INVALID_MOVEMENT_COMMAND", "movement reason is required", false);
    }
  }

  private assertMovementReferences(
    input: InventoryMovementInput,
    source?: InventoryBalanceContract,
    destination?: InventoryBalanceContract,
  ): void {
    const requiresSource = ["ADJUST_DECREASE", "INTERNAL_MOVE", "QUARANTINE", "RELEASE_FROM_QUARANTINE", "WRITE_OFF"].includes(input.movementType);
    const requiresDestination = ["ADJUST_INCREASE", "INTERNAL_MOVE", "QUARANTINE", "RELEASE_FROM_QUARANTINE"].includes(input.movementType);

    if (requiresSource && (!source || input.expectedSourceVersion === undefined)) {
      throw new InventoryDomainError("INVALID_MOVEMENT_COMMAND", "source balance and expected source version are required", false);
    }
    if (requiresDestination && (!destination || input.expectedDestinationVersion === undefined)) {
      throw new InventoryDomainError("INVALID_MOVEMENT_COMMAND", "destination balance and expected destination version are required", false);
    }
    if ((input.movementType === "INTERNAL_MOVE" || input.movementType === "QUARANTINE" || input.movementType === "RELEASE_FROM_QUARANTINE") && source && destination && source.inventoryBalanceId === destination.inventoryBalanceId) {
      throw new InventoryDomainError("PROHIBITED_SELF_MOVEMENT", "source and destination cannot be identical", false);
    }
    if (source) {
      if (source.tenantId !== input.tenantId) {
        throw new InventoryDomainError("TENANT_ISOLATION_VIOLATION", "source balance tenant mismatch", false);
      }
      if (source.inventoryItemId !== input.inventoryItemId) {
        throw new InventoryDomainError("INVENTORY_ITEM_MISMATCH", "source balance inventory item mismatch", false);
      }
    }
    if (destination) {
      if (destination.tenantId !== input.tenantId) {
        throw new InventoryDomainError("TENANT_ISOLATION_VIOLATION", "destination balance tenant mismatch", false);
      }
      if (destination.inventoryItemId !== input.inventoryItemId) {
        throw new InventoryDomainError("INVENTORY_ITEM_MISMATCH", "destination balance inventory item mismatch", false);
      }
    }
  }

  private computeProposedBalances(
    input: InventoryMovementInput,
    source?: InventoryBalanceContract,
    destination?: InventoryBalanceContract,
  ): { source?: InventoryBalanceContract; destination?: InventoryBalanceContract } {
    switch (input.movementType) {
      case "ADJUST_INCREASE":
        return {
          destination: this.foundation.inventoryBalanceService.applyIncrease(destination!, {
            expectedVersion: input.expectedDestinationVersion!,
            quantity: input.quantity,
          }),
        };
      case "ADJUST_DECREASE":
        return {
          source: this.foundation.inventoryBalanceService.applyDecrease(source!, {
            expectedVersion: input.expectedSourceVersion!,
            quantity: input.quantity,
          }),
        };
      case "INTERNAL_MOVE":
        return {
          source: this.foundation.inventoryBalanceService.applyTransferOut(source!, {
            expectedVersion: input.expectedSourceVersion!,
            quantity: input.quantity,
          }),
          destination: this.foundation.inventoryBalanceService.applyTransferIn(destination!, {
            expectedVersion: input.expectedDestinationVersion!,
            quantity: input.quantity,
          }),
        };
      case "QUARANTINE":
        return {
          source: this.foundation.inventoryBalanceService.applyQuarantine(source!, {
            expectedVersion: input.expectedSourceVersion!,
            quantity: input.quantity,
          }),
          destination: this.foundation.inventoryBalanceService.applyTransferIn(destination!, {
            expectedVersion: input.expectedDestinationVersion!,
            quantity: input.quantity,
          }),
        };
      case "RELEASE_FROM_QUARANTINE":
        return {
          source: this.foundation.inventoryBalanceService.applyReleaseFromQuarantine(source!, {
            expectedVersion: input.expectedSourceVersion!,
            quantity: input.quantity,
          }),
          destination: this.foundation.inventoryBalanceService.applyTransferIn(destination!, {
            expectedVersion: input.expectedDestinationVersion!,
            quantity: input.quantity,
          }),
        };
      case "WRITE_OFF":
        return {
          source: this.foundation.inventoryBalanceService.applyWriteOff(source!, {
            expectedVersion: input.expectedSourceVersion!,
            quantity: input.quantity,
          }),
        };
    }
  }

  private createLedgerEntries(
    input: InventoryMovementInput,
    source: InventoryBalanceContract | undefined,
    destination: InventoryBalanceContract | undefined,
    proposals: { source?: InventoryBalanceContract; destination?: InventoryBalanceContract },
  ): LedgerEntryContract[] {
    const entries: LedgerEntryContract[] = [];
    const correlationId = input.commandMetadata.correlationId;
    const occurredAt = this.dependencies.clockProvider.now();

    const pushEntry = (
      ledgerEntryId: LedgerEntryId,
      before: InventoryBalanceContract,
      after: InventoryBalanceContract,
      quantityDelta: number,
      entryType: InventoryLedgerEntryType,
    ) => {
      const sequence = ++this.state.sequence;
      entries.push({
        ledgerEntryId,
        movementId: input.movementId,
        tenantId: input.tenantId,
        inventoryItemId: input.inventoryItemId,
        affectedBalanceId: before.inventoryBalanceId,
        entryType,
        sequence,
        orderingKey: `${input.tenantId}|${String(sequence).padStart(12, "0")}|${ledgerEntryId}`,
        occurredAt,
        movementType: input.movementType,
        correlationId,
        quantityDelta,
        onHandBefore: before.onHandQuantity,
        onHandAfter: after.onHandQuantity,
        reservedBefore: before.reservedQuantity,
        reservedAfter: after.reservedQuantity,
        allocatedBefore: before.allocatedQuantity,
        allocatedAfter: after.allocatedQuantity,
        availableBefore: before.availableQuantity,
        availableAfter: after.availableQuantity,
        auditEventType: "inventory.ledger.append",
      });
    };

    const identifierProvider = this.dependencies.identifierProvider;
    if (source && proposals.source) {
      pushEntry(
        identifierProvider.createIdentifier("ledger") as LedgerEntryId,
        source,
        proposals.source,
        -input.quantity,
        input.movementType === "WRITE_OFF" ? "WRITE_OFF" : input.movementType === "ADJUST_DECREASE" ? "ADJUSTMENT" : input.movementType === "QUARANTINE" ? "QUARANTINE" : "SOURCE",
      );
    }
    if (destination && proposals.destination) {
      pushEntry(
        identifierProvider.createIdentifier("ledger") as LedgerEntryId,
        destination,
        proposals.destination,
        input.quantity,
        input.movementType === "ADJUST_INCREASE" ? "ADJUSTMENT" : input.movementType === "RELEASE_FROM_QUARANTINE" ? "RELEASE" : "DESTINATION",
      );
    }
    return entries;
  }

  private assertLedgerCountMatches(
    input: InventoryMovementInput,
    proposals: { source?: InventoryBalanceContract; destination?: InventoryBalanceContract },
    entries: readonly LedgerEntryContract[],
  ): void {
    const expectedCount = (proposals.source ? 1 : 0) + (proposals.destination ? 1 : 0);
    if (entries.length !== expectedCount) {
      throw new InventoryDomainError("LEDGER_INTEGRITY_VIOLATION", `ledger entry count mismatch for movement type ${input.movementType}`, false);
    }
  }
}

export class InventoryAdjustmentService {
  constructor(private readonly movementService: InventoryMovementService, private readonly audit: InventoryMovementAuditRecorder) {}

  async applyAdjustment(input: InventoryAdjustmentInput): Promise<MovementContract> {
    try {
      const result = await this.movementService.executeMovement({
        movementId: input.movementId,
        tenantId: input.tenantId,
        inventoryItemId: input.inventoryItemId,
        movementType: input.movementType,
        reason: input.reason,
        quantity: input.quantity,
        sourceBalanceId: input.movementType === "ADJUST_DECREASE" ? input.balanceId : undefined,
        destinationBalanceId: input.movementType === "ADJUST_INCREASE" ? input.balanceId : undefined,
        expectedSourceVersion: input.movementType === "ADJUST_DECREASE" ? input.expectedVersion : undefined,
        expectedDestinationVersion: input.movementType === "ADJUST_INCREASE" ? input.expectedVersion : undefined,
        commandMetadata: input.commandMetadata,
        auditMetadata: input.auditMetadata,
      });
      await this.audit.record("inventory.adjustment.accepted", "adjustment accepted", input.commandMetadata, {
        action: "APPLY_ADJUSTMENT",
        tenantId: input.tenantId,
        movementId: result.movementId,
        inventoryItemId: input.inventoryItemId,
        quantity: input.quantity,
        success: true,
      });
      return result;
    } catch (error) {
      await this.audit.record("inventory.adjustment.rejected", "adjustment rejected", input.commandMetadata, {
        action: "APPLY_ADJUSTMENT",
        tenantId: input.tenantId,
        movementId: input.movementId,
        inventoryItemId: input.inventoryItemId,
        quantity: input.quantity,
        success: false,
        rejectionClassification: error instanceof InventoryDomainError ? error.classification : "INVALID_MOVEMENT_COMMAND",
      });
      throw error;
    }
  }
}

export class InventoryMovementQueryService {
  constructor(
    private readonly foundationQueries: InventoryFoundationQueryService,
    private readonly movementService: InventoryMovementService,
    private readonly ledgerService: InventoryLedgerService,
  ) {}

  getInventoryMovement(tenantId: TenantId, movementId: MovementId): MovementContract | undefined {
    return this.movementService.getInventoryMovement(tenantId, movementId);
  }

  listInventoryMovements(tenantId: TenantId): MovementContract[] {
    return this.movementService.listInventoryMovements(tenantId);
  }

  listMovementsByInventoryItem(tenantId: TenantId, inventoryItemId: InventoryItemId): MovementContract[] {
    return this.movementService.listMovementsByInventoryItem(tenantId, inventoryItemId);
  }

  listMovementsByBalance(tenantId: TenantId, balanceId: InventoryBalanceId): MovementContract[] {
    return this.movementService.listMovementsByBalance(tenantId, balanceId);
  }

  getLedgerEntry(tenantId: TenantId, ledgerEntryId: LedgerEntryId): LedgerEntryContract | undefined {
    return this.ledgerService.getLedgerEntry(tenantId, ledgerEntryId);
  }

  listLedgerEntries(tenantId: TenantId): LedgerEntryContract[] {
    return this.ledgerService.listLedgerEntries(tenantId);
  }

  listLedgerByInventoryItem(tenantId: TenantId, inventoryItemId: InventoryItemId): LedgerEntryContract[] {
    return this.ledgerService.listLedgerByInventoryItem(tenantId, inventoryItemId);
  }

  listLedgerByBalance(tenantId: TenantId, balanceId: InventoryBalanceId): LedgerEntryContract[] {
    return this.ledgerService.listLedgerByBalance(tenantId, balanceId);
  }

  listLedgerByMovement(tenantId: TenantId, movementId: MovementId): LedgerEntryContract[] {
    return this.ledgerService.listLedgerByMovement(tenantId, movementId);
  }

  async verifyLedgerIntegrity(tenantId: TenantId): Promise<{ valid: true } | { valid: false; reason: string }> {
    return this.ledgerService.verifyLedgerIntegrity(this.movementService.listInventoryMovements(tenantId));
  }

  getAvailability(tenantId: TenantId, balanceId: InventoryBalanceId): number | undefined {
    return this.foundationQueries.getAvailability(tenantId, balanceId);
  }
}

export type InventorySlice4Services = Readonly<{
  foundation: InventoryFoundationServices;
  foundationQueries: InventoryFoundationQueryService;
  movementService: InventoryMovementService;
  adjustmentService: InventoryAdjustmentService;
  ledgerService: InventoryLedgerService;
  movementQueryService: InventoryMovementQueryService;
}>;

export function createInventorySlice4Services(options: {
  dependencies: InventoryRuntimeDependencies;
  validatorRegistry: InventoryReferenceValidatorRegistry;
}): InventorySlice4Services {
  const foundation = createInventoryFoundationServices({
    dependencies: options.dependencies,
    validatorRegistry: options.validatorRegistry,
  });
  const foundationQueries = new InventoryFoundationQueryService(foundation);
  const audit = new InventoryMovementAuditRecorder(options.dependencies);
  const movementState = createMovementState();
  const ledgerService = new InventoryLedgerService(movementState, audit);
  const movementService = new InventoryMovementService(foundation, movementState, ledgerService, audit, options.dependencies);
  const adjustmentService = new InventoryAdjustmentService(movementService, audit);
  const movementQueryService = new InventoryMovementQueryService(foundationQueries, movementService, ledgerService);

  return {
    foundation,
    foundationQueries,
    movementService,
    adjustmentService,
    ledgerService,
    movementQueryService,
  };
}

export function createInventorySlice4ServiceRegistrationHook(options: {
  validatorRegistry: InventoryReferenceValidatorRegistry;
}): InventoryServiceRegistrationHook {
  return (context: InventoryRuntimeContext) => {
    const services = createInventorySlice4Services({
      dependencies: context.dependencies,
      validatorRegistry: options.validatorRegistry,
    });

    const registrations: InventoryRuntimeServiceRegistration[] = [
      {
        serviceId: "inventory.service.bin",
        contract: "inventory.service.bin",
        description: "Slice 3 bin foundation service.",
        value: services.foundation.binService,
      },
      {
        serviceId: "inventory.service.foundation-query",
        contract: "inventory.service.foundation-query",
        description: "Slice 3 deterministic foundation query service.",
        value: services.foundationQueries,
      },
      {
        serviceId: "inventory.service.inventory-adjustment",
        contract: "inventory.service.inventory-adjustment",
        description: "Slice 4 inventory adjustment service.",
        value: services.adjustmentService,
      },
      {
        serviceId: "inventory.service.inventory-balance",
        contract: "inventory.service.inventory-balance",
        description: "Slice 3 inventory balance foundation service.",
        value: services.foundation.inventoryBalanceService,
      },
      {
        serviceId: "inventory.service.inventory-item",
        contract: "inventory.service.inventory-item",
        description: "Slice 3 inventory item foundation service.",
        value: services.foundation.inventoryItemService,
      },
      {
        serviceId: "inventory.service.inventory-ledger",
        contract: "inventory.service.inventory-ledger",
        description: "Slice 4 append-only inventory ledger service.",
        value: services.ledgerService,
      },
      {
        serviceId: "inventory.service.inventory-movement",
        contract: "inventory.service.inventory-movement",
        description: "Slice 4 inventory movement service.",
        value: services.movementService,
      },
      {
        serviceId: "inventory.service.movement-query",
        contract: "inventory.service.movement-query",
        description: "Slice 4 movement and ledger query service.",
        value: services.movementQueryService,
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
        value: services.foundation.referenceValidationService,
      },
      {
        serviceId: "inventory.service.storage-location",
        contract: "inventory.service.storage-location",
        description: "Slice 3 storage location foundation service.",
        value: services.foundation.storageLocationService,
      },
      {
        serviceId: "inventory.service.warehouse",
        contract: "inventory.service.warehouse",
        description: "Slice 3 warehouse foundation service.",
        value: services.foundation.warehouseService,
      },
    ];

    for (const registration of registrations.sort((left, right) => compareDeterministicStrings(left.serviceId, right.serviceId))) {
      context.host.registerService(registration);
    }
  };
}
