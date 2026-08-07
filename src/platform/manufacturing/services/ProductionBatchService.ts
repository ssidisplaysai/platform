import { deterministicSort } from "../../shared";
import type {
  CorrelationIdentifier,
  IdempotencyKey,
  ProductionBatch,
  ProductionRun,
  TenantId,
} from "../contracts";
import { ManufacturingDomainError } from "../domain";
import type {
  ManufacturingAuditSinkProvider,
  ManufacturingClockProvider,
} from "../integration";
import type { ManufacturingWorkOrderService } from "./ManufacturingWorkOrderService";
import type { ProductionRunService } from "./ProductionRunService";

export type CreateProductionBatch = Readonly<{
  productionBatchId: ProductionBatch["productionBatchId"];
  batchCode: ProductionBatch["batchCode"];
  tenantId: TenantId;
  workOrderId: ProductionBatch["workOrderId"];
  productionRunId?: ProductionRun["productionRunId"];
  expectedVersion: number;
  idempotencyKey: IdempotencyKey;
  correlationId: CorrelationIdentifier;
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}>;

export type ProductionBatchRecord = Readonly<{
  batch: ProductionBatch;
  metadata: Readonly<Record<string, string | number | boolean | null>>;
  inventoryLotBinding: null;
}>;

type StoredIdempotency = Readonly<{
  payloadFingerprint: string;
  result: ProductionBatchRecord;
}>;

function fingerprint(value: unknown): string {
  return JSON.stringify(value);
}

export class ProductionBatchService {
  private readonly byId = new Map<string, ProductionBatchRecord>();
  private readonly idByTenantCode = new Map<string, string>();
  private readonly idempotency = new Map<string, StoredIdempotency>();

  constructor(
    private readonly dependencies: {
      clock: ManufacturingClockProvider;
      audit: ManufacturingAuditSinkProvider;
      workOrders: ManufacturingWorkOrderService;
      runs: ProductionRunService;
    },
  ) {}

  async createProductionBatch(command: CreateProductionBatch): Promise<ProductionBatchRecord> {
    const idempotencyKey = `${command.tenantId}:BATCH_CREATE:${command.idempotencyKey}`;
    const payloadFingerprint = fingerprint(command);
    const replay = this.idempotency.get(idempotencyKey);
    if (replay) {
      if (replay.payloadFingerprint !== payloadFingerprint) {
        throw new ManufacturingDomainError("CONFLICTING_IDEMPOTENCY_PAYLOAD", "conflicting idempotency payload", false);
      }
      return structuredClone(replay.result);
    }

    if (command.expectedVersion !== 0) {
      throw new ManufacturingDomainError("STALE_EXPECTED_VERSION", "expected version must be 0 for create", false);
    }

    const batchId = command.productionBatchId as string;
    if (this.byId.has(batchId)) {
      throw new ManufacturingDomainError("DUPLICATE_PRODUCTION_BATCH_ID", `duplicate production batch id: ${batchId}`, false);
    }

    const codeKey = `${command.tenantId}:${command.batchCode}`;
    if (this.idByTenantCode.has(codeKey)) {
      throw new ManufacturingDomainError("DUPLICATE_BATCH_CODE", `duplicate batch code within tenant: ${command.batchCode}`, false);
    }

    this.dependencies.workOrders.require(command.tenantId, command.workOrderId);

    if (command.productionRunId) {
      const run = this.dependencies.runs.getProductionRun(command.tenantId, command.productionRunId as string);
      if (!run) {
        throw new ManufacturingDomainError("INVALID_PRODUCTION_BATCH", "production run not found for batch association", false);
      }
      if (run.run.workOrderId !== command.workOrderId) {
        throw new ManufacturingDomainError("INVALID_PRODUCTION_BATCH", "production run/work order relationship mismatch", false);
      }
    }

    const created: ProductionBatchRecord = {
      batch: {
        productionBatchId: command.productionBatchId,
        batchCode: command.batchCode,
        tenantId: command.tenantId,
        workOrderId: command.workOrderId,
        productionRunId: command.productionRunId,
        status: "PLANNED" as ProductionBatch["status"],
        version: 1,
      },
      metadata: { ...(command.metadata ?? {}) },
      inventoryLotBinding: null,
    };

    this.byId.set(batchId, created);
    this.idByTenantCode.set(codeKey, batchId);
    this.idempotency.set(idempotencyKey, { payloadFingerprint, result: structuredClone(created) });
    this.dependencies.workOrders.registerBatchBinding(command.tenantId, command.workOrderId, command.productionBatchId);

    await this.dependencies.audit.recordAudit({
      eventType: "manufacturing.production-batch",
      message: "Production batch created.",
      recordedAt: this.dependencies.clock.now(),
      details: {
        tenantId: command.tenantId,
        entityType: "PRODUCTION_BATCH",
        entityId: command.productionBatchId,
        businessIdentifier: command.batchCode,
        action: "CREATE",
        priorVersion: 0,
        resultingVersion: 1,
        idempotencyKey: command.idempotencyKey,
        correlationId: command.correlationId,
        classification: "INVALID_COMMAND",
        inventoryLotBinding: null,
      },
    });

    return structuredClone(created);
  }

  getProductionBatch(tenantId: TenantId, productionBatchId: string): ProductionBatchRecord | undefined {
    const found = this.byId.get(productionBatchId);
    if (!found || found.batch.tenantId !== tenantId) {
      return undefined;
    }
    return structuredClone(found);
  }

  listProductionBatches(tenantId: TenantId): ProductionBatchRecord[] {
    return deterministicSort(
      [...this.byId.values()].filter((item) => item.batch.tenantId === tenantId),
      (item) => `${item.batch.batchCode}:${item.batch.productionBatchId}`,
    ).map((item) => structuredClone(item));
  }

  listProductionBatchesByWorkOrder(tenantId: TenantId, workOrderId: string): ProductionBatchRecord[] {
    return this.listProductionBatches(tenantId).filter((item) => item.batch.workOrderId === workOrderId);
  }

  listProductionBatchesByRun(tenantId: TenantId, productionRunId: string): ProductionBatchRecord[] {
    return this.listProductionBatches(tenantId).filter((item) => item.batch.productionRunId === productionRunId);
  }
}
