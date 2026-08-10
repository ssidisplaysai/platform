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
  type ManufacturingWorkOrderService,
  type ManufacturingProductReferenceService,
  type ExecutionRoutingService,
  type OperationExecutionService,
  type ManufacturingProductionResultQueryService,
  type ProductionOutputService,
  type ReworkService,
  type ScrapService,
} from "@/platform/manufacturing";

function id<T extends Parameters<typeof createManufacturingIdentifier>[1]>(value: string, brand: T) {
  return createManufacturingIdentifier(value, brand);
}

type InventoryBehavior = Readonly<{
  rejectFinishedGoodsReceipt?: boolean;
  invalidFinishedGoodsAcceptedQuantity?: boolean;
  rejectWriteOff?: boolean;
  invalidWriteOffAcceptedQuantity?: boolean;
}>;

function createBaseWorkOrder(tenantId = id("tenant-s7-001", "TenantId"), suffix = "001"): CreateManufacturingWorkOrder {
  const unit = createUnitOfMeasure("EA");
  return {
    workOrderId: id(`wo-s7-${suffix}`, "ManufacturingWorkOrderId"),
    workOrderNumber: id(`WO-S7-${suffix}`, "WorkOrderNumber"),
    tenantId,
    productRef: { tenantId, productId: id(`prod-s7-${suffix}`, "ProductIdentifier") },
    productVariantRef: { tenantId, productVariantId: id(`var-s7-${suffix}`, "ProductVariantIdentifier") },
    productVersionRef: { tenantId, productVersionId: id(`pv-s7-${suffix}`, "ProductVersionIdentifier") },
    productBomRef: {
      tenantId,
      productBomId: id(`bom-s7-${suffix}`, "ProductBomIdentifier"),
      bomVersion: id("1.0.0", "VersionIdentifier"),
    },
    requestedQuantity: createRequestedQuantity(10, unit),
    plannedQuantity: createPlannedQuantity(10, unit),
    priority: "HIGH",
    idempotencyKey: id(`idem-s7-wo-${suffix}`, "IdempotencyKey"),
    correlationId: id(`corr-s7-wo-${suffix}`, "CorrelationIdentifier"),
    command: {
      commandId: `cmd-s7-wo-${suffix}`,
      expectedVersion: 0,
      requestedAt: "2026-08-10T00:00:00.000Z",
    },
  };
}

function createRoutingCommand(input: {
  tenantId: ReturnType<typeof id<"TenantId">>;
  workOrderId: ReturnType<typeof id<"ManufacturingWorkOrderId">>;
  expectedWorkOrderVersion: number;
  routingId: string;
}): CreateExecutionRouting {
  return {
    executionRoutingId: id(input.routingId, "ExecutionRoutingId"),
    tenantId: input.tenantId,
    workOrderId: input.workOrderId,
    sourceRoutingReference: id("prod-routing-s7", "ProductRoutingReferenceId"),
    sourceProductVersionRef: { tenantId: input.tenantId, productVersionId: id("pv-s7-001", "ProductVersionIdentifier") },
    sourceBomRef: {
      tenantId: input.tenantId,
      productBomId: id("bom-s7-001", "ProductBomIdentifier"),
      bomVersion: id("1.0.0", "VersionIdentifier"),
    },
    steps: [
      {
        routingStepId: id("step-s7-001", "RoutingStepId"),
        operationExecutionId: id("opexec-s7-001", "OperationExecutionId"),
        operationCode: id("OP-S7-001", "OperationCode"),
        routingStepCode: id("STEP-S7-001", "RoutingStepCode"),
        sequenceNumber: createSequenceNumber(10),
        predecessorStepIds: [],
        successorStepIds: [id("step-s7-002", "RoutingStepId")],
        conditionalEligibility: { state: "ELIGIBLE" as const },
        explicitReworkEdges: [{ targetStepId: id("step-s7-002", "RoutingStepId"), maxIterations: 1 }],
        reworkStepIds: [id("step-s7-002", "RoutingStepId")],
        conditionalStepIds: [],
        executionState: { readiness: "READY" as const, operationState: "READY" as const },
        tenantId: input.tenantId,
      },
      {
        routingStepId: id("step-s7-002", "RoutingStepId"),
        operationExecutionId: id("opexec-s7-002", "OperationExecutionId"),
        operationCode: id("OP-S7-002", "OperationCode"),
        routingStepCode: id("STEP-S7-002", "RoutingStepCode"),
        sequenceNumber: createSequenceNumber(20),
        predecessorStepIds: [id("step-s7-001", "RoutingStepId")],
        successorStepIds: [],
        conditionalEligibility: { state: "ELIGIBLE" as const },
        explicitReworkEdges: [{ targetStepId: id("step-s7-001", "RoutingStepId"), maxIterations: 1 }],
        reworkStepIds: [id("step-s7-001", "RoutingStepId")],
        conditionalStepIds: [],
        executionState: { readiness: "BLOCKED" as const, operationState: "BLOCKED" as const },
        tenantId: input.tenantId,
      },
    ],
    expectedWorkOrderVersion: input.expectedWorkOrderVersion,
    expectedVersion: 0,
    idempotencyKey: id(`idem-s7-routing-${input.routingId}`, "IdempotencyKey"),
    correlationId: id(`corr-s7-routing-${input.routingId}`, "CorrelationIdentifier"),
  };
}

