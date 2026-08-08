import { compareDeterministicStrings, deterministicSort } from "../../shared";
import type {
  CorrelationIdentifier,
  ExecutionRouting,
  IdempotencyKey,
  ManufacturingFailureClassification,
  RoutingStep,
  TenantId,
} from "../contracts";
import { ManufacturingDomainError, validateRoutingGraph } from "../domain";
import type { ManufacturingAuditSinkProvider, ManufacturingClockProvider } from "../integration";
import type { ManufacturingWorkOrderService } from "./ManufacturingWorkOrderService";

export type CreateExecutionRouting = Readonly<{
  executionRoutingId: ExecutionRouting["executionRoutingId"];
  tenantId: TenantId;
  workOrderId: ExecutionRouting["workOrderId"];
  sourceRoutingReference?: ExecutionRouting["sourceRoutingReference"];
  sourceProductVersionRef?: ExecutionRouting["sourceProductVersionRef"];
  sourceBomRef?: ExecutionRouting["sourceBomRef"];
  steps: readonly RoutingStep[];
  expectedWorkOrderVersion: number;
  expectedVersion: number;
  idempotencyKey: IdempotencyKey;
  correlationId: CorrelationIdentifier;
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}>;

export type ExecutionRoutingReadiness = Readonly<{
  routingReady: boolean;
  blockingInvariants: readonly string[];
}>;

export type ExecutionRoutingRecord = Readonly<{
  routing: ExecutionRouting;
  metadata: Readonly<Record<string, string | number | boolean | null>>;
  orderedStepIds: readonly string[];
  structuralEdges: ReadonlyArray<Readonly<{ from: string; to: string; edgeType: "STRUCTURAL" | "CONDITIONAL" }>>;
  reworkEdges: ReadonlyArray<Readonly<{ from: string; to: string; edgeType: "REWORK" }>>;
  readiness: ExecutionRoutingReadiness;
}>;

type StoredIdempotency = Readonly<{
  payloadFingerprint: string;
  result: ExecutionRoutingRecord;
}>;

function stableJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stableJson(item));
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

function cloneRecord(record: ExecutionRoutingRecord): ExecutionRoutingRecord {
  return structuredClone(record);
}

export class ExecutionRoutingService {
  private readonly byId = new Map<string, ExecutionRoutingRecord>();
  private readonly idByTenantAndWorkOrder = new Map<string, string>();
  private readonly idempotency = new Map<string, StoredIdempotency>();

  constructor(
    private readonly dependencies: {
      clock: ManufacturingClockProvider;
      audit: ManufacturingAuditSinkProvider;
      workOrders: ManufacturingWorkOrderService;
    },
  ) {}

