import { describe, expect, it } from "@jest/globals";
import {
  createDefaultManufacturingRuntimeDependencies,
  createManufacturingIdentifier,
  createManufacturingRuntime,
  createPlannedQuantity,
  createRequestedQuantity,
  createSequenceNumber,
  createUnitOfMeasure,
  type CreateExecutionRouting,
  type CreateManufacturingWorkOrder,
  type ExecutionRoutingService,
  type ManufacturingRoutingQueryService,
  type ManufacturingWorkOrderService,
  type OperationExecutionService,
} from "@/platform/manufacturing";

function id<T extends Parameters<typeof createManufacturingIdentifier>[1]>(value: string, brand: T) {
  return createManufacturingIdentifier(value, brand);
}

function createBaseWorkOrder(tenantId = id("tenant-001", "TenantId"), suffix = "001"): CreateManufacturingWorkOrder {
  const unit = createUnitOfMeasure("EA");
  return {
    workOrderId: id(`wo-${suffix}`, "ManufacturingWorkOrderId"),
    workOrderNumber: id(`WO-${suffix}`, "WorkOrderNumber"),
    tenantId,
    productRef: { tenantId, productId: id(`prod-${suffix}`, "ProductIdentifier") },
    productVariantRef: { tenantId, productVariantId: id(`var-${suffix}`, "ProductVariantIdentifier") },
    productVersionRef: { tenantId, productVersionId: id(`pv-${suffix}`, "ProductVersionIdentifier") },
    productBomRef: { tenantId, productBomId: id(`bom-${suffix}`, "ProductBomIdentifier"), bomVersion: id("1.0.0", "VersionIdentifier") },
    requestedQuantity: createRequestedQuantity(10, unit),
    plannedQuantity: createPlannedQuantity(10, unit),
    priority: "HIGH",
    idempotencyKey: id(`idem-wo-create-${suffix}`, "IdempotencyKey"),
    correlationId: id(`corr-wo-create-${suffix}`, "CorrelationIdentifier"),
    command: {
      commandId: `cmd-wo-${suffix}`,
      expectedVersion: 0,
      requestedAt: "2026-08-07T20:00:00.000Z",
    },
  };
}

function createRoutingCommand(input: {
  tenantId: ReturnType<typeof id<"TenantId">>;
  workOrderId: ReturnType<typeof id<"ManufacturingWorkOrderId">>;
  expectedWorkOrderVersion: number;
  routingId: string;
  stepOrder?: readonly string[];
}): CreateExecutionRouting {
  const stepOrder = input.stepOrder ?? ["s1", "s2", "s3"];
  const stepById = {
    s1: {
      routingStepId: id("step-001", "RoutingStepId"),
      operationExecutionId: id("opexec-001", "OperationExecutionId"),
      operationCode: id("OP-001", "OperationCode"),
      routingStepCode: id("STEP-001", "RoutingStepCode"),
      sequenceNumber: createSequenceNumber(10),
      predecessorStepIds: [],
      successorStepIds: [id("step-002", "RoutingStepId")],
      conditionalEligibility: { state: "ELIGIBLE" as const },
      explicitReworkEdges: [{ targetStepId: id("step-002", "RoutingStepId"), maxIterations: 1 }],
      reworkStepIds: [id("step-002", "RoutingStepId")],
      conditionalStepIds: [],
      executionState: { readiness: "READY" as const, operationState: "READY" as const },
      tenantId: input.tenantId,
    },
    s2: {
      routingStepId: id("step-002", "RoutingStepId"),
      operationExecutionId: id("opexec-002", "OperationExecutionId"),
      operationCode: id("OP-002", "OperationCode"),
      routingStepCode: id("STEP-002", "RoutingStepCode"),
      sequenceNumber: createSequenceNumber(20),
      predecessorStepIds: [id("step-001", "RoutingStepId")],
      successorStepIds: [id("step-003", "RoutingStepId")],
      conditionalEligibility: { state: "ELIGIBLE" as const },
      explicitReworkEdges: [{ targetStepId: id("step-001", "RoutingStepId"), maxIterations: 1 }],
      reworkStepIds: [id("step-001", "RoutingStepId")],
      conditionalStepIds: [],
      executionState: { readiness: "BLOCKED" as const, operationState: "BLOCKED" as const },
      tenantId: input.tenantId,
    },
    s3: {
      routingStepId: id("step-003", "RoutingStepId"),
      operationExecutionId: id("opexec-003", "OperationExecutionId"),
      operationCode: id("OP-003", "OperationCode"),
      routingStepCode: id("STEP-003", "RoutingStepCode"),
      sequenceNumber: createSequenceNumber(30),
      predecessorStepIds: [id("step-002", "RoutingStepId")],
      successorStepIds: [],
      conditionalEligibility: { state: "DEFERRED" as const, conditionCode: id("COND-STEP-003", "ConditionCode") },
      explicitReworkEdges: [],
      reworkStepIds: [],
      conditionalStepIds: [],
      executionState: { readiness: "NOT_READY" as const, operationState: "BLOCKED" as const },
      tenantId: input.tenantId,
    },
  } as const;

  return {
    executionRoutingId: id(input.routingId, "ExecutionRoutingId"),
    tenantId: input.tenantId,
    workOrderId: input.workOrderId,
    sourceRoutingReference: id("prod-routing-001", "ProductRoutingReferenceId"),
    sourceProductVersionRef: { tenantId: input.tenantId, productVersionId: id("pv-001", "ProductVersionIdentifier") },
    sourceBomRef: { tenantId: input.tenantId, productBomId: id("bom-001", "ProductBomIdentifier"), bomVersion: id("1.0.0", "VersionIdentifier") },
    steps: stepOrder.map((key) => stepById[key as keyof typeof stepById]),
    expectedWorkOrderVersion: input.expectedWorkOrderVersion,
    expectedVersion: 0,
    idempotencyKey: id(`idem-routing-${input.routingId}`, "IdempotencyKey"),
    correlationId: id(`corr-routing-${input.routingId}`, "CorrelationIdentifier"),
  };
}

