import { compareDeterministicStrings, deterministicSort } from "../../shared";
import type {
  CorrelationIdentifier,
  DowntimeEndCommand,
  DowntimeRecord,
  DowntimeStartCommand,
  IdempotencyKey,
  TenantId,
} from "../contracts";
import { ManufacturingDomainError } from "../domain";
import type { ManufacturingAuditSinkProvider, ManufacturingClockProvider } from "../integration";
import type { ManufacturingWorkOrderService } from "./ManufacturingWorkOrderService";
import type { OperationExecutionService } from "./OperationExecutionService";

type StoredIdempotency = Readonly<{
  payloadFingerprint: string;
  result: DowntimeRecord;
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

function parseTimestamp(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new ManufacturingDomainError("INVALID_DOWNTIME", `invalid timestamp: ${value}`, false);
  }
  return parsed;
}

export class DowntimeService {
  private readonly byId = new Map<string, DowntimeRecord>();
  private readonly byWorkOrder = new Map<string, string[]>();
  private readonly byOperation = new Map<string, string[]>();
  private readonly idempotency = new Map<string, StoredIdempotency>();

  constructor(
    private readonly dependencies: {
      clock: ManufacturingClockProvider;
      audit: ManufacturingAuditSinkProvider;
      workOrders: ManufacturingWorkOrderService;
      operations: OperationExecutionService;
    },
  ) {}

  async startDowntime(command: DowntimeStartCommand): Promise<DowntimeRecord> {
    const key = `${command.tenantId}:DOWNTIME_START:${command.idempotencyKey}`;
    const payloadFingerprint = createFingerprint(command);
    const replay = this.idempotency.get(key);
    if (replay) {
      if (replay.payloadFingerprint !== payloadFingerprint) {
        throw new ManufacturingDomainError("CONFLICTING_IDEMPOTENCY_PAYLOAD", "conflicting idempotency payload", false);
      }
      return structuredClone(replay.result);
    }

    if (this.byId.has(command.downtimeRecordId as string)) {
      throw new ManufacturingDomainError("DUPLICATE_ACTIVE_DOWNTIME", "duplicate downtime record id", false);
    }

    const startedAtMs = parseTimestamp(command.startedAt);
    const workOrder = this.dependencies.workOrders.require(command.tenantId, command.workOrderId);
    if (workOrder.workOrder.version !== command.expectedWorkOrderVersion) {
      throw new ManufacturingDomainError(
        "STALE_EXPECTED_VERSION",
        `stale expected version: expected ${command.expectedWorkOrderVersion}, current ${workOrder.workOrder.version}`,
        false,
      );
    }

    if (command.operationExecutionId) {
      const operation = this.dependencies.operations.getOperationExecution(command.tenantId, command.operationExecutionId as string);
      if (!operation || operation.execution.workOrderId !== command.workOrderId) {
        throw new ManufacturingDomainError("INVALID_DOWNTIME", "operation/work-order mismatch for downtime", false);
      }
    }

    const activeConflict = [...this.byId.values()].find(
      (entry) =>
        entry.tenantId === command.tenantId &&
        entry.status === "ACTIVE" &&
        entry.workOrderId === command.workOrderId &&
        (entry.operationExecutionId ?? "") === (command.operationExecutionId ?? "") &&
        (entry.workCenterId ?? "") === (command.workCenterId ?? "") &&
        (entry.productionCellId ?? "") === (command.productionCellId ?? "") &&
        (entry.machineRef?.assetId ?? "") === (command.machineRef?.assetId ?? ""),
    );
    if (activeConflict) {
      throw new ManufacturingDomainError("DUPLICATE_ACTIVE_DOWNTIME", "active downtime already exists for context", false);
    }

    const created: DowntimeRecord = {
      downtimeRecordId: command.downtimeRecordId,
      tenantId: command.tenantId,
      workOrderId: command.workOrderId,
      operationExecutionId: command.operationExecutionId,
      workCenterId: command.workCenterId,
      productionCellId: command.productionCellId,
      machineRef: command.machineRef,
      startedAt: new Date(startedAtMs).toISOString(),
      reasonCode: command.reasonCode,
      category: command.category,
      status: "ACTIVE",
      idempotencyKey: command.idempotencyKey,
      correlationId: command.correlationId,
      metadata: command.metadata,
      version: 1,
    };

    this.byId.set(created.downtimeRecordId as string, created);
    this.idempotency.set(key, {
      payloadFingerprint,
      result: structuredClone(created),
    });

    const woKey = `${command.tenantId}:${command.workOrderId}`;
    this.byWorkOrder.set(woKey, [...(this.byWorkOrder.get(woKey) ?? []), created.downtimeRecordId as string]);
    if (command.operationExecutionId) {
      const opKey = `${command.tenantId}:${command.operationExecutionId}`;
      this.byOperation.set(opKey, [...(this.byOperation.get(opKey) ?? []), created.downtimeRecordId as string]);
    }

    await this.audit("Downtime started.", command.tenantId, command.idempotencyKey, command.correlationId, {
      downtimeRecordId: created.downtimeRecordId,
      workOrderId: created.workOrderId,
      operationExecutionId: created.operationExecutionId,
      classification: "INVALID_COMMAND",
    });

    return structuredClone(created);
  }

