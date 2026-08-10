import { compareDeterministicStrings, deterministicSort } from "../../shared";
import type {
  CorrelationIdentifier,
  IdempotencyKey,
  ProductionCell,
  ProductionCellRegistrationCommand,
  TenantId,
} from "../contracts";
import { ManufacturingDomainError } from "../domain";
import type { ManufacturingAuditSinkProvider, ManufacturingClockProvider } from "../integration";
import type { WorkCenterService } from "./WorkCenterService";

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

type StoredIdempotency = Readonly<{
  payloadFingerprint: string;
  result: ProductionCell;
}>;

export class ProductionCellService {
  private readonly byId = new Map<string, ProductionCell>();
  private readonly idByTenantCode = new Map<string, string>();
  private readonly idempotency = new Map<string, StoredIdempotency>();

  constructor(
    private readonly dependencies: {
      clock: ManufacturingClockProvider;
      audit: ManufacturingAuditSinkProvider;
      workCenters: WorkCenterService;
    },
  ) {}

  async registerProductionCell(command: ProductionCellRegistrationCommand): Promise<ProductionCell> {
    const key = `${command.tenantId}:PRODUCTION_CELL_REGISTER:${command.idempotencyKey}`;
    const payloadFingerprint = createFingerprint(command);
    const replay = this.idempotency.get(key);
    if (replay) {
      if (replay.payloadFingerprint !== payloadFingerprint) {
        throw new ManufacturingDomainError("CONFLICTING_IDEMPOTENCY_PAYLOAD", "conflicting idempotency payload", false);
      }
      await this.audit("Production cell register replay accepted.", command.tenantId, command.idempotencyKey, command.correlationId, {
        productionCellId: replay.result.productionCellId,
        classification: "INVALID_COMMAND",
      });
      return structuredClone(replay.result);
    }

    const id = command.productionCellId as string;
    if (this.byId.has(id)) {
      await this.audit("Production cell register rejected due to duplicate id.", command.tenantId, command.idempotencyKey, command.correlationId, {
        productionCellId: command.productionCellId,
        classification: "DUPLICATE_PRODUCTION_CELL",
      });
      throw new ManufacturingDomainError("DUPLICATE_PRODUCTION_CELL", `duplicate production cell id: ${command.productionCellId}`, false);
    }

    const codeKey = `${command.tenantId}:${command.productionCellCode}`;
    if (this.idByTenantCode.has(codeKey)) {
      await this.audit("Production cell register rejected due to duplicate code.", command.tenantId, command.idempotencyKey, command.correlationId, {
        productionCellCode: command.productionCellCode,
        classification: "DUPLICATE_PRODUCTION_CELL",
      });
      throw new ManufacturingDomainError("DUPLICATE_PRODUCTION_CELL", `duplicate production cell code: ${command.productionCellCode}`, false);
    }

    this.assertCapacity(command.capacityMetadata.capacityUnits, "capacityUnits");
    this.assertCapacity(command.capacityMetadata.machineCapacity, "machineCapacity");
    this.assertCapacity(command.capacityMetadata.toolCapacity, "toolCapacity");
    this.assertCapacity(command.capacityMetadata.laborCapacity, "laborCapacity");

    const workCenter = this.dependencies.workCenters.require(command.tenantId, command.workCenterId as string);

    const created: ProductionCell = {
      productionCellId: command.productionCellId,
      productionCellCode: command.productionCellCode,
      tenantId: command.tenantId,
      displayName: command.displayName,
      workCenterId: command.workCenterId,
      status: command.status,
      capacityMetadata: {
        capacityUnits: command.capacityMetadata.capacityUnits,
        machineCapacity: command.capacityMetadata.machineCapacity,
        toolCapacity: command.capacityMetadata.toolCapacity,
        laborCapacity: command.capacityMetadata.laborCapacity,
      },
      createdAt: this.dependencies.clock.now(),
      correlationId: command.correlationId,
      metadata: command.metadata,
      version: 1,
    };

    const updatedWorkCenter = this.dependencies.workCenters.attachProductionCell({
      tenantId: command.tenantId,
      workCenterId: workCenter.workCenterId,
      productionCellId: created.productionCellId,
      expectedVersion: workCenter.version,
    });

    this.byId.set(id, created);
    this.idByTenantCode.set(codeKey, id);
    this.idempotency.set(key, {
      payloadFingerprint,
      result: structuredClone(created),
    });

    await this.audit("Production cell registered.", command.tenantId, command.idempotencyKey, command.correlationId, {
      productionCellId: created.productionCellId,
      workCenterId: updatedWorkCenter.workCenterId,
      classification: "INVALID_COMMAND",
    });

    return structuredClone(created);
  }

  updateProductionCell(input: {
    tenantId: TenantId;
    productionCellId: ProductionCell["productionCellId"];
    expectedVersion: number;
    displayName?: string;
    status?: ProductionCellRegistrationCommand["status"];
    capacityMetadata?: ProductionCell["capacityMetadata"];
  }): ProductionCell {
    const current = this.require(input.tenantId, input.productionCellId as string);
    if (current.version !== input.expectedVersion) {
      throw new ManufacturingDomainError(
        "STALE_EXPECTED_VERSION",
        `stale expected version: expected ${input.expectedVersion}, current ${current.version}`,
        false,
      );
    }

    if (input.capacityMetadata) {
      this.assertCapacity(input.capacityMetadata.capacityUnits, "capacityUnits");
      this.assertCapacity(input.capacityMetadata.machineCapacity, "machineCapacity");
      this.assertCapacity(input.capacityMetadata.toolCapacity, "toolCapacity");
      this.assertCapacity(input.capacityMetadata.laborCapacity, "laborCapacity");
    }

    const next: ProductionCell = {
      ...current,
      displayName: input.displayName ?? current.displayName,
      status: input.status ?? current.status,
      capacityMetadata: input.capacityMetadata
        ? {
            capacityUnits: input.capacityMetadata.capacityUnits,
            machineCapacity: input.capacityMetadata.machineCapacity,
            toolCapacity: input.capacityMetadata.toolCapacity,
            laborCapacity: input.capacityMetadata.laborCapacity,
          }
        : current.capacityMetadata,
      version: current.version + 1,
    };

    this.byId.set(next.productionCellId as string, next);
    return structuredClone(next);
  }

  getProductionCell(tenantId: TenantId, productionCellId: string): ProductionCell | undefined {
    const found = this.byId.get(productionCellId);
    if (!found || found.tenantId !== tenantId) {
      return undefined;
    }
    return structuredClone(found);
  }

  listProductionCells(tenantId: TenantId): ProductionCell[] {
    return deterministicSort(
      [...this.byId.values()].filter((entry) => entry.tenantId === tenantId),
      (entry) => `${entry.productionCellCode}:${entry.productionCellId}`,
    ).map((entry) => structuredClone(entry));
  }

  require(tenantId: TenantId, productionCellId: string): ProductionCell {
    const found = this.byId.get(productionCellId);
    if (!found) {
      throw new ManufacturingDomainError("INVALID_PRODUCTION_CELL", `production cell not found: ${productionCellId}`, false);
    }
    if (found.tenantId !== tenantId) {
      throw new ManufacturingDomainError("TENANT_MISMATCH", "production cell tenant mismatch", false);
    }
    return found;
  }

  private assertCapacity(value: number | undefined, field: string): void {
    if (value === undefined) {
      return;
    }
    if (!Number.isFinite(value) || value < 1) {
      throw new ManufacturingDomainError("INVALID_PRODUCTION_CELL", `${field} must be a positive finite number`, false);
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
      eventType: "manufacturing.production-cell",
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
