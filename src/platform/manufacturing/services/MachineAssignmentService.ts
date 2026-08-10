import { compareDeterministicStrings, deterministicSort } from "../../shared";
import type {
  CorrelationIdentifier,
  IdempotencyKey,
  MachineAssignment,
  MachineAssignmentCommand,
  TenantId,
} from "../contracts";
import { ManufacturingDomainError } from "../domain";
import type {
  ManufacturingAuditSinkProvider,
  ManufacturingClockProvider,
} from "../integration";
import type { ManufacturingWorkOrderService } from "./ManufacturingWorkOrderService";
import type { OperationExecutionService } from "./OperationExecutionService";
import type { ProductionCellService } from "./ProductionCellService";
import type { WorkCenterService } from "./WorkCenterService";

type StoredIdempotency = Readonly<{
  payloadFingerprint: string;
  result: MachineAssignment;
}>;

function stableJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stableJson(entry));
  }
  if (value && typeof value === "object") {
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort((left, right) => compareDeterministicStrings(left, right))) {
      normalized[key] = stableJson((value as Record<string, unknown>)[key]);
    }
    return normalized;
  }
  return value;
}

function createFingerprint(payload: unknown): string {
  return JSON.stringify(stableJson(payload));
}

function parseTimestamp(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return parsed;
}

export class MachineAssignmentService {
  private readonly byId = new Map<string, MachineAssignment>();
  private readonly byOperation = new Map<string, string[]>();
  private readonly idempotency = new Map<string, StoredIdempotency>();
  private onAssignmentChanged?: (tenantId: TenantId, workOrderId: string) => void;

  constructor(
    private readonly dependencies: {
      clock: ManufacturingClockProvider;
      audit: ManufacturingAuditSinkProvider;
      workOrders: ManufacturingWorkOrderService;
      operations: OperationExecutionService;
      workCenters: WorkCenterService;
      productionCells: ProductionCellService;
    },
  ) {}

  setReadinessSynchronizer(callback: (tenantId: TenantId, workOrderId: string) => void): void {
    this.onAssignmentChanged = callback;
  }

  async assignMachine(command: MachineAssignmentCommand): Promise<MachineAssignment> {
    const key = `${command.tenantId}:MACHINE_ASSIGNMENT:${command.idempotencyKey}`;
    const payloadFingerprint = createFingerprint(command);
    const replay = this.idempotency.get(key);
    if (replay) {
      if (replay.payloadFingerprint !== payloadFingerprint) {
        throw new ManufacturingDomainError("CONFLICTING_IDEMPOTENCY_PAYLOAD", "conflicting idempotency payload", false);
      }
      await this.audit("Machine assignment replay accepted.", command.tenantId, command.idempotencyKey, command.correlationId, {
        machineAssignmentId: replay.result.machineAssignmentId,
        classification: "INVALID_COMMAND",
      });
      return structuredClone(replay.result);
    }

    this.assertTimeOrder(command.plannedStartAt, command.plannedEndAt);
    if (command.machineRef.tenantId !== command.tenantId) {
      throw new ManufacturingDomainError("TENANT_MISMATCH", "machine asset reference tenant mismatch", false);
    }

    const duplicateById = this.byId.get(command.machineAssignmentId as string);
    if (duplicateById) {
      throw new ManufacturingDomainError("RESOURCE_ASSIGNMENT_CONFLICT", "duplicate machine assignment id", false);
    }

    const workOrder = this.dependencies.workOrders.require(command.tenantId, command.workOrderId);
    if (workOrder.workOrder.version !== command.expectedWorkOrderVersion) {
      throw new ManufacturingDomainError(
        "STALE_EXPECTED_VERSION",
        `stale expected version: expected ${command.expectedWorkOrderVersion}, current ${workOrder.workOrder.version}`,
        false,
      );
    }

    const operation = this.dependencies.operations.getOperationExecution(command.tenantId, command.operationExecutionId as string);
    if (!operation) {
      throw new ManufacturingDomainError("INVALID_RESOURCE_ASSIGNMENT", "operation execution not found", false);
    }
    if (operation.execution.workOrderId !== command.workOrderId) {
      throw new ManufacturingDomainError("INVALID_RESOURCE_ASSIGNMENT", "operation/work-order mismatch", false);
    }
    if (operation.execution.version !== command.expectedOperationVersion) {
      throw new ManufacturingDomainError(
        "STALE_EXPECTED_VERSION",
        `stale expected version: expected ${command.expectedOperationVersion}, current ${operation.execution.version}`,
        false,
      );
    }

    if (command.workCenterId) {
      this.dependencies.workCenters.require(command.tenantId, command.workCenterId as string);
    }
    if (command.productionCellId) {
      const cell = this.dependencies.productionCells.require(command.tenantId, command.productionCellId as string);
      if (command.workCenterId && cell.workCenterId !== command.workCenterId) {
        throw new ManufacturingDomainError("INVALID_RESOURCE_ASSIGNMENT", "production cell/work center mismatch", false);
      }
    }

    this.assertConflicts(command);

    const created: MachineAssignment = {
      machineAssignmentId: command.machineAssignmentId,
      tenantId: command.tenantId,
      workOrderId: command.workOrderId,
      operationExecutionId: command.operationExecutionId,
      workCenterId: command.workCenterId,
      productionCellId: command.productionCellId,
      machineRef: command.machineRef,
      status: "ASSIGNED",
      plannedStartAt: command.plannedStartAt,
      plannedEndAt: command.plannedEndAt,
      effectiveRange:
        command.plannedStartAt && command.plannedEndAt
          ? {
              startAt: command.plannedStartAt,
              endAt: command.plannedEndAt,
            }
          : undefined,
      idempotencyKey: command.idempotencyKey,
      correlationId: command.correlationId,
      metadata: command.metadata,
      version: 1,
    };

    this.byId.set(created.machineAssignmentId as string, created);
    const opKey = `${created.tenantId}:${created.operationExecutionId}`;
    const opIds = this.byOperation.get(opKey) ?? [];
    this.byOperation.set(opKey, [...opIds, created.machineAssignmentId as string]);

    this.idempotency.set(key, {
      payloadFingerprint,
      result: structuredClone(created),
    });

    this.onAssignmentChanged?.(command.tenantId, command.workOrderId as string);

    await this.audit("Machine assignment created.", command.tenantId, command.idempotencyKey, command.correlationId, {
      machineAssignmentId: created.machineAssignmentId,
      operationExecutionId: created.operationExecutionId,
      machineAssetId: created.machineRef.assetId,
      classification: "INVALID_COMMAND",
    });

    return structuredClone(created);
  }

