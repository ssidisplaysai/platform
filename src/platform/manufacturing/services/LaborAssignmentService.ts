import { compareDeterministicStrings, deterministicSort } from "../../shared";
import type {
  CorrelationIdentifier,
  IdempotencyKey,
  LaborAssignment,
  LaborAssignmentCommand,
  TenantId,
} from "../contracts";
import { ManufacturingDomainError } from "../domain";
import type { ManufacturingAuditSinkProvider, ManufacturingClockProvider } from "../integration";
import type { ManufacturingWorkOrderService } from "./ManufacturingWorkOrderService";
import type { OperationExecutionService } from "./OperationExecutionService";
import type { ProductionCellService } from "./ProductionCellService";
import type { WorkCenterService } from "./WorkCenterService";

type StoredIdempotency = Readonly<{
  payloadFingerprint: string;
  result: LaborAssignment;
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

export class LaborAssignmentService {
  private readonly byId = new Map<string, LaborAssignment>();
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

  async assignLabor(command: LaborAssignmentCommand): Promise<LaborAssignment> {
    const key = `${command.tenantId}:LABOR_ASSIGNMENT:${command.idempotencyKey}`;
    const payloadFingerprint = createFingerprint(command);
    const replay = this.idempotency.get(key);
    if (replay) {
      if (replay.payloadFingerprint !== payloadFingerprint) {
        throw new ManufacturingDomainError("CONFLICTING_IDEMPOTENCY_PAYLOAD", "conflicting idempotency payload", false);
      }
      await this.audit("Labor assignment replay accepted.", command.tenantId, command.idempotencyKey, command.correlationId, {
        laborAssignmentId: replay.result.laborAssignmentId,
      });
      return structuredClone(replay.result);
    }

    this.assertTimeOrder(command.plannedStartAt, command.plannedEndAt);
    if (command.laborRef.tenantId !== command.tenantId) {
      throw new ManufacturingDomainError("INVALID_LABOR_REFERENCE", "labor reference tenant mismatch", false);
    }

    if (this.byId.has(command.laborAssignmentId as string)) {
      throw new ManufacturingDomainError("RESOURCE_ASSIGNMENT_CONFLICT", "duplicate labor assignment id", false);
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

    const created: LaborAssignment = {
      laborAssignmentId: command.laborAssignmentId,
      tenantId: command.tenantId,
      workOrderId: command.workOrderId,
      operationExecutionId: command.operationExecutionId,
      workCenterId: command.workCenterId,
      productionCellId: command.productionCellId,
      laborRef: command.laborRef,
      roleCode: command.roleCode,
      status: "ASSIGNED",
      actualStartAt: undefined,
      actualEndAt: undefined,
      effectiveRange:
        command.plannedStartAt && command.plannedEndAt
          ? {
              startAt: command.plannedStartAt,
              endAt: command.plannedEndAt,
            }
          : undefined,
      laborDuration: undefined,
      idempotencyKey: command.idempotencyKey,
      correlationId: command.correlationId,
      metadata: command.metadata,
      version: 1,
    };

    this.byId.set(created.laborAssignmentId as string, created);
    const opKey = `${created.tenantId}:${created.operationExecutionId}`;
    const opIds = this.byOperation.get(opKey) ?? [];
    this.byOperation.set(opKey, [...opIds, created.laborAssignmentId as string]);

    this.idempotency.set(key, {
      payloadFingerprint,
      result: structuredClone(created),
    });

    this.onAssignmentChanged?.(command.tenantId, command.workOrderId as string);

    await this.audit("Labor assignment created.", command.tenantId, command.idempotencyKey, command.correlationId, {
      laborAssignmentId: created.laborAssignmentId,
      operationExecutionId: created.operationExecutionId,
      laborReferenceId: created.laborRef.personOrContactId,
    });

    return structuredClone(created);
  }

  startLabor(input: {
    tenantId: TenantId;
    laborAssignmentId: LaborAssignment["laborAssignmentId"];
    expectedVersion: number;
    startedAt: string;
    idempotencyKey: IdempotencyKey;
    correlationId: CorrelationIdentifier;
  }): LaborAssignment {
    const current = this.require(input.tenantId, input.laborAssignmentId as string);
    if (current.version !== input.expectedVersion) {
      throw new ManufacturingDomainError(
        "STALE_EXPECTED_VERSION",
        `stale expected version: expected ${input.expectedVersion}, current ${current.version}`,
        false,
      );
    }
    if (current.status === "COMPLETED" || current.status === "CANCELLED") {
      throw new ManufacturingDomainError("LABOR_ASSIGNMENT_CONFLICT", "terminal labor assignment cannot be started", false);
    }

    const startedAt = parseTimestamp(input.startedAt);
    if (startedAt === undefined) {
      throw new ManufacturingDomainError("INVALID_RESOURCE_ASSIGNMENT", "invalid labor start timestamp", false);
    }

    const next: LaborAssignment = {
      ...current,
      status: "IN_PROGRESS",
      actualStartAt: input.startedAt,
      version: current.version + 1,
    };
    this.byId.set(next.laborAssignmentId as string, next);
    return structuredClone(next);
  }

  pauseLabor(input: {
    tenantId: TenantId;
    laborAssignmentId: LaborAssignment["laborAssignmentId"];
    expectedVersion: number;
  }): LaborAssignment {
    const current = this.require(input.tenantId, input.laborAssignmentId as string);
    if (current.version !== input.expectedVersion) {
      throw new ManufacturingDomainError(
        "STALE_EXPECTED_VERSION",
        `stale expected version: expected ${input.expectedVersion}, current ${current.version}`,
        false,
      );
    }
    if (current.status !== "IN_PROGRESS") {
      throw new ManufacturingDomainError("LABOR_ASSIGNMENT_CONFLICT", "labor assignment is not in progress", false);
    }

    const next: LaborAssignment = {
      ...current,
      status: "PAUSED",
      version: current.version + 1,
    };
    this.byId.set(next.laborAssignmentId as string, next);
    return structuredClone(next);
  }

  completeLabor(input: {
    tenantId: TenantId;
    laborAssignmentId: LaborAssignment["laborAssignmentId"];
    expectedVersion: number;
    endedAt: string;
  }): LaborAssignment {
    const current = this.require(input.tenantId, input.laborAssignmentId as string);
    if (current.version !== input.expectedVersion) {
      throw new ManufacturingDomainError(
        "STALE_EXPECTED_VERSION",
        `stale expected version: expected ${input.expectedVersion}, current ${current.version}`,
        false,
      );
    }
    if (!current.actualStartAt) {
      throw new ManufacturingDomainError("INVALID_RESOURCE_ASSIGNMENT", "labor assignment must be started before completion", false);
    }

    const start = parseTimestamp(current.actualStartAt);
    const end = parseTimestamp(input.endedAt);
    if (start === undefined || end === undefined || end < start) {
      throw new ManufacturingDomainError("INVALID_RESOURCE_ASSIGNMENT", "invalid labor completion timestamps", false);
    }

    const durationMinutes = Math.round((end - start) / 60000);
    const next: LaborAssignment = {
      ...current,
      status: "COMPLETED",
      actualEndAt: input.endedAt,
      laborDuration: durationMinutes as LaborAssignment["laborDuration"],
      version: current.version + 1,
    };
    this.byId.set(next.laborAssignmentId as string, next);
    this.onAssignmentChanged?.(next.tenantId, next.workOrderId as string);
    return structuredClone(next);
  }

  getLaborAssignment(tenantId: TenantId, laborAssignmentId: string): LaborAssignment | undefined {
    const found = this.byId.get(laborAssignmentId);
    if (!found || found.tenantId !== tenantId) {
      return undefined;
    }
    return structuredClone(found);
  }

  listLaborAssignments(tenantId: TenantId): LaborAssignment[] {
    return deterministicSort(
      [...this.byId.values()].filter((entry) => entry.tenantId === tenantId),
      (entry) => `${entry.operationExecutionId}:${entry.laborAssignmentId}`,
    ).map((entry) => structuredClone(entry));
  }

  listLaborAssignmentsByOperation(tenantId: TenantId, operationExecutionId: string): LaborAssignment[] {
    const ids = this.byOperation.get(`${tenantId}:${operationExecutionId}`) ?? [];
    return ids
      .map((id) => this.byId.get(id))
      .filter((entry): entry is LaborAssignment => Boolean(entry))
      .map((entry) => structuredClone(entry));
  }

  private require(tenantId: TenantId, laborAssignmentId: string): LaborAssignment {
    const found = this.byId.get(laborAssignmentId);
    if (!found) {
      throw new ManufacturingDomainError("INVALID_RESOURCE_ASSIGNMENT", `labor assignment not found: ${laborAssignmentId}`, false);
    }
    if (found.tenantId !== tenantId) {
      throw new ManufacturingDomainError("TENANT_MISMATCH", "labor assignment tenant mismatch", false);
    }
    return found;
  }

  private assertConflicts(command: LaborAssignmentCommand): void {
    const active = [...this.byId.values()].filter(
      (entry) =>
        entry.tenantId === command.tenantId &&
        entry.status !== "COMPLETED" &&
        entry.status !== "CANCELLED",
    );

    const laborConflict = active.find((entry) => entry.laborRef.personOrContactId === command.laborRef.personOrContactId);
    if (laborConflict) {
      throw new ManufacturingDomainError("LABOR_ASSIGNMENT_CONFLICT", "labor reference already assigned to active execution", false);
    }

    if (!command.workCenterId) {
      return;
    }

    const center = this.dependencies.workCenters.require(command.tenantId, command.workCenterId as string);
    const laborCapacity = center.capacityMetadata.laborCapacity ?? center.capacityMetadata.capacityUnits;
    if (laborCapacity > 1) {
      return;
    }

    const contextConflict = active.find(
      (entry) =>
        entry.workCenterId === command.workCenterId &&
        (!command.productionCellId || entry.productionCellId === command.productionCellId),
    );
    if (contextConflict) {
      throw new ManufacturingDomainError("RESOURCE_ASSIGNMENT_CONFLICT", "work center labor capacity exceeded", false);
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
      eventType: "manufacturing.labor-assignment",
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
