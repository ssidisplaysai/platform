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
  type DowntimeService,
  type ExecutionExceptionService,
  type ExecutionRoutingService,
  type LaborAssignmentService,
  type MachineAssignmentService,
  type ManufacturingProductReferenceService,
  type ManufacturingResourceQueryService,
  type ManufacturingTraceabilityQueryService,
  type ManufacturingTraceabilityService,
  type ManufacturingWorkOrderService,
  type OperationExecutionService,
  type ProductionCellService,
  type ToolAssignmentService,
  type WorkCenterService,
} from "@/platform/manufacturing";

function id<T extends Parameters<typeof createManufacturingIdentifier>[1]>(value: string, brand: T) {
  return createManufacturingIdentifier(value, brand);
}

function createBaseWorkOrder(tenantId = id("tenant-s8-001", "TenantId"), suffix = "001"): CreateManufacturingWorkOrder {
  const unit = createUnitOfMeasure("EA");
  return {
    workOrderId: id(`wo-s8-${suffix}`, "ManufacturingWorkOrderId"),
    workOrderNumber: id(`WO-S8-${suffix}`, "WorkOrderNumber"),
    tenantId,
    productRef: { tenantId, productId: id(`prod-s8-${suffix}`, "ProductIdentifier") },
    productVariantRef: { tenantId, productVariantId: id(`var-s8-${suffix}`, "ProductVariantIdentifier") },
    productVersionRef: { tenantId, productVersionId: id(`pv-s8-${suffix}`, "ProductVersionIdentifier") },
    productBomRef: {
      tenantId,
      productBomId: id(`bom-s8-${suffix}`, "ProductBomIdentifier"),
      bomVersion: id("1.0.0", "VersionIdentifier"),
    },
    requestedQuantity: createRequestedQuantity(20, unit),
    plannedQuantity: createPlannedQuantity(20, unit),
    priority: "HIGH",
    idempotencyKey: id(`idem-s8-wo-${suffix}`, "IdempotencyKey"),
    correlationId: id(`corr-s8-wo-${suffix}`, "CorrelationIdentifier"),
    command: {
      commandId: `cmd-s8-wo-${suffix}`,
      expectedVersion: 0,
      requestedAt: "2026-08-12T00:00:00.000Z",
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
    sourceRoutingReference: id("prod-routing-s8", "DocumentIdentifier") as never,
    sourceProductVersionRef: { tenantId: input.tenantId, productVersionId: id("pv-s8-001", "ProductVersionIdentifier") },
    sourceBomRef: {
      tenantId: input.tenantId,
      productBomId: id("bom-s8-001", "ProductBomIdentifier"),
      bomVersion: id("1.0.0", "VersionIdentifier"),
    },
    steps: [
      {
        routingStepId: id("step-s8-001", "RoutingStepId"),
        operationExecutionId: id("opexec-s8-001", "OperationExecutionId"),
        operationCode: id("OP-S8-001", "OperationCode"),
        routingStepCode: id("STEP-S8-001", "RoutingStepCode"),
        sequenceNumber: createSequenceNumber(10),
        predecessorStepIds: [],
        successorStepIds: [id("step-s8-002", "RoutingStepId")],
        conditionalEligibility: {
          state: "ELIGIBLE" as const,
          conditionInput: {
            requiresWorkCenter: true,
            requiresProductionCell: true,
            requiresMachine: true,
            requiresTool: true,
            requiresLabor: true,
          },
        },
        explicitReworkEdges: [{ targetStepId: id("step-s8-002", "RoutingStepId"), maxIterations: 1 }],
        reworkStepIds: [id("step-s8-002", "RoutingStepId")],
        conditionalStepIds: [],
        executionState: { readiness: "READY" as const, operationState: "READY" as const },
        tenantId: input.tenantId,
      },
      {
        routingStepId: id("step-s8-002", "RoutingStepId"),
        operationExecutionId: id("opexec-s8-002", "OperationExecutionId"),
        operationCode: id("OP-S8-002", "OperationCode"),
        routingStepCode: id("STEP-S8-002", "RoutingStepCode"),
        sequenceNumber: createSequenceNumber(20),
        predecessorStepIds: [id("step-s8-001", "RoutingStepId")],
        successorStepIds: [],
        conditionalEligibility: { state: "ELIGIBLE" as const },
        explicitReworkEdges: [{ targetStepId: id("step-s8-001", "RoutingStepId"), maxIterations: 1 }],
        reworkStepIds: [id("step-s8-001", "RoutingStepId")],
        conditionalStepIds: [],
        executionState: { readiness: "BLOCKED" as const, operationState: "BLOCKED" as const },
        tenantId: input.tenantId,
      },
    ],
    expectedWorkOrderVersion: input.expectedWorkOrderVersion,
    expectedVersion: 0,
    idempotencyKey: id(`idem-s8-routing-${input.routingId}`, "IdempotencyKey"),
    correlationId: id(`corr-s8-routing-${input.routingId}`, "CorrelationIdentifier"),
  };
}

type RuntimeContext = Readonly<{
  runtime: Awaited<ReturnType<typeof createManufacturingRuntime>>;
  workOrders: ManufacturingWorkOrderService;
  productRefs: ManufacturingProductReferenceService;
  routing: ExecutionRoutingService;
  operations: OperationExecutionService;
  workCenters: WorkCenterService;
  cells: ProductionCellService;
  machines: MachineAssignmentService;
  tools: ToolAssignmentService;
  labor: LaborAssignmentService;
  downtime: DowntimeService;
  exceptions: ExecutionExceptionService;
  traces: ManufacturingTraceabilityService;
  resourceQueries: ManufacturingResourceQueryService;
  traceQueries: ManufacturingTraceabilityQueryService;
}>;

async function createRuntimeContext(): Promise<RuntimeContext> {
  const baseDependencies = createDefaultManufacturingRuntimeDependencies();
  const runtime = await createManufacturingRuntime({
    runtimeId: "manufacturing-runtime-s8-test",
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
          return { accepted: true, referenceId: "reservation-s8" } as const;
        },
        async requestAllocation() {
          return { accepted: true, referenceId: "allocation-s8" } as const;
        },
        async releaseReservation() {
          return { accepted: true, referenceId: "release-reservation-s8" } as const;
        },
        async releaseAllocation() {
          return { accepted: true, referenceId: "release-allocation-s8" } as const;
        },
        async requestMaterialIssue(input) {
          return { accepted: true, referenceId: "issue-s8", acceptedQuantity: input.quantity } as const;
        },
        async requestMaterialReturn() {
          return { accepted: true, referenceId: "return-s8", acceptedQuantity: 1 } as const;
        },
        async requestFinishedGoodsReceipt(input) {
          return { accepted: true, referenceId: "receipt-s8", acceptedQuantity: input.quantity } as const;
        },
        async requestWriteOff(input) {
          return { accepted: true, referenceId: "writeoff-s8", acceptedQuantity: input.quantity } as const;
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

  return {
    runtime,
    workOrders: runtime.services.require("manufacturing.service.work-order").value as ManufacturingWorkOrderService,
    productRefs: runtime.services.require("manufacturing.service.product-reference").value as ManufacturingProductReferenceService,
    routing: runtime.services.require("manufacturing.service.execution-routing").value as ExecutionRoutingService,
    operations: runtime.services.require("manufacturing.service.operation-execution").value as OperationExecutionService,
    workCenters: runtime.services.require("manufacturing.service.work-center").value as WorkCenterService,
    cells: runtime.services.require("manufacturing.service.production-cell").value as ProductionCellService,
    machines: runtime.services.require("manufacturing.service.machine-assignment").value as MachineAssignmentService,
    tools: runtime.services.require("manufacturing.service.tool-assignment").value as ToolAssignmentService,
    labor: runtime.services.require("manufacturing.service.labor-assignment").value as LaborAssignmentService,
    downtime: runtime.services.require("manufacturing.service.downtime").value as DowntimeService,
    exceptions: runtime.services.require("manufacturing.service.execution-exception").value as ExecutionExceptionService,
    traces: runtime.services.require("manufacturing.service.traceability").value as ManufacturingTraceabilityService,
    resourceQueries: runtime.services.require("manufacturing.query.resource").value as ManufacturingResourceQueryService,
    traceQueries: runtime.services.require("manufacturing.query.traceability").value as ManufacturingTraceabilityQueryService,
  };
}

async function createExecutionReadyWorkOrder(context: RuntimeContext, suffix = "001") {
  const created = await context.workOrders.createWorkOrder(createBaseWorkOrder(id(`tenant-s8-${suffix}`, "TenantId"), suffix));

  const validated = await context.productRefs.validateProductBaseline({
    tenantId: created.workOrder.tenantId,
    workOrderId: created.workOrder.manufacturingWorkOrderId,
    expectedVersion: created.workOrder.version,
    productRef: created.workOrder.productRef,
    productVariantRef: created.workOrder.productVariantRef,
    productVersionRef: created.workOrder.productVersionRef,
    productBomRef: created.workOrder.productBomRef,
    designRoutingReference: "prod-routing-s8" as never,
    idempotencyKey: id(`idem-s8-baseline-validate-${suffix}`, "IdempotencyKey"),
    correlationId: id(`corr-s8-baseline-validate-${suffix}`, "CorrelationIdentifier"),
  });

  const frozen = await context.productRefs.freezeProductBaseline({
    tenantId: created.workOrder.tenantId,
    workOrderId: created.workOrder.manufacturingWorkOrderId,
    expectedVersion: validated.version,
    idempotencyKey: id(`idem-s8-baseline-freeze-${suffix}`, "IdempotencyKey"),
    correlationId: id(`corr-s8-baseline-freeze-${suffix}`, "CorrelationIdentifier"),
  });

  const route = await context.routing.createExecutionRouting(
    createRoutingCommand({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      expectedWorkOrderVersion: frozen.version,
      routingId: `routing-s8-${suffix}`,
    }),
  );

  const operations = await context.operations.initializeOperations({
    tenantId: created.workOrder.tenantId,
    workOrderId: created.workOrder.manufacturingWorkOrderId,
    executionRoutingId: route.routing.executionRoutingId,
    expectedRoutingVersion: route.routing.version,
    idempotencyKey: id(`idem-s8-op-init-${suffix}`, "IdempotencyKey"),
    correlationId: id(`corr-s8-op-init-${suffix}`, "CorrelationIdentifier"),
  });

  const planned = await context.workOrders.planWorkOrder({
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
    idempotencyKey: id(`idem-s8-plan-${suffix}`, "IdempotencyKey"),
    correlationId: id(`corr-s8-plan-${suffix}`, "CorrelationIdentifier"),
  });

  const released = await context.workOrders.releaseWorkOrder({
    workOrderId: planned.workOrder.manufacturingWorkOrderId,
    tenantId: planned.workOrder.tenantId,
    expectedVersion: planned.workOrder.version,
    idempotencyKey: id(`idem-s8-release-${suffix}`, "IdempotencyKey"),
    correlationId: id(`corr-s8-release-${suffix}`, "CorrelationIdentifier"),
  });

  const hold = await context.workOrders.placeOnHoldWorkOrder({
    workOrderId: released.workOrder.manufacturingWorkOrderId,
    tenantId: released.workOrder.tenantId,
    expectedVersion: released.workOrder.version,
    idempotencyKey: id(`idem-s8-hold-${suffix}`, "IdempotencyKey"),
    correlationId: id(`corr-s8-hold-${suffix}`, "CorrelationIdentifier"),
  });

  const ready = await context.workOrders.releaseHoldWorkOrder({
    workOrderId: hold.workOrder.manufacturingWorkOrderId,
    tenantId: hold.workOrder.tenantId,
    expectedVersion: hold.workOrder.version,
    idempotencyKey: id(`idem-s8-ready-${suffix}`, "IdempotencyKey"),
    correlationId: id(`corr-s8-ready-${suffix}`, "CorrelationIdentifier"),
  });

  const inProgress = await context.workOrders.startWorkOrderExecution({
    workOrderId: ready.workOrder.manufacturingWorkOrderId,
    tenantId: ready.workOrder.tenantId,
    expectedVersion: ready.workOrder.version,
    idempotencyKey: id(`idem-s8-wo-start-${suffix}`, "IdempotencyKey"),
    correlationId: id(`corr-s8-wo-start-${suffix}`, "CorrelationIdentifier"),
  });

  return {
    workOrder: inProgress,
    route,
    operations,
    firstOperation: operations.find((entry) => entry.execution.operationExecutionId === id("opexec-s8-001", "OperationExecutionId"))!,
  };
}

function currentWorkOrderVersion(context: RuntimeContext, tenantId: ReturnType<typeof id<"TenantId">>, workOrderId: string) {
  return context.workOrders.require(tenantId, workOrderId as never).workOrder.version;
}

describe("GMDT-1001-S8 resources downtime and traceability", () => {
  it("registers work centers and production cells with tenant boundaries and deterministic listing", async () => {
    const context = await createRuntimeContext();

    const tenant = id("tenant-s8-a01", "TenantId");
    const centerB = await context.workCenters.registerWorkCenter({
      tenantId: tenant,
      workCenterId: id("wc-s8-b", "WorkCenterId"),
      workCenterCode: id("WCB-S8", "WorkCenterCode"),
      displayName: "Packing Line B",
      status: "ACTIVE",
      capacityMetadata: { capacityUnits: 2, machineCapacity: 2, toolCapacity: 2, laborCapacity: 2 },
      idempotencyKey: id("idem-s8-wc-b", "IdempotencyKey"),
      correlationId: id("corr-s8-wc-b", "CorrelationIdentifier"),
    });

    const centerA = await context.workCenters.registerWorkCenter({
      tenantId: tenant,
      workCenterId: id("wc-s8-a", "WorkCenterId"),
      workCenterCode: id("WCA-S8", "WorkCenterCode"),
      displayName: "Packing Line A",
      status: "ACTIVE",
      capacityMetadata: { capacityUnits: 1, machineCapacity: 1, toolCapacity: 1, laborCapacity: 1 },
      idempotencyKey: id("idem-s8-wc-a", "IdempotencyKey"),
      correlationId: id("corr-s8-wc-a", "CorrelationIdentifier"),
    });

    await expect(
      context.workCenters.registerWorkCenter({
        tenantId: tenant,
        workCenterId: id("wc-s8-c", "WorkCenterId"),
        workCenterCode: id("WCA-S8", "WorkCenterCode"),
        displayName: "Duplicate Code",
        status: "ACTIVE",
        capacityMetadata: { capacityUnits: 1, machineCapacity: 1, toolCapacity: 1, laborCapacity: 1 },
        idempotencyKey: id("idem-s8-wc-dup", "IdempotencyKey"),
        correlationId: id("corr-s8-wc-dup", "CorrelationIdentifier"),
      }),
    ).rejects.toMatchObject({ classification: "DUPLICATE_WORK_CENTER_CODE" });

    const replay = await context.workCenters.registerWorkCenter({
      tenantId: tenant,
      workCenterId: centerA.workCenterId,
      workCenterCode: centerA.workCenterCode,
      displayName: centerA.displayName,
      status: centerA.status,
      capacityMetadata: centerA.capacityMetadata,
      idempotencyKey: id("idem-s8-wc-a", "IdempotencyKey"),
      correlationId: id("corr-s8-wc-a", "CorrelationIdentifier"),
    });
    expect(replay.workCenterId).toBe(centerA.workCenterId);

    const cell = await context.cells.registerProductionCell({
      tenantId: tenant,
      productionCellId: id("pc-s8-a", "ProductionCellId"),
      productionCellCode: id("PCA-S8", "ProductionCellCode"),
      displayName: "Cell A",
      workCenterId: centerA.workCenterId,
      status: "ACTIVE",
      capacityMetadata: { capacityUnits: 1, machineCapacity: 1, toolCapacity: 1, laborCapacity: 1 },
      idempotencyKey: id("idem-s8-pc-a", "IdempotencyKey"),
      correlationId: id("corr-s8-pc-a", "CorrelationIdentifier"),
    });

    const listedCenters = context.resourceQueries.listWorkCenters(tenant);
    expect(listedCenters.map((entry) => entry.workCenterCode)).toEqual([centerA.workCenterCode, centerB.workCenterCode]);

    const refreshedCenterA = context.resourceQueries.getWorkCenter(tenant, centerA.workCenterId as string)!;
    expect(refreshedCenterA.productionCellIds).toEqual([cell.productionCellId]);

    const foreignTenant = id("tenant-s8-a02", "TenantId");
    expect(context.resourceQueries.listWorkCenters(foreignTenant)).toHaveLength(0);

    await context.runtime.stop();
  });

  it("enforces assignment conflicts, lifecycle facts, and stale version checks", async () => {
    const context = await createRuntimeContext();
    const setup = await createExecutionReadyWorkOrder(context, "002");
    const tenant = setup.workOrder.workOrder.tenantId;
    const workOrderId = setup.workOrder.workOrder.manufacturingWorkOrderId;
    const operationId = setup.firstOperation.execution.operationExecutionId;

    const workCenter = await context.workCenters.registerWorkCenter({
      tenantId: tenant,
      workCenterId: id("wc-s8-assignment", "WorkCenterId"),
      workCenterCode: id("WCA-ASSIGN", "WorkCenterCode"),
      displayName: "Assembly Center",
      status: "ACTIVE",
      capacityMetadata: { capacityUnits: 1, machineCapacity: 1, toolCapacity: 1, laborCapacity: 1 },
      idempotencyKey: id("idem-s8-assign-wc", "IdempotencyKey"),
      correlationId: id("corr-s8-assign-wc", "CorrelationIdentifier"),
    });

    const cell = await context.cells.registerProductionCell({
      tenantId: tenant,
      productionCellId: id("pc-s8-assignment", "ProductionCellId"),
      productionCellCode: id("PCA-ASSIGN", "ProductionCellCode"),
      displayName: "Assembly Cell",
      workCenterId: workCenter.workCenterId,
      status: "ACTIVE",
      capacityMetadata: { capacityUnits: 1, machineCapacity: 1, toolCapacity: 1, laborCapacity: 1 },
      idempotencyKey: id("idem-s8-assign-pc", "IdempotencyKey"),
      correlationId: id("corr-s8-assign-pc", "CorrelationIdentifier"),
    });

    const machine = await context.machines.assignMachine({
      tenantId: tenant,
      machineAssignmentId: id("machine-assignment-s8", "MachineAssignmentId"),
      workOrderId,
      operationExecutionId: operationId,
      workCenterId: workCenter.workCenterId,
      productionCellId: cell.productionCellId,
      machineRef: { tenantId: tenant, assetId: id("machine-s8-01", "AssetIdentifier") },
      expectedWorkOrderVersion: currentWorkOrderVersion(context, tenant, workOrderId),
      expectedOperationVersion: setup.firstOperation.execution.version,
      plannedStartAt: "2026-08-12T10:00:00.000Z",
      plannedEndAt: "2026-08-12T12:00:00.000Z",
      idempotencyKey: id("idem-s8-machine-1", "IdempotencyKey"),
      correlationId: id("corr-s8-machine-1", "CorrelationIdentifier"),
    });

    await expect(
      context.machines.assignMachine({
        tenantId: tenant,
        machineAssignmentId: id("machine-assignment-s8-dup", "MachineAssignmentId"),
        workOrderId,
        operationExecutionId: operationId,
        workCenterId: workCenter.workCenterId,
        productionCellId: cell.productionCellId,
        machineRef: machine.machineRef,
        expectedWorkOrderVersion: currentWorkOrderVersion(context, tenant, workOrderId),
        expectedOperationVersion: setup.firstOperation.execution.version,
        idempotencyKey: id("idem-s8-machine-dup", "IdempotencyKey"),
        correlationId: id("corr-s8-machine-dup", "CorrelationIdentifier"),
      }),
    ).rejects.toMatchObject({ classification: "MACHINE_ASSIGNMENT_CONFLICT" });

    const tool = await context.tools.assignTool({
      tenantId: tenant,
      toolAssignmentId: id("tool-assignment-s8", "ToolAssignmentId"),
      workOrderId,
      operationExecutionId: operationId,
      workCenterId: workCenter.workCenterId,
      productionCellId: cell.productionCellId,
      toolRef: { tenantId: tenant, assetId: id("tool-s8-01", "AssetIdentifier") },
      expectedWorkOrderVersion: currentWorkOrderVersion(context, tenant, workOrderId),
      expectedOperationVersion: setup.firstOperation.execution.version,
      idempotencyKey: id("idem-s8-tool-1", "IdempotencyKey"),
      correlationId: id("corr-s8-tool-1", "CorrelationIdentifier"),
    });

    const toolReplay = await context.tools.assignTool({
      tenantId: tenant,
      toolAssignmentId: tool.toolAssignmentId,
      workOrderId,
      operationExecutionId: operationId,
      workCenterId: workCenter.workCenterId,
      productionCellId: cell.productionCellId,
      toolRef: tool.toolRef,
      expectedWorkOrderVersion: currentWorkOrderVersion(context, tenant, workOrderId),
      expectedOperationVersion: setup.firstOperation.execution.version,
      idempotencyKey: id("idem-s8-tool-1", "IdempotencyKey"),
      correlationId: id("corr-s8-tool-1", "CorrelationIdentifier"),
    });
    expect(toolReplay.toolAssignmentId).toBe(tool.toolAssignmentId);

    const labor = await context.labor.assignLabor({
      tenantId: tenant,
      laborAssignmentId: id("labor-assignment-s8", "LaborAssignmentId"),
      workOrderId,
      operationExecutionId: operationId,
      workCenterId: workCenter.workCenterId,
      productionCellId: cell.productionCellId,
      laborRef: { tenantId: tenant, personOrContactId: id("labor-ref-s8-01", "PersonOrContactIdentifier") },
      roleCode: "OPERATOR",
      expectedWorkOrderVersion: currentWorkOrderVersion(context, tenant, workOrderId),
      expectedOperationVersion: setup.firstOperation.execution.version,
      plannedStartAt: "2026-08-12T10:00:00.000Z",
      plannedEndAt: "2026-08-12T12:00:00.000Z",
      idempotencyKey: id("idem-s8-labor-1", "IdempotencyKey"),
      correlationId: id("corr-s8-labor-1", "CorrelationIdentifier"),
    });

    await expect(
      context.labor.assignLabor({
        tenantId: tenant,
        laborAssignmentId: id("labor-assignment-s8-stale", "LaborAssignmentId"),
        workOrderId,
        operationExecutionId: operationId,
        workCenterId: workCenter.workCenterId,
        productionCellId: cell.productionCellId,
        laborRef: { tenantId: tenant, personOrContactId: id("labor-ref-s8-02", "PersonOrContactIdentifier") },
        roleCode: "INSPECTOR",
        expectedWorkOrderVersion: currentWorkOrderVersion(context, tenant, workOrderId),
        expectedOperationVersion: setup.firstOperation.execution.version + 1,
        idempotencyKey: id("idem-s8-labor-stale", "IdempotencyKey"),
        correlationId: id("corr-s8-labor-stale", "CorrelationIdentifier"),
      }),
    ).rejects.toMatchObject({ classification: "STALE_EXPECTED_VERSION" });

    const started = context.labor.startLabor({
      tenantId: tenant,
      laborAssignmentId: labor.laborAssignmentId,
      expectedVersion: labor.version,
      startedAt: "2026-08-12T10:00:00.000Z",
      idempotencyKey: id("idem-s8-labor-start", "IdempotencyKey"),
      correlationId: id("corr-s8-labor-start", "CorrelationIdentifier"),
    });
    const paused = context.labor.pauseLabor({
      tenantId: tenant,
      laborAssignmentId: labor.laborAssignmentId,
      expectedVersion: started.version,
    });
    expect(paused.status).toBe("PAUSED");

    const resumed = context.labor.startLabor({
      tenantId: tenant,
      laborAssignmentId: labor.laborAssignmentId,
      expectedVersion: paused.version,
      startedAt: "2026-08-12T10:00:00.000Z",
      idempotencyKey: id("idem-s8-labor-resume", "IdempotencyKey"),
      correlationId: id("corr-s8-labor-resume", "CorrelationIdentifier"),
    });

    const completed = context.labor.completeLabor({
      tenantId: tenant,
      laborAssignmentId: labor.laborAssignmentId,
      expectedVersion: resumed.version,
      endedAt: "2026-08-12T10:42:00.000Z",
    });

    expect(completed.status).toBe("COMPLETED");
    expect(completed.laborDuration).toBe(42);
    expect("payRate" in (completed as Record<string, unknown>)).toBe(false);

    await context.runtime.stop();
  });

  it("computes resource readiness and enforces operation start guards with quality hold release flow", async () => {
    const context = await createRuntimeContext();
    const setup = await createExecutionReadyWorkOrder(context, "003");

    const tenant = setup.workOrder.workOrder.tenantId;
    const workOrderId = setup.workOrder.workOrder.manufacturingWorkOrderId;
    const operation = setup.firstOperation;

    const initialReadiness = context.resourceQueries.getResourceReadiness(tenant, workOrderId as string);
    expect(initialReadiness.resourcesReady).toBe(false);
    expect(initialReadiness.operationReadiness[0]?.blockingReasons).toEqual(
      expect.arrayContaining([
        "missing required work center assignment",
        "missing required production cell assignment",
        "missing required machine assignment",
        "missing required tool assignment",
        "missing required labor assignment",
      ]),
    );

    await expect(
      context.operations.startOperation({
        tenantId: tenant,
        workOrderId,
        executionRoutingId: setup.route.routing.executionRoutingId,
        operationExecutionId: operation.execution.operationExecutionId,
        expectedVersion: operation.execution.version,
        idempotencyKey: id("idem-s8-op-start-blocked", "IdempotencyKey"),
        correlationId: id("corr-s8-op-start-blocked", "CorrelationIdentifier"),
      }),
    ).rejects.toMatchObject({ classification: "RESOURCE_NOT_READY" });

    const workCenter = await context.workCenters.registerWorkCenter({
      tenantId: tenant,
      workCenterId: id("wc-s8-readiness", "WorkCenterId"),
      workCenterCode: id("WCA-READY", "WorkCenterCode"),
      displayName: "Readiness Center",
      status: "ACTIVE",
      capacityMetadata: { capacityUnits: 2, machineCapacity: 2, toolCapacity: 2, laborCapacity: 2 },
      idempotencyKey: id("idem-s8-ready-wc", "IdempotencyKey"),
      correlationId: id("corr-s8-ready-wc", "CorrelationIdentifier"),
    });

    const cell = await context.cells.registerProductionCell({
      tenantId: tenant,
      productionCellId: id("pc-s8-readiness", "ProductionCellId"),
      productionCellCode: id("PCA-READY", "ProductionCellCode"),
      displayName: "Readiness Cell",
      workCenterId: workCenter.workCenterId,
      status: "ACTIVE",
      capacityMetadata: { capacityUnits: 2, machineCapacity: 2, toolCapacity: 2, laborCapacity: 2 },
      idempotencyKey: id("idem-s8-ready-pc", "IdempotencyKey"),
      correlationId: id("corr-s8-ready-pc", "CorrelationIdentifier"),
    });

    await context.machines.assignMachine({
      tenantId: tenant,
      machineAssignmentId: id("machine-readiness-s8", "MachineAssignmentId"),
      workOrderId,
      operationExecutionId: operation.execution.operationExecutionId,
      workCenterId: workCenter.workCenterId,
      productionCellId: cell.productionCellId,
      machineRef: { tenantId: tenant, assetId: id("machine-s8-ready", "AssetIdentifier") },
      expectedWorkOrderVersion: currentWorkOrderVersion(context, tenant, workOrderId),
      expectedOperationVersion: operation.execution.version,
      idempotencyKey: id("idem-s8-ready-machine", "IdempotencyKey"),
      correlationId: id("corr-s8-ready-machine", "CorrelationIdentifier"),
    });

    await context.tools.assignTool({
      tenantId: tenant,
      toolAssignmentId: id("tool-readiness-s8", "ToolAssignmentId"),
      workOrderId,
      operationExecutionId: operation.execution.operationExecutionId,
      workCenterId: workCenter.workCenterId,
      productionCellId: cell.productionCellId,
      toolRef: { tenantId: tenant, assetId: id("tool-s8-ready", "AssetIdentifier") },
      expectedWorkOrderVersion: currentWorkOrderVersion(context, tenant, workOrderId),
      expectedOperationVersion: operation.execution.version,
      idempotencyKey: id("idem-s8-ready-tool", "IdempotencyKey"),
      correlationId: id("corr-s8-ready-tool", "CorrelationIdentifier"),
    });

    await context.labor.assignLabor({
      tenantId: tenant,
      laborAssignmentId: id("labor-readiness-s8", "LaborAssignmentId"),
      workOrderId,
      operationExecutionId: operation.execution.operationExecutionId,
      workCenterId: workCenter.workCenterId,
      productionCellId: cell.productionCellId,
      laborRef: { tenantId: tenant, personOrContactId: id("labor-s8-ready", "PersonOrContactIdentifier") },
      roleCode: "OPERATOR",
      expectedWorkOrderVersion: currentWorkOrderVersion(context, tenant, workOrderId),
      expectedOperationVersion: operation.execution.version,
      idempotencyKey: id("idem-s8-ready-labor", "IdempotencyKey"),
      correlationId: id("corr-s8-ready-labor", "CorrelationIdentifier"),
    });

    const readiness = context.resourceQueries.getResourceReadiness(tenant, workOrderId as string);
    expect(readiness.resourcesReady).toBe(true);
    expect(readiness.operationReadiness[0]?.ready).toBe(true);

    const opened = await context.exceptions.openException({
      tenantId: tenant,
      executionExceptionId: id("exec-ex-s8", "ExecutionExceptionId"),
      workOrderId,
      operationExecutionId: operation.execution.operationExecutionId,
      category: "QUALITY",
      severity: "HIGH",
      reason: "Pending quality hold",
      expectedWorkOrderVersion: currentWorkOrderVersion(context, tenant, workOrderId),
      idempotencyKey: id("idem-s8-ex-open", "IdempotencyKey"),
      correlationId: id("corr-s8-ex-open", "CorrelationIdentifier"),
    });

    const held = context.exceptions.applyQualityHold({
      tenantId: tenant,
      executionExceptionId: opened.executionExceptionId,
      qualityHoldRef: {
        qualityHoldReferenceId: "qh-s8-001" as never,
        tenantId: tenant,
        targetIdentity: operation.execution.operationExecutionId,
        holdCode: "QH-S8-01",
        status: "ACTIVE" as never,
      },
      expectedVersion: opened.version,
      idempotencyKey: id("idem-s8-ex-hold", "IdempotencyKey"),
      correlationId: id("corr-s8-ex-hold", "CorrelationIdentifier"),
    });

    await expect(
      context.operations.startOperation({
        tenantId: tenant,
        workOrderId,
        executionRoutingId: setup.route.routing.executionRoutingId,
        operationExecutionId: operation.execution.operationExecutionId,
        expectedVersion: operation.execution.version,
        idempotencyKey: id("idem-s8-op-start-held", "IdempotencyKey"),
        correlationId: id("corr-s8-op-start-held", "CorrelationIdentifier"),
      }),
    ).rejects.toMatchObject({ classification: "QUALITY_HOLD_ACTIVE" });

    const released = context.exceptions.releaseQualityHold({
      tenantId: tenant,
      executionExceptionId: held.executionExceptionId,
      qualityHoldReferenceId: held.qualityHoldRef!.qualityHoldReferenceId,
      releaseEvidence: "verified disposition",
      expectedVersion: held.version,
      idempotencyKey: id("idem-s8-ex-release", "IdempotencyKey"),
      correlationId: id("corr-s8-ex-release", "CorrelationIdentifier"),
    });

    const closed = context.exceptions.closeException({
      tenantId: tenant,
      executionExceptionId: released.executionExceptionId,
      expectedVersion: released.version,
      idempotencyKey: id("idem-s8-ex-close", "IdempotencyKey"),
      correlationId: id("corr-s8-ex-close", "CorrelationIdentifier"),
    });
    expect(closed.status).toBe("CLOSED");

    const started = await context.operations.startOperation({
      tenantId: tenant,
      workOrderId,
      executionRoutingId: setup.route.routing.executionRoutingId,
      operationExecutionId: operation.execution.operationExecutionId,
      expectedVersion: operation.execution.version,
      idempotencyKey: id("idem-s8-op-start-ready", "IdempotencyKey"),
      correlationId: id("corr-s8-op-start-ready", "CorrelationIdentifier"),
    });
    expect(started.execution.operationState).toBe("IN_PROGRESS");

    await context.runtime.stop();
  });

  it("tracks downtime with idempotency, duration, and stale version checks", async () => {
    const context = await createRuntimeContext();
    const setup = await createExecutionReadyWorkOrder(context, "004");
    const tenant = setup.workOrder.workOrder.tenantId;
    const workOrderId = setup.workOrder.workOrder.manufacturingWorkOrderId;
    const operationId = setup.firstOperation.execution.operationExecutionId;

    const started = await context.downtime.startDowntime({
      tenantId: tenant,
      downtimeRecordId: id("dt-s8-001", "DowntimeRecordId"),
      workOrderId,
      operationExecutionId: operationId,
      startedAt: "2026-08-12T10:00:00.000Z",
      reasonCode: "MACHINE_FAULT",
      category: "UNPLANNED",
      expectedWorkOrderVersion: currentWorkOrderVersion(context, tenant, workOrderId),
      idempotencyKey: id("idem-s8-dt-start", "IdempotencyKey"),
      correlationId: id("corr-s8-dt-start", "CorrelationIdentifier"),
    });

    const replay = await context.downtime.startDowntime({
      tenantId: tenant,
      downtimeRecordId: started.downtimeRecordId,
      workOrderId,
      operationExecutionId: operationId,
      startedAt: "2026-08-12T10:00:00.000Z",
      reasonCode: "MACHINE_FAULT",
      category: "UNPLANNED",
      expectedWorkOrderVersion: currentWorkOrderVersion(context, tenant, workOrderId),
      idempotencyKey: id("idem-s8-dt-start", "IdempotencyKey"),
      correlationId: id("corr-s8-dt-start", "CorrelationIdentifier"),
    });
    expect(replay.downtimeRecordId).toBe(started.downtimeRecordId);

    await expect(
      context.downtime.startDowntime({
        tenantId: tenant,
        downtimeRecordId: id("dt-s8-002", "DowntimeRecordId"),
        workOrderId,
        operationExecutionId: operationId,
        startedAt: "2026-08-12T10:05:00.000Z",
        reasonCode: "MACHINE_FAULT",
        category: "UNPLANNED",
        expectedWorkOrderVersion: currentWorkOrderVersion(context, tenant, workOrderId),
        idempotencyKey: id("idem-s8-dt-dup", "IdempotencyKey"),
        correlationId: id("corr-s8-dt-dup", "CorrelationIdentifier"),
      }),
    ).rejects.toMatchObject({ classification: "DUPLICATE_ACTIVE_DOWNTIME" });

    const ended = await context.downtime.endDowntime({
      tenantId: tenant,
      downtimeRecordId: started.downtimeRecordId,
      endedAt: "2026-08-12T10:35:00.000Z",
      expectedVersion: started.version,
      idempotencyKey: id("idem-s8-dt-end", "IdempotencyKey"),
      correlationId: id("corr-s8-dt-end", "CorrelationIdentifier"),
    });
    expect(ended.status).toBe("CLOSED");
    expect(ended.duration).toBe(35);

    await expect(
      context.downtime.endDowntime({
        tenantId: tenant,
        downtimeRecordId: started.downtimeRecordId,
        endedAt: "2026-08-12T10:40:00.000Z",
        expectedVersion: started.version,
        idempotencyKey: id("idem-s8-dt-end-stale", "IdempotencyKey"),
        correlationId: id("corr-s8-dt-end-stale", "CorrelationIdentifier"),
      }),
    ).rejects.toMatchObject({ classification: "STALE_EXPECTED_VERSION" });

    const listed = context.resourceQueries.listDowntimeByOperation(tenant, operationId as string);
    expect(listed).toHaveLength(1);

    await context.runtime.stop();
  });

  it("enforces trace append invariants and supports deterministic relation queries", async () => {
    const context = await createRuntimeContext();
    const setup = await createExecutionReadyWorkOrder(context, "005");
    const tenant = setup.workOrder.workOrder.tenantId;
    const workOrderId = setup.workOrder.workOrder.manufacturingWorkOrderId;
    const operationId = setup.firstOperation.execution.operationExecutionId;

    await expect(
      context.traces.appendTrace({
        tenantId: tenant,
        productionTraceId: id("trace-s8-self", "ProductionTraceId"),
        sourceType: "WORK_ORDER",
        sourceId: workOrderId,
        targetType: "WORK_ORDER",
        targetId: workOrderId,
        relationType: "SELF",
        workOrderId,
        idempotencyKey: id("idem-s8-trace-self", "IdempotencyKey"),
        correlationId: id("corr-s8-trace-self", "CorrelationIdentifier"),
      }),
    ).rejects.toMatchObject({ classification: "INVALID_TRACE_RELATION" });

    const otherTenant = id("tenant-s8-foreign", "TenantId");
    const foreignOrder = await context.workOrders.createWorkOrder(createBaseWorkOrder(otherTenant, "foreign"));
    await expect(
      context.traces.appendTrace({
        tenantId: tenant,
        productionTraceId: id("trace-s8-tenant-mismatch", "ProductionTraceId"),
        sourceType: "WORK_ORDER",
        sourceId: workOrderId,
        targetType: "OPERATION",
        targetId: operationId,
        relationType: "MISMATCH",
        workOrderId: foreignOrder.workOrder.manufacturingWorkOrderId,
        idempotencyKey: id("idem-s8-trace-tenant", "IdempotencyKey"),
        correlationId: id("corr-s8-trace-tenant", "CorrelationIdentifier"),
      }),
    ).rejects.toMatchObject({ classification: "TRACE_TENANT_MISMATCH" });

    const relations: ReadonlyArray<{
      traceId: string;
      sourceType: "WORK_ORDER" | "ROUTING" | "MATERIAL_ISSUE" | "LOT" | "PRODUCTION_OUTPUT" | "REWORK" | "MACHINE_ASSET" | "TOOL_ASSET" | "LABOR_REFERENCE";
      sourceId: string;
      targetType: "PRODUCT_VERSION" | "PRODUCT_BOM_VERSION" | "PRODUCTION_RUN" | "PRODUCTION_BATCH" | "OPERATION" | "INVENTORY_MOVEMENT" | "MATERIAL_CONSUMPTION";
      targetId: string;
      relationType: string;
    }> = [
      {
        traceId: "trace-s8-001",
        sourceType: "WORK_ORDER",
        sourceId: workOrderId,
        targetType: "PRODUCT_VERSION",
        targetId: setup.workOrder.workOrder.productVersionRef.productVersionId,
        relationType: "WORK_ORDER_PRODUCT_BASELINE",
      },
      {
        traceId: "trace-s8-002",
        sourceType: "WORK_ORDER",
        sourceId: workOrderId,
        targetType: "PRODUCT_BOM_VERSION",
        targetId: setup.workOrder.workOrder.productBomRef.productBomId,
        relationType: "WORK_ORDER_BOM_BASELINE",
      },
      {
        traceId: "trace-s8-003",
        sourceType: "WORK_ORDER",
        sourceId: workOrderId,
        targetType: "PRODUCTION_RUN",
        targetId: "run-s8-001",
        relationType: "WORK_ORDER_RUN",
      },
      {
        traceId: "trace-s8-004",
        sourceType: "WORK_ORDER",
        sourceId: workOrderId,
        targetType: "PRODUCTION_BATCH",
        targetId: "batch-s8-001",
        relationType: "WORK_ORDER_BATCH",
      },
      {
        traceId: "trace-s8-005",
        sourceType: "ROUTING",
        sourceId: setup.route.routing.executionRoutingId,
        targetType: "OPERATION",
        targetId: operationId,
        relationType: "ROUTING_OPERATION",
      },
      {
        traceId: "trace-s8-006",
        sourceType: "MATERIAL_ISSUE",
        sourceId: "issue-s8-001",
        targetType: "INVENTORY_MOVEMENT",
        targetId: "inv-move-s8-001",
        relationType: "ISSUE_MOVEMENT",
      },
      {
        traceId: "trace-s8-007",
        sourceType: "LOT",
        sourceId: "lot-s8-001",
        targetType: "MATERIAL_CONSUMPTION",
        targetId: "consumption-s8-001",
        relationType: "LOT_CONSUMPTION",
      },
      {
        traceId: "trace-s8-008",
        sourceType: "PRODUCTION_OUTPUT",
        sourceId: "output-s8-001",
        targetType: "INVENTORY_MOVEMENT",
        targetId: "inv-move-s8-002",
        relationType: "OUTPUT_MOVEMENT",
      },
      {
        traceId: "trace-s8-009",
        sourceType: "REWORK",
        sourceId: "rework-s8-001",
        targetType: "OPERATION",
        targetId: operationId,
        relationType: "REWORK_OPERATION",
      },
      {
        traceId: "trace-s8-010",
        sourceType: "MACHINE_ASSET",
        sourceId: "machine-s8-01",
        targetType: "OPERATION",
        targetId: operationId,
        relationType: "MACHINE_OPERATION",
      },
      {
        traceId: "trace-s8-011",
        sourceType: "TOOL_ASSET",
        sourceId: "tool-s8-01",
        targetType: "OPERATION",
        targetId: operationId,
        relationType: "TOOL_OPERATION",
      },
      {
        traceId: "trace-s8-012",
        sourceType: "LABOR_REFERENCE",
        sourceId: "labor-s8-01",
        targetType: "OPERATION",
        targetId: operationId,
        relationType: "LABOR_OPERATION",
      },
    ];

    for (const relation of relations) {
      await context.traces.appendTrace({
        tenantId: tenant,
        productionTraceId: id(relation.traceId, "ProductionTraceId"),
        sourceType: relation.sourceType,
        sourceId: relation.sourceId,
        targetType: relation.targetType,
        targetId: relation.targetId,
        relationType: relation.relationType,
        workOrderId,
        operationExecutionId: relation.targetType === "OPERATION" ? operationId : undefined,
        occurredAt: "2026-08-12T11:00:00.000Z",
        idempotencyKey: id(`idem-${relation.traceId}`, "IdempotencyKey"),
        correlationId: id(`corr-${relation.traceId}`, "CorrelationIdentifier"),
      });
    }

    const replay = await context.traces.appendTrace({
      tenantId: tenant,
      productionTraceId: id("trace-s8-001", "ProductionTraceId"),
      sourceType: "WORK_ORDER",
      sourceId: workOrderId,
      targetType: "PRODUCT_VERSION",
      targetId: setup.workOrder.workOrder.productVersionRef.productVersionId,
      relationType: "WORK_ORDER_PRODUCT_BASELINE",
      workOrderId,
      occurredAt: "2026-08-12T11:00:00.000Z",
      idempotencyKey: id("idem-trace-s8-001", "IdempotencyKey"),
      correlationId: id("corr-trace-s8-001", "CorrelationIdentifier"),
    });
    expect(replay.productionTraceId).toBe(id("trace-s8-001", "ProductionTraceId"));

    await expect(
      context.traces.appendTrace({
        tenantId: tenant,
        productionTraceId: id("trace-s8-001", "ProductionTraceId"),
        sourceType: "WORK_ORDER",
        sourceId: workOrderId,
        targetType: "PRODUCTION_RUN",
        targetId: "run-s8-002",
        relationType: "DUPLICATE_ID",
        workOrderId,
        idempotencyKey: id("idem-s8-trace-dup-id", "IdempotencyKey"),
        correlationId: id("corr-s8-trace-dup-id", "CorrelationIdentifier"),
      }),
    ).rejects.toMatchObject({ classification: "DUPLICATE_TRACE_ID" });

    const listed = context.traceQueries.listProductionTrace(tenant);
    expect(listed).toHaveLength(12);
    expect(listed.map((entry) => entry.appendSequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

    expect(context.traceQueries.traceProductToWorkOrder(tenant, setup.workOrder.workOrder.productVersionRef.productVersionId, workOrderId as string)).toHaveLength(1);
    expect(context.traceQueries.traceOutputToInventoryMovement(tenant, "output-s8-001")).toHaveLength(1);
    expect(context.traceQueries.traceMaterialToConsumption(tenant, "issue-s8-001")).toHaveLength(0);
    expect(context.traceQueries.traceMachineToExecution(tenant, "machine-s8-01")).toHaveLength(1);
    expect(context.traceQueries.traceLaborToExecution(tenant, "labor-s8-01")).toHaveLength(1);

    await context.runtime.stop();
  });

  it("registers slice 8 services in runtime while keeping forbidden families absent", async () => {
    const context = await createRuntimeContext();
    const ids = context.runtime.services.list().map((service) => service.serviceId).sort();

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

    expect(ids.some((entry) => entry.startsWith("manufacturing.service.persistence"))).toBe(false);
    expect(ids.some((entry) => entry.startsWith("manufacturing.service.maintenance"))).toBe(false);
    expect(ids.some((entry) => entry.startsWith("manufacturing.service.quality-management"))).toBe(false);
    expect(ids.some((entry) => entry.startsWith("manufacturing.service.observability"))).toBe(false);

    await context.runtime.stop();
  });
});