  getMachineAssignment(tenantId: TenantId, machineAssignmentId: string): MachineAssignment | undefined {
    const found = this.byId.get(machineAssignmentId);
    if (!found || found.tenantId !== tenantId) {
      return undefined;
    }
    return structuredClone(found);
  }

  listMachineAssignments(tenantId: TenantId): MachineAssignment[] {
    return deterministicSort(
      [...this.byId.values()].filter((entry) => entry.tenantId === tenantId),
      (entry) => `${entry.operationExecutionId}:${entry.machineAssignmentId}`,
    ).map((entry) => structuredClone(entry));
  }

  listMachineAssignmentsByOperation(tenantId: TenantId, operationExecutionId: string): MachineAssignment[] {
    const ids = this.byOperation.get(`${tenantId}:${operationExecutionId}`) ?? [];
    return ids
      .map((id) => this.byId.get(id))
      .filter((entry): entry is MachineAssignment => Boolean(entry))
      .map((entry) => structuredClone(entry));
  }

  private assertConflicts(command: MachineAssignmentCommand): void {
    const active = [...this.byId.values()].filter(
      (entry) =>
        entry.tenantId === command.tenantId &&
        entry.status !== "COMPLETED" &&
        entry.status !== "CANCELLED",
    );

    const machineConflict = active.find((entry) => entry.machineRef.assetId === command.machineRef.assetId);
    if (machineConflict) {
      throw new ManufacturingDomainError("MACHINE_ASSIGNMENT_CONFLICT", "machine already assigned to active execution", false);
    }

    if (!command.workCenterId) {
      return;
    }

    const center = this.dependencies.workCenters.require(command.tenantId, command.workCenterId as string);
    const machineCapacity = center.capacityMetadata.machineCapacity ?? center.capacityMetadata.capacityUnits;
    if (machineCapacity > 1) {
      return;
    }

    const contextConflict = active.find(
      (entry) =>
        entry.workCenterId === command.workCenterId &&
        (!command.productionCellId || entry.productionCellId === command.productionCellId),
    );
    if (contextConflict) {
      throw new ManufacturingDomainError("RESOURCE_ASSIGNMENT_CONFLICT", "work center machine capacity exceeded", false);
    }
  }

  private assertTimeOrder(startAt?: string, endAt?: string): void {
    const start = parseTimestamp(startAt);
    const end = parseTimestamp(endAt);
    if (startAt && start === undefined) {
      throw new ManufacturingDomainError("INVALID_RESOURCE_ASSIGNMENT", "invalid planned start timestamp", false);
    }
    if (endAt && end === undefined) {
      throw new ManufacturingDomainError("INVALID_RESOURCE_ASSIGNMENT", "invalid planned end timestamp", false);
    }
    if (start !== undefined && end !== undefined && end < start) {
      throw new ManufacturingDomainError("INVALID_RESOURCE_ASSIGNMENT", "planned end must be after planned start", false);
    }
  }

  private async audit(
    message: string,
    tenantId: TenantId,
    idempotencyKey: IdempotencyKey,
    correlationId: CorrelationIdentifier,
    details: Record<string, unknown>,
  ): Promise<void> {
    await this.dependencies.audit.recordAudit({
      eventType: "manufacturing.machine-assignment",
      message,
      recordedAt: this.dependencies.clock.now(),
      details: {
        tenantId,
        idempotencyKey,
        correlationId,
        ...details,
      },
    });
  }
}