async function createRuntime() {
  const audits: Array<Record<string, unknown>> = [];
  const baseDependencies = createDefaultManufacturingRuntimeDependencies();

  const runtime = await createManufacturingRuntime({
    runtimeId: "manufacturing-runtime-s4-test",
    dependencies: {
      ...baseDependencies,
      auditSinkProvider: {
        ...baseDependencies.auditSinkProvider,
        async recordAudit(record: Record<string, unknown>) {
          audits.push(record);
        },
      },
    },
    productIntegration: {
      integrationId: "product-port",
      port: {
        async validateProductReference() { return { valid: true }; },
        async validateVariantReference() { return { valid: true }; },
        async validateProductVersionReference() { return { valid: true }; },
        async validateBomReference() { return { valid: true }; },
        async validateRoutingReference() { return { valid: true }; },
        async validateConfigurationReference() { return { valid: true }; },
      },
    },
    inventoryIntegration: {
      integrationId: "inventory-port",
      port: {
        async queryAvailability() { return { valid: true }; },
        async requestReservation() { return { accepted: true, referenceId: "r1" }; },
        async requestAllocation() { return { accepted: true, referenceId: "a1" }; },
        async releaseReservation() { return { accepted: true, referenceId: "rr1" }; },
        async releaseAllocation() { return { accepted: true, referenceId: "ra1" }; },
        async requestMaterialIssue() { return { accepted: true, referenceId: "mi1" }; },
        async requestMaterialReturn() { return { accepted: true, referenceId: "mr1" }; },
        async requestFinishedGoodsReceipt() { return { accepted: true, referenceId: "fg1" }; },
        async requestWriteOff() { return { accepted: true, referenceId: "wo1" }; },
        async validateInventoryMovement() { return { valid: true }; },
        async validateLot() { return { valid: true }; },
        async validateSerial() { return { valid: true }; },
      },
    },
  });

  return {
    runtime,
    audits,
    workOrders: runtime.services.require("manufacturing.service.work-order").value as ManufacturingWorkOrderService,
    routing: runtime.services.require("manufacturing.service.execution-routing").value as ExecutionRoutingService,
    operations: runtime.services.require("manufacturing.service.operation-execution").value as OperationExecutionService,
    queries: runtime.services.require("manufacturing.query.routing").value as ManufacturingRoutingQueryService,
  };
}

