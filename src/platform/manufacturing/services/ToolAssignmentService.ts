import { compareDeterministicStrings, deterministicSort } from "../../shared";
import type {
  CorrelationIdentifier,
  IdempotencyKey,
  TenantId,
  ToolAssignment,
  ToolAssignmentCommand,
} from "../contracts";
import { ManufacturingDomainError } from "../domain";
import type { ManufacturingAuditSinkProvider, ManufacturingClockProvider } from "../integration";
import type { ManufacturingWorkOrderService } from "./ManufacturingWorkOrderService";
import type { OperationExecutionService } from "./OperationExecutionService";
import type { ProductionCellService } from "./ProductionCellService";
import type { WorkCenterService } from "./WorkCenterService";

type StoredIdempotency = Readonly<{
  payloadFingerprint: string;
  result: ToolAssignment;
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

export class ToolAssignmentService {
  private readonly byId = new Map<string, ToolAssignment>();
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

  async assignTool(command: ToolAssignmentCommand): Promise<ToolAssignment> {
    const key = `${command.tenantId}:TOOL_ASSIGNMENT:${command.idempotencyKey}`;
    const payloadFingerprint = createFingerprint(command);
    const replay = this.idempotency.get(key);
    if (replay) {
      if (replay.payloadFingerprint !== payloadFingerprint) {
        throw new ManufacturingDomainError("CONFLICTING_IDEMPOTENCY_PAYLOAD", "conflicting idempotency payload", false);
      }
      await this.audit("Tool assignment replay accepted.", command.tenantId, command.idempotencyKey, command.correlationId, {
        toolAssignmentId: replay.result.toolAssignmentId,
      });
      return structuredClone(replay.result);
    }

    this.assertTimeOrder(command.plannedStartAt, command.plannedEndAt);
    if (command.toolRef.tenantId !== command.tenantId) {
      throw new ManufacturingDomainError("TENANT_MISMATCH", "tool asset reference tenant mismatch", false);
    }

    if (this.byId.has(command.toolAssignmentId as string)) {
      throw new ManufacturingDomainError("RESOURCE_ASSIGNMENT_CONFLICT", "duplicate tool assignment id", false);
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

    const created: ToolAssignment = {
      toolAssignmentId: command.toolAssignmentId,
      tenantId: command.tenantId,
      workOrderId: command.workOrderId,
      operationExecutionId: command.operationExecutionId,
      workCenterId: command.workCenterId,
      productionCellId: command.productionCellId,
      toolRef: command.toolRef,
      status: "ASSIGNED",
      plannedStartAt: command.plannedStartAt,
      plannedEndAt: command.plannedEndAt,
      actualStartAt: undefined,
      actualEndAt: undefined,
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

    this.byId.set(created.toolAssignmentId as string, created);
    const opKey = `${created.tenantId}:${created.operationExecutionId}`;
    const opIds = this.byOperation.get(opKey) ?? [];
    this.byOperation.set(opKey, [...opIds, created.toolAssignmentId as string]);

    this.idempotency.set(key, {
      payloadFingerprint,
      result: structuredClone(created),
    });

    this.onAssignmentChanged?.(command.tenantId, command.workOrderId as string);

    await this.audit("Tool assignment created.", command.tenantId, command.idempotencyKey, command.correlationId, {
      toolAssignmentId: created.toolAssignmentId,
      operationExecutionId: created.operationExecutionId,
      toolAssetId: created.toolRef.assetId,
    });

    return structuredClone(created);
  }

  getToolAssignment(tenantId: TenantId, toolAssignmentId: string): ToolAssignment | undefined {
    const found = this.byId.get(toolAssignmentId);
    if (!found || found.tenantId !== tenantId) {
      return undefined;
    }
    return structuredClone(found);
  }

  listToolAssignments(tenantId: TenantId): ToolAssignment[] {
    return deterministicSort(
      [...this.byId.values()].filter((entry) => entry.tenantId === tenantId),
      (entry) => `${entry.operationExecutionId}:${entry.toolAssignmentId}`,
    ).map((entry) => structuredClone(entry));
  }

  listToolAssignmentsByOperation(tenantId: TenantId, operationExecutionId: string): ToolAssignment[] {
    const ids = this.byOperation.get(`${tenantId}:${operationExecutionId}`) ?? [];
    return ids
      .map((id) => this.byId.get(id))
      .filter((entry): entry is ToolAssignment => Boolean(entry))
      .map((entry) => structuredClone(entry));
  }

  private assertConflicts(command: ToolAssignmentCommand): void {
    const active = [...this.byId.values()].filter(
      (entry) =>
        entry.tenantId === command.tenantId &&
        entry.status !== "COMPLETED" &&
        entry.status !== "CANCELLED",
    );

    const toolConflict = active.find((entry) => entry.toolRef.assetId === command.toolRef.assetId);
    if (toolConflict) {
      throw new ManufacturingDomainError("TOOL_ASSIGNMENT_CONFLICT", "tool already assigned to active execution", false);
    }

    if (!command.workCenterId) {
      return;
    }

    const center = this.dependencies.workCenters.require(command.tenantId, command.workCenterId as string);
    const toolCapacity = center.capacityMetadata.toolCapacity ?? center.capacityMetadata.capacityUnits;
    if (toolCapacity > 1) {
      return;
    }

    const contextConflict = active.find(
      (entry) =>
        entry.workCenterId === command.workCenterId &&
        (!command.productionCellId || entry.productionCellId === command.productionCellId),
    );
    if (contextConflict) {
      throw new ManufacturingDomainError("RESOURCE_ASSIGNMENT_CONFLICT", "work center tool capacity exceeded", false);
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
      eventType: "manufacturing.tool-assignment",
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
