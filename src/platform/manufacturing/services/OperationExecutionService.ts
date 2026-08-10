import { compareDeterministicStrings, deterministicSort } from "../../shared";
import type {
  CorrelationIdentifier,
  IdempotencyKey,
  ManufacturingFailureClassification,
  OperationEligibilityState,
  OperationExecution,
  OperationLifecycleState,
  TenantId,
} from "../contracts";
import { ManufacturingDomainError, canCompleteOperation, canSkipOperation } from "../domain";
import type { ManufacturingAuditSinkProvider, ManufacturingClockProvider } from "../integration";
import type { ExecutionRoutingService } from "./ExecutionRoutingService";
import type { ManufacturingWorkOrderService } from "./ManufacturingWorkOrderService";

export type InitializeRoutingOperations = Readonly<{
  tenantId: TenantId;
  executionRoutingId: OperationExecution["executionRoutingId"];
  workOrderId: OperationExecution["workOrderId"];
  expectedRoutingVersion: number;
  idempotencyKey: IdempotencyKey;
  correlationId: CorrelationIdentifier;
}>;

export type OperationLifecycleCommand = Readonly<{
  tenantId: TenantId;
  workOrderId: OperationExecution["workOrderId"];
  executionRoutingId: OperationExecution["executionRoutingId"];
  operationExecutionId: OperationExecution["operationExecutionId"];
  expectedVersion: number;
  idempotencyKey: IdempotencyKey;
  correlationId: CorrelationIdentifier;
}>;

export type RequestOperationRework = OperationLifecycleCommand &
  Readonly<{
    targetStepId: OperationExecution["routingStepId"];
  }>;

export type OperationExecutionRecord = Readonly<{
  execution: OperationExecution;
  history: ReadonlyArray<
    Readonly<{
      action: string;
      at: string;
      priorState: OperationLifecycleState;
      nextState: OperationLifecycleState;
      idempotencyKey: IdempotencyKey;
      correlationId: CorrelationIdentifier;
    }>
  >;
  reworkCounts: Readonly<Record<string, number>>;
}>;