describe("GMDT-1001-S4 Routing and operation execution", () => {
  it("creates a valid route, computes deterministic topological ordering, and marks routing readiness truthfully", async () => {
    const { runtime, workOrders, routing, queries } = await createRuntime();
    const workOrder = await workOrders.createWorkOrder(createBaseWorkOrder());

    const created = await routing.createExecutionRouting(
      createRoutingCommand({
        tenantId: workOrder.workOrder.tenantId,
        workOrderId: workOrder.workOrder.manufacturingWorkOrderId,
        expectedWorkOrderVersion: workOrder.workOrder.version,
        routingId: "routing-001",
        stepOrder: ["s2", "s3", "s1"],
      }),
    );

    expect(created.readiness.routingReady).toBe(true);
    expect(created.orderedStepIds).toEqual([
      id("step-001", "RoutingStepId"),
      id("step-002", "RoutingStepId"),
      id("step-003", "RoutingStepId"),
    ]);

    const alternateWorkOrder = await workOrders.createWorkOrder(createBaseWorkOrder(id("tenant-001", "TenantId"), "002"));
    const alternate = await routing.createExecutionRouting(
      createRoutingCommand({
        tenantId: alternateWorkOrder.workOrder.tenantId,
        workOrderId: alternateWorkOrder.workOrder.manufacturingWorkOrderId,
        expectedWorkOrderVersion: alternateWorkOrder.workOrder.version,
        routingId: "routing-002",
        stepOrder: ["s1", "s3", "s2"],
      }),
    );

    expect(alternate.orderedStepIds).toEqual(created.orderedStepIds);

    const executionState = workOrders.getExecutionState(workOrder.workOrder.tenantId, workOrder.workOrder.manufacturingWorkOrderId);
    expect(executionState.readiness.routingReady).toBe(true);
    expect(executionState.readiness.executionReady).toBe(false);

    await expect(
      workOrders.startWorkOrderExecution({
        workOrderId: workOrder.workOrder.manufacturingWorkOrderId,
        tenantId: workOrder.workOrder.tenantId,
        expectedVersion: executionState.version,
        idempotencyKey: id("idem-start-wo-denied", "IdempotencyKey"),
        correlationId: id("corr-start-wo-denied", "CorrelationIdentifier"),
      }),
    ).rejects.toMatchObject({ classification: "WORK_ORDER_NOT_READY" });

    const listed = queries.listExecutionRoutings(workOrder.workOrder.tenantId);
    expect(listed.map((entry) => entry.routing.executionRoutingId)).toEqual([
      id("routing-001", "ExecutionRoutingId"),
      id("routing-002", "ExecutionRoutingId"),
    ]);

    await runtime.stop();
  });

  it("rejects invalid graph structures, duplicates, and stale expected version commands", async () => {
    const { runtime, workOrders, routing } = await createRuntime();
    const workOrder = await workOrders.createWorkOrder(createBaseWorkOrder());

    await expect(
      routing.createExecutionRouting({
        ...createRoutingCommand({
          tenantId: workOrder.workOrder.tenantId,
          workOrderId: workOrder.workOrder.manufacturingWorkOrderId,
          expectedWorkOrderVersion: workOrder.workOrder.version,
          routingId: "routing-self-cycle",
        }),
        steps: [
          {
            ...createRoutingCommand({
              tenantId: workOrder.workOrder.tenantId,
              workOrderId: workOrder.workOrder.manufacturingWorkOrderId,
              expectedWorkOrderVersion: workOrder.workOrder.version,
              routingId: "routing-self-cycle",
            }).steps[0],
            predecessorStepIds: [id("step-001", "RoutingStepId")],
          },
        ],
      }),
    ).rejects.toMatchObject({ classification: "ROUTING_SELF_CYCLE" });

    await expect(
      routing.createExecutionRouting({
        ...createRoutingCommand({
          tenantId: workOrder.workOrder.tenantId,
          workOrderId: workOrder.workOrder.manufacturingWorkOrderId,
          expectedWorkOrderVersion: workOrder.workOrder.version,
          routingId: "routing-two-cycle",
        }),
        steps: [
          {
            ...createRoutingCommand({
              tenantId: workOrder.workOrder.tenantId,
              workOrderId: workOrder.workOrder.manufacturingWorkOrderId,
              expectedWorkOrderVersion: workOrder.workOrder.version,
              routingId: "routing-two-cycle",
            }).steps[0],
            successorStepIds: [id("step-002", "RoutingStepId")],
          },
          {
            ...createRoutingCommand({
              tenantId: workOrder.workOrder.tenantId,
              workOrderId: workOrder.workOrder.manufacturingWorkOrderId,
              expectedWorkOrderVersion: workOrder.workOrder.version,
              routingId: "routing-two-cycle",
            }).steps[1],
            successorStepIds: [id("step-001", "RoutingStepId")],
            predecessorStepIds: [id("step-001", "RoutingStepId")],
          },
        ],
      }),
    ).rejects.toMatchObject({ classification: "ROUTING_STRUCTURAL_CYCLE" });

    await expect(
      routing.createExecutionRouting({
        ...createRoutingCommand({
          tenantId: workOrder.workOrder.tenantId,
          workOrderId: workOrder.workOrder.manufacturingWorkOrderId,
          expectedWorkOrderVersion: workOrder.workOrder.version,
          routingId: "routing-missing-ref",
        }),
        steps: [
          {
            ...createRoutingCommand({
              tenantId: workOrder.workOrder.tenantId,
              workOrderId: workOrder.workOrder.manufacturingWorkOrderId,
              expectedWorkOrderVersion: workOrder.workOrder.version,
              routingId: "routing-missing-ref",
            }).steps[0],
            successorStepIds: [id("step-999", "RoutingStepId")],
          },
        ],
      }),
    ).rejects.toMatchObject({ classification: "INVALID_ROUTING_DEPENDENCY" });

    await expect(
      routing.createExecutionRouting({
        ...createRoutingCommand({
          tenantId: workOrder.workOrder.tenantId,
          workOrderId: workOrder.workOrder.manufacturingWorkOrderId,
          expectedWorkOrderVersion: workOrder.workOrder.version,
          routingId: "routing-dup-step",
        }),
        steps: [
          createRoutingCommand({
            tenantId: workOrder.workOrder.tenantId,
            workOrderId: workOrder.workOrder.manufacturingWorkOrderId,
            expectedWorkOrderVersion: workOrder.workOrder.version,
            routingId: "routing-dup-step",
          }).steps[0],
          createRoutingCommand({
            tenantId: workOrder.workOrder.tenantId,
            workOrderId: workOrder.workOrder.manufacturingWorkOrderId,
            expectedWorkOrderVersion: workOrder.workOrder.version,
            routingId: "routing-dup-step",
          }).steps[0],
        ],
      }),
    ).rejects.toMatchObject({ classification: "DUPLICATE_ROUTING_STEP_ID" });

    const created = await routing.createExecutionRouting(
      createRoutingCommand({
        tenantId: workOrder.workOrder.tenantId,
        workOrderId: workOrder.workOrder.manufacturingWorkOrderId,
        expectedWorkOrderVersion: workOrder.workOrder.version,
        routingId: "routing-dup-id",
      }),
    );

    await expect(
      routing.createExecutionRouting({
        ...createRoutingCommand({
          tenantId: workOrder.workOrder.tenantId,
          workOrderId: workOrder.workOrder.manufacturingWorkOrderId,
          expectedWorkOrderVersion: workOrder.workOrder.version + 1,
          routingId: "routing-dup-id",
        }),
        idempotencyKey: id("idem-routing-conflict", "IdempotencyKey"),
      }),
    ).rejects.toMatchObject({ classification: "DUPLICATE_ROUTING_ID" });

    expect(created.reworkEdges).toHaveLength(2);

    await runtime.stop();
  });

  it("initializes operations, enforces prerequisites and lifecycle transitions, and computes progress deterministically", async () => {
    const { runtime, workOrders, routing, operations, queries } = await createRuntime();
    const workOrder = await workOrders.createWorkOrder(createBaseWorkOrder());

    const route = await routing.createExecutionRouting(
      createRoutingCommand({
        tenantId: workOrder.workOrder.tenantId,
        workOrderId: workOrder.workOrder.manufacturingWorkOrderId,
        expectedWorkOrderVersion: workOrder.workOrder.version,
        routingId: "routing-op-001",
      }),
    );

    const initialized = await operations.initializeOperations({
      tenantId: workOrder.workOrder.tenantId,
      workOrderId: workOrder.workOrder.manufacturingWorkOrderId,
      executionRoutingId: route.routing.executionRoutingId,
      expectedRoutingVersion: route.routing.version,
      idempotencyKey: id("idem-init-op-001", "IdempotencyKey"),
      correlationId: id("corr-init-op-001", "CorrelationIdentifier"),
    });

    expect(initialized).toHaveLength(3);
    expect(queries.getNextEligibleOperations(workOrder.workOrder.tenantId, route.routing.executionRoutingId)).toHaveLength(1);

    const second = initialized.find((entry) => entry.execution.operationExecutionId === id("opexec-002", "OperationExecutionId"))!;
    await expect(
      operations.startOperation({
        tenantId: workOrder.workOrder.tenantId,
        workOrderId: workOrder.workOrder.manufacturingWorkOrderId,
        executionRoutingId: route.routing.executionRoutingId,
        operationExecutionId: second.execution.operationExecutionId,
        expectedVersion: second.execution.version,
        idempotencyKey: id("idem-op2-start-early", "IdempotencyKey"),
        correlationId: id("corr-op2-start-early", "CorrelationIdentifier"),
      }),
    ).rejects.toMatchObject({ classification: "OPERATION_PREREQUISITE_FAILURE" });

    const planned = await workOrders.planWorkOrder({
      workOrderId: workOrder.workOrder.manufacturingWorkOrderId,
      tenantId: workOrder.workOrder.tenantId,
      expectedVersion: workOrder.workOrder.version + 1,
      productBaselineState: "FROZEN",
      readinessEvidence: { productBaselineReady: true, routingReady: true, materialsReady: true, resourcesReady: true },
      idempotencyKey: id("idem-plan-start", "IdempotencyKey"),
      correlationId: id("corr-plan-start", "CorrelationIdentifier"),
    });
    const released = await workOrders.releaseWorkOrder({
      workOrderId: planned.workOrder.manufacturingWorkOrderId,
      tenantId: planned.workOrder.tenantId,
      expectedVersion: planned.workOrder.version,
      idempotencyKey: id("idem-release-start", "IdempotencyKey"),
      correlationId: id("corr-release-start", "CorrelationIdentifier"),
    });
    const onHold = await workOrders.placeOnHoldWorkOrder({
      workOrderId: released.workOrder.manufacturingWorkOrderId,
      tenantId: released.workOrder.tenantId,
      expectedVersion: released.workOrder.version,
      idempotencyKey: id("idem-hold-start", "IdempotencyKey"),
      correlationId: id("corr-hold-start", "CorrelationIdentifier"),
    });
    const ready = await workOrders.releaseHoldWorkOrder({
      workOrderId: onHold.workOrder.manufacturingWorkOrderId,
      tenantId: onHold.workOrder.tenantId,
      expectedVersion: onHold.workOrder.version,
      idempotencyKey: id("idem-ready-start", "IdempotencyKey"),
      correlationId: id("corr-ready-start", "CorrelationIdentifier"),
    });
    await workOrders.startWorkOrderExecution({
      workOrderId: ready.workOrder.manufacturingWorkOrderId,
      tenantId: ready.workOrder.tenantId,
      expectedVersion: ready.workOrder.version,
      idempotencyKey: id("idem-wo-start", "IdempotencyKey"),
      correlationId: id("corr-wo-start", "CorrelationIdentifier"),
    });

    const first = initialized.find((entry) => entry.execution.operationExecutionId === id("opexec-001", "OperationExecutionId"))!;
    const started = await operations.startOperation({
      tenantId: workOrder.workOrder.tenantId,
      workOrderId: workOrder.workOrder.manufacturingWorkOrderId,
      executionRoutingId: route.routing.executionRoutingId,
      operationExecutionId: first.execution.operationExecutionId,
      expectedVersion: first.execution.version,
      idempotencyKey: id("idem-op1-start", "IdempotencyKey"),
      correlationId: id("corr-op1-start", "CorrelationIdentifier"),
    });
    const paused = await operations.pauseOperation({
      tenantId: workOrder.workOrder.tenantId,
      workOrderId: workOrder.workOrder.manufacturingWorkOrderId,
      executionRoutingId: route.routing.executionRoutingId,
      operationExecutionId: started.execution.operationExecutionId,
      expectedVersion: started.execution.version,
      idempotencyKey: id("idem-op1-pause", "IdempotencyKey"),
      correlationId: id("corr-op1-pause", "CorrelationIdentifier"),
    });
    const resumed = await operations.resumeOperation({
      tenantId: workOrder.workOrder.tenantId,
      workOrderId: workOrder.workOrder.manufacturingWorkOrderId,
      executionRoutingId: route.routing.executionRoutingId,
      operationExecutionId: paused.execution.operationExecutionId,
      expectedVersion: paused.execution.version,
      idempotencyKey: id("idem-op1-resume", "IdempotencyKey"),
      correlationId: id("corr-op1-resume", "CorrelationIdentifier"),
    });
    await operations.completeOperation({
      tenantId: workOrder.workOrder.tenantId,
      workOrderId: workOrder.workOrder.manufacturingWorkOrderId,
      executionRoutingId: route.routing.executionRoutingId,
      operationExecutionId: resumed.execution.operationExecutionId,
      expectedVersion: resumed.execution.version,
      idempotencyKey: id("idem-op1-complete", "IdempotencyKey"),
      correlationId: id("corr-op1-complete", "CorrelationIdentifier"),
    });

    const nextEligible = queries.getNextEligibleOperations(workOrder.workOrder.tenantId, route.routing.executionRoutingId);
    expect(nextEligible.map((item) => item.execution.operationExecutionId)).toEqual([id("opexec-002", "OperationExecutionId")]);

    const progress = queries.getRoutingProgress(workOrder.workOrder.tenantId, route.routing.executionRoutingId);
    expect(progress.totalSteps).toBe(3);
    expect(progress.completedSteps).toBe(1);
    expect(progress.blockedSteps).toBe(1);

    await runtime.stop();
  });

  it("enforces idempotency and stale version behavior for operation commands", async () => {
    const { runtime, workOrders, routing, operations } = await createRuntime();
    const workOrder = await workOrders.createWorkOrder(createBaseWorkOrder());

    const route = await routing.createExecutionRouting(
      createRoutingCommand({
        tenantId: workOrder.workOrder.tenantId,
        workOrderId: workOrder.workOrder.manufacturingWorkOrderId,
        expectedWorkOrderVersion: workOrder.workOrder.version,
        routingId: "routing-idem-001",
      }),
    );

    const initialized = await operations.initializeOperations({
      tenantId: workOrder.workOrder.tenantId,
      workOrderId: workOrder.workOrder.manufacturingWorkOrderId,
      executionRoutingId: route.routing.executionRoutingId,
      expectedRoutingVersion: route.routing.version,
      idempotencyKey: id("idem-init-idem", "IdempotencyKey"),
      correlationId: id("corr-init-idem", "CorrelationIdentifier"),
    });

    const planned = await workOrders.planWorkOrder({
      workOrderId: workOrder.workOrder.manufacturingWorkOrderId,
      tenantId: workOrder.workOrder.tenantId,
      expectedVersion: workOrder.workOrder.version + 1,
      productBaselineState: "FROZEN",
      readinessEvidence: { productBaselineReady: true, routingReady: true, materialsReady: true, resourcesReady: true },
      idempotencyKey: id("idem-plan-idem", "IdempotencyKey"),
      correlationId: id("corr-plan-idem", "CorrelationIdentifier"),
    });
    const released = await workOrders.releaseWorkOrder({
      workOrderId: planned.workOrder.manufacturingWorkOrderId,
      tenantId: planned.workOrder.tenantId,
      expectedVersion: planned.workOrder.version,
      idempotencyKey: id("idem-release-idem", "IdempotencyKey"),
      correlationId: id("corr-release-idem", "CorrelationIdentifier"),
    });
    const onHold = await workOrders.placeOnHoldWorkOrder({
      workOrderId: released.workOrder.manufacturingWorkOrderId,
      tenantId: released.workOrder.tenantId,
      expectedVersion: released.workOrder.version,
      idempotencyKey: id("idem-hold-idem", "IdempotencyKey"),
      correlationId: id("corr-hold-idem", "CorrelationIdentifier"),
    });
    const ready = await workOrders.releaseHoldWorkOrder({
      workOrderId: onHold.workOrder.manufacturingWorkOrderId,
      tenantId: onHold.workOrder.tenantId,
      expectedVersion: onHold.workOrder.version,
      idempotencyKey: id("idem-ready-idem", "IdempotencyKey"),
      correlationId: id("corr-ready-idem", "CorrelationIdentifier"),
    });
    await workOrders.startWorkOrderExecution({
      workOrderId: ready.workOrder.manufacturingWorkOrderId,
      tenantId: ready.workOrder.tenantId,
      expectedVersion: ready.workOrder.version,
      idempotencyKey: id("idem-wo-start-idem", "IdempotencyKey"),
      correlationId: id("corr-wo-start-idem", "CorrelationIdentifier"),
    });

    const first = initialized.find((entry) => entry.execution.operationExecutionId === id("opexec-001", "OperationExecutionId"))!;
    const started = await operations.startOperation({
      tenantId: workOrder.workOrder.tenantId,
      workOrderId: workOrder.workOrder.manufacturingWorkOrderId,
      executionRoutingId: route.routing.executionRoutingId,
      operationExecutionId: first.execution.operationExecutionId,
      expectedVersion: first.execution.version,
      idempotencyKey: id("idem-op-start-replay", "IdempotencyKey"),
      correlationId: id("corr-op-start-replay", "CorrelationIdentifier"),
    });

    const replay = await operations.startOperation({
      tenantId: workOrder.workOrder.tenantId,
      workOrderId: workOrder.workOrder.manufacturingWorkOrderId,
      executionRoutingId: route.routing.executionRoutingId,
      operationExecutionId: first.execution.operationExecutionId,
      expectedVersion: first.execution.version,
      idempotencyKey: id("idem-op-start-replay", "IdempotencyKey"),
      correlationId: id("corr-op-start-replay", "CorrelationIdentifier"),
    });
    expect(replay.execution.version).toBe(started.execution.version);

    await expect(
      operations.startOperation({
        tenantId: workOrder.workOrder.tenantId,
        workOrderId: workOrder.workOrder.manufacturingWorkOrderId,
        executionRoutingId: route.routing.executionRoutingId,
        operationExecutionId: first.execution.operationExecutionId,
        expectedVersion: first.execution.version + 1,
        idempotencyKey: id("idem-op-start-replay", "IdempotencyKey"),
        correlationId: id("corr-op-start-conflict", "CorrelationIdentifier"),
      }),
    ).rejects.toMatchObject({ classification: "CONFLICTING_IDEMPOTENCY_PAYLOAD" });

    await expect(
      operations.completeOperation({
        tenantId: workOrder.workOrder.tenantId,
        workOrderId: workOrder.workOrder.manufacturingWorkOrderId,
        executionRoutingId: route.routing.executionRoutingId,
        operationExecutionId: first.execution.operationExecutionId,
        expectedVersion: first.execution.version,
        idempotencyKey: id("idem-op-complete-stale", "IdempotencyKey"),
        correlationId: id("corr-op-complete-stale", "CorrelationIdentifier"),
      }),
    ).rejects.toMatchObject({ classification: "STALE_EXPECTED_VERSION" });

    await runtime.stop();
  });

  it("enforces bounded rework edges and preserves immutable execution history", async () => {
    const { runtime, workOrders, routing, operations } = await createRuntime();
    const workOrder = await workOrders.createWorkOrder(createBaseWorkOrder());

    const route = await routing.createExecutionRouting(
      createRoutingCommand({
        tenantId: workOrder.workOrder.tenantId,
        workOrderId: workOrder.workOrder.manufacturingWorkOrderId,
        expectedWorkOrderVersion: workOrder.workOrder.version,
        routingId: "routing-rework-001",
      }),
    );

    const initialized = await operations.initializeOperations({
      tenantId: workOrder.workOrder.tenantId,
      workOrderId: workOrder.workOrder.manufacturingWorkOrderId,
      executionRoutingId: route.routing.executionRoutingId,
      expectedRoutingVersion: route.routing.version,
      idempotencyKey: id("idem-init-rework", "IdempotencyKey"),
      correlationId: id("corr-init-rework", "CorrelationIdentifier"),
    });

    const second = initialized.find((entry) => entry.execution.operationExecutionId === id("opexec-002", "OperationExecutionId"))!;

    await expect(
      operations.requestReworkTransition({
        tenantId: workOrder.workOrder.tenantId,
        workOrderId: workOrder.workOrder.manufacturingWorkOrderId,
        executionRoutingId: route.routing.executionRoutingId,
        operationExecutionId: second.execution.operationExecutionId,
        expectedVersion: second.execution.version,
        idempotencyKey: id("idem-rework-invalid", "IdempotencyKey"),
        correlationId: id("corr-rework-invalid", "CorrelationIdentifier"),
        targetStepId: id("step-999", "RoutingStepId"),
      }),
    ).rejects.toMatchObject({ classification: "INVALID_REWORK_EDGE" });

    const reworkRequired = await operations.requestReworkTransition({
      tenantId: workOrder.workOrder.tenantId,
      workOrderId: workOrder.workOrder.manufacturingWorkOrderId,
      executionRoutingId: route.routing.executionRoutingId,
      operationExecutionId: second.execution.operationExecutionId,
      expectedVersion: second.execution.version,
      idempotencyKey: id("idem-rework-valid", "IdempotencyKey"),
      correlationId: id("corr-rework-valid", "CorrelationIdentifier"),
      targetStepId: id("step-001", "RoutingStepId"),
    });
    expect(reworkRequired.history.length).toBe(1);

    await expect(
      operations.requestReworkTransition({
        tenantId: workOrder.workOrder.tenantId,
        workOrderId: workOrder.workOrder.manufacturingWorkOrderId,
        executionRoutingId: route.routing.executionRoutingId,
        operationExecutionId: second.execution.operationExecutionId,
        expectedVersion: reworkRequired.execution.version,
        idempotencyKey: id("idem-rework-over", "IdempotencyKey"),
        correlationId: id("corr-rework-over", "CorrelationIdentifier"),
        targetStepId: id("step-001", "RoutingStepId"),
      }),
    ).rejects.toMatchObject({ classification: "REWORK_LIMIT_EXCEEDED" });

    await runtime.stop();
  });

  it("registers Slice 4 runtime services while keeping output/persistence out of scope and emitting audit evidence", async () => {
    const { runtime, audits, workOrders, routing } = await createRuntime();
    const serviceIds = runtime.services.list().map((service) => service.serviceId);

    expect(serviceIds).toContain("manufacturing.service.execution-routing");
    expect(serviceIds).toContain("manufacturing.service.operation-execution");
    expect(serviceIds).toContain("manufacturing.query.routing");
    expect(serviceIds).toContain("manufacturing.service.material-requirement");
    expect(serviceIds).toContain("manufacturing.query.material");
    expect(serviceIds).toContain("manufacturing.service.production-output");
    expect(serviceIds).toContain("manufacturing.query.production-result");
    expect(serviceIds.some((id) => id.includes("persistence"))).toBe(false);
    expect(serviceIds.some((id) => id.includes("resource"))).toBe(false);
    expect(serviceIds.some((id) => id.includes("labor"))).toBe(false);
    expect(serviceIds.some((id) => id.includes("downtime"))).toBe(false);

    const workOrder = await workOrders.createWorkOrder(createBaseWorkOrder());
    await routing.createExecutionRouting(
      createRoutingCommand({
        tenantId: workOrder.workOrder.tenantId,
        workOrderId: workOrder.workOrder.manufacturingWorkOrderId,
        expectedWorkOrderVersion: workOrder.workOrder.version,
        routingId: "routing-audit-001",
      }),
    );

    expect(audits.length).toBeGreaterThan(0);

    await runtime.stop();
  });
});
