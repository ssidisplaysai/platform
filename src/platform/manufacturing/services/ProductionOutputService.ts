import { compareDeterministicStrings, deterministicSort } from "../../shared";
import type {
  CorrelationIdentifier,
  IdempotencyKey,
  ProductionOutputCommand,
  ProductionOutputDisposition,
  ProductionOutputExecutionRecord,
  TenantId,
} from "../contracts";
import { ManufacturingDomainError } from "../domain";
import type {
  ManufacturingAuditSinkProvider,
  ManufacturingClockProvider,
  ManufacturingIdentifierProvider,
} from "../integration";
import type { ManufacturingInventoryIntegrationService } from "./ManufacturingInventoryIntegrationService";
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
  result: ProductionOutputExecutionRecord;
}>;

function mapDispositionToDeltas(disposition: ProductionOutputDisposition, quantity: number): {
  completed: number;
  rejected: number;
  scrap: number;
  rework: number;
} {
  switch (disposition) {
    case "GOOD":
    case "FINISHED":
    case "INTERMEDIATE":
      return { completed: quantity, rejected: 0, scrap: 0, rework: 0 };
    case "REJECTED":
      return { completed: 0, rejected: quantity, scrap: 0, rework: 0 };
    case "SCRAP":
      return { completed: 0, rejected: 0, scrap: quantity, rework: 0 };
    case "REWORK":
      return { completed: 0, rejected: 0, scrap: 0, rework: quantity };
    default:
      return { completed: 0, rejected: 0, scrap: 0, rework: 0 };
  }
}

