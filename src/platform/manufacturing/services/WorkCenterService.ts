import { compareDeterministicStrings, deterministicSort } from "../../shared";
import type {
  CorrelationIdentifier,
  IdempotencyKey,
  MetadataCollection,
  ProductionCellId,
  TenantId,
  WorkCenter,
  WorkCenterRegistrationCommand,
} from "../contracts";
import { ManufacturingDomainError } from "../domain";
import type {
  ManufacturingAuditSinkProvider,
  ManufacturingClockProvider,
} from "../integration";

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
  result: WorkCenter;
}>;

export class WorkCenterService {
  private readonly byId = new Map<string, WorkCenter>();
  private readonly idByTenantCode = new Map<string, string>();
  private readonly idempotency = new Map<string, StoredIdempotency>();

  constructor(
    private readonly dependencies: {
      clock: ManufacturingClockProvider;
      audit: ManufacturingAuditSinkProvider;
    },
  ) {}

  async registerWorkCenter(command: WorkCenterRegistrationCommand): Promise<WorkCenter> {
    const key = `${command.tenantId}:WORK_CENTER_REGISTER:${command.idempotencyKey}`;
    const payloadFingerprint = createFingerprint(command);
    const replay = this.idempotency.get(key);
    if (replay) {
      if (replay.payloadFingerprint !== payloadFingerprint) {
        throw new ManufacturingDomainError("CONFLICTING_IDEMPOTENCY_PAYLOAD", "conflicting idempotency payload", false);
      }
      await this.audit("Work center register replay accepted.", command.tenantId, command.idempotencyKey, command.correlationId, {
        workCenterId: replay.result.workCenterId,
        classification: "INVALID_COMMAND",
      });
      return structuredClone(replay.result);
    }

    this.assertCapacity(command.capacityMetadata.capacityUnits, "capacityUnits");
    this.assertCapacity(command.capacityMetadata.machineCapacity, "machineCapacity");
    this.assertCapacity(command.capacityMetadata.toolCapacity, "toolCapacity");
    this.assertCapacity(command.capacityMetadata.laborCapacity, "laborCapacity");

    const id = command.workCenterId as string;
    if (this.byId.has(id)) {
      await this.audit("Work center register rejected due to duplicate id.", command.tenantId, command.idempotencyKey, command.correlationId, {
        workCenterId: command.workCenterId,
        classification: "DUPLICATE_WORK_CENTER",
      });
      throw new ManufacturingDomainError("DUPLICATE_WORK_CENTER", `duplicate work center id: ${command.workCenterId}`, false);
    }

    const codeKey = `${command.tenantId}:${command.workCenterCode}`;
    if (this.idByTenantCode.has(codeKey)) {
      await this.audit("Work center register rejected due to duplicate code.", command.tenantId, command.idempotencyKey, command.correlationId, {
        workCenterCode: command.workCenterCode,
        classification: "DUPLICATE_WORK_CENTER_CODE",
      });
      throw new ManufacturingDomainError("DUPLICATE_WORK_CENTER_CODE", `duplicate work center code: ${command.workCenterCode}`, false);
    }

    const created: WorkCenter = {
      workCenterId: command.workCenterId,
      workCenterCode: command.workCenterCode,
      tenantId: command.tenantId,
      displayName: command.displayName,
      status: command.status,
      capacityMetadata: {
        capacityUnits: command.capacityMetadata.capacityUnits,
        machineCapacity: command.capacityMetadata.machineCapacity,
        toolCapacity: command.capacityMetadata.toolCapacity,
        laborCapacity: command.capacityMetadata.laborCapacity,
      },
      organizationRef: command.organizationRef,
      facilityRef: command.facilityRef,
      productionCellIds: [],
      createdAt: this.dependencies.clock.now(),
      correlationId: command.correlationId,
      metadata: command.metadata,
      version: 1,
    };

    this.byId.set(id, created);
    this.idByTenantCode.set(codeKey, id);
    this.idempotency.set(key, {
      payloadFingerprint,
      result: structuredClone(created),
    });

    await this.audit("Work center registered.", command.tenantId, command.idempotencyKey, command.correlationId, {
      workCenterId: created.workCenterId,
      workCenterCode: created.workCenterCode,
      classification: "INVALID_COMMAND",
    });

    return structuredClone(created);
  }

  updateWorkCenter(input: {
    tenantId: TenantId;
    workCenterId: WorkCenter["workCenterId"];
    expectedVersion: number;
    displayName?: string;
    status?: WorkCenterRegistrationCommand["status"];
    capacityMetadata?: WorkCenter["capacityMetadata"];
    metadata?: MetadataCollection;
  }): WorkCenter {
    const current = this.require(input.tenantId, input.workCenterId as string);
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

    const next: WorkCenter = {
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
      metadata: input.metadata ?? current.metadata,
      version: current.version + 1,
    };

    this.byId.set(next.workCenterId as string, next);
    return structuredClone(next);
  }

  attachProductionCell(input: {
    tenantId: TenantId;
    workCenterId: WorkCenter["workCenterId"];
    productionCellId: ProductionCellId;
    expectedVersion: number;
  }): WorkCenter {
    const current = this.require(input.tenantId, input.workCenterId as string);
    if (current.version !== input.expectedVersion) {
      throw new ManufacturingDomainError(
        "STALE_EXPECTED_VERSION",
        `stale expected version: expected ${input.expectedVersion}, current ${current.version}`,
        false,
      );
    }

    if (current.productionCellIds.includes(input.productionCellId)) {
      return structuredClone(current);
    }

    const next: WorkCenter = {
      ...current,
      productionCellIds: [...current.productionCellIds, input.productionCellId].sort(compareDeterministicStrings),
      version: current.version + 1,
    };
    this.byId.set(next.workCenterId as string, next);
    return structuredClone(next);
  }

  getWorkCenter(tenantId: TenantId, workCenterId: string): WorkCenter | undefined {
    const found = this.byId.get(workCenterId);
    if (!found || found.tenantId !== tenantId) {
      return undefined;
    }
    return structuredClone(found);
  }

  listWorkCenters(tenantId: TenantId): WorkCenter[] {
    return deterministicSort(
      [...this.byId.values()].filter((entry) => entry.tenantId === tenantId),
      (entry) => `${entry.workCenterCode}:${entry.workCenterId}`,
    ).map((entry) => structuredClone(entry));
  }

  require(tenantId: TenantId, workCenterId: string): WorkCenter {
    const found = this.byId.get(workCenterId);
    if (!found) {
      throw new ManufacturingDomainError("INVALID_WORK_CENTER", `work center not found: ${workCenterId}`, false);
    }
    if (found.tenantId !== tenantId) {
      throw new ManufacturingDomainError("TENANT_MISMATCH", "work center tenant mismatch", false);
    }
    return found;
  }

  private assertCapacity(value: number | undefined, field: string): void {
    if (value === undefined) {
      return;
    }
    if (!Number.isFinite(value) || value < 1) {
      throw new ManufacturingDomainError("INVALID_WORK_CENTER", `${field} must be a positive finite number`, false);
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
      eventType: "manufacturing.work-center",
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