type StoredIdempotency = Readonly<{
  payloadFingerprint: string;
  result: OperationExecutionRecord;
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

function cloneRecord(record: OperationExecutionRecord): OperationExecutionRecord {
  return structuredClone(record);
}

function isTerminal(state: OperationLifecycleState): boolean {
  return state === "SKIPPED" || state === "CLOSED" || state === "CANCELLED";
}

export class OperationExecutionService {
  private readonly byId = new Map<string, OperationExecutionRecord>();
  private readonly byRouting = new Map<string, string[]>();
  private readonly byWorkOrder = new Map<string, string[]>();
  private readonly idempotency = new Map<string, StoredIdempotency>();
  private readonly initializationIdempotency = new Map<string, readonly string[]>();
  private readonly operationStartGuards: Array<
    (command: OperationLifecycleCommand, current: OperationExecutionRecord) => void
  > = [];

  constructor(
    private readonly dependencies: {
      clock: ManufacturingClockProvider;
      audit: ManufacturingAuditSinkProvider;
      workOrders: ManufacturingWorkOrderService;
      routings: ExecutionRoutingService;
    },
  ) {}

  async initializeOperations(command: InitializeRoutingOperations): Promise<OperationExecutionRecord[]> {
    const initKey = `${command.tenantId}:OP_INIT:${command.idempotencyKey}`;
    const replay = this.initializationIdempotency.get(initKey);
    if (replay) {
      return replay.map((operationId) => cloneRecord(this.byId.get(operationId)!));
    }

    const routing = this.dependencies.routings.getExecutionRouting(command.tenantId, command.executionRoutingId);
    if (!routing) {
      throw new ManufacturingDomainError("INVALID_ROUTING_REFERENCE", "routing not found for operation initialization", false);
    }
    if (routing.routing.workOrderId !== command.workOrderId) {
      throw new ManufacturingDomainError("INVALID_ROUTING_REFERENCE", "routing/work-order mismatch", false);
    }
    if (routing.routing.version !== command.expectedRoutingVersion) {
      throw new ManufacturingDomainError(
        "STALE_EXPECTED_VERSION",
        `stale expected version: expected ${command.expectedRoutingVersion}, current ${routing.routing.version}`,
        false,
      );
    }

    this.dependencies.workOrders.require(command.tenantId, command.workOrderId);

    const operationIds: string[] = [];
    for (const step of routing.routing.steps) {
      const operationId = step.operationExecutionId as string;
      if (this.byId.has(operationId)) {
        throw new ManufacturingDomainError(
          "DUPLICATE_OPERATION_EXECUTION_ID",
          `operation execution already initialized: ${operationId}`,
          false,
        );
      }

      const eligibility = step.conditionalEligibility.state;
      const hasPredecessor = step.predecessorStepIds.length > 0;
      const initialState: OperationLifecycleState = eligibility === "NOT_ELIGIBLE" ? "SKIPPED" : hasPredecessor ? "BLOCKED" : "READY";

      const execution: OperationExecution = {
        operationExecutionId: step.operationExecutionId,
        tenantId: command.tenantId,
        workOrderId: command.workOrderId,
        executionRoutingId: command.executionRoutingId,
        routingStepId: step.routingStepId,
        operationCode: step.operationCode,
        eligibility,
        operationState: initialState,
        plannedQuantity: this.dependencies.workOrders.require(command.tenantId, command.workOrderId).workOrder.plannedQuantity,
        completedQuantity: {
          value: 0,
          unitOfMeasure: this.dependencies.workOrders.require(command.tenantId, command.workOrderId).workOrder.plannedQuantity.unitOfMeasure,
        } as OperationExecution["completedQuantity"],
        rejectedQuantity: {
          value: 0,
          unitOfMeasure: this.dependencies.workOrders.require(command.tenantId, command.workOrderId).workOrder.plannedQuantity.unitOfMeasure,
        } as OperationExecution["rejectedQuantity"],
        scrapQuantity: {
          value: 0,
          unitOfMeasure: this.dependencies.workOrders.require(command.tenantId, command.workOrderId).workOrder.plannedQuantity.unitOfMeasure,
        } as OperationExecution["scrapQuantity"],
        reworkQuantity: {
          value: 0,
          unitOfMeasure: this.dependencies.workOrders.require(command.tenantId, command.workOrderId).workOrder.plannedQuantity.unitOfMeasure,
        } as OperationExecution["reworkQuantity"],
        version: 1,
      };

      const record: OperationExecutionRecord = {
        execution,
        history: [],
        reworkCounts: {},
      };

      this.byId.set(operationId, record);
      operationIds.push(operationId);
    }

    this.byRouting.set(`${command.tenantId}:${command.executionRoutingId}`, [...operationIds].sort(compareDeterministicStrings));
    this.byWorkOrder.set(`${command.tenantId}:${command.workOrderId}`, [...operationIds].sort(compareDeterministicStrings));
    this.initializationIdempotency.set(initKey, [...operationIds]);

    await this.dependencies.audit.recordAudit({
      eventType: "manufacturing.operation-execution",
      message: "Operations initialized from routing.",
      recordedAt: this.dependencies.clock.now(),
      details: {
        tenantId: command.tenantId,
        workOrderId: command.workOrderId,
        executionRoutingId: command.executionRoutingId,
        operationCount: operationIds.length,
        action: "INITIALIZE",
        idempotencyKey: command.idempotencyKey,
        correlationId: command.correlationId,
        classification: "INVALID_COMMAND",
      },
    });

    return operationIds.map((operationId) => cloneRecord(this.byId.get(operationId)!));
  }

  async startOperation(command: OperationLifecycleCommand): Promise<OperationExecutionRecord> {
    return this.transitionOperation("OP_START", command, "IN_PROGRESS", (current) => {
      this.assertEligible(current.execution.eligibility);
      this.assertPredecessorsSatisfied(current.execution.tenantId, current.execution.executionRoutingId, current.execution.routingStepId);
      this.assertLifecycle(current.execution.operationState, ["READY"]);
      for (const guard of this.operationStartGuards) {
        guard(command, current);
      }
      const workOrder = this.dependencies.workOrders.require(command.tenantId, command.workOrderId);
      if (workOrder.workOrder.workOrderState !== "IN_PROGRESS") {
        throw new ManufacturingDomainError("WORK_ORDER_NOT_READY", "work order is not in execution-compatible state", false);
      }
      return {
        ...current,
        execution: {
          ...current.execution,
          startedAt: current.execution.startedAt ?? this.dependencies.clock.now(),
        },
      };
    });
  }

  registerOperationStartGuard(
    guard: (command: OperationLifecycleCommand, current: OperationExecutionRecord) => void,
  ): void {
    this.operationStartGuards.push(guard);
  }

  async pauseOperation(command: OperationLifecycleCommand): Promise<OperationExecutionRecord> {
    return this.transitionOperation("OP_PAUSE", command, "PAUSED", (current) => {
      this.assertLifecycle(current.execution.operationState, ["IN_PROGRESS"]);
      return current;
    });
  }

  async resumeOperation(command: OperationLifecycleCommand): Promise<OperationExecutionRecord> {
    return this.transitionOperation("OP_RESUME", command, "IN_PROGRESS", (current) => {
      this.assertLifecycle(current.execution.operationState, ["PAUSED"]);
      return current;
    });
  }

  async completeOperation(command: OperationLifecycleCommand): Promise<OperationExecutionRecord> {
    return this.transitionOperation("OP_COMPLETE", command, "COMPLETED", (current) => {
      if (!canCompleteOperation(current.execution.operationState)) {
        throw new ManufacturingDomainError("INVALID_OPERATION_TRANSITION", "operation cannot complete from current state", false);
      }
      return {
        ...current,
        execution: {
          ...current.execution,
          endedAt: this.dependencies.clock.now(),
        },
      };
    });
  }

  async skipOperation(command: OperationLifecycleCommand): Promise<OperationExecutionRecord> {
    return this.transitionOperation("OP_SKIP", command, "SKIPPED", (current) => {
      if (!canSkipOperation(current.execution.operationState)) {
        throw new ManufacturingDomainError("INVALID_OPERATION_TRANSITION", "operation cannot be skipped from current state", false);
      }
      this.assertEligible(current.execution.eligibility, true);
      return current;
    });
  }

  async requestReworkTransition(command: RequestOperationRework): Promise<OperationExecutionRecord> {
    return this.transitionOperation("OP_REWORK", command, "REWORK_REQUIRED", (current) => {
      const routing = this.dependencies.routings.getExecutionRouting(command.tenantId, command.executionRoutingId);
      if (!routing) {
        throw new ManufacturingDomainError("INVALID_ROUTING_REFERENCE", "routing not found", false);
      }

      const sourceStep = routing.routing.steps.find((step) => step.routingStepId === current.execution.routingStepId);
      if (!sourceStep) {
        throw new ManufacturingDomainError("INVALID_ROUTING_REFERENCE", "source step not found for operation", false);
      }

      const edge = sourceStep.explicitReworkEdges.find((candidate) => candidate.targetStepId === command.targetStepId);
      if (!edge) {
        throw new ManufacturingDomainError("INVALID_REWORK_EDGE", "rework target is not permitted by route definition", false);
      }

      this.assertLifecycle(current.execution.operationState, ["COMPLETED", "IN_PROGRESS", "FAILED", "BLOCKED", "REWORK_REQUIRED"]);

      const reworkKey = `${current.execution.routingStepId}->${command.targetStepId}`;
      const currentCount = current.reworkCounts[reworkKey] ?? 0;
      if (currentCount >= edge.maxIterations) {
        throw new ManufacturingDomainError("REWORK_LIMIT_EXCEEDED", `rework iteration limit exceeded for ${reworkKey}`, false);
      }

      const nextCounts = {
        ...current.reworkCounts,
        [reworkKey]: currentCount + 1,
      };

      return {
        ...current,
        reworkCounts: nextCounts,
      };
    });
  }

  getOperationExecution(tenantId: TenantId, operationExecutionId: string): OperationExecutionRecord | undefined {
    const found = this.byId.get(operationExecutionId);
    if (!found || found.execution.tenantId !== tenantId) {
      return undefined;
    }
    return cloneRecord(found);
  }

  listOperationsByWorkOrder(tenantId: TenantId, workOrderId: string): OperationExecutionRecord[] {
    const ids = this.byWorkOrder.get(`${tenantId}:${workOrderId}`) ?? [];
    return ids.map((id) => cloneRecord(this.byId.get(id)!));
  }

  listOperationsByRouting(tenantId: TenantId, executionRoutingId: string): OperationExecutionRecord[] {
    const ids = this.byRouting.get(`${tenantId}:${executionRoutingId}`) ?? [];
    return ids.map((id) => cloneRecord(this.byId.get(id)!));
  }

  listOperationsByStatus(
    tenantId: TenantId,
    executionRoutingId: string,
    status: OperationLifecycleState,
  ): OperationExecutionRecord[] {
    return this.listOperationsByRouting(tenantId, executionRoutingId).filter((entry) => entry.execution.operationState === status);
  }

  getOperationEligibility(tenantId: TenantId, operationExecutionId: string): OperationEligibilityState {
    const found = this.requireOperation(tenantId, operationExecutionId);
    return found.execution.eligibility;
  }

  getNextEligibleOperations(tenantId: TenantId, executionRoutingId: string): OperationExecutionRecord[] {
    const routing = this.dependencies.routings.getExecutionRouting(tenantId, executionRoutingId);
    if (!routing) {
      return [];
    }

    const candidates = this.listOperationsByRouting(tenantId, executionRoutingId).filter((entry) => {
      if (entry.execution.eligibility !== "ELIGIBLE") {
        return false;
      }
      if (entry.execution.operationState !== "READY") {
        return false;
      }
      return this.arePredecessorsSatisfied(tenantId, executionRoutingId, entry.execution.routingStepId);
    });

    return deterministicSort(candidates, (entry) => {
      const sequence = routing.routing.steps.find((step) => step.routingStepId === entry.execution.routingStepId)?.sequenceNumber ?? 0;
      return `${String(sequence).padStart(10, "0")}:${entry.execution.routingStepId}:${entry.execution.operationExecutionId}`;
    });
  }

  applyExecutionQuantities(input: {
    tenantId: TenantId;
    operationExecutionId: OperationExecution["operationExecutionId"];
    expectedVersion: number;
    deltaCompleted?: number;
    deltaRejected?: number;
    deltaScrap?: number;
    deltaRework?: number;
    correlationId: CorrelationIdentifier;
    idempotencyKey: IdempotencyKey;
  }): OperationExecutionRecord {
    const current = this.requireOperation(input.tenantId, input.operationExecutionId as string);
    if (current.execution.version !== input.expectedVersion) {
      throw new ManufacturingDomainError(
        "STALE_EXPECTED_VERSION",
        `stale expected version: expected ${input.expectedVersion}, current ${current.execution.version}`,
        false,
      );
    }

    const deltaCompleted = input.deltaCompleted ?? 0;
    const deltaRejected = input.deltaRejected ?? 0;
    const deltaScrap = input.deltaScrap ?? 0;
    const deltaRework = input.deltaRework ?? 0;
    for (const delta of [deltaCompleted, deltaRejected, deltaScrap, deltaRework]) {
      if (!Number.isFinite(delta) || delta < 0) {
        throw new ManufacturingDomainError("INVALID_QUANTITY", "quantity deltas must be non-negative finite values", false);
      }
    }

    if (isTerminal(current.execution.operationState) && deltaCompleted + deltaRejected + deltaScrap + deltaRework > 0) {
      throw new ManufacturingDomainError("PRODUCTION_OUTPUT_NOT_ALLOWED", "operation is terminal for quantity mutation", false);
    }

    const nextCompleted = Math.round((current.execution.completedQuantity.value + deltaCompleted) * 1_000_000) / 1_000_000;
    const nextRejected = Math.round((current.execution.rejectedQuantity.value + deltaRejected) * 1_000_000) / 1_000_000;
    const nextScrap = Math.round((current.execution.scrapQuantity.value + deltaScrap) * 1_000_000) / 1_000_000;
    const nextRework = Math.round((current.execution.reworkQuantity.value + deltaRework) * 1_000_000) / 1_000_000;
    const totalProcessed = nextCompleted + nextRejected + nextScrap;
    if (totalProcessed > current.execution.plannedQuantity.value + 0.000001) {
      throw new ManufacturingDomainError(
        "PRODUCTION_OUTPUT_QUANTITY_EXCEEDED",
        "operation processed quantity exceeds planned bounds",
        false,
      );
    }

    const nextState: OperationLifecycleState =
      totalProcessed >= current.execution.plannedQuantity.value - 0.000001 ? "COMPLETED" : current.execution.operationState;

    const updated: OperationExecutionRecord = {
      ...current,
      execution: {
        ...current.execution,
        completedQuantity: {
          ...current.execution.completedQuantity,
          value: nextCompleted,
        },
        rejectedQuantity: {
          ...current.execution.rejectedQuantity,
          value: nextRejected,
        },
        scrapQuantity: {
          ...current.execution.scrapQuantity,
          value: nextScrap,
        },
        reworkQuantity: {
          ...current.execution.reworkQuantity,
          value: nextRework,
        },
        operationState: nextState,
        endedAt:
          nextState === "COMPLETED" ? (current.execution.endedAt ?? this.dependencies.clock.now()) : current.execution.endedAt,
        version: current.execution.version + 1,
      },
      history: [
        ...current.history,
        {
          action: "APPLY_QUANTITIES",
          at: this.dependencies.clock.now(),
          priorState: current.execution.operationState,
          nextState,
          idempotencyKey: input.idempotencyKey,
          correlationId: input.correlationId,
        },
      ],
    };

    this.byId.set(updated.execution.operationExecutionId as string, updated);
    this.refreshDownstreamReadiness(updated.execution.tenantId, updated.execution.executionRoutingId, updated.execution.routingStepId);
    return cloneRecord(updated);
  }

  private async transitionOperation(
    commandFamily: string,
    command: OperationLifecycleCommand,
    nextState: OperationLifecycleState,
    mutate: (current: OperationExecutionRecord) => OperationExecutionRecord,
  ): Promise<OperationExecutionRecord> {
    const idempotencyKey = `${command.tenantId}:${commandFamily}:${command.idempotencyKey}`;
    const payloadFingerprint = createFingerprint(command);
    const replay = this.idempotency.get(idempotencyKey);

    if (replay) {
      if (replay.payloadFingerprint !== payloadFingerprint) {
        await this.audit(
          "CONFLICTING_IDEMPOTENCY_PAYLOAD",
          "Operation command rejected due to conflicting idempotency payload.",
          command,
          undefined,
          command.operationExecutionId,
          undefined,
          undefined,
        );
        throw new ManufacturingDomainError("CONFLICTING_IDEMPOTENCY_PAYLOAD", "conflicting idempotency payload", false);
      }

      await this.audit(
        "DUPLICATE_OPERATION_COMMAND",
        "Operation command replay accepted.",
        command,
        undefined,
        command.operationExecutionId,
        replay.result.execution.version,
        replay.result.execution.version,
      );
      return cloneRecord(replay.result);
    }

    const current = this.requireOperation(command.tenantId, command.operationExecutionId as string);
    this.dependencies.workOrders.require(command.tenantId, command.workOrderId);

    if (current.execution.executionRoutingId !== command.executionRoutingId || current.execution.workOrderId !== command.workOrderId) {
      throw new ManufacturingDomainError("INVALID_ROUTING_REFERENCE", "operation command routing/work-order mismatch", false);
    }

    if (current.execution.version !== command.expectedVersion) {
      await this.audit(
        "STALE_EXPECTED_VERSION",
        "Operation command rejected due to stale expected version.",
        command,
        command.executionRoutingId,
        command.operationExecutionId,
        current.execution.version,
        current.execution.version,
      );
      throw new ManufacturingDomainError(
        "STALE_EXPECTED_VERSION",
        `stale expected version: expected ${command.expectedVersion}, current ${current.execution.version}`,
        false,
      );
    }

    if (isTerminal(current.execution.operationState)) {
      throw new ManufacturingDomainError("TERMINAL_OPERATION_MUTATION", "terminal operation mutation is not allowed", false);
    }

    const priorState = current.execution.operationState;
    const proposed = mutate(cloneRecord(current));

    const updated: OperationExecutionRecord = {
      ...proposed,
      execution: {
        ...proposed.execution,
        operationState: nextState,
        version: current.execution.version + 1,
      },
      history: [
        ...proposed.history,
        {
          action: commandFamily,
          at: this.dependencies.clock.now(),
          priorState,
          nextState,
          idempotencyKey: command.idempotencyKey,
          correlationId: command.correlationId,
        },
      ],
    };

    this.byId.set(updated.execution.operationExecutionId as string, updated);
    this.idempotency.set(idempotencyKey, {
      payloadFingerprint,
      result: cloneRecord(updated),
    });

    this.refreshDownstreamReadiness(updated.execution.tenantId, updated.execution.executionRoutingId, updated.execution.routingStepId);

    await this.audit(
      "INVALID_COMMAND",
      `Operation transitioned ${priorState} -> ${nextState}.`,
      command,
      updated.execution.executionRoutingId,
      updated.execution.operationExecutionId,
      current.execution.version,
      updated.execution.version,
    );

    return cloneRecord(updated);
  }

  private refreshDownstreamReadiness(tenantId: TenantId, executionRoutingId: string, sourceStepId: string): void {
    const routing = this.dependencies.routings.getExecutionRouting(tenantId, executionRoutingId);
    if (!routing) {
      return;
    }

    const step = routing.routing.steps.find((item) => item.routingStepId === sourceStepId);
    if (!step) {
      return;
    }

    for (const successorId of step.successorStepIds) {
      const successor = routing.routing.steps.find((item) => item.routingStepId === successorId);
      if (!successor) {
        continue;
      }

      const operation = this.byId.get(successor.operationExecutionId as string);
      if (!operation) {
        continue;
      }

      if (operation.execution.operationState === "BLOCKED" && this.arePredecessorsSatisfied(tenantId, executionRoutingId, successorId)) {
        const next: OperationExecutionRecord = {
          ...operation,
          execution: {
            ...operation.execution,
            operationState: "READY",
            version: operation.execution.version + 1,
          },
          history: [
            ...operation.history,
            {
              action: "AUTO_UNBLOCK",
              at: this.dependencies.clock.now(),
              priorState: "BLOCKED",
              nextState: "READY",
              idempotencyKey: "auto-unblock" as IdempotencyKey,
              correlationId: "auto-unblock" as CorrelationIdentifier,
            },
          ],
        };
        this.byId.set(successor.operationExecutionId as string, next);
      }
    }
  }

  private assertLifecycle(current: OperationLifecycleState, allowed: readonly OperationLifecycleState[]): void {
    if (!allowed.includes(current)) {
      throw new ManufacturingDomainError("INVALID_OPERATION_TRANSITION", `invalid operation lifecycle transition from ${current}`, false);
    }
  }

  private assertEligible(eligibility: OperationEligibilityState, allowDeferred = false): void {
    if (eligibility === "ELIGIBLE") {
      return;
    }
    if (allowDeferred && eligibility === "DEFERRED") {
      return;
    }
    throw new ManufacturingDomainError("OPERATION_NOT_ELIGIBLE", `operation is not eligible (${eligibility})`, false);
  }

  private assertPredecessorsSatisfied(tenantId: TenantId, executionRoutingId: string, routingStepId: string): void {
    if (!this.arePredecessorsSatisfied(tenantId, executionRoutingId, routingStepId)) {
      throw new ManufacturingDomainError("OPERATION_PREREQUISITE_FAILURE", "predecessor requirements are not satisfied", false);
    }
  }

  private arePredecessorsSatisfied(tenantId: TenantId, executionRoutingId: string, routingStepId: string): boolean {
    const routing = this.dependencies.routings.getExecutionRouting(tenantId, executionRoutingId);
    if (!routing) {
      return false;
    }

    const step = routing.routing.steps.find((candidate) => candidate.routingStepId === routingStepId);
    if (!step) {
      return false;
    }

    for (const predecessorId of step.predecessorStepIds) {
      const predecessor = routing.routing.steps.find((candidate) => candidate.routingStepId === predecessorId);
      if (!predecessor) {
        return false;
      }
      const predecessorOperation = this.byId.get(predecessor.operationExecutionId as string);
      if (!predecessorOperation) {
        return false;
      }
      const predecessorState = predecessorOperation.execution.operationState;
      if (predecessorState !== "COMPLETED" && predecessorState !== "SKIPPED" && predecessorState !== "CLOSED") {
        return false;
      }
    }

    return true;
  }

  private requireOperation(tenantId: TenantId, operationExecutionId: string): OperationExecutionRecord {
    const found = this.byId.get(operationExecutionId);
    if (!found) {
      throw new ManufacturingDomainError("INVALID_ROUTING_REFERENCE", `operation execution not found: ${operationExecutionId}`, false);
    }
    if (found.execution.tenantId !== tenantId) {
      throw new ManufacturingDomainError("TENANT_MISMATCH", "operation tenant mismatch", false);
    }
    return found;
  }

  private async audit(
    classification: ManufacturingFailureClassification,
    message: string,
    command: {
      tenantId: TenantId;
      workOrderId: string;
      idempotencyKey: IdempotencyKey;
      correlationId: CorrelationIdentifier;
      executionRoutingId?: string;
    },
    executionRoutingId: string | undefined,
    operationExecutionId: string | undefined,
    priorVersion: number | undefined,
    resultingVersion: number | undefined,
  ): Promise<void> {
    await this.dependencies.audit.recordAudit({
      eventType: "manufacturing.operation-execution",
      message,
      recordedAt: this.dependencies.clock.now(),
      details: {
        tenantId: command.tenantId,
        workOrderId: command.workOrderId,
        executionRoutingId: executionRoutingId ?? command.executionRoutingId,
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
