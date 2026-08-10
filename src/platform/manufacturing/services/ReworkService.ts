import { compareDeterministicStrings, deterministicSort } from "../../shared";
import type {
  CorrelationIdentifier,
  IdempotencyKey,
  ReworkCommand,
  ReworkExecutionRecord,
  TenantId,
} from "../contracts";
import { ManufacturingDomainError } from "../domain";
import type {
  ManufacturingAuditSinkProvider,
  ManufacturingClockProvider,
  ManufacturingIdentifierProvider,
} from "../integration";
import type { ExecutionRoutingService } from "./ExecutionRoutingService";
import type { ManufacturingWorkOrderService } from "./ManufacturingWorkOrderService";
import type { OperationExecutionService } from "./OperationExecutionService";
import type { WipService } from "./WipService";

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

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

type StoredIdempotency = Readonly<{
  payloadFingerprint: string;
  result: ReworkExecutionRecord;
}>;

export class ReworkService {
  private readonly byId = new Map<string, ReworkExecutionRecord>();
  private readonly byWorkOrder = new Map<string, string[]>();
  private readonly byOperation = new Map<string, string[]>();
  private readonly idempotency = new Map<string, StoredIdempotency>();

  constructor(
    private readonly dependencies: {
      clock: ManufacturingClockProvider;
      identifier: ManufacturingIdentifierProvider;
      audit: ManufacturingAuditSinkProvider;
      workOrders: ManufacturingWorkOrderService;
      operations: OperationExecutionService;
      routings: ExecutionRoutingService;
      wip: WipService;
    },
  ) {}

  async createRework(command: ReworkCommand): Promise<ReworkExecutionRecord> {
    const storageKey = `${command.tenantId}:REWORK:${command.idempotencyKey}`;
    const payloadFingerprint = createFingerprint(command);
    const replay = this.idempotency.get(storageKey);
    if (replay) {
      if (replay.payloadFingerprint !== payloadFingerprint) {
        throw new ManufacturingDomainError("CONFLICTING_IDEMPOTENCY_PAYLOAD", "conflicting idempotency payload", false);
      }
      return structuredClone(replay.result);
    }

    if (!Number.isFinite(command.quantity) || command.quantity <= 0) {
      throw new ManufacturingDomainError("INVALID_REWORK", "rework quantity must be greater than zero", false);
    }

    const workOrder = this.dependencies.workOrders.require(command.tenantId, command.workOrderId);
    if (workOrder.workOrder.version !== command.expectedWorkOrderVersion) {
      throw new ManufacturingDomainError(
        "STALE_EXPECTED_VERSION",
        `stale expected version: expected ${command.expectedWorkOrderVersion}, current ${workOrder.workOrder.version}`,
        false,
      );
    }

    this.dependencies.wip.initializeForWorkOrder({
      tenantId: command.tenantId,
      workOrderId: command.workOrderId as string,
      plannedQuantity: workOrder.workOrder.plannedQuantity.value,
      unitOfMeasure: workOrder.workOrder.plannedQuantity.unitOfMeasure,
      correlationId: command.correlationId,
      metadata: command.metadata,
    });

    const sourceOperation = this.dependencies.operations.getOperationExecution(command.tenantId, command.sourceOperationExecutionId as string);
    const targetOperation = this.dependencies.operations.getOperationExecution(command.tenantId, command.targetOperationExecutionId as string);
    if (!sourceOperation || !targetOperation) {
      throw new ManufacturingDomainError("INVALID_REWORK", "source or target operation execution not found", false);
    }
    if (sourceOperation.execution.workOrderId !== command.workOrderId || targetOperation.execution.workOrderId !== command.workOrderId) {
      throw new ManufacturingDomainError("INVALID_REWORK", "operation/work-order mismatch for rework", false);
    }
    if (sourceOperation.execution.version !== command.expectedSourceOperationVersion) {
      throw new ManufacturingDomainError(
        "STALE_EXPECTED_VERSION",
        `stale expected version: expected ${command.expectedSourceOperationVersion}, current ${sourceOperation.execution.version}`,
        false,
      );
    }
    if (targetOperation.execution.version !== command.expectedTargetOperationVersion) {
      throw new ManufacturingDomainError(
        "STALE_EXPECTED_VERSION",
        `stale expected version: expected ${command.expectedTargetOperationVersion}, current ${targetOperation.execution.version}`,
        false,
      );
    }

    const routing = this.dependencies.routings.getExecutionRouting(command.tenantId, sourceOperation.execution.executionRoutingId as string);
    if (!routing) {
      throw new ManufacturingDomainError("INVALID_REWORK", "execution routing not found for rework", false);
    }

    const sourceStep = routing.routing.steps.find((step) => step.routingStepId === sourceOperation.execution.routingStepId);
    const targetStep = routing.routing.steps.find((step) => step.routingStepId === targetOperation.execution.routingStepId);
    if (!sourceStep || !targetStep) {
      throw new ManufacturingDomainError("INVALID_REWORK", "source or target routing step not found for rework", false);
    }

    const edge = sourceStep.explicitReworkEdges.find((candidate) => candidate.targetStepId === targetStep.routingStepId);
    if (!edge) {
      throw new ManufacturingDomainError("REWORK_NOT_ALLOWED", "rework edge is not permitted by routing", false);
    }

    await this.dependencies.operations.requestReworkTransition({
      tenantId: command.tenantId,
      workOrderId: command.workOrderId,
      executionRoutingId: sourceOperation.execution.executionRoutingId,
      operationExecutionId: sourceOperation.execution.operationExecutionId,
      expectedVersion: command.expectedSourceOperationVersion,
      idempotencyKey: command.idempotencyKey,
      correlationId: command.correlationId,
      targetStepId: targetStep.routingStepId,
    });

    const updatedSource = this.dependencies.operations.applyExecutionQuantities({
      tenantId: command.tenantId,
      operationExecutionId: command.sourceOperationExecutionId,
      expectedVersion: command.expectedSourceOperationVersion + 1,
      deltaRework: command.quantity,
      correlationId: command.correlationId,
      idempotencyKey: command.idempotencyKey,
    });

    const updatedWorkOrder = this.dependencies.workOrders.applyExecutionQuantities({
      tenantId: command.tenantId,
      workOrderId: command.workOrderId,
      expectedVersion: command.expectedWorkOrderVersion,
      deltaRework: command.quantity,
    });

    this.dependencies.wip.onReworkRecorded({
      tenantId: command.tenantId,
      workOrderId: command.workOrderId,
      currentOperationExecutionId: command.targetOperationExecutionId,
      plannedQuantity: updatedWorkOrder.workOrder.plannedQuantity.value,
      completedQuantity: updatedWorkOrder.workOrder.completedQuantity.value,
      rejectedQuantity: updatedWorkOrder.workOrder.rejectedQuantity.value,
      scrapQuantity: updatedWorkOrder.workOrder.scrapQuantity.value,
      reworkQuantity: updatedWorkOrder.workOrder.reworkQuantity.value,
      operationInProgress: updatedSource.execution.operationState === "IN_PROGRESS",
      correlationId: command.correlationId,
      metadata: command.metadata,
    });

    const record: ReworkExecutionRecord = {
      reworkRecordId: this.dependencies.identifier.createIdentifier("rework-record") as ReworkExecutionRecord["reworkRecordId"],
      tenantId: command.tenantId,
      workOrderId: command.workOrderId,
      sourceOperationExecutionId: command.sourceOperationExecutionId,
      targetOperationExecutionId: command.targetOperationExecutionId,
      quantity: round(command.quantity),
      unitOfMeasure: command.unitOfMeasure,
      reasonCode: command.reasonCode,
      status: "RECORDED",
      idempotencyKey: command.idempotencyKey,
      correlationId: command.correlationId,
      recordedAt: this.dependencies.clock.now(),
      metadata: command.metadata,
      version: updatedWorkOrder.workOrder.version,
    };

    this.byId.set(record.reworkRecordId as string, record);
    const workOrderKey = `${record.tenantId}:${record.workOrderId}`;
    const workOrderIds = this.byWorkOrder.get(workOrderKey) ?? [];
    this.byWorkOrder.set(workOrderKey, [...workOrderIds, record.reworkRecordId as string]);

    for (const operationId of [record.sourceOperationExecutionId, record.targetOperationExecutionId]) {
      const operationKey = `${record.tenantId}:${operationId}`;
      const operationIds = this.byOperation.get(operationKey) ?? [];
      this.byOperation.set(operationKey, [...operationIds, record.reworkRecordId as string]);
    }

    this.idempotency.set(storageKey, {
      payloadFingerprint,
      result: structuredClone(record),
    });

    await this.audit("Rework recorded.", command.tenantId, command.workOrderId as string, command.idempotencyKey, command.correlationId, {
      sourceOperationExecutionId: command.sourceOperationExecutionId,
      targetOperationExecutionId: command.targetOperationExecutionId,
      quantity: command.quantity,
      reasonCode: command.reasonCode,
      maxIterations: edge.maxIterations,
    });

    return structuredClone(record);
  }