  async createExecutionRouting(command: CreateExecutionRouting): Promise<ExecutionRoutingRecord> {
    const idempotencyKey = `${command.tenantId}:ROUTING_CREATE:${command.idempotencyKey}`;
    const payloadFingerprint = createFingerprint(command);
    const replay = this.idempotency.get(idempotencyKey);

    if (replay) {
      if (replay.payloadFingerprint !== payloadFingerprint) {
        await this.audit(
          "CONFLICTING_IDEMPOTENCY_PAYLOAD",
          "Routing create rejected due to conflicting idempotency payload.",
          command,
          command.executionRoutingId,
          undefined,
          0,
          0,
        );
        throw new ManufacturingDomainError("CONFLICTING_IDEMPOTENCY_PAYLOAD", "conflicting idempotency payload", false);
      }
      await this.audit(
        "DUPLICATE_OPERATION_COMMAND",
        "Routing create replay accepted.",
        command,
        command.executionRoutingId,
        undefined,
        replay.result.routing.version,
        replay.result.routing.version,
      );
      return cloneRecord(replay.result);
    }

    if (command.expectedVersion !== 0) {
      throw new ManufacturingDomainError("STALE_EXPECTED_VERSION", "expected version must be 0 for routing create", false);
    }

    const routingId = command.executionRoutingId as string;
    if (this.byId.has(routingId)) {
      throw new ManufacturingDomainError("DUPLICATE_ROUTING_ID", `duplicate execution routing id: ${routingId}`, false);
    }

    const workOrder = this.dependencies.workOrders.require(command.tenantId, command.workOrderId);
    const tenantWorkOrderKey = `${command.tenantId}:${command.workOrderId}`;
    if (this.idByTenantAndWorkOrder.has(tenantWorkOrderKey)) {
      throw new ManufacturingDomainError("DUPLICATE_ROUTING_ID", `routing already exists for work order: ${command.workOrderId}`, false);
    }

    if (workOrder.workOrder.tenantId !== command.tenantId) {
      throw new ManufacturingDomainError("TENANT_MISMATCH", "routing tenant mismatch", false);
    }

    if (command.steps.length === 0) {
      throw new ManufacturingDomainError("INVALID_ROUTING_REFERENCE", "routing requires at least one step", false);
    }

    for (const step of command.steps) {
      if (step.tenantId !== command.tenantId) {
        throw new ManufacturingDomainError("TENANT_MISMATCH", "routing step tenant mismatch", false);
      }
      if (!step.operationExecutionId || !step.operationCode) {
        throw new ManufacturingDomainError(
          "INVALID_ROUTING_REFERENCE",
          `routing step ${step.routingStepId} requires operationExecutionId and operationCode`,
          false,
        );
      }
      if (!step.conditionalEligibility || !step.executionState) {
        throw new ManufacturingDomainError(
          "INVALID_ROUTING_REFERENCE",
          `routing step ${step.routingStepId} requires conditional and execution state metadata`,
          false,
        );
      }

      for (const edge of step.explicitReworkEdges ?? []) {
        if (!Number.isInteger(edge.maxIterations) || edge.maxIterations < 1) {
          throw new ManufacturingDomainError(
            "INVALID_REWORK_EDGE",
            `rework edge maxIterations must be >= 1 for step ${step.routingStepId}`,
            false,
          );
        }
      }
    }

    const routing: ExecutionRouting = {
      executionRoutingId: command.executionRoutingId,
      tenantId: command.tenantId,
      workOrderId: command.workOrderId,
      sourceRoutingReference: command.sourceRoutingReference,
      sourceProductVersionRef: command.sourceProductVersionRef,
      sourceBomRef: command.sourceBomRef,
      status: "READY" as ExecutionRouting["status"],
      steps: command.steps,
      version: 1,
    };

    const validation = validateRoutingGraph(routing);
    const readiness: ExecutionRoutingReadiness = {
      routingReady: true,
      blockingInvariants: [],
    };

    this.dependencies.workOrders.registerRoutingBinding({
      tenantId: command.tenantId,
      workOrderId: command.workOrderId,
      executionRoutingId: command.executionRoutingId,
      expectedVersion: command.expectedWorkOrderVersion,
    });

    const record: ExecutionRoutingRecord = {
      routing,
      metadata: { ...(command.metadata ?? {}) },
      orderedStepIds: [...validation.orderedStepIds],
      structuralEdges: validation.structuralEdges
        .filter((edge) => edge.edgeType !== "REWORK")
        .map((edge) => ({ from: edge.from, to: edge.to, edgeType: edge.edgeType as "STRUCTURAL" | "CONDITIONAL" })),
      reworkEdges: validation.reworkEdges.map((edge) => ({ from: edge.from, to: edge.to, edgeType: "REWORK" as const })),
      readiness,
    };

    this.byId.set(routingId, record);
    this.idByTenantAndWorkOrder.set(tenantWorkOrderKey, routingId);
    this.idempotency.set(idempotencyKey, {
      payloadFingerprint,
      result: cloneRecord(record),
    });

    await this.audit(
      "INVALID_COMMAND",
      "Execution routing created.",
      command,
      command.executionRoutingId,
      undefined,
      0,
      1,
    );

    return cloneRecord(record);
  }

  getExecutionRouting(tenantId: TenantId, executionRoutingId: string): ExecutionRoutingRecord | undefined {
    const found = this.byId.get(executionRoutingId);
    if (!found || found.routing.tenantId !== tenantId) {
      return undefined;
    }
    return cloneRecord(found);
  }

  getExecutionRoutingByWorkOrder(tenantId: TenantId, workOrderId: string): ExecutionRoutingRecord | undefined {
    const routingId = this.idByTenantAndWorkOrder.get(`${tenantId}:${workOrderId}`);
    if (!routingId) {
      return undefined;
    }
    return this.getExecutionRouting(tenantId, routingId);
  }

  listExecutionRoutings(tenantId: TenantId): ExecutionRoutingRecord[] {
    const entries = [...this.byId.values()].filter((entry) => entry.routing.tenantId === tenantId);
    return deterministicSort(entries, (entry) => `${entry.routing.workOrderId}:${entry.routing.executionRoutingId}`).map((entry) =>
      cloneRecord(entry),
    );
  }

  getRoutingReadiness(tenantId: TenantId, executionRoutingId: string): ExecutionRoutingReadiness {
    const found = this.getExecutionRouting(tenantId, executionRoutingId);
    if (!found) {
      throw new ManufacturingDomainError("INVALID_ROUTING_REFERENCE", `execution routing not found: ${executionRoutingId}`, false);
    }
    return {
      routingReady: found.readiness.routingReady,
      blockingInvariants: [...found.readiness.blockingInvariants],
    };
  }

  private async audit(
    classification: ManufacturingFailureClassification,
    message: string,
    command: { tenantId: TenantId; idempotencyKey: IdempotencyKey; correlationId: CorrelationIdentifier; workOrderId: string },
    executionRoutingId: string,
    operationExecutionId: string | undefined,
    priorVersion: number,
    resultingVersion: number,
  ): Promise<void> {
    await this.dependencies.audit.recordAudit({
      eventType: "manufacturing.execution-routing",
      message,
      recordedAt: this.dependencies.clock.now(),
      details: {
        tenantId: command.tenantId,
        workOrderId: command.workOrderId,
        executionRoutingId,
        operationExecutionId,
        action: message,
        priorVersion,
        resultingVersion,
        idempotencyKey: command.idempotencyKey,
        correlationId: command.correlationId,
        classification,
      },
    });
  }
}