export class ProductionOutputService {
  private readonly byId = new Map<string, ProductionOutputExecutionRecord>();
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
      inventory: ManufacturingInventoryIntegrationService;
      wip: WipService;
    },
  ) {}

  async recordProductionOutput(command: ProductionOutputCommand): Promise<ProductionOutputExecutionRecord> {
    const idempotencyStorageKey = `${command.tenantId}:PROD_OUTPUT:${command.idempotencyKey}`;
    const payloadFingerprint = createFingerprint(command);
    const replay = this.idempotency.get(idempotencyStorageKey);
    if (replay) {
      if (replay.payloadFingerprint !== payloadFingerprint) {
        throw new ManufacturingDomainError("CONFLICTING_IDEMPOTENCY_PAYLOAD", "conflicting idempotency payload", false);
      }
      return structuredClone(replay.result);
    }

    if (!Number.isFinite(command.quantity) || command.quantity <= 0) {
      throw new ManufacturingDomainError("INVALID_PRODUCTION_OUTPUT", "production output quantity must be greater than zero", false);
    }

    const workOrder = this.dependencies.workOrders.require(command.tenantId, command.workOrderId);
    const operation = this.dependencies.operations.getOperationExecution(command.tenantId, command.operationExecutionId as string);
    if (!operation) {
      throw new ManufacturingDomainError("INVALID_OPERATION_STATE", "operation execution not found", false);
    }
    if (operation.execution.workOrderId !== command.workOrderId) {
      throw new ManufacturingDomainError("INVALID_PRODUCTION_OUTPUT", "operation does not belong to work order", false);
    }

    if (workOrder.workOrder.version !== command.expectedWorkOrderVersion) {
      throw new ManufacturingDomainError(
        "STALE_EXPECTED_VERSION",
        `stale expected version: expected ${command.expectedWorkOrderVersion}, current ${workOrder.workOrder.version}`,
        false,
      );
    }
    if (operation.execution.version !== command.expectedOperationVersion) {
      throw new ManufacturingDomainError(
        "STALE_EXPECTED_VERSION",
        `stale expected version: expected ${command.expectedOperationVersion}, current ${operation.execution.version}`,
        false,
      );
    }

    if (workOrder.workOrder.workOrderState !== "IN_PROGRESS" && workOrder.workOrder.workOrderState !== "PARTIALLY_COMPLETED") {
      throw new ManufacturingDomainError("PRODUCTION_OUTPUT_NOT_ALLOWED", "work order is not in output-eligible lifecycle state", false);
    }

    if (workOrder.productBaselineState !== "FROZEN") {
      throw new ManufacturingDomainError("PRODUCT_BASELINE_NOT_READY", "product baseline must be frozen before output recording", false);
    }

    if (workOrder.workOrder.productRef.productId !== command.productRef.productId) {
      throw new ManufacturingDomainError("PRODUCT_REFERENCE_INVALID", "output product reference does not match work order baseline", false);
    }
    if (workOrder.workOrder.productVersionRef.productVersionId !== command.productVersionRef.productVersionId) {
      throw new ManufacturingDomainError("PRODUCT_VERSION_INVALID", "output product version does not match work order baseline", false);
    }
    if (
      command.productVariantRef &&
      workOrder.workOrder.productVariantRef &&
      workOrder.workOrder.productVariantRef.productVariantId !== command.productVariantRef.productVariantId
    ) {
      throw new ManufacturingDomainError("PRODUCT_VARIANT_INVALID", "output product variant does not match work order baseline", false);
    }

    if (command.unitOfMeasure !== workOrder.workOrder.plannedQuantity.unitOfMeasure) {
      throw new ManufacturingDomainError("INVALID_PRODUCTION_OUTPUT", "output unit of measure mismatch", false);
    }

    const inventoryReceiptRequired = command.inventoryReceiptRequired ?? command.disposition === "FINISHED";
    if (inventoryReceiptRequired && !command.inventoryItemRef) {
      throw new ManufacturingDomainError("INVALID_OUTPUT_INVENTORY_REFERENCE", "inventory item reference is required", false);
    }

    const deltas = mapDispositionToDeltas(command.disposition, command.quantity);
    let inventoryReferenceId: string | undefined;

    this.dependencies.wip.initializeForWorkOrder({
      tenantId: command.tenantId,
      workOrderId: command.workOrderId as string,
      plannedQuantity: workOrder.workOrder.plannedQuantity.value,
      unitOfMeasure: workOrder.workOrder.plannedQuantity.unitOfMeasure,
      correlationId: command.correlationId,
      metadata: command.metadata,
    });

    if (inventoryReceiptRequired) {
      const receipt = await this.dependencies.inventory.requestFinishedGoodsReceipt({
        tenantId: command.tenantId,
        inventoryItemId: command.inventoryItemRef!.inventoryItemId as string,
        quantity: command.quantity,
        unitOfMeasure: command.unitOfMeasure,
      });
      inventoryReferenceId = receipt.referenceId;
      if (!Number.isFinite(receipt.acceptedQuantity) || receipt.acceptedQuantity <= 0) {
        const reconciliation = this.buildRecord(command, "RECONCILIATION_REQUIRED", command.quantity, inventoryReferenceId, {
          reason: "inventory accepted output receipt but returned invalid accepted quantity",
          reasonCode: "OUTPUT_RECONCILIATION_REQUIRED",
        });
        this.storeRecord(reconciliation, idempotencyStorageKey, payloadFingerprint);
        throw new ManufacturingDomainError(
          "OUTPUT_RECONCILIATION_REQUIRED",
          "inventory accepted output receipt but local reconciliation failed",
          false,
        );
      }
    }

    try {
      const updatedWorkOrder = this.dependencies.workOrders.applyExecutionQuantities({
        tenantId: command.tenantId,
        workOrderId: command.workOrderId,
        expectedVersion: command.expectedWorkOrderVersion,
        deltaCompleted: deltas.completed,
        deltaRejected: deltas.rejected,
        deltaScrap: deltas.scrap,
        deltaRework: deltas.rework,
      });

      const updatedOperation = this.dependencies.operations.applyExecutionQuantities({
        tenantId: command.tenantId,
        operationExecutionId: command.operationExecutionId,
        expectedVersion: command.expectedOperationVersion,
        deltaCompleted: deltas.completed,
        deltaRejected: deltas.rejected,
        deltaScrap: deltas.scrap,
        deltaRework: deltas.rework,
        correlationId: command.correlationId,
        idempotencyKey: command.idempotencyKey,
      });

      this.dependencies.wip.onOutputRecorded({
        tenantId: command.tenantId,
        workOrderId: command.workOrderId,
        currentOperationExecutionId: command.operationExecutionId,
        plannedQuantity: updatedWorkOrder.workOrder.plannedQuantity.value,
        completedQuantity: updatedWorkOrder.workOrder.completedQuantity.value,
        rejectedQuantity: updatedWorkOrder.workOrder.rejectedQuantity.value,
        scrapQuantity: updatedWorkOrder.workOrder.scrapQuantity.value,
        reworkQuantity: updatedWorkOrder.workOrder.reworkQuantity.value,
        operationInProgress: updatedOperation.execution.operationState === "IN_PROGRESS",
        correlationId: command.correlationId,
        metadata: command.metadata,
      });

      const record = this.buildRecord(command, "RECORDED", command.quantity, inventoryReferenceId, {
        version: updatedWorkOrder.workOrder.version,
      });
      this.storeRecord(record, idempotencyStorageKey, payloadFingerprint);
      await this.audit("Production output recorded.", command.tenantId, command.workOrderId as string, command.idempotencyKey, command.correlationId, {
        operationExecutionId: command.operationExecutionId,
        disposition: command.disposition,
        quantity: command.quantity,
        inventoryReferenceId,
      });
      return structuredClone(record);
    } catch (error) {
      if (inventoryReceiptRequired && inventoryReferenceId) {
        const reconciliation = this.buildRecord(command, "RECONCILIATION_REQUIRED", command.quantity, inventoryReferenceId, {
          reason: error instanceof Error ? error.message : "local commit failed",
          reasonCode: "OUTPUT_RECONCILIATION_REQUIRED",
        });
        this.storeRecord(reconciliation, idempotencyStorageKey, payloadFingerprint);
        throw new ManufacturingDomainError(
          "OUTPUT_RECONCILIATION_REQUIRED",
          "inventory accepted output receipt but local reconciliation failed",
          false,
        );
      }
      throw error;
    }
  }

  getProductionOutput(tenantId: TenantId, productionOutputId: string): ProductionOutputExecutionRecord | undefined {
    const found = this.byId.get(productionOutputId);
    if (!found || found.tenantId !== tenantId) {
      return undefined;
    }
    return structuredClone(found);
  }

  listProductionOutputs(tenantId: TenantId): ProductionOutputExecutionRecord[] {
    return deterministicSort(
      [...this.byId.values()].filter((entry) => entry.tenantId === tenantId),
      (entry) => entry.productionOutputId,
    ).map((entry) => structuredClone(entry));
  }

  listProductionOutputsByWorkOrder(tenantId: TenantId, workOrderId: string): ProductionOutputExecutionRecord[] {
    const ids = this.byWorkOrder.get(`${tenantId}:${workOrderId}`) ?? [];
    return ids
      .map((id) => this.byId.get(id))
      .filter((entry): entry is ProductionOutputExecutionRecord => Boolean(entry))
      .map((entry) => structuredClone(entry));
  }

  listProductionOutputsByOperation(tenantId: TenantId, operationExecutionId: string): ProductionOutputExecutionRecord[] {
    const ids = this.byOperation.get(`${tenantId}:${operationExecutionId}`) ?? [];
    return ids
      .map((id) => this.byId.get(id))
      .filter((entry): entry is ProductionOutputExecutionRecord => Boolean(entry))
      .map((entry) => structuredClone(entry));
  }

  private buildRecord(
    command: ProductionOutputCommand,
    status: ProductionOutputExecutionRecord["status"],
    quantity: number,
    inventoryReferenceId: string | undefined,
    options?: Readonly<{ reason?: string; reasonCode?: string; version?: number }>,
  ): ProductionOutputExecutionRecord {
    return {
      productionOutputId: this.dependencies.identifier.createIdentifier("production-output") as ProductionOutputExecutionRecord["productionOutputId"],
      tenantId: command.tenantId,
      workOrderId: command.workOrderId,
      operationExecutionId: command.operationExecutionId,
      productRef: command.productRef,
      productVariantRef: command.productVariantRef,
      productVersionRef: command.productVersionRef,
      inventoryItemRef: command.inventoryItemRef,
      quantity: round(quantity),
      unitOfMeasure: command.unitOfMeasure,
      disposition: command.disposition,
      inventoryReferenceId,
      inventoryMovementId: inventoryReferenceId,
      status,
      reason: options?.reason,
      reasonCode: options?.reasonCode,
      idempotencyKey: command.idempotencyKey,
      correlationId: command.correlationId,
      recordedAt: this.dependencies.clock.now(),
      metadata: command.metadata,
      version: options?.version ?? 1,
    };
  }

  private storeRecord(record: ProductionOutputExecutionRecord, key: string, payloadFingerprint: string): void {
    this.byId.set(record.productionOutputId as string, record);

    const byWorkOrderKey = `${record.tenantId}:${record.workOrderId}`;
    const outputIdsByWorkOrder = this.byWorkOrder.get(byWorkOrderKey) ?? [];
    this.byWorkOrder.set(byWorkOrderKey, [...outputIdsByWorkOrder, record.productionOutputId as string]);

    const byOperationKey = `${record.tenantId}:${record.operationExecutionId}`;
    const outputIdsByOperation = this.byOperation.get(byOperationKey) ?? [];
    this.byOperation.set(byOperationKey, [...outputIdsByOperation, record.productionOutputId as string]);

    this.idempotency.set(key, {
      payloadFingerprint,
      result: structuredClone(record),
    });
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
      eventType: "manufacturing.production-output",
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
