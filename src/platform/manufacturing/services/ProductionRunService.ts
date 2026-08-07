import { compareDeterministicStrings, deterministicSort } from "../../shared";
import type {
  CorrelationIdentifier,
  IdempotencyKey,
  ProductionRun,
  RunCode,
  TenantId,
} from "../contracts";
import { ManufacturingDomainError } from "../domain";
import type {
  ManufacturingAuditSinkProvider,
  ManufacturingClockProvider,
} from "../integration";
import type { ManufacturingWorkOrderService } from "./ManufacturingWorkOrderService";

export type CreateProductionRun = Readonly<{
  productionRunId: ProductionRun["productionRunId"];
  runCode: RunCode;
  tenantId: TenantId;
  workOrderId: ProductionRun["workOrderId"];
  expectedVersion: number;
  idempotencyKey: IdempotencyKey;
  correlationId: CorrelationIdentifier;
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}>;

export type ProductionRunRecord = Readonly<{
  run: ProductionRun;
  metadata: Readonly<Record<string, string | number | boolean | null>>;
}>;

type StoredIdempotency = Readonly<{
  payloadFingerprint: string;
  result: ProductionRunRecord;
}>;

function fingerprint(value: unknown): string {
  return JSON.stringify(value);
}

export class ProductionRunService {
  private readonly byId = new Map<string, ProductionRunRecord>();
  private readonly idByTenantCode = new Map<string, string>();
  private readonly idempotency = new Map<string, StoredIdempotency>();

  constructor(
    private readonly dependencies: {
      clock: ManufacturingClockProvider;
      audit: ManufacturingAuditSinkProvider;
      workOrders: ManufacturingWorkOrderService;
    },
  ) {}

  async createProductionRun(command: CreateProductionRun): Promise<ProductionRunRecord> {
    const idempotencyKey = `${command.tenantId}:RUN_CREATE:${command.idempotencyKey}`;
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

    const runId = command.productionRunId as string;
    if (this.byId.has(runId)) {
      throw new ManufacturingDomainError("DUPLICATE_PRODUCTION_RUN_ID", `duplicate production run id: ${runId}`, false);
    }

    const codeKey = `${command.tenantId}:${command.runCode}`;
    if (this.idByTenantCode.has(codeKey)) {
      throw new ManufacturingDomainError("DUPLICATE_RUN_CODE", `duplicate run code within tenant: ${command.runCode}`, false);
    }

    this.dependencies.workOrders.require(command.tenantId, command.workOrderId);

    const created: ProductionRunRecord = {
      run: {
        productionRunId: command.productionRunId,
        runCode: command.runCode,
        tenantId: command.tenantId,
        workOrderId: command.workOrderId,
        status: "PLANNED" as ProductionRun["status"],
        version: 1,
      },
      metadata: { ...(command.metadata ?? {}) },
    };

    this.byId.set(runId, created);
    this.idByTenantCode.set(codeKey, runId);
    this.idempotency.set(idempotencyKey, { payloadFingerprint, result: structuredClone(created) });
    this.dependencies.workOrders.registerRunBinding(command.tenantId, command.workOrderId, command.productionRunId);

    await this.dependencies.audit.recordAudit({
      eventType: "manufacturing.production-run",
      message: "Production run created.",
      recordedAt: this.dependencies.clock.now(),
      details: {
        tenantId: command.tenantId,
        entityType: "PRODUCTION_RUN",
        entityId: command.productionRunId,
        businessIdentifier: command.runCode,
        action: "CREATE",
        priorVersion: 0,
        resultingVersion: 1,
        idempotencyKey: command.idempotencyKey,
        correlationId: command.correlationId,
        classification: "INVALID_COMMAND",
      },
    });

    return structuredClone(created);
  }

  getProductionRun(tenantId: TenantId, productionRunId: string): ProductionRunRecord | undefined {
    const found = this.byId.get(productionRunId);
    if (!found || found.run.tenantId !== tenantId) {
      return undefined;
    }
    return structuredClone(found);
  }

  listProductionRuns(tenantId: TenantId): ProductionRunRecord[] {
    return deterministicSort(
      [...this.byId.values()].filter((item) => item.run.tenantId === tenantId),
      (item) => `${item.run.runCode}:${item.run.productionRunId}`,
    ).map((item) => structuredClone(item));
  }

  listProductionRunsByWorkOrder(tenantId: TenantId, workOrderId: string): ProductionRunRecord[] {
    return this.listProductionRuns(tenantId).filter((item) => item.run.workOrderId === workOrderId);
  }
}