  async endDowntime(command: DowntimeEndCommand): Promise<DowntimeRecord> {
    const key = `${command.tenantId}:DOWNTIME_END:${command.idempotencyKey}`;
    const payloadFingerprint = createFingerprint(command);
    const replay = this.idempotency.get(key);
    if (replay) {
      if (replay.payloadFingerprint !== payloadFingerprint) {
        throw new ManufacturingDomainError("CONFLICTING_IDEMPOTENCY_PAYLOAD", "conflicting idempotency payload", false);
      }
      return structuredClone(replay.result);
    }

    const current = this.require(command.tenantId, command.downtimeRecordId as string);
    if (current.version !== command.expectedVersion) {
      throw new ManufacturingDomainError(
        "STALE_EXPECTED_VERSION",
        `stale expected version: expected ${command.expectedVersion}, current ${current.version}`,
        false,
      );
    }
    if (current.status !== "ACTIVE") {
      throw new ManufacturingDomainError("INVALID_DOWNTIME", "downtime is not active", false);
    }

    const startMs = parseTimestamp(current.startedAt);
    const endMs = parseTimestamp(command.endedAt);
    if (endMs < startMs) {
      throw new ManufacturingDomainError("INVALID_DOWNTIME", "downtime end must be after start", false);
    }

    const duration = Math.round((endMs - startMs) / 60000);
    const ended: DowntimeRecord = {
      ...current,
      endedAt: new Date(endMs).toISOString(),
      status: "CLOSED",
      duration: duration as DowntimeRecord["duration"],
      version: current.version + 1,
    };

    this.byId.set(ended.downtimeRecordId as string, ended);
    this.idempotency.set(key, {
      payloadFingerprint,
      result: structuredClone(ended),
    });

    await this.audit("Downtime ended.", command.tenantId, command.idempotencyKey, command.correlationId, {
      downtimeRecordId: ended.downtimeRecordId,
      durationMinutes: duration,
      classification: "INVALID_COMMAND",
    });

    return structuredClone(ended);
  }

  getDowntime(tenantId: TenantId, downtimeRecordId: string): DowntimeRecord | undefined {
    const found = this.byId.get(downtimeRecordId);
    if (!found || found.tenantId !== tenantId) {
      return undefined;
    }
    return structuredClone(found);
  }

  listDowntimeByWorkOrder(tenantId: TenantId, workOrderId: string): DowntimeRecord[] {
    const ids = this.byWorkOrder.get(`${tenantId}:${workOrderId}`) ?? [];
    return ids
      .map((id) => this.byId.get(id))
      .filter((entry): entry is DowntimeRecord => Boolean(entry))
      .map((entry) => structuredClone(entry));
  }

  listDowntimeByOperation(tenantId: TenantId, operationExecutionId: string): DowntimeRecord[] {
    const ids = this.byOperation.get(`${tenantId}:${operationExecutionId}`) ?? [];
    return ids
      .map((id) => this.byId.get(id))
      .filter((entry): entry is DowntimeRecord => Boolean(entry))
      .map((entry) => structuredClone(entry));
  }

  listDowntime(tenantId: TenantId): DowntimeRecord[] {
    return deterministicSort(
      [...this.byId.values()].filter((entry) => entry.tenantId === tenantId),
      (entry) => `${entry.startedAt}:${entry.downtimeRecordId}`,
    ).map((entry) => structuredClone(entry));
  }

  private require(tenantId: TenantId, downtimeRecordId: string): DowntimeRecord {
    const found = this.byId.get(downtimeRecordId);
    if (!found) {
      throw new ManufacturingDomainError("INVALID_DOWNTIME", `downtime not found: ${downtimeRecordId}`, false);
    }
    if (found.tenantId !== tenantId) {
      throw new ManufacturingDomainError("TENANT_MISMATCH", "downtime tenant mismatch", false);
    }
    return found;
  }

  private async audit(
    message: string,
    tenantId: TenantId,
    idempotencyKey: IdempotencyKey,
    correlationId: CorrelationIdentifier,
    details: Record<string, unknown>,
  ): Promise<void> {
    await this.dependencies.audit.recordAudit({
      eventType: "manufacturing.downtime",
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