  getReworkRecord(tenantId: TenantId, reworkRecordId: string): ReworkExecutionRecord | undefined {
    const found = this.byId.get(reworkRecordId);
    if (!found || found.tenantId !== tenantId) {
      return undefined;
    }
    return structuredClone(found);
  }

  listReworkByWorkOrder(tenantId: TenantId, workOrderId: string): ReworkExecutionRecord[] {
    const ids = this.byWorkOrder.get(`${tenantId}:${workOrderId}`) ?? [];
    return ids
      .map((id) => this.byId.get(id))
      .filter((entry): entry is ReworkExecutionRecord => Boolean(entry))
      .map((entry) => structuredClone(entry));
  }

  listReworkByOperation(tenantId: TenantId, operationExecutionId: string): ReworkExecutionRecord[] {
    const ids = this.byOperation.get(`${tenantId}:${operationExecutionId}`) ?? [];
    return ids
      .map((id) => this.byId.get(id))
      .filter((entry): entry is ReworkExecutionRecord => Boolean(entry))
      .map((entry) => structuredClone(entry));
  }

  listReworkRecords(tenantId: TenantId): ReworkExecutionRecord[] {
    return deterministicSort(
      [...this.byId.values()].filter((entry) => entry.tenantId === tenantId),
      (entry) => entry.reworkRecordId,
    ).map((entry) => structuredClone(entry));
  }

  private async audit(
    message: string,
    tenantId: TenantId,
    workOrderId: string,
    idempotencyKey: IdempotencyKey,
    correlationId: CorrelationIdentifier,
    details: Record<string, unknown>,
  ): Promise<void> {
    await this.dependencies.audit.recordAudit({
      eventType: "manufacturing.rework",
      message,
      recordedAt: this.dependencies.clock.now(),
      details: {
        tenantId,
        workOrderId,
        idempotencyKey,
        correlationId,
        ...details,
      },
    });
  }
}
