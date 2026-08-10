import { compareDeterministicStrings, deterministicSort } from "../../shared";
import type {
  CorrelationIdentifier,
  IdempotencyKey,
  ScrapCommand,
  ScrapExecutionRecord,
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
  result: ScrapExecutionRecord;
}>;

export class ScrapService {
  private readonly byId = new Map<string, ScrapExecutionRecord>();
  private readonly byWorkOrder = new Map<string, string[]>();
  private readonly byOperation = new Map<string, string[]>();
  private readonly idempotency = new Map<string, StoredIdempotency>();

  constructor(
    private readonly dependencies: {
      clock: ManufacturingClockProvider;
      identifier: ManufacturingIdentifierProvider;
      audit: ManufacturingAuditSinkProvider;
      inventory: ManufacturingInventoryIntegrationService;
      workOrders: ManufacturingWorkOrderService;
      operations: OperationExecutionService;
      wip: WipService;
    },
  ) {}

  async recordScrap(command: ScrapCommand): Promise<ScrapExecutionRecord> {
    const storageKey = `${command.tenantId}:SCRAP:${command.idempotencyKey}`;
    const payloadFingerprint = createFingerprint(command);
    const replay = this.idempotency.get(storageKey);
    if (replay) {
      if (replay.payloadFingerprint !== payloadFingerprint) {
        throw new ManufacturingDomainError("CONFLICTING_IDEMPOTENCY_PAYLOAD", "conflicting idempotency payload", false);
      }
      return structuredClone(replay.result);
    }

    if (!Number.isFinite(command.quantity) || command.quantity <= 0) {
      throw new ManufacturingDomainError("INVALID_SCRAP", "scrap quantity must be greater than zero", false);
    }
    if (!command.reasonCode || command.reasonCode.trim().length === 0) {
      throw new ManufacturingDomainError("INVALID_SCRAP", "scrap reason code is required", false);
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

    let operationVersion = command.expectedOperationVersion;
    let operationState: ReturnType<OperationExecutionService["getOperationExecution"]>;
    if (command.operationExecutionId) {
      operationState = this.dependencies.operations.getOperationExecution(command.tenantId, command.operationExecutionId as string);
      if (!operationState) {
        throw new ManufacturingDomainError("INVALID_SCRAP", "operation execution not found", false);
      }
      if (operationState.execution.workOrderId !== command.workOrderId) {
        throw new ManufacturingDomainError("INVALID_SCRAP", "operation does not belong to work order", false);
      }
      operationVersion = command.expectedOperationVersion ?? operationState.execution.version;
      if (operationState.execution.version !== operationVersion) {
        throw new ManufacturingDomainError(
          "STALE_EXPECTED_VERSION",
          `stale expected version: expected ${operationVersion}, current ${operationState.execution.version}`,
          false,
        );
      }
    }

    let inventoryReferenceId: string | undefined;
    if (command.requestInventoryWriteOff) {
      if (!command.inventoryItemRef) {
        throw new ManufacturingDomainError("INVALID_OUTPUT_INVENTORY_REFERENCE", "inventory item reference is required for write-off", false);
      }
      const writeOff = await this.dependencies.inventory.requestWriteOff({
        tenantId: command.tenantId,
        inventoryItemId: command.inventoryItemRef.inventoryItemId as string,
        quantity: command.quantity,
        unitOfMeasure: command.unitOfMeasure,
      });
      inventoryReferenceId = writeOff.referenceId;
      if (!Number.isFinite(writeOff.acceptedQuantity) || writeOff.acceptedQuantity <= 0) {
        const reconciliationRecord = this.buildRecord(command, "RECONCILIATION_REQUIRED", inventoryReferenceId, {
          reason: "inventory accepted write-off but returned invalid accepted quantity",
          reasonCodeClassification: "SCRAP_RECONCILIATION_REQUIRED",
        });
        this.storeRecord(reconciliationRecord, storageKey, payloadFingerprint);
        throw new ManufacturingDomainError(
          "SCRAP_RECONCILIATION_REQUIRED",
          "inventory accepted write-off but local reconciliation failed",
          false,
        );
      }
    }

    try {
      const updatedWorkOrder = this.dependencies.workOrders.applyExecutionQuantities({
        tenantId: command.tenantId,
        workOrderId: command.workOrderId,
        expectedVersion: command.expectedWorkOrderVersion,
        deltaScrap: command.quantity,
      });

      if (command.operationExecutionId) {
        this.dependencies.operations.applyExecutionQuantities({
          tenantId: command.tenantId,
          operationExecutionId: command.operationExecutionId,
          expectedVersion: operationVersion!,
          deltaScrap: command.quantity,
          correlationId: command.correlationId,
          idempotencyKey: command.idempotencyKey,
        });
      }

      this.dependencies.wip.onScrapRecorded({
        tenantId: command.tenantId,
        workOrderId: command.workOrderId,
        currentOperationExecutionId: command.operationExecutionId,
        plannedQuantity: updatedWorkOrder.workOrder.plannedQuantity.value,
        completedQuantity: updatedWorkOrder.workOrder.completedQuantity.value,
        rejectedQuantity: updatedWorkOrder.workOrder.rejectedQuantity.value,
        scrapQuantity: updatedWorkOrder.workOrder.scrapQuantity.value,
        reworkQuantity: updatedWorkOrder.workOrder.reworkQuantity.value,
        operationInProgress: operationState?.execution.operationState === "IN_PROGRESS",
        correlationId: command.correlationId,
        metadata: command.metadata,
      });

      const record = this.buildRecord(command, "RECORDED", inventoryReferenceId, {
        version: updatedWorkOrder.workOrder.version,
      });
      this.storeRecord(record, storageKey, payloadFingerprint);
      await this.audit("Scrap recorded.", command.tenantId, command.workOrderId as string, command.idempotencyKey, command.correlationId, {
        operationExecutionId: command.operationExecutionId,
        quantity: command.quantity,
        reasonCode: command.reasonCode,
        inventoryReferenceId,
      });
      return structuredClone(record);
    } catch (error) {
      if (command.requestInventoryWriteOff && inventoryReferenceId) {
        const reconciliationRecord = this.buildRecord(command, "RECONCILIATION_REQUIRED", inventoryReferenceId, {
          reason: error instanceof Error ? error.message : "local commit failed",
          reasonCodeClassification: "SCRAP_RECONCILIATION_REQUIRED",
        });
        this.storeRecord(reconciliationRecord, storageKey, payloadFingerprint);
        throw new ManufacturingDomainError(
          "SCRAP_RECONCILIATION_REQUIRED",
          "inventory accepted write-off but local reconciliation failed",
          false,
        );
      }
      throw error;
    }
  }

  getScrapRecord(tenantId: TenantId, scrapRecordId: string): ScrapExecutionRecord | undefined {
    const found = this.byId.get(scrapRecordId);
    if (!found || found.tenantId !== tenantId) {
      return undefined;
    }
    return structuredClone(found);
  }

  listScrapByWorkOrder(tenantId: TenantId, workOrderId: string): ScrapExecutionRecord[] {
    const ids = this.byWorkOrder.get(`${tenantId}:${workOrderId}`) ?? [];
    return ids
      .map((id) => this.byId.get(id))
      .filter((entry): entry is ScrapExecutionRecord => Boolean(entry))
      .map((entry) => structuredClone(entry));
  }

  listScrapByOperation(tenantId: TenantId, operationExecutionId: string): ScrapExecutionRecord[] {
    const ids = this.byOperation.get(`${tenantId}:${operationExecutionId}`) ?? [];
    return ids
      .map((id) => this.byId.get(id))
      .filter((entry): entry is ScrapExecutionRecord => Boolean(entry))
      .map((entry) => structuredClone(entry));
  }

  listScrapRecords(tenantId: TenantId): ScrapExecutionRecord[] {
    return deterministicSort(
      [...this.byId.values()].filter((entry) => entry.tenantId === tenantId),
      (entry) => entry.scrapRecordId,
    ).map((entry) => structuredClone(entry));
  }

  private buildRecord(
    command: ScrapCommand,
    status: ScrapExecutionRecord["status"],
    inventoryReferenceId: string | undefined,
    options?: Readonly<{ reason?: string; reasonCodeClassification?: string; version?: number }>,
  ): ScrapExecutionRecord {
    return {
      scrapRecordId: this.dependencies.identifier.createIdentifier("scrap-record") as ScrapExecutionRecord["scrapRecordId"],
      tenantId: command.tenantId,
      workOrderId: command.workOrderId,
      operationExecutionId: command.operationExecutionId,
      outputRef: command.outputRef,
      inventoryItemRef: command.inventoryItemRef,
      quantity: round(command.quantity),
      unitOfMeasure: command.unitOfMeasure,
      reasonCode: command.reasonCode,
      inventoryReferenceId,
      status,
      reason: options?.reason,
      reasonCodeClassification: options?.reasonCodeClassification,
      idempotencyKey: command.idempotencyKey,
      correlationId: command.correlationId,
      recordedAt: this.dependencies.clock.now(),
      metadata: command.metadata,
      version: options?.version ?? 1,
    };
  }

  private storeRecord(record: ScrapExecutionRecord, key: string, payloadFingerprint: string): void {
    this.byId.set(record.scrapRecordId as string, record);

    const workOrderKey = `${record.tenantId}:${record.workOrderId}`;
    const workOrderIds = this.byWorkOrder.get(workOrderKey) ?? [];
    this.byWorkOrder.set(workOrderKey, [...workOrderIds, record.scrapRecordId as string]);

    if (record.operationExecutionId) {
      const operationKey = `${record.tenantId}:${record.operationExecutionId}`;
      const operationIds = this.byOperation.get(operationKey) ?? [];
      this.byOperation.set(operationKey, [...operationIds, record.scrapRecordId as string]);
    }

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
      eventType: "manufacturing.scrap",
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
