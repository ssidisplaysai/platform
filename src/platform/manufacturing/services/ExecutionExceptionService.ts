import { compareDeterministicStrings, deterministicSort } from "../../shared";
import type {
  CorrelationIdentifier,
  ExecutionException,
  ExecutionExceptionCommand,
  IdempotencyKey,
  QualityHoldApplyCommand,
  QualityHoldReleaseCommand,
  TenantId,
} from "../contracts";
import { ManufacturingDomainError } from "../domain";
import type { ManufacturingAuditSinkProvider, ManufacturingClockProvider } from "../integration";
import type { ManufacturingWorkOrderService } from "./ManufacturingWorkOrderService";
import type { OperationExecutionService } from "./OperationExecutionService";

type StoredIdempotency = Readonly<{
  payloadFingerprint: string;
  result: ExecutionException;
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

export class ExecutionExceptionService {
  private readonly byId = new Map<string, ExecutionException>();
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

  async openException(command: ExecutionExceptionCommand): Promise<ExecutionException> {
    const key = `${command.tenantId}:EXECUTION_EXCEPTION_OPEN:${command.idempotencyKey}`;
    const payloadFingerprint = createFingerprint(command);
    const replay = this.idempotency.get(key);
    if (replay) {
      if (replay.payloadFingerprint !== payloadFingerprint) {
        throw new ManufacturingDomainError("CONFLICTING_IDEMPOTENCY_PAYLOAD", "conflicting idempotency payload", false);
      }
      return structuredClone(replay.result);
    }

    if (this.byId.has(command.executionExceptionId as string)) {
      throw new ManufacturingDomainError("INVALID_EXECUTION_EXCEPTION", "duplicate execution exception id", false);
    }

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
        throw new ManufacturingDomainError("INVALID_EXECUTION_EXCEPTION", "operation/work-order mismatch for execution exception", false);
      }
    }

    const created: ExecutionException = {
      executionExceptionId: command.executionExceptionId,
      tenantId: command.tenantId,
      workOrderId: command.workOrderId,
      operationExecutionId: command.operationExecutionId,
      category: command.category,
      severity: command.severity,
      reason: command.reason,
      sourceReference: command.sourceReference,
      status: "OPEN",
      openedAt: this.dependencies.clock.now(),
      idempotencyKey: command.idempotencyKey,
      correlationId: command.correlationId,
      metadata: command.metadata,
      version: 1,
    };

    this.byId.set(created.executionExceptionId as string, created);
    const woKey = `${command.tenantId}:${command.workOrderId}`;
    this.byWorkOrder.set(woKey, [...(this.byWorkOrder.get(woKey) ?? []), created.executionExceptionId as string]);
    if (command.operationExecutionId) {
      const opKey = `${command.tenantId}:${command.operationExecutionId}`;
      this.byOperation.set(opKey, [...(this.byOperation.get(opKey) ?? []), created.executionExceptionId as string]);
    }

    this.idempotency.set(key, {
      payloadFingerprint,
      result: structuredClone(created),
    });

    await this.audit("Execution exception opened.", command.tenantId, command.idempotencyKey, command.correlationId, {
      executionExceptionId: created.executionExceptionId,
      workOrderId: created.workOrderId,
      operationExecutionId: created.operationExecutionId,
      classification: "INVALID_COMMAND",
    });

    return structuredClone(created);
  }

  closeException(input: {
    tenantId: TenantId;
    executionExceptionId: ExecutionException["executionExceptionId"];
    expectedVersion: number;
    correlationId: CorrelationIdentifier;
    idempotencyKey: IdempotencyKey;
  }): ExecutionException {
    const current = this.require(input.tenantId, input.executionExceptionId as string);
    if (current.version !== input.expectedVersion) {
      throw new ManufacturingDomainError(
        "STALE_EXPECTED_VERSION",
        `stale expected version: expected ${input.expectedVersion}, current ${current.version}`,
        false,
      );
    }
    if (current.status === "CLOSED") {
      return structuredClone(current);
    }

    const next: ExecutionException = {
      ...current,
      status: "CLOSED",
      closedAt: this.dependencies.clock.now(),
      version: current.version + 1,
    };
    this.byId.set(next.executionExceptionId as string, next);
    return structuredClone(next);
  }

  applyQualityHold(command: QualityHoldApplyCommand): ExecutionException {
    const current = this.require(command.tenantId, command.executionExceptionId as string);
    if (current.version !== command.expectedVersion) {
      throw new ManufacturingDomainError(
        "STALE_EXPECTED_VERSION",
        `stale expected version: expected ${command.expectedVersion}, current ${current.version}`,
        false,
      );
    }
    if (current.status !== "OPEN") {
      throw new ManufacturingDomainError("INVALID_EXECUTION_EXCEPTION", "cannot apply quality hold to closed exception", false);
    }
    if (command.qualityHoldRef.tenantId !== command.tenantId) {
      throw new ManufacturingDomainError("INVALID_QUALITY_HOLD_REFERENCE", "quality hold tenant mismatch", false);
    }
    if (current.qualityHoldRef) {
      throw new ManufacturingDomainError("QUALITY_HOLD_ACTIVE", "quality hold already active", false);
    }

    const next: ExecutionException = {
      ...current,
      qualityHoldRef: command.qualityHoldRef,
      version: current.version + 1,
    };
    this.byId.set(next.executionExceptionId as string, next);
    return structuredClone(next);
  }

  releaseQualityHold(command: QualityHoldReleaseCommand): ExecutionException {
    const current = this.require(command.tenantId, command.executionExceptionId as string);
    if (current.version !== command.expectedVersion) {
      throw new ManufacturingDomainError(
        "STALE_EXPECTED_VERSION",
        `stale expected version: expected ${command.expectedVersion}, current ${current.version}`,
        false,
      );
    }
    if (!current.qualityHoldRef) {
      throw new ManufacturingDomainError("INVALID_QUALITY_HOLD_REFERENCE", "quality hold is not active", false);
    }
    if (current.qualityHoldRef.qualityHoldReferenceId !== command.qualityHoldReferenceId) {
      throw new ManufacturingDomainError("INVALID_QUALITY_HOLD_REFERENCE", "quality hold identity mismatch", false);
    }
    if (!command.releaseEvidence || command.releaseEvidence.trim().length === 0) {
      throw new ManufacturingDomainError("INVALID_QUALITY_HOLD_REFERENCE", "release evidence is required", false);
    }

    const next: ExecutionException = {
      ...current,
      qualityHoldRef: undefined,
      version: current.version + 1,
    };
    this.byId.set(next.executionExceptionId as string, next);
    return structuredClone(next);
  }

  hasActiveQualityHold(tenantId: TenantId, workOrderId: string, operationExecutionId?: string): boolean {
    return [...this.byId.values()].some(
      (entry) =>
        entry.tenantId === tenantId &&
        entry.status === "OPEN" &&
        Boolean(entry.qualityHoldRef) &&
        entry.workOrderId === workOrderId &&
        (!operationExecutionId || entry.operationExecutionId === operationExecutionId),
    );
  }

  getExecutionException(tenantId: TenantId, executionExceptionId: string): ExecutionException | undefined {
    const found = this.byId.get(executionExceptionId);
    if (!found || found.tenantId !== tenantId) {
      return undefined;
    }
    return structuredClone(found);
  }

  listExecutionExceptions(tenantId: TenantId): ExecutionException[] {
    return deterministicSort(
      [...this.byId.values()].filter((entry) => entry.tenantId === tenantId),
      (entry) => `${entry.openedAt}:${entry.executionExceptionId}`,
    ).map((entry) => structuredClone(entry));
  }

  listExecutionExceptionsByWorkOrder(tenantId: TenantId, workOrderId: string): ExecutionException[] {
    const ids = this.byWorkOrder.get(`${tenantId}:${workOrderId}`) ?? [];
    return ids
      .map((id) => this.byId.get(id))
      .filter((entry): entry is ExecutionException => Boolean(entry))
      .map((entry) => structuredClone(entry));
  }

  listExecutionExceptionsByOperation(tenantId: TenantId, operationExecutionId: string): ExecutionException[] {
    const ids = this.byOperation.get(`${tenantId}:${operationExecutionId}`) ?? [];
    return ids
      .map((id) => this.byId.get(id))
      .filter((entry): entry is ExecutionException => Boolean(entry))
      .map((entry) => structuredClone(entry));
  }

  listOpenExecutionExceptions(tenantId: TenantId): ExecutionException[] {
    return this.listExecutionExceptions(tenantId).filter((entry) => entry.status === "OPEN");
  }

  private require(tenantId: TenantId, executionExceptionId: string): ExecutionException {
    const found = this.byId.get(executionExceptionId);
    if (!found) {
      throw new ManufacturingDomainError("INVALID_EXECUTION_EXCEPTION", `execution exception not found: ${executionExceptionId}`, false);
    }
    if (found.tenantId !== tenantId) {
      throw new ManufacturingDomainError("TENANT_MISMATCH", "execution exception tenant mismatch", false);
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
      eventType: "manufacturing.execution-exception",
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
