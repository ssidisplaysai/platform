import { compareDeterministicStrings, deterministicSort } from "../../shared";
import type {
  CorrelationIdentifier,
  IdempotencyKey,
  ManufacturingWorkOrderId,
  OperationExecutionId,
  ProductionTraceAppendCommand,
  ProductionTraceRecord,
  TenantId,
} from "../contracts";
import { ManufacturingDomainError } from "../domain";
import {
  assertAppendOnlyTraceHistory,
  compareTraceRecords,
} from "../domain/traceability";
import type {
  ManufacturingAuditSinkProvider,
  ManufacturingClockProvider,
} from "../integration";
import type { ManufacturingWorkOrderService } from "./ManufacturingWorkOrderService";
import type { OperationExecutionService } from "./OperationExecutionService";

type StoredIdempotency = Readonly<{
  payloadFingerprint: string;
  result: ProductionTraceRecord;
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

export class ManufacturingTraceabilityService {
  private readonly byId = new Map<string, ProductionTraceRecord>();
  private readonly byWorkOrder = new Map<string, string[]>();
  private readonly byOperation = new Map<string, string[]>();
  private readonly bySource = new Map<string, string[]>();
  private readonly byTarget = new Map<string, string[]>();
  private readonly appendSequenceByTenant = new Map<string, number>();
  private readonly idempotency = new Map<string, StoredIdempotency>();

  constructor(
    private readonly dependencies: {
      clock: ManufacturingClockProvider;
      audit: ManufacturingAuditSinkProvider;
      workOrders: ManufacturingWorkOrderService;
      operations: OperationExecutionService;
    },
  ) {}

  async appendTrace(command: ProductionTraceAppendCommand): Promise<ProductionTraceRecord> {
    const key = `${command.tenantId}:TRACE_APPEND:${command.idempotencyKey}`;
    const payloadFingerprint = createFingerprint(command);
    const replay = this.idempotency.get(key);
    if (replay) {
      if (replay.payloadFingerprint !== payloadFingerprint) {
        throw new ManufacturingDomainError("CONFLICTING_IDEMPOTENCY_PAYLOAD", "conflicting idempotency payload", false);
      }
      await this.audit("Trace append replay accepted.", command.tenantId, command.idempotencyKey, command.correlationId, {
        productionTraceId: replay.result.productionTraceId,
        classification: "INVALID_COMMAND",
      });
      return structuredClone(replay.result);
    }

    this.assertCommand(command);

    const traceId = command.productionTraceId as string;
    if (this.byId.has(traceId)) {
      throw new ManufacturingDomainError("DUPLICATE_TRACE_ID", `duplicate trace id: ${traceId}`, false);
    }

    try {
      if (command.workOrderId) {
        this.dependencies.workOrders.require(command.tenantId, command.workOrderId as string);
      }
      if (command.operationExecutionId) {
        const operation = this.dependencies.operations.getOperationExecution(command.tenantId, command.operationExecutionId as string);
        if (!operation) {
          throw new ManufacturingDomainError("INVALID_TRACE_RELATION", "operation reference not found", false);
        }
        if (command.workOrderId && operation.execution.workOrderId !== command.workOrderId) {
          throw new ManufacturingDomainError("INVALID_TRACE_RELATION", "operation/work-order trace mismatch", false);
        }
      }
    } catch (error) {
      if (error instanceof ManufacturingDomainError && error.classification === "TENANT_MISMATCH") {
        throw new ManufacturingDomainError("TRACE_TENANT_MISMATCH", error.message, false);
      }
      throw error;
    }

    const previous = this.listProductionTrace(command.tenantId);
    const sequence = (this.appendSequenceByTenant.get(command.tenantId) ?? 0) + 1;
    this.appendSequenceByTenant.set(command.tenantId, sequence);

    const created: ProductionTraceRecord = {
      productionTraceId: command.productionTraceId,
      appendSequence: sequence,
      tenantId: command.tenantId,
      correlationId: command.correlationId,
      sourceType: command.sourceType,
      sourceId: command.sourceId,
      targetType: command.targetType,
      targetId: command.targetId,
      relationType: command.relationType,
      workOrderId: command.workOrderId,
      operationExecutionId: command.operationExecutionId,
      occurredAt: command.occurredAt ?? this.dependencies.clock.now(),
      metadata: command.metadata,
      version: 1,
    };

    const current = [...previous, created].sort(compareTraceRecords);
    assertAppendOnlyTraceHistory(previous, current);

    this.byId.set(traceId, created);
    this.idempotency.set(key, {
      payloadFingerprint,
      result: structuredClone(created),
    });

    if (created.workOrderId) {
      const woKey = `${created.tenantId}:${created.workOrderId}`;
      this.byWorkOrder.set(woKey, [...(this.byWorkOrder.get(woKey) ?? []), traceId]);
    }
    if (created.operationExecutionId) {
      const opKey = `${created.tenantId}:${created.operationExecutionId}`;
      this.byOperation.set(opKey, [...(this.byOperation.get(opKey) ?? []), traceId]);
    }

    const sourceKey = this.toEdgeKey(created.tenantId, created.sourceType, created.sourceId);
    const targetKey = this.toEdgeKey(created.tenantId, created.targetType, created.targetId);
    this.bySource.set(sourceKey, [...(this.bySource.get(sourceKey) ?? []), traceId]);
    this.byTarget.set(targetKey, [...(this.byTarget.get(targetKey) ?? []), traceId]);

    await this.audit("Trace appended.", command.tenantId, command.idempotencyKey, command.correlationId, {
      productionTraceId: created.productionTraceId,
      sourceType: created.sourceType,
      targetType: created.targetType,
      relationType: created.relationType,
      classification: "INVALID_COMMAND",
    });

    return structuredClone(created);
  }

  getProductionTrace(tenantId: TenantId, productionTraceId: string): ProductionTraceRecord | undefined {
    const found = this.byId.get(productionTraceId);
    if (!found || found.tenantId !== tenantId) {
      return undefined;
    }
    return structuredClone(found);
  }

  listProductionTrace(tenantId: TenantId): ProductionTraceRecord[] {
    return deterministicSort(
      [...this.byId.values()].filter((entry) => entry.tenantId === tenantId),
      (entry) => `${String(entry.appendSequence).padStart(12, "0")}:${entry.productionTraceId}`,
    ).map((entry) => structuredClone(entry));
  }

  listTraceByWorkOrder(tenantId: TenantId, workOrderId: string): ProductionTraceRecord[] {
    const ids = this.byWorkOrder.get(`${tenantId}:${workOrderId}`) ?? [];
    return this.resolveByIds(ids);
  }

  listTraceByOperation(tenantId: TenantId, operationExecutionId: string): ProductionTraceRecord[] {
    const ids = this.byOperation.get(`${tenantId}:${operationExecutionId}`) ?? [];
    return this.resolveByIds(ids);
  }

  listTraceBySource(tenantId: TenantId, sourceType: string, sourceId: string): ProductionTraceRecord[] {
    const ids = this.bySource.get(this.toEdgeKey(tenantId, sourceType, sourceId)) ?? [];
    return this.resolveByIds(ids);
  }

  listTraceByTarget(tenantId: TenantId, targetType: string, targetId: string): ProductionTraceRecord[] {
    const ids = this.byTarget.get(this.toEdgeKey(tenantId, targetType, targetId)) ?? [];
    return this.resolveByIds(ids);
  }

  traceProductToWorkOrder(tenantId: TenantId, productVersionId: string, workOrderId: string): ProductionTraceRecord[] {
    return this.listTraceByWorkOrder(tenantId, workOrderId).filter(
      (entry) =>
        (entry.sourceType === "PRODUCT_VERSION" && entry.sourceId === productVersionId && entry.targetType === "WORK_ORDER") ||
        (entry.targetType === "PRODUCT_VERSION" && entry.targetId === productVersionId && entry.sourceType === "WORK_ORDER"),
    );
  }

  traceMaterialToConsumption(tenantId: TenantId, materialRequirementId: string): ProductionTraceRecord[] {
    return this.listTraceBySource(tenantId, "MATERIAL_REQUIREMENT", materialRequirementId).filter(
      (entry) => entry.targetType === "MATERIAL_CONSUMPTION" || entry.targetType === "CONSUMPTION",
    );
  }

  traceConsumptionToOutput(tenantId: TenantId, materialConsumptionId: string): ProductionTraceRecord[] {
    return this.listTraceBySource(tenantId, "MATERIAL_CONSUMPTION", materialConsumptionId).filter(
      (entry) => entry.targetType === "PRODUCTION_OUTPUT" || entry.targetType === "OUTPUT",
    );
  }

  traceOutputToInventoryMovement(tenantId: TenantId, productionOutputId: string): ProductionTraceRecord[] {
    return this.listTraceBySource(tenantId, "PRODUCTION_OUTPUT", productionOutputId).filter(
      (entry) => entry.targetType === "INVENTORY_MOVEMENT",
    );
  }

  traceLotOrSerialToWorkOrder(tenantId: TenantId, lotOrSerialId: string): ProductionTraceRecord[] {
    const lot = this.listTraceBySource(tenantId, "LOT", lotOrSerialId);
    const serial = this.listTraceBySource(tenantId, "SERIAL", lotOrSerialId);
    const all = [...lot, ...serial];
    return deterministicSort(all, (entry) => `${entry.occurredAt}:${entry.productionTraceId}`);
  }

  traceMachineToExecution(tenantId: TenantId, machineAssetId: string): ProductionTraceRecord[] {
    return this.listTraceBySource(tenantId, "MACHINE_ASSET", machineAssetId);
  }

  traceLaborToExecution(tenantId: TenantId, laborReferenceId: string): ProductionTraceRecord[] {
    return this.listTraceBySource(tenantId, "LABOR_REFERENCE", laborReferenceId);
  }

  appendWorkOrderProductBaselineTrace(input: {
    tenantId: TenantId;
    workOrderId: ManufacturingWorkOrderId;
    productVersionId: string;
    productBomId: string;
    idempotencyKey: IdempotencyKey;
    correlationId: CorrelationIdentifier;
  }): Promise<ProductionTraceRecord[]> {
    return Promise.all([
      this.appendTrace({
        tenantId: input.tenantId,
        productionTraceId: `${input.workOrderId}:product-version` as ProductionTraceRecord["productionTraceId"],
        sourceType: "WORK_ORDER",
        sourceId: input.workOrderId,
        targetType: "PRODUCT_VERSION",
        targetId: input.productVersionId,
        relationType: "WORK_ORDER_PRODUCT_BASELINE",
        workOrderId: input.workOrderId,
        idempotencyKey: `${input.idempotencyKey}:pv` as IdempotencyKey,
        correlationId: input.correlationId,
      }),
      this.appendTrace({
        tenantId: input.tenantId,
        productionTraceId: `${input.workOrderId}:bom-version` as ProductionTraceRecord["productionTraceId"],
        sourceType: "WORK_ORDER",
        sourceId: input.workOrderId,
        targetType: "PRODUCT_BOM_VERSION",
        targetId: input.productBomId,
        relationType: "WORK_ORDER_BOM_BASELINE",
        workOrderId: input.workOrderId,
        idempotencyKey: `${input.idempotencyKey}:bom` as IdempotencyKey,
        correlationId: input.correlationId,
      }),
    ]);
  }

  private resolveByIds(ids: readonly string[]): ProductionTraceRecord[] {
    return ids
      .map((id) => this.byId.get(id))
      .filter((entry): entry is ProductionTraceRecord => Boolean(entry))
      .sort(compareTraceRecords)
      .map((entry) => structuredClone(entry));
  }

  private toEdgeKey(tenantId: TenantId, type: string, id: string): string {
    return `${tenantId}:${type}:${id}`;
  }

  private assertCommand(command: ProductionTraceAppendCommand): void {
    if (!command.sourceId || !command.targetId) {
      throw new ManufacturingDomainError("TRACEABILITY_VIOLATION", "trace source and target identifiers are required", false);
    }
    if (!command.relationType || command.relationType.trim().length === 0) {
      throw new ManufacturingDomainError("INVALID_TRACE_RELATION", "trace relation type is required", false);
    }
    if (command.sourceType === command.targetType && command.sourceId === command.targetId) {
      throw new ManufacturingDomainError("INVALID_TRACE_RELATION", "trace self-reference is not allowed", false);
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
      eventType: "manufacturing.traceability",
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