async function createRuntime(behavior: InventoryBehavior = {}) {
  const baseDependencies = createDefaultManufacturingRuntimeDependencies();
  const runtime = await createManufacturingRuntime({
    runtimeId: "manufacturing-runtime-s7-test",
    dependencies: baseDependencies,
    productIntegration: {
      integrationId: "product-port",
      port: {
        async validateProductReference() {
          return { valid: true } as const;
        },
        async validateVariantReference() {
          return { valid: true } as const;
        },
        async validateProductVersionReference() {
          return { valid: true } as const;
        },
        async validateBomReference() {
          return { valid: true } as const;
        },
        async validateRoutingReference() {
          return { valid: true } as const;
        },
        async validateConfigurationReference() {
          return { valid: true } as const;
        },
      },
    },
    inventoryIntegration: {
      integrationId: "inventory-port",
      port: {
        async queryAvailability() {
          return { valid: true, availableQuantity: 100 } as const;
        },
        async requestReservation() {
          return { accepted: true, referenceId: "reservation-s7" } as const;
        },
        async requestAllocation() {
          return { accepted: true, referenceId: "allocation-s7" } as const;
        },
        async releaseReservation() {
          return { accepted: true, referenceId: "release-reservation-s7" } as const;
        },
        async releaseAllocation() {
          return { accepted: true, referenceId: "release-allocation-s7" } as const;
        },
        async requestMaterialIssue(input) {
          return { accepted: true, referenceId: "issue-s7", acceptedQuantity: input.quantity } as const;
        },
        async requestMaterialReturn() {
          return { accepted: true, referenceId: "return-s7", acceptedQuantity: 1 } as const;
        },
        async requestFinishedGoodsReceipt(input) {
          if (behavior.rejectFinishedGoodsReceipt) {
            return { accepted: false, reason: "receipt rejected" } as const;
          }
          return {
            accepted: true,
            referenceId: "receipt-s7",
            acceptedQuantity: behavior.invalidFinishedGoodsAcceptedQuantity ? 0 : input.quantity,
          } as const;
        },
        async requestWriteOff(input) {
          if (behavior.rejectWriteOff) {
            return { accepted: false, reason: "writeoff rejected" } as const;
          }
          return {
            accepted: true,
            referenceId: "writeoff-s7",
            acceptedQuantity: behavior.invalidWriteOffAcceptedQuantity ? 0 : input.quantity,
          } as const;
        },
        async validateInventoryMovement() {
          return { valid: true } as const;
        },
        async validateLot() {
          return { valid: true } as const;
        },
        async validateSerial() {
          return { valid: true } as const;
        },
      },
    },
  });

  const workOrders = runtime.services.require("manufacturing.service.work-order").value as ManufacturingWorkOrderService;
  const productRefs = runtime.services.require("manufacturing.service.product-reference").value as ManufacturingProductReferenceService;
  const routing = runtime.services.require("manufacturing.service.execution-routing").value as ExecutionRoutingService;
  const operations = runtime.services.require("manufacturing.service.operation-execution").value as OperationExecutionService;
  const outputs = runtime.services.require("manufacturing.service.production-output").value as ProductionOutputService;
  const scrap = runtime.services.require("manufacturing.service.scrap").value as ScrapService;
  const rework = runtime.services.require("manufacturing.service.rework").value as ReworkService;
  const resultQueries = runtime.services.require("manufacturing.query.production-result").value as ManufacturingProductionResultQueryService;

  const created = await workOrders.createWorkOrder(createBaseWorkOrder());

  const validated = await productRefs.validateProductBaseline({
    tenantId: created.workOrder.tenantId,
    workOrderId: created.workOrder.manufacturingWorkOrderId,
    expectedVersion: created.workOrder.version,
    productRef: created.workOrder.productRef,
    productVariantRef: created.workOrder.productVariantRef,
    productVersionRef: created.workOrder.productVersionRef,
    productBomRef: created.workOrder.productBomRef,
    designRoutingReference: "prod-routing-s7",
    idempotencyKey: id("idem-s7-baseline-validate", "IdempotencyKey"),
    correlationId: id("corr-s7-baseline-validate", "CorrelationIdentifier"),
  });
  const frozen = await productRefs.freezeProductBaseline({
    tenantId: created.workOrder.tenantId,
    workOrderId: created.workOrder.manufacturingWorkOrderId,
    expectedVersion: validated.version,
    idempotencyKey: id("idem-s7-baseline-freeze", "IdempotencyKey"),
    correlationId: id("corr-s7-baseline-freeze", "CorrelationIdentifier"),
  });

  const createdRouting = await routing.createExecutionRouting(
    createRoutingCommand({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      expectedWorkOrderVersion: frozen.version,
      routingId: "routing-s7-001",
    }),
  );

  const initialized = await operations.initializeOperations({
    tenantId: created.workOrder.tenantId,
    workOrderId: created.workOrder.manufacturingWorkOrderId,
    executionRoutingId: createdRouting.routing.executionRoutingId,
    expectedRoutingVersion: createdRouting.routing.version,
    idempotencyKey: id("idem-s7-op-init", "IdempotencyKey"),
    correlationId: id("corr-s7-op-init", "CorrelationIdentifier"),
  });

  const planned = await workOrders.planWorkOrder({
    workOrderId: created.workOrder.manufacturingWorkOrderId,
    tenantId: created.workOrder.tenantId,
    expectedVersion: frozen.version + 1,
    productBaselineState: "FROZEN",
    readinessEvidence: {
      productBaselineReady: true,
      routingReady: true,
      materialsReady: true,
      resourcesReady: true,
    },
    idempotencyKey: id("idem-s7-plan", "IdempotencyKey"),
    correlationId: id("corr-s7-plan", "CorrelationIdentifier"),
  });

  const released = await workOrders.releaseWorkOrder({
    workOrderId: planned.workOrder.manufacturingWorkOrderId,
    tenantId: planned.workOrder.tenantId,
    expectedVersion: planned.workOrder.version,
    idempotencyKey: id("idem-s7-release", "IdempotencyKey"),
    correlationId: id("corr-s7-release", "CorrelationIdentifier"),
  });

  const onHold = await workOrders.placeOnHoldWorkOrder({
    workOrderId: released.workOrder.manufacturingWorkOrderId,
    tenantId: released.workOrder.tenantId,
    expectedVersion: released.workOrder.version,
    idempotencyKey: id("idem-s7-hold", "IdempotencyKey"),
    correlationId: id("corr-s7-hold", "CorrelationIdentifier"),
  });

  const ready = await workOrders.releaseHoldWorkOrder({
    workOrderId: onHold.workOrder.manufacturingWorkOrderId,
    tenantId: onHold.workOrder.tenantId,
    expectedVersion: onHold.workOrder.version,
    idempotencyKey: id("idem-s7-ready", "IdempotencyKey"),
    correlationId: id("corr-s7-ready", "CorrelationIdentifier"),
  });

  const startedWorkOrder = await workOrders.startWorkOrderExecution({
    workOrderId: ready.workOrder.manufacturingWorkOrderId,
    tenantId: ready.workOrder.tenantId,
    expectedVersion: ready.workOrder.version,
    idempotencyKey: id("idem-s7-start-wo", "IdempotencyKey"),
    correlationId: id("corr-s7-start-wo", "CorrelationIdentifier"),
  });

  const op1 = initialized.find((entry) => entry.execution.operationExecutionId === id("opexec-s7-001", "OperationExecutionId"))!;
  const op1Started = await operations.startOperation({
    tenantId: created.workOrder.tenantId,
    workOrderId: created.workOrder.manufacturingWorkOrderId,
    executionRoutingId: createdRouting.routing.executionRoutingId,
    operationExecutionId: op1.execution.operationExecutionId,
    expectedVersion: op1.execution.version,
    idempotencyKey: id("idem-s7-op1-start", "IdempotencyKey"),
    correlationId: id("corr-s7-op1-start", "CorrelationIdentifier"),
  });

  return {
    runtime,
    created,
    createdRouting,
    op1Started,
    startedWorkOrder,
    workOrders,
    operations,
    outputs,
    scrap,
    rework,
    resultQueries,
  };
}

