import type {
  CorrelationIdentifier,
  MetadataCollection,
  OperationExecutionId,
  TenantId,
  UnitOfMeasure,
  WipExecutionState,
  WorkCenterId,
} from "../contracts";
import { ManufacturingDomainError } from "../domain";
import type { ManufacturingIdentifierProvider } from "../integration";

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export class WipService {
  private readonly byWorkOrder = new Map<string, WipExecutionState>();

  constructor(
    private readonly dependencies: {
      identifier: ManufacturingIdentifierProvider;
    },
  ) {}

  initializeForWorkOrder(input: {
    tenantId: TenantId;
    workOrderId: string;
    plannedQuantity: number;
    unitOfMeasure: UnitOfMeasure;
    correlationId: CorrelationIdentifier;
    metadata?: MetadataCollection;
  }): WipExecutionState {
    const key = `${input.tenantId}:${input.workOrderId}`;
    const existing = this.byWorkOrder.get(key);
    if (existing) {
      return structuredClone(existing);
    }

    const created: WipExecutionState = {
      wipStateId: this.dependencies.identifier.createIdentifier("wip-state") as WipExecutionState["wipStateId"],
      tenantId: input.tenantId,
      workOrderId: input.workOrderId as WipExecutionState["workOrderId"],
      quantityWaiting: round(input.plannedQuantity),
      quantityInProcess: 0,
      quantityCompleted: 0,
      quantityRejected: 0,
      quantityRework: 0,
      holdState: "ACTIVE",
      status: "ACTIVE",
      correlationId: input.correlationId,
      metadata: input.metadata,
      version: 1,
    };

    this.byWorkOrder.set(key, created);
    return structuredClone(created);
  }

  onOperationStart(input: {
    tenantId: TenantId;
    workOrderId: string;
    operationExecutionId: OperationExecutionId;
    plannedQuantity: number;
    completedQuantity: number;
    rejectedQuantity: number;
    scrapQuantity: number;
    reworkQuantity: number;
    correlationId: CorrelationIdentifier;
    metadata?: MetadataCollection;
  }): WipExecutionState {
    return this.reconcileFromExecutionTotals({
      ...input,
      currentOperationExecutionId: input.operationExecutionId,
      operationInProgress: true,
      holdState: "ACTIVE",
    });
  }

  onOperationCompletion(input: {
    tenantId: TenantId;
    workOrderId: string;
    plannedQuantity: number;
    completedQuantity: number;
    rejectedQuantity: number;
    scrapQuantity: number;
    reworkQuantity: number;
    correlationId: CorrelationIdentifier;
    metadata?: MetadataCollection;
  }): WipExecutionState {
    return this.reconcileFromExecutionTotals({
      ...input,
      operationInProgress: false,
      holdState: "ACTIVE",
    });
  }

  onOutputRecorded(input: {
    tenantId: TenantId;
    workOrderId: string;
    currentOperationExecutionId?: OperationExecutionId;
    plannedQuantity: number;
    completedQuantity: number;
    rejectedQuantity: number;
    scrapQuantity: number;
    reworkQuantity: number;
    operationInProgress: boolean;
    correlationId: CorrelationIdentifier;
    metadata?: MetadataCollection;
  }): WipExecutionState {
    return this.reconcileFromExecutionTotals({
      ...input,
      holdState: "ACTIVE",
    });
  }

  onScrapRecorded(input: {
    tenantId: TenantId;
    workOrderId: string;
    currentOperationExecutionId?: OperationExecutionId;
    plannedQuantity: number;
    completedQuantity: number;
    rejectedQuantity: number;
    scrapQuantity: number;
    reworkQuantity: number;
    operationInProgress: boolean;
    correlationId: CorrelationIdentifier;
    metadata?: MetadataCollection;
  }): WipExecutionState {
    return this.reconcileFromExecutionTotals({
      ...input,
      holdState: "ACTIVE",
    });
  }

  onReworkRecorded(input: {
    tenantId: TenantId;
    workOrderId: string;
    currentOperationExecutionId?: OperationExecutionId;
    plannedQuantity: number;
    completedQuantity: number;
    rejectedQuantity: number;
    scrapQuantity: number;
    reworkQuantity: number;
    operationInProgress: boolean;
    correlationId: CorrelationIdentifier;
    metadata?: MetadataCollection;
  }): WipExecutionState {
    return this.reconcileFromExecutionTotals({
      ...input,
      holdState: "ACTIVE",
    });
  }

  reconcileFromExecutionTotals(input: {
    tenantId: TenantId;
    workOrderId: string;
    currentOperationExecutionId?: OperationExecutionId;
    plannedQuantity: number;
    completedQuantity: number;
    rejectedQuantity: number;
    scrapQuantity: number;
    reworkQuantity: number;
    operationInProgress: boolean;
    holdState: "ACTIVE" | "ON_HOLD";
    correlationId: CorrelationIdentifier;
    metadata?: MetadataCollection;
    expectedVersion?: number;
    currentWorkCenterId?: WorkCenterId;
  }): WipExecutionState {
    const key = `${input.tenantId}:${input.workOrderId}`;
    const current = this.byWorkOrder.get(key);
    if (!current) {
      throw new ManufacturingDomainError("INVALID_WIP_STATE", `wip state not initialized for work order ${input.workOrderId}`, false);
    }
    if (typeof input.expectedVersion === "number" && current.version !== input.expectedVersion) {
      throw new ManufacturingDomainError(
        "STALE_EXPECTED_VERSION",
        `stale expected version: expected ${input.expectedVersion}, current ${current.version}`,
        false,
      );
    }

    for (const quantity of [
      input.plannedQuantity,
      input.completedQuantity,
      input.rejectedQuantity,
      input.scrapQuantity,
      input.reworkQuantity,
    ]) {
      if (!Number.isFinite(quantity) || quantity < 0) {
        throw new ManufacturingDomainError("INVALID_WIP_STATE", "wip quantities must be non-negative finite values", false);
      }
    }

    const processed = round(input.completedQuantity + input.rejectedQuantity + input.scrapQuantity);
    if (processed > input.plannedQuantity + 0.000001) {
      throw new ManufacturingDomainError("WIP_RECONCILIATION_FAILURE", "processed quantity exceeds planned quantity", false);
    }

    const waiting = round(Math.max(0, input.plannedQuantity - processed));
    const inProcess = input.operationInProgress ? waiting : 0;
    const status =
      processed >= input.plannedQuantity - 0.000001
        ? "COMPLETED"
        : input.holdState === "ON_HOLD"
          ? "ON_HOLD"
          : "ACTIVE";

    const next: WipExecutionState = {
      ...current,
      currentOperationExecutionId: input.currentOperationExecutionId,
      quantityWaiting: waiting,
      quantityInProcess: inProcess,
      quantityCompleted: round(input.completedQuantity),
      quantityRejected: round(input.rejectedQuantity + input.scrapQuantity),
      quantityRework: round(input.reworkQuantity),
      holdState: input.holdState,
      status,
      currentWorkCenterId: input.currentWorkCenterId,
      correlationId: input.correlationId,
      metadata: input.metadata,
      version: current.version + 1,
    };

    this.byWorkOrder.set(key, next);
    return structuredClone(next);
  }

  getWipState(tenantId: TenantId, workOrderId: string): WipExecutionState | undefined {
    const found = this.byWorkOrder.get(`${tenantId}:${workOrderId}`);
    return found ? structuredClone(found) : undefined;
  }

  listWipByWorkOrder(tenantId: TenantId): WipExecutionState[] {
    return [...this.byWorkOrder.values()]
      .filter((entry) => entry.tenantId === tenantId)
      .sort((left, right) => left.workOrderId.localeCompare(right.workOrderId))
      .map((entry) => structuredClone(entry));
  }
}