describe("GMDT-1001-S7 Production output, scrap, rework, yield, and WIP", () => {
  it("records output, computes deterministic summary and yield, and advances WIP/work-order execution state", async () => {
    const { runtime, created, op1Started, outputs, resultQueries, workOrders, startedWorkOrder } = await createRuntime();

    const output = await outputs.recordProductionOutput({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      operationExecutionId: op1Started.execution.operationExecutionId,
      productRef: created.workOrder.productRef,
      productVariantRef: created.workOrder.productVariantRef,
      productVersionRef: created.workOrder.productVersionRef,
      inventoryItemRef: { tenantId: created.workOrder.tenantId, inventoryItemId: id("inv-s7-fg", "InventoryItemId") },
      quantity: 4,
      unitOfMeasure: created.workOrder.plannedQuantity.unitOfMeasure,
      disposition: "FINISHED",
      inventoryReceiptRequired: true,
      expectedWorkOrderVersion: startedWorkOrder.workOrder.version,
      expectedOperationVersion: op1Started.execution.version,
      idempotencyKey: id("idem-s7-output-001", "IdempotencyKey"),
      correlationId: id("corr-s7-output-001", "CorrelationIdentifier"),
    });

    expect(output.status).toBe("RECORDED");
    expect(output.quantity).toBe(4);

    const replay = await outputs.recordProductionOutput({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      operationExecutionId: op1Started.execution.operationExecutionId,
      productRef: created.workOrder.productRef,
      productVariantRef: created.workOrder.productVariantRef,
      productVersionRef: created.workOrder.productVersionRef,
      inventoryItemRef: { tenantId: created.workOrder.tenantId, inventoryItemId: id("inv-s7-fg", "InventoryItemId") },
      quantity: 4,
      unitOfMeasure: created.workOrder.plannedQuantity.unitOfMeasure,
      disposition: "FINISHED",
      inventoryReceiptRequired: true,
      expectedWorkOrderVersion: startedWorkOrder.workOrder.version,
      expectedOperationVersion: op1Started.execution.version,
      idempotencyKey: id("idem-s7-output-001", "IdempotencyKey"),
      correlationId: id("corr-s7-output-001", "CorrelationIdentifier"),
    });

    expect(replay.productionOutputId).toBe(output.productionOutputId);

    await expect(
      outputs.recordProductionOutput({
        tenantId: created.workOrder.tenantId,
        workOrderId: created.workOrder.manufacturingWorkOrderId,
        operationExecutionId: op1Started.execution.operationExecutionId,
        productRef: created.workOrder.productRef,
        productVariantRef: created.workOrder.productVariantRef,
        productVersionRef: created.workOrder.productVersionRef,
        inventoryItemRef: { tenantId: created.workOrder.tenantId, inventoryItemId: id("inv-s7-fg", "InventoryItemId") },
        quantity: 4,
        unitOfMeasure: created.workOrder.plannedQuantity.unitOfMeasure,
        disposition: "FINISHED",
        inventoryReceiptRequired: true,
        expectedWorkOrderVersion: startedWorkOrder.workOrder.version + 1,
        expectedOperationVersion: op1Started.execution.version,
        idempotencyKey: id("idem-s7-output-001", "IdempotencyKey"),
        correlationId: id("corr-s7-output-conflict", "CorrelationIdentifier"),
      }),
    ).rejects.toMatchObject({ classification: "CONFLICTING_IDEMPOTENCY_PAYLOAD" });

    const summary = resultQueries.getProductionExecutionSummary(
      created.workOrder.tenantId,
      created.workOrder.manufacturingWorkOrderId,
    );
    expect(summary.completedQuantity).toBe(4);
    expect(summary.scrapQuantity).toBe(0);
    expect(summary.rejectedQuantity).toBe(0);
    expect(summary.processedQuantity).toBe(4);
    expect(summary.yieldRatio).toBe(1);

    const wip = resultQueries.getWipState(created.workOrder.tenantId, created.workOrder.manufacturingWorkOrderId);
    expect(wip?.quantityCompleted).toBe(4);
    expect(wip?.quantityWaiting).toBe(6);
    expect(wip?.status).toBe("ACTIVE");

    const execution = workOrders.getExecutionState(created.workOrder.tenantId, created.workOrder.manufacturingWorkOrderId);
    expect(execution.lifecycleState).toBe("PARTIALLY_COMPLETED");

    await runtime.stop();
  });

  it("enforces output bounds and rejects inventory reference mismatch", async () => {
    const { runtime, created, op1Started, outputs, startedWorkOrder } = await createRuntime();

    await expect(
      outputs.recordProductionOutput({
        tenantId: created.workOrder.tenantId,
        workOrderId: created.workOrder.manufacturingWorkOrderId,
        operationExecutionId: op1Started.execution.operationExecutionId,
        productRef: created.workOrder.productRef,
        productVariantRef: created.workOrder.productVariantRef,
        productVersionRef: created.workOrder.productVersionRef,
        quantity: 11,
        unitOfMeasure: created.workOrder.plannedQuantity.unitOfMeasure,
        disposition: "GOOD",
        inventoryReceiptRequired: false,
        expectedWorkOrderVersion: startedWorkOrder.workOrder.version,
        expectedOperationVersion: op1Started.execution.version,
        idempotencyKey: id("idem-s7-output-over", "IdempotencyKey"),
        correlationId: id("corr-s7-output-over", "CorrelationIdentifier"),
      }),
    ).rejects.toMatchObject({ classification: "PRODUCTION_OUTPUT_QUANTITY_EXCEEDED" });

    await expect(
      outputs.recordProductionOutput({
        tenantId: created.workOrder.tenantId,
        workOrderId: created.workOrder.manufacturingWorkOrderId,
        operationExecutionId: op1Started.execution.operationExecutionId,
        productRef: created.workOrder.productRef,
        productVariantRef: created.workOrder.productVariantRef,
        productVersionRef: created.workOrder.productVersionRef,
        quantity: 1,
        unitOfMeasure: created.workOrder.plannedQuantity.unitOfMeasure,
        disposition: "FINISHED",
        inventoryReceiptRequired: true,
        expectedWorkOrderVersion: startedWorkOrder.workOrder.version,
        expectedOperationVersion: op1Started.execution.version,
        idempotencyKey: id("idem-s7-output-missing-inv", "IdempotencyKey"),
        correlationId: id("corr-s7-output-missing-inv", "CorrelationIdentifier"),
      }),
    ).rejects.toMatchObject({ classification: "INVALID_OUTPUT_INVENTORY_REFERENCE" });

    await runtime.stop();
  });

  it("records scrap with idempotency, rejects invalid scrap payloads, and does not mutate state on reject", async () => {
    const { runtime, created, op1Started, scrap, resultQueries, startedWorkOrder } = await createRuntime();

    const before = resultQueries.getProductionExecutionSummary(created.workOrder.tenantId, created.workOrder.manufacturingWorkOrderId);
    const recorded = await scrap.recordScrap({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      operationExecutionId: op1Started.execution.operationExecutionId,
      inventoryItemRef: { tenantId: created.workOrder.tenantId, inventoryItemId: id("inv-s7-scrap", "InventoryItemId") },
      quantity: 1,
      unitOfMeasure: created.workOrder.plannedQuantity.unitOfMeasure,
      reasonCode: "QUALITY_FAIL",
      requestInventoryWriteOff: true,
      expectedWorkOrderVersion: startedWorkOrder.workOrder.version,
      expectedOperationVersion: op1Started.execution.version,
      idempotencyKey: id("idem-s7-scrap-001", "IdempotencyKey"),
      correlationId: id("corr-s7-scrap-001", "CorrelationIdentifier"),
    });

    expect(recorded.status).toBe("RECORDED");

    const replay = await scrap.recordScrap({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      operationExecutionId: op1Started.execution.operationExecutionId,
      inventoryItemRef: { tenantId: created.workOrder.tenantId, inventoryItemId: id("inv-s7-scrap", "InventoryItemId") },
      quantity: 1,
      unitOfMeasure: created.workOrder.plannedQuantity.unitOfMeasure,
      reasonCode: "QUALITY_FAIL",
      requestInventoryWriteOff: true,
      expectedWorkOrderVersion: startedWorkOrder.workOrder.version,
      expectedOperationVersion: op1Started.execution.version,
      idempotencyKey: id("idem-s7-scrap-001", "IdempotencyKey"),
      correlationId: id("corr-s7-scrap-001", "CorrelationIdentifier"),
    });

    expect(replay.scrapRecordId).toBe(recorded.scrapRecordId);

    await expect(
      scrap.recordScrap({
        tenantId: created.workOrder.tenantId,
        workOrderId: created.workOrder.manufacturingWorkOrderId,
        operationExecutionId: op1Started.execution.operationExecutionId,
        quantity: 0,
        unitOfMeasure: created.workOrder.plannedQuantity.unitOfMeasure,
        reasonCode: "",
        requestInventoryWriteOff: false,
        expectedWorkOrderVersion: startedWorkOrder.workOrder.version + 1,
        expectedOperationVersion: op1Started.execution.version + 1,
        idempotencyKey: id("idem-s7-scrap-invalid", "IdempotencyKey"),
        correlationId: id("corr-s7-scrap-invalid", "CorrelationIdentifier"),
      }),
    ).rejects.toMatchObject({ classification: "INVALID_SCRAP" });

    const after = resultQueries.getProductionExecutionSummary(created.workOrder.tenantId, created.workOrder.manufacturingWorkOrderId);
    expect(after.scrapQuantity).toBe(before.scrapQuantity + 1);

    await runtime.stop();
  });

  it("records rework with bounded edge validation and immutable history replay", async () => {
    const { runtime, created, op1Started, operations, rework, resultQueries, startedWorkOrder } = await createRuntime();

    await operations.completeOperation({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      executionRoutingId: id("routing-s7-001", "ExecutionRoutingId"),
      operationExecutionId: op1Started.execution.operationExecutionId,
      expectedVersion: op1Started.execution.version,
      idempotencyKey: id("idem-s7-op1-complete", "IdempotencyKey"),
      correlationId: id("corr-s7-op1-complete", "CorrelationIdentifier"),
    });

    const op2 = operations.getOperationExecution(created.workOrder.tenantId, id("opexec-s7-002", "OperationExecutionId"))!;

    await expect(
      rework.createRework({
        tenantId: created.workOrder.tenantId,
        workOrderId: created.workOrder.manufacturingWorkOrderId,
        sourceOperationExecutionId: id("opexec-s7-001", "OperationExecutionId"),
        targetOperationExecutionId: id("opexec-s7-001", "OperationExecutionId"),
        quantity: 1,
        unitOfMeasure: created.workOrder.plannedQuantity.unitOfMeasure,
        reasonCode: "EDGE_INVALID",
        expectedSourceOperationVersion: op1Started.execution.version + 1,
        expectedTargetOperationVersion: op1Started.execution.version + 1,
        expectedWorkOrderVersion: startedWorkOrder.workOrder.version,
        idempotencyKey: id("idem-s7-rework-invalid", "IdempotencyKey"),
        correlationId: id("corr-s7-rework-invalid", "CorrelationIdentifier"),
      }),
    ).rejects.toMatchObject({ classification: "REWORK_NOT_ALLOWED" });

    const recorded = await rework.createRework({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      sourceOperationExecutionId: id("opexec-s7-001", "OperationExecutionId"),
      targetOperationExecutionId: id("opexec-s7-002", "OperationExecutionId"),
      quantity: 1,
      unitOfMeasure: created.workOrder.plannedQuantity.unitOfMeasure,
      reasonCode: "REWORK_EDGE",
      expectedSourceOperationVersion: op1Started.execution.version + 1,
      expectedTargetOperationVersion: op2.execution.version,
      expectedWorkOrderVersion: startedWorkOrder.workOrder.version,
      idempotencyKey: id("idem-s7-rework-001", "IdempotencyKey"),
      correlationId: id("corr-s7-rework-001", "CorrelationIdentifier"),
    });

    const replay = await rework.createRework({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      sourceOperationExecutionId: id("opexec-s7-001", "OperationExecutionId"),
      targetOperationExecutionId: id("opexec-s7-002", "OperationExecutionId"),
      quantity: 1,
      unitOfMeasure: created.workOrder.plannedQuantity.unitOfMeasure,
      reasonCode: "REWORK_EDGE",
      expectedSourceOperationVersion: op1Started.execution.version + 1,
      expectedTargetOperationVersion: op2.execution.version,
      expectedWorkOrderVersion: startedWorkOrder.workOrder.version,
      idempotencyKey: id("idem-s7-rework-001", "IdempotencyKey"),
      correlationId: id("corr-s7-rework-001", "CorrelationIdentifier"),
    });

    expect(replay.reworkRecordId).toBe(recorded.reworkRecordId);

    const byWorkOrder = resultQueries.listReworkByWorkOrder(created.workOrder.tenantId, created.workOrder.manufacturingWorkOrderId);
    expect(byWorkOrder.map((entry) => entry.reworkRecordId)).toEqual([recorded.reworkRecordId]);

    await runtime.stop();
  });

  it("returns undefined yield when denominator is zero and deterministic defined yield once processed", async () => {
    const { runtime, created, op1Started, outputs, resultQueries, startedWorkOrder } = await createRuntime();

    const initialYield = resultQueries.getWorkOrderYield(created.workOrder.tenantId, created.workOrder.manufacturingWorkOrderId);
    expect(initialYield.classification).toBe("UNDEFINED");
    expect(initialYield.yieldRatio).toBeUndefined();

    await outputs.recordProductionOutput({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      operationExecutionId: op1Started.execution.operationExecutionId,
      productRef: created.workOrder.productRef,
      productVariantRef: created.workOrder.productVariantRef,
      productVersionRef: created.workOrder.productVersionRef,
      quantity: 3,
      unitOfMeasure: created.workOrder.plannedQuantity.unitOfMeasure,
      disposition: "GOOD",
      inventoryReceiptRequired: false,
      expectedWorkOrderVersion: startedWorkOrder.workOrder.version,
      expectedOperationVersion: op1Started.execution.version,
      idempotencyKey: id("idem-s7-yield-good", "IdempotencyKey"),
      correlationId: id("corr-s7-yield-good", "CorrelationIdentifier"),
    });

    const operationYield = resultQueries.getOperationYield(
      created.workOrder.tenantId,
      created.workOrder.manufacturingWorkOrderId,
      op1Started.execution.operationExecutionId,
    );
    expect(operationYield.classification).toBe("DEFINED");
    expect(operationYield.yieldRatio).toBe(1);

    await runtime.stop();
  });

  it("marks reconciliation required when inventory accepts but local output commit fails", async () => {
    const { runtime, created, op1Started, outputs, resultQueries, startedWorkOrder } = await createRuntime({
      invalidFinishedGoodsAcceptedQuantity: true,
    });

    await expect(
      outputs.recordProductionOutput({
        tenantId: created.workOrder.tenantId,
        workOrderId: created.workOrder.manufacturingWorkOrderId,
        operationExecutionId: op1Started.execution.operationExecutionId,
        productRef: created.workOrder.productRef,
        productVariantRef: created.workOrder.productVariantRef,
        productVersionRef: created.workOrder.productVersionRef,
        inventoryItemRef: { tenantId: created.workOrder.tenantId, inventoryItemId: id("inv-s7-rec", "InventoryItemId") },
        quantity: 2,
        unitOfMeasure: created.workOrder.plannedQuantity.unitOfMeasure,
        disposition: "FINISHED",
        inventoryReceiptRequired: true,
        expectedWorkOrderVersion: startedWorkOrder.workOrder.version,
        expectedOperationVersion: op1Started.execution.version,
        idempotencyKey: id("idem-s7-rec-output", "IdempotencyKey"),
        correlationId: id("corr-s7-rec-output", "CorrelationIdentifier"),
      }),
    ).rejects.toMatchObject({ classification: "OUTPUT_RECONCILIATION_REQUIRED" });

    const status = resultQueries.getOutputReconciliationStatus(created.workOrder.tenantId, created.workOrder.manufacturingWorkOrderId);
    expect(status.reconciliationRequired).toBe(true);
    expect(status.unresolvedOutputs).toHaveLength(1);

    await runtime.stop();
  });

  it("marks reconciliation required for scrap write-off mismatch after accepted external write-off", async () => {
    const { runtime, created, op1Started, scrap, resultQueries, startedWorkOrder } = await createRuntime({
      invalidWriteOffAcceptedQuantity: true,
    });

    await expect(
      scrap.recordScrap({
        tenantId: created.workOrder.tenantId,
        workOrderId: created.workOrder.manufacturingWorkOrderId,
        operationExecutionId: op1Started.execution.operationExecutionId,
        inventoryItemRef: { tenantId: created.workOrder.tenantId, inventoryItemId: id("inv-s7-writeoff", "InventoryItemId") },
        quantity: 1,
        unitOfMeasure: created.workOrder.plannedQuantity.unitOfMeasure,
        reasonCode: "SCRAP_WRITE_OFF",
        requestInventoryWriteOff: true,
        expectedWorkOrderVersion: startedWorkOrder.workOrder.version,
        expectedOperationVersion: op1Started.execution.version,
        idempotencyKey: id("idem-s7-rec-scrap", "IdempotencyKey"),
        correlationId: id("corr-s7-rec-scrap", "CorrelationIdentifier"),
      }),
    ).rejects.toMatchObject({ classification: "SCRAP_RECONCILIATION_REQUIRED" });

    const status = resultQueries.getOutputReconciliationStatus(created.workOrder.tenantId, created.workOrder.manufacturingWorkOrderId);
    expect(status.reconciliationRequired).toBe(true);
    expect(status.unresolvedScrap).toHaveLength(1);

    await runtime.stop();
  });

  it("registers slice 7 services in runtime and keeps persistence/resources-labor/downtime out of scope", async () => {
    const { runtime } = await createRuntime();

    const ids = runtime.services.list().map((service) => service.serviceId);
    expect(ids).toContain("manufacturing.service.production-output");
    expect(ids).toContain("manufacturing.service.scrap");
    expect(ids).toContain("manufacturing.service.rework");
    expect(ids).toContain("manufacturing.service.yield");
    expect(ids).toContain("manufacturing.service.wip");
    expect(ids).toContain("manufacturing.query.production-result");
    expect(ids).toContain("manufacturing.service.work-center");
    expect(ids).toContain("manufacturing.service.production-cell");
    expect(ids).toContain("manufacturing.service.machine-assignment");
    expect(ids).toContain("manufacturing.service.tool-assignment");
    expect(ids).toContain("manufacturing.service.labor-assignment");
    expect(ids).toContain("manufacturing.service.resource-readiness");
    expect(ids).toContain("manufacturing.service.downtime");
    expect(ids).toContain("manufacturing.service.execution-exception");
    expect(ids).toContain("manufacturing.service.traceability");
    expect(ids).toContain("manufacturing.query.resource");
    expect(ids).toContain("manufacturing.query.traceability");

    expect(ids.some((serviceId) => serviceId.includes("persistence"))).toBe(false);
    expect(ids.some((serviceId) => serviceId.includes("maintenance"))).toBe(false);
    expect(ids.some((serviceId) => serviceId.includes("quality-management"))).toBe(false);
    expect(ids.some((serviceId) => serviceId.includes("observability"))).toBe(false);

    await runtime.stop();
  });
});
