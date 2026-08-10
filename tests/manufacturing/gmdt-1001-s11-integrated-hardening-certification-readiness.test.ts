import { describe, expect, it } from "@jest/globals";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  type ManufacturingMaterialExecutionQueryService,
  type ManufacturingObservabilityQueryService,
  type ManufacturingProductionResultQueryService,
  type ManufacturingProductReferenceService,
  type ManufacturingResourceQueryService,
  type ManufacturingTraceabilityService,
  type ManufacturingWorkOrderService,
  type MaterialConsumptionService,
  type MaterialIssueService,
  type MaterialRequirementService,
  type OperationExecutionService,
  type ProductionBatchService,
  type ProductionCellService,
  type ProductionOutputService,
  type ProductionRunService,
  type ReworkService,
  type ScrapService,
  type ToolAssignmentService,
  type WorkCenterService,
} from "@/platform/manufacturing";

function id<T extends Parameters<typeof createManufacturingIdentifier>[1]>(value: string, brand: T) {
  return createManufacturingIdentifier(value, brand);
}

type InventoryBehavior = Readonly<{
  issueAcceptedQuantity?: number;
}>;

type RuntimeServices = Readonly<{
  runtime: Awaited<ReturnType<typeof createManufacturingRuntime>>;
  workOrders: ManufacturingWorkOrderService;
  runs: ProductionRunService;
  batches: ProductionBatchService;
  productRefs: ManufacturingProductReferenceService;
  routing: ExecutionRoutingService;
  operations: OperationExecutionService;
  materials: MaterialRequirementService;
  issues: MaterialIssueService;
  consumption: MaterialConsumptionService;
  outputs: ProductionOutputService;
  scrap: ScrapService;
  rework: ReworkService;
  workCenters: WorkCenterService;
  cells: ProductionCellService;
  machines: MachineAssignmentService;
  tools: ToolAssignmentService;
  labor: LaborAssignmentService;
  downtime: DowntimeService;
  exceptions: ExecutionExceptionService;
  traceability: ManufacturingTraceabilityService;
  resultQueries: ManufacturingProductionResultQueryService;
  materialQueries: ManufacturingMaterialExecutionQueryService;
  resourceQueries: ManufacturingResourceQueryService;
  observabilityQueries: ManufacturingObservabilityQueryService;
}>;

function createWorkOrder(tenantId = id("tenant-s11-001", "TenantId"), suffix = "001"): CreateManufacturingWorkOrder {
  const unit = createUnitOfMeasure("EA");
  return {
    workOrderId: id(`wo-s11-${suffix}`, "ManufacturingWorkOrderId"),
    workOrderNumber: id(`WO-S11-${suffix}`, "WorkOrderNumber"),
    tenantId,
    productRef: { tenantId, productId: id(`prod-s11-${suffix}`, "ProductIdentifier") },
    productVariantRef: { tenantId, productVariantId: id(`var-s11-${suffix}`, "ProductVariantIdentifier") },
    productVersionRef: { tenantId, productVersionId: id(`pv-s11-${suffix}`, "ProductVersionIdentifier") },
    productBomRef: {
      tenantId,
      productBomId: id(`bom-s11-${suffix}`, "ProductBomIdentifier"),
      bomVersion: id("1.0.0", "VersionIdentifier"),
    },
    requestedQuantity: createRequestedQuantity(10, unit),
    plannedQuantity: createPlannedQuantity(10, unit),
    priority: "HIGH",
    idempotencyKey: id(`idem-s11-wo-${suffix}`, "IdempotencyKey"),
    correlationId: id(`corr-s11-wo-${suffix}`, "CorrelationIdentifier"),
    command: {
      commandId: `cmd-s11-wo-${suffix}`,
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
    sourceRoutingReference: id("prod-routing-s11", "ProductRoutingReferenceId"),
    sourceProductVersionRef: { tenantId: input.tenantId, productVersionId: id("pv-s11-001", "ProductVersionIdentifier") },
    sourceBomRef: {
      tenantId: input.tenantId,
      productBomId: id("bom-s11-001", "ProductBomIdentifier"),
      bomVersion: id("1.0.0", "VersionIdentifier"),
    },
    steps: [
      {
        routingStepId: id("step-s11-001", "RoutingStepId"),
        operationExecutionId: id("opexec-s11-001", "OperationExecutionId"),
        operationCode: id("OP-S11-001", "OperationCode"),
        routingStepCode: id("STEP-S11-001", "RoutingStepCode"),
        sequenceNumber: createSequenceNumber(10),
        predecessorStepIds: [],
        successorStepIds: [id("step-s11-002", "RoutingStepId")],
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
        explicitReworkEdges: [{ targetStepId: id("step-s11-002", "RoutingStepId"), maxIterations: 1 }],
        reworkStepIds: [id("step-s11-002", "RoutingStepId")],
        conditionalStepIds: [],
        executionState: { readiness: "READY" as const, operationState: "READY" as const },
        tenantId: input.tenantId,
      },
      {
        routingStepId: id("step-s11-002", "RoutingStepId"),
        operationExecutionId: id("opexec-s11-002", "OperationExecutionId"),
        operationCode: id("OP-S11-002", "OperationCode"),
        routingStepCode: id("STEP-S11-002", "RoutingStepCode"),
        sequenceNumber: createSequenceNumber(20),
        predecessorStepIds: [id("step-s11-001", "RoutingStepId")],
        successorStepIds: [],
        conditionalEligibility: { state: "ELIGIBLE" as const },
        explicitReworkEdges: [{ targetStepId: id("step-s11-001", "RoutingStepId"), maxIterations: 1 }],
        reworkStepIds: [id("step-s11-001", "RoutingStepId")],
        conditionalStepIds: [],
        executionState: { readiness: "BLOCKED" as const, operationState: "BLOCKED" as const },
        tenantId: input.tenantId,
      },
    ],
    expectedWorkOrderVersion: input.expectedWorkOrderVersion,
    expectedVersion: 0,
    idempotencyKey: id(`idem-s11-routing-${input.routingId}`, "IdempotencyKey"),
    correlationId: id(`corr-s11-routing-${input.routingId}`, "CorrelationIdentifier"),
  };
}

async function createRuntime(rootDir?: string, behavior: InventoryBehavior = {}): Promise<RuntimeServices> {
  const dependencies = createDefaultManufacturingRuntimeDependencies();
  const runtime = await createManufacturingRuntime({
    runtimeId: "manufacturing-runtime-s11-test",
    persistence: rootDir ? { rootDir } : undefined,
    dependencies,
    productIntegration: {
      integrationId: "product-port",
      port: {
        async validateProductReference() { return { valid: true } as const; },
        async validateVariantReference() { return { valid: true } as const; },
        async validateProductVersionReference() { return { valid: true } as const; },
        async validateBomReference() { return { valid: true } as const; },
        async validateRoutingReference() { return { valid: true } as const; },
        async validateConfigurationReference() { return { valid: true } as const; },
      },
    },
    inventoryIntegration: {
      integrationId: "inventory-port",
      port: {
        async queryAvailability() { return { valid: true, availableQuantity: 100 } as const; },
        async requestReservation() { return { accepted: true, referenceId: "reservation-s11" } as const; },
        async requestAllocation() { return { accepted: true, referenceId: "allocation-s11" } as const; },
        async releaseReservation() { return { accepted: true, referenceId: "release-reservation-s11" } as const; },
        async releaseAllocation() { return { accepted: true, referenceId: "release-allocation-s11" } as const; },
        async requestMaterialIssue(input) {
          return {
            accepted: true,
            referenceId: "issue-s11",
            acceptedQuantity: behavior.issueAcceptedQuantity ?? input.quantity,
          } as const;
        },
        async requestMaterialReturn(input) { return { accepted: true, referenceId: "return-s11", acceptedQuantity: input.quantity } as const; },
        async requestFinishedGoodsReceipt(input) { return { accepted: true, referenceId: "receipt-s11", acceptedQuantity: input.quantity } as const; },
        async requestWriteOff(input) { return { accepted: true, referenceId: "writeoff-s11", acceptedQuantity: input.quantity } as const; },
        async validateInventoryMovement() { return { valid: true } as const; },
        async validateLot() { return { valid: true } as const; },
        async validateSerial() { return { valid: true } as const; },
      },
    },
  });

  return {
    runtime,
    workOrders: runtime.services.require("manufacturing.service.work-order").value as ManufacturingWorkOrderService,
    runs: runtime.services.require("manufacturing.service.production-run").value as ProductionRunService,
    batches: runtime.services.require("manufacturing.service.production-batch").value as ProductionBatchService,
    productRefs: runtime.services.require("manufacturing.service.product-reference").value as ManufacturingProductReferenceService,
    routing: runtime.services.require("manufacturing.service.execution-routing").value as ExecutionRoutingService,
    operations: runtime.services.require("manufacturing.service.operation-execution").value as OperationExecutionService,
    materials: runtime.services.require("manufacturing.service.material-requirement").value as MaterialRequirementService,
    issues: runtime.services.require("manufacturing.service.material-issue").value as MaterialIssueService,
    consumption: runtime.services.require("manufacturing.service.material-consumption").value as MaterialConsumptionService,
    outputs: runtime.services.require("manufacturing.service.production-output").value as ProductionOutputService,
    scrap: runtime.services.require("manufacturing.service.scrap").value as ScrapService,
    rework: runtime.services.require("manufacturing.service.rework").value as ReworkService,
    workCenters: runtime.services.require("manufacturing.service.work-center").value as WorkCenterService,
    cells: runtime.services.require("manufacturing.service.production-cell").value as ProductionCellService,
    machines: runtime.services.require("manufacturing.service.machine-assignment").value as MachineAssignmentService,
    tools: runtime.services.require("manufacturing.service.tool-assignment").value as ToolAssignmentService,
    labor: runtime.services.require("manufacturing.service.labor-assignment").value as LaborAssignmentService,
    downtime: runtime.services.require("manufacturing.service.downtime").value as DowntimeService,
    exceptions: runtime.services.require("manufacturing.service.execution-exception").value as ExecutionExceptionService,
    traceability: runtime.services.require("manufacturing.service.traceability").value as ManufacturingTraceabilityService,
    resultQueries: runtime.services.require("manufacturing.query.production-result").value as ManufacturingProductionResultQueryService,
    materialQueries: runtime.services.require("manufacturing.query.material-execution").value as ManufacturingMaterialExecutionQueryService,
    resourceQueries: runtime.services.require("manufacturing.query.resource").value as ManufacturingResourceQueryService,
    observabilityQueries: runtime.services.require("manufacturing.query.observation").value as ManufacturingObservabilityQueryService,
  };
}

describe("GMDT-1001-S11 integrated hardening and certification readiness", () => {
  it("distinguishes durable readiness from ephemeral mode truthfully", async () => {
    const ephemeral = await createRuntime();
    const ephemeralReadiness = ephemeral.observabilityQueries.getManufacturingRuntimeReadiness();
    const ephemeralHealth = await ephemeral.observabilityQueries.getManufacturingHealth();

    expect(ephemeralReadiness.ready).toBe(true);
    expect(ephemeralReadiness.durableReadiness).toBe(false);
    expect(ephemeralReadiness.durablePersistenceConfigured).toBe(false);
    expect(ephemeralReadiness.durabilityMode).toBe("EPHEMERAL_UNCONFIGURED");
    expect(ephemeralHealth.checks.find((check) => check.subsystem === "persistence-durability-mode")?.reasonCode).toBe("PERSISTENCE_EPHEMERAL_MODE");

    await ephemeral.runtime.stop();

    const rootDir = await mkdtemp(join(tmpdir(), "gmdt-s11-durable-"));
    const durable = await createRuntime(rootDir);
    const durableReadiness = durable.observabilityQueries.getManufacturingRuntimeReadiness();
    const durableHealth = await durable.observabilityQueries.getManufacturingHealth();

    expect(durableReadiness.ready).toBe(true);
    expect(durableReadiness.durableReadiness).toBe(true);
    expect(durableReadiness.durablePersistenceConfigured).toBe(true);
    expect(durableReadiness.durabilityMode).toBe("DURABLE_CONFIGURED");
    expect(durableHealth.checks.find((check) => check.subsystem === "persistence-durability-mode")?.status).toBe("PASS");

    await durable.runtime.stop();
    await rm(rootDir, { recursive: true, force: true });
  });

  it("restores representative S1-S10 manufacturing artifacts across restart with idempotency and reconciliation evidence", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gmdt-s11-integrated-"));
    const first = await createRuntime(rootDir);

    const created = await first.workOrders.createWorkOrder(createWorkOrder());
    const run = await first.runs.createProductionRun({
      productionRunId: id("run-s11-001", "ProductionRunId"),
      runCode: id("RUN-S11-001", "RunCode"),
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      expectedVersion: 0,
      idempotencyKey: id("idem-s11-run-001", "IdempotencyKey"),
      correlationId: id("corr-s11-run-001", "CorrelationIdentifier"),
    });

    const batch = await first.batches.createProductionBatch({
      productionBatchId: id("batch-s11-001", "ProductionBatchId"),
      batchCode: id("BATCH-S11-001", "BatchCode"),
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      productionRunId: run.run.productionRunId,
      expectedVersion: 0,
      idempotencyKey: id("idem-s11-batch-001", "IdempotencyKey"),
      correlationId: id("corr-s11-batch-001", "CorrelationIdentifier"),
    });

    const validated = await first.productRefs.validateProductBaseline({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      expectedVersion: created.workOrder.version,
      productRef: created.workOrder.productRef,
      productVariantRef: created.workOrder.productVariantRef,
      productVersionRef: created.workOrder.productVersionRef,
      productBomRef: created.workOrder.productBomRef,
      designRoutingReference: "prod-routing-s11",
      idempotencyKey: id("idem-s11-baseline-validate", "IdempotencyKey"),
      correlationId: id("corr-s11-baseline-validate", "CorrelationIdentifier"),
    });

    const frozen = await first.productRefs.freezeProductBaseline({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      expectedVersion: validated.version,
      idempotencyKey: id("idem-s11-baseline-freeze", "IdempotencyKey"),
      correlationId: id("corr-s11-baseline-freeze", "CorrelationIdentifier"),
    });

    const createdRouting = await first.routing.createExecutionRouting(
      createRoutingCommand({
        tenantId: created.workOrder.tenantId,
        workOrderId: created.workOrder.manufacturingWorkOrderId,
        expectedWorkOrderVersion: frozen.version,
        routingId: "routing-s11-001",
      }),
    );

    const operations = await first.operations.initializeOperations({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      executionRoutingId: createdRouting.routing.executionRoutingId,
      expectedRoutingVersion: createdRouting.routing.version,
      idempotencyKey: id("idem-s11-op-init", "IdempotencyKey"),
      correlationId: id("corr-s11-op-init", "CorrelationIdentifier"),
    });
    const op1 = operations.find((entry) => entry.execution.operationExecutionId === id("opexec-s11-001", "OperationExecutionId"))!;
    const op2 = operations.find((entry) => entry.execution.operationExecutionId === id("opexec-s11-002", "OperationExecutionId"))!;

    const requirements = await first.materials.deriveMaterialRequirements({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      expectedWorkOrderVersion: frozen.version + 1,
      idempotencyKey: id("idem-s11-mr-derive", "IdempotencyKey"),
      correlationId: id("corr-s11-mr-derive", "CorrelationIdentifier"),
      bomLines: [
        {
          bomLineId: "bom-line-s11-01",
          inventoryItemRef: { tenantId: created.workOrder.tenantId, inventoryItemId: "inv-s11-rm-01" },
          quantityPerUnit: 1,
          unitOfMeasure: "EA",
          requiredByRoutingStepId: "step-s11-001",
        },
      ],
    });
    const requirement = requirements.requirements[0]!;

    const issued = await first.issues.issueMaterial({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      materialRequirementId: requirement.materialRequirementId,
      inventoryItemRef: requirement.inventoryItemRef!,
      quantity: 6,
      unitOfMeasure: requirement.unitOfMeasure,
      idempotencyKey: id("idem-s11-issue-001", "IdempotencyKey"),
      correlationId: id("corr-s11-issue-001", "CorrelationIdentifier"),
    });
    const issueReplay = await first.issues.issueMaterial({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      materialRequirementId: requirement.materialRequirementId,
      inventoryItemRef: requirement.inventoryItemRef!,
      quantity: 6,
      unitOfMeasure: requirement.unitOfMeasure,
      idempotencyKey: id("idem-s11-issue-001", "IdempotencyKey"),
      correlationId: id("corr-s11-issue-001", "CorrelationIdentifier"),
    });
    expect(issueReplay.materialIssueRequestId).toBe(issued.materialIssueRequestId);

    await expect(
      first.issues.issueMaterial({
        tenantId: created.workOrder.tenantId,
        workOrderId: created.workOrder.manufacturingWorkOrderId,
        materialRequirementId: requirement.materialRequirementId,
        inventoryItemRef: requirement.inventoryItemRef!,
        quantity: 5,
        unitOfMeasure: requirement.unitOfMeasure,
        idempotencyKey: id("idem-s11-issue-001", "IdempotencyKey"),
        correlationId: id("corr-s11-issue-conflict", "CorrelationIdentifier"),
      }),
    ).rejects.toMatchObject({ classification: "CONFLICTING_IDEMPOTENCY_PAYLOAD" });

    await first.consumption.recordConsumption({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      operationExecutionId: op1.execution.operationExecutionId,
      materialRequirementId: requirement.materialRequirementId,
      consumedQuantity: 5,
      unitOfMeasure: requirement.unitOfMeasure,
      inventoryMovementId: "move-s11-001",
      idempotencyKey: id("idem-s11-consume-001", "IdempotencyKey"),
      correlationId: id("corr-s11-consume-001", "CorrelationIdentifier"),
    });

    const planningVersion = first.workOrders.getExecutionState(
      created.workOrder.tenantId,
      created.workOrder.manufacturingWorkOrderId,
    ).version;

    const planned = await first.workOrders.planWorkOrder({
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      tenantId: created.workOrder.tenantId,
      expectedVersion: planningVersion,
      productBaselineState: "FROZEN",
      readinessEvidence: {
        productBaselineReady: true,
        routingReady: true,
        materialsReady: true,
        resourcesReady: true,
      },
      idempotencyKey: id("idem-s11-plan", "IdempotencyKey"),
      correlationId: id("corr-s11-plan", "CorrelationIdentifier"),
    });

    const released = await first.workOrders.releaseWorkOrder({
      workOrderId: planned.workOrder.manufacturingWorkOrderId,
      tenantId: planned.workOrder.tenantId,
      expectedVersion: planned.workOrder.version,
      idempotencyKey: id("idem-s11-release", "IdempotencyKey"),
      correlationId: id("corr-s11-release", "CorrelationIdentifier"),
    });

    const onHold = await first.workOrders.placeOnHoldWorkOrder({
      workOrderId: released.workOrder.manufacturingWorkOrderId,
      tenantId: released.workOrder.tenantId,
      expectedVersion: released.workOrder.version,
      idempotencyKey: id("idem-s11-hold", "IdempotencyKey"),
      correlationId: id("corr-s11-hold", "CorrelationIdentifier"),
    });

    const ready = await first.workOrders.releaseHoldWorkOrder({
      workOrderId: onHold.workOrder.manufacturingWorkOrderId,
      tenantId: onHold.workOrder.tenantId,
      expectedVersion: onHold.workOrder.version,
      idempotencyKey: id("idem-s11-ready", "IdempotencyKey"),
      correlationId: id("corr-s11-ready", "CorrelationIdentifier"),
    });

    const startedWorkOrder = await first.workOrders.startWorkOrderExecution({
      workOrderId: ready.workOrder.manufacturingWorkOrderId,
      tenantId: ready.workOrder.tenantId,
      expectedVersion: ready.workOrder.version,
      idempotencyKey: id("idem-s11-wo-start", "IdempotencyKey"),
      correlationId: id("corr-s11-wo-start", "CorrelationIdentifier"),
    });
    const currentWorkOrderVersion = () =>
      first.workOrders.getExecutionState(created.workOrder.tenantId, created.workOrder.manufacturingWorkOrderId).version;

    const wc = await first.workCenters.registerWorkCenter({
      tenantId: created.workOrder.tenantId,
      workCenterId: id("wc-s11-001", "WorkCenterId"),
      workCenterCode: id("WCS11-001", "WorkCenterCode"),
      displayName: "Assembly Center S11",
      status: "ACTIVE",
      capacityMetadata: { capacityUnits: 1, machineCapacity: 1, toolCapacity: 1, laborCapacity: 1 },
      idempotencyKey: id("idem-s11-wc", "IdempotencyKey"),
      correlationId: id("corr-s11-wc", "CorrelationIdentifier"),
    });

    const cell = await first.cells.registerProductionCell({
      tenantId: created.workOrder.tenantId,
      productionCellId: id("pc-s11-001", "ProductionCellId"),
      productionCellCode: id("PCS11-001", "ProductionCellCode"),
      displayName: "Assembly Cell S11",
      workCenterId: wc.workCenterId,
      status: "ACTIVE",
      capacityMetadata: { capacityUnits: 1, machineCapacity: 1, toolCapacity: 1, laborCapacity: 1 },
      idempotencyKey: id("idem-s11-pc", "IdempotencyKey"),
      correlationId: id("corr-s11-pc", "CorrelationIdentifier"),
    });

    await first.machines.assignMachine({
      tenantId: created.workOrder.tenantId,
      machineAssignmentId: id("ma-s11-001", "MachineAssignmentId"),
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      operationExecutionId: op1.execution.operationExecutionId,
      workCenterId: wc.workCenterId,
      productionCellId: cell.productionCellId,
      machineRef: { tenantId: created.workOrder.tenantId, assetId: id("asset-machine-s11", "AssetIdentifier") },
      expectedWorkOrderVersion: currentWorkOrderVersion(),
      expectedOperationVersion: op1.execution.version,
      idempotencyKey: id("idem-s11-ma", "IdempotencyKey"),
      correlationId: id("corr-s11-ma", "CorrelationIdentifier"),
    });

    await first.tools.assignTool({
      tenantId: created.workOrder.tenantId,
      toolAssignmentId: id("ta-s11-001", "ToolAssignmentId"),
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      operationExecutionId: op1.execution.operationExecutionId,
      workCenterId: wc.workCenterId,
      productionCellId: cell.productionCellId,
      toolRef: { tenantId: created.workOrder.tenantId, assetId: id("asset-tool-s11", "AssetIdentifier") },
      expectedWorkOrderVersion: currentWorkOrderVersion(),
      expectedOperationVersion: op1.execution.version,
      idempotencyKey: id("idem-s11-ta", "IdempotencyKey"),
      correlationId: id("corr-s11-ta", "CorrelationIdentifier"),
    });

    await first.labor.assignLabor({
      tenantId: created.workOrder.tenantId,
      laborAssignmentId: id("la-s11-001", "LaborAssignmentId"),
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      operationExecutionId: op1.execution.operationExecutionId,
      workCenterId: wc.workCenterId,
      productionCellId: cell.productionCellId,
      laborRef: { tenantId: created.workOrder.tenantId, personOrContactId: id("person-s11", "PersonOrContactIdentifier") },
      roleCode: "OPERATOR",
      expectedWorkOrderVersion: currentWorkOrderVersion(),
      expectedOperationVersion: op1.execution.version,
      idempotencyKey: id("idem-s11-la", "IdempotencyKey"),
      correlationId: id("corr-s11-la", "CorrelationIdentifier"),
    });

    const startedDowntime = await first.downtime.startDowntime({
      tenantId: created.workOrder.tenantId,
      downtimeRecordId: id("dt-s11-001", "DowntimeRecordId"),
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      operationExecutionId: op1.execution.operationExecutionId,
      startedAt: "2026-08-10T01:00:00.000Z",
      reasonCode: "MACHINE_FAULT",
      category: "UNPLANNED",
      expectedWorkOrderVersion: currentWorkOrderVersion(),
      idempotencyKey: id("idem-s11-dt-start", "IdempotencyKey"),
      correlationId: id("corr-s11-dt-start", "CorrelationIdentifier"),
    });

    await first.downtime.endDowntime({
      tenantId: created.workOrder.tenantId,
      downtimeRecordId: startedDowntime.downtimeRecordId,
      endedAt: "2026-08-10T01:35:00.000Z",
      expectedVersion: startedDowntime.version,
      idempotencyKey: id("idem-s11-dt-end", "IdempotencyKey"),
      correlationId: id("corr-s11-dt-end", "CorrelationIdentifier"),
    });

    const opened = await first.exceptions.openException({
      tenantId: created.workOrder.tenantId,
      executionExceptionId: id("ex-s11-001", "ExecutionExceptionId"),
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      operationExecutionId: op1.execution.operationExecutionId,
      category: "QUALITY",
      severity: "MEDIUM",
      reason: "inspection required",
      expectedWorkOrderVersion: currentWorkOrderVersion(),
      idempotencyKey: id("idem-s11-ex-open", "IdempotencyKey"),
      correlationId: id("corr-s11-ex-open", "CorrelationIdentifier"),
    });

    await first.exceptions.closeException({
      tenantId: created.workOrder.tenantId,
      executionExceptionId: opened.executionExceptionId,
      expectedVersion: opened.version,
      idempotencyKey: id("idem-s11-ex-close", "IdempotencyKey"),
      correlationId: id("corr-s11-ex-close", "CorrelationIdentifier"),
    });

    const startedOperation = await first.operations.startOperation({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      executionRoutingId: createdRouting.routing.executionRoutingId,
      operationExecutionId: op1.execution.operationExecutionId,
      expectedVersion: op1.execution.version,
      idempotencyKey: id("idem-s11-op-start", "IdempotencyKey"),
      correlationId: id("corr-s11-op-start", "CorrelationIdentifier"),
    });
    const currentOp1Version = () =>
      first.operations.getOperationExecution(created.workOrder.tenantId, op1.execution.operationExecutionId as string)!.execution.version;
    const currentOp2Version = () =>
      first.operations.getOperationExecution(created.workOrder.tenantId, op2.execution.operationExecutionId as string)!.execution.version;

    await first.outputs.recordProductionOutput({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      operationExecutionId: op1.execution.operationExecutionId,
      productRef: created.workOrder.productRef,
      productVariantRef: created.workOrder.productVariantRef,
      productVersionRef: created.workOrder.productVersionRef,
      inventoryItemRef: { tenantId: created.workOrder.tenantId, inventoryItemId: id("inv-s11-fg", "InventoryItemId") },
      quantity: 4,
      unitOfMeasure: created.workOrder.plannedQuantity.unitOfMeasure,
      disposition: "FINISHED",
      inventoryReceiptRequired: true,
      expectedWorkOrderVersion: currentWorkOrderVersion(),
      expectedOperationVersion: currentOp1Version(),
      idempotencyKey: id("idem-s11-output-001", "IdempotencyKey"),
      correlationId: id("corr-s11-output-001", "CorrelationIdentifier"),
    });

    await first.scrap.recordScrap({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      operationExecutionId: op1.execution.operationExecutionId,
      inventoryItemRef: { tenantId: created.workOrder.tenantId, inventoryItemId: id("inv-s11-scrap", "InventoryItemId") },
      quantity: 1,
      unitOfMeasure: created.workOrder.plannedQuantity.unitOfMeasure,
      reasonCode: "QUALITY_FAIL",
      requestInventoryWriteOff: true,
      expectedWorkOrderVersion: currentWorkOrderVersion(),
      expectedOperationVersion: currentOp1Version(),
      idempotencyKey: id("idem-s11-scrap-001", "IdempotencyKey"),
      correlationId: id("corr-s11-scrap-001", "CorrelationIdentifier"),
    });

    const completedOperation = await first.operations.completeOperation({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      executionRoutingId: createdRouting.routing.executionRoutingId,
      operationExecutionId: op1.execution.operationExecutionId,
      expectedVersion: currentOp1Version(),
      idempotencyKey: id("idem-s11-op-complete", "IdempotencyKey"),
      correlationId: id("corr-s11-op-complete", "CorrelationIdentifier"),
    });

    await first.rework.createRework({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      sourceOperationExecutionId: op1.execution.operationExecutionId,
      targetOperationExecutionId: op2.execution.operationExecutionId,
      quantity: 1,
      unitOfMeasure: created.workOrder.plannedQuantity.unitOfMeasure,
      reasonCode: "REWORK_EDGE",
      expectedSourceOperationVersion: completedOperation.execution.version,
      expectedTargetOperationVersion: currentOp2Version(),
      expectedWorkOrderVersion: currentWorkOrderVersion(),
      idempotencyKey: id("idem-s11-rework-001", "IdempotencyKey"),
      correlationId: id("corr-s11-rework-001", "CorrelationIdentifier"),
    });

    await first.traceability.appendTrace({
      tenantId: created.workOrder.tenantId,
      productionTraceId: id("trace-s11-001", "ProductionTraceId"),
      sourceType: "WORK_ORDER",
      sourceId: created.workOrder.manufacturingWorkOrderId,
      targetType: "PRODUCT_VERSION",
      targetId: created.workOrder.productVersionRef.productVersionId,
      relationType: "WORK_ORDER_PRODUCT_BASELINE",
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      idempotencyKey: id("idem-s11-trace-001", "IdempotencyKey"),
      correlationId: id("corr-s11-trace-001", "CorrelationIdentifier"),
    });

    await first.traceability.appendTrace({
      tenantId: created.workOrder.tenantId,
      productionTraceId: id("trace-s11-002", "ProductionTraceId"),
      sourceType: "WORK_ORDER",
      sourceId: created.workOrder.manufacturingWorkOrderId,
      targetType: "PRODUCTION_RUN",
      targetId: run.run.productionRunId as string,
      relationType: "WORK_ORDER_RUN",
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      idempotencyKey: id("idem-s11-trace-002", "IdempotencyKey"),
      correlationId: id("corr-s11-trace-002", "CorrelationIdentifier"),
    });

    await first.traceability.appendTrace({
      tenantId: created.workOrder.tenantId,
      productionTraceId: id("trace-s11-003", "ProductionTraceId"),
      sourceType: "WORK_ORDER",
      sourceId: created.workOrder.manufacturingWorkOrderId,
      targetType: "PRODUCTION_BATCH",
      targetId: batch.batch.productionBatchId as string,
      relationType: "WORK_ORDER_BATCH",
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      idempotencyKey: id("idem-s11-trace-003", "IdempotencyKey"),
      correlationId: id("corr-s11-trace-003", "CorrelationIdentifier"),
    });

    const materialSummary = first.materialQueries.getMaterialExecutionSummary(
      created.workOrder.tenantId,
      requirement.materialRequirementId as string,
    );
    expect(materialSummary.reconciliationRequired).toBe(false);

    await first.runtime.stop();

    const restarted = await createRuntime(rootDir);
    const recoveredWorkOrder = restarted.workOrders.require(created.workOrder.tenantId, created.workOrder.manufacturingWorkOrderId);
    expect(recoveredWorkOrder.productBaselineState).toBe("FROZEN");
    expect(restarted.runs.listProductionRuns(created.workOrder.tenantId)).toHaveLength(1);
    expect(restarted.batches.listProductionBatches(created.workOrder.tenantId)).toHaveLength(1);
    expect(restarted.routing.getExecutionRouting(created.workOrder.tenantId, createdRouting.routing.executionRoutingId as string)).toBeDefined();
    expect(restarted.operations.listOperationsByWorkOrder(created.workOrder.tenantId, created.workOrder.manufacturingWorkOrderId).length).toBe(2);
    expect(restarted.materials.listMaterialRequirements(created.workOrder.tenantId)).toHaveLength(1);
    expect(restarted.issues.listIssueRecordsByRequirement(created.workOrder.tenantId, requirement.materialRequirementId as string)).toHaveLength(1);
    expect(restarted.consumption.listConsumptionRecordsByRequirement(created.workOrder.tenantId, requirement.materialRequirementId as string)).toHaveLength(1);
    expect(restarted.resultQueries.listProductionOutputs(created.workOrder.tenantId)).toHaveLength(1);
    expect(restarted.resultQueries.listScrapByWorkOrder(created.workOrder.tenantId, created.workOrder.manufacturingWorkOrderId)).toHaveLength(1);
    expect(restarted.resultQueries.listReworkByWorkOrder(created.workOrder.tenantId, created.workOrder.manufacturingWorkOrderId)).toHaveLength(1);
    expect(restarted.resourceQueries.listWorkCenters(created.workOrder.tenantId)).toHaveLength(1);
    expect(restarted.resourceQueries.listProductionCells(created.workOrder.tenantId)).toHaveLength(1);
    expect(restarted.resourceQueries.listMachineAssignments(created.workOrder.tenantId)).toHaveLength(1);
    expect(restarted.resourceQueries.listLaborAssignmentsByOperation(created.workOrder.tenantId, op1.execution.operationExecutionId as string)).toHaveLength(1);
    expect(restarted.resourceQueries.listDowntimeByOperation(created.workOrder.tenantId, op1.execution.operationExecutionId as string)).toHaveLength(1);
    expect(restarted.resourceQueries.listExecutionExceptions(created.workOrder.tenantId).find((item) => item.executionExceptionId === opened.executionExceptionId)?.status).toBe("CLOSED");
    expect(restarted.traceability.listProductionTrace(created.workOrder.tenantId)).toHaveLength(3);

    const recoveredReadiness = restarted.observabilityQueries.getManufacturingRuntimeReadiness();
    expect(recoveredReadiness.durableReadiness).toBe(true);

    await restarted.runtime.stop();
    await rm(rootDir, { recursive: true, force: true });
  });

  it("models persistence save-success audit as post-commit volatile evidence until durable checkpoint", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gmdt-s11-audit-"));
    const runtime = await createRuntime(rootDir);

    const created = await runtime.workOrders.createWorkOrder(createWorkOrder(id("tenant-s11-audit", "TenantId"), "audit"));
    void created;

    const inMemorySaveSuccess = runtime.observabilityQueries
      .listManufacturingAuditEvents()
      .filter((event) => event.record.eventType === "manufacturing.persistence.save.succeeded");
    expect(inMemorySaveSuccess.length).toBeGreaterThan(0);
    expect(inMemorySaveSuccess[inMemorySaveSuccess.length - 1]?.record.details?.checkpointDurability).toBe(
      "POST_COMMIT_VOLATILE_UNTIL_NEXT_DURABLE_CHECKPOINT",
    );

    const manifestBeforeStop = JSON.parse(await readFile(join(rootDir, "manufacturing-manifest.json"), "utf8")) as {
      runtimeState: { auditEvents: Array<{ eventType: string }> };
    };
    expect(
      manifestBeforeStop.runtimeState.auditEvents.some((event) => event.eventType === "manufacturing.persistence.save.succeeded"),
    ).toBe(false);

    await runtime.runtime.stop();

    const recovered = await createRuntime(rootDir);
    const recoveredSaveSuccess = recovered.observabilityQueries
      .listManufacturingAuditEvents()
      .filter((event) => event.record.eventType === "manufacturing.persistence.save.succeeded");
    expect(recoveredSaveSuccess.length).toBeGreaterThan(0);

    await recovered.runtime.stop();
    await rm(rootDir, { recursive: true, force: true });
  });

  it("persists reconciliation-required evidence across restart when external accept/local commit diverges", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gmdt-s11-reconcile-"));
    const first = await createRuntime(rootDir, { issueAcceptedQuantity: -1 });

    const created = await first.workOrders.createWorkOrder(createWorkOrder(id("tenant-s11-reconcile", "TenantId"), "recon"));
    const validated = await first.productRefs.validateProductBaseline({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      expectedVersion: created.workOrder.version,
      productRef: created.workOrder.productRef,
      productVariantRef: created.workOrder.productVariantRef,
      productVersionRef: created.workOrder.productVersionRef,
      productBomRef: created.workOrder.productBomRef,
      designRoutingReference: "prod-routing-s11",
      idempotencyKey: id("idem-s11-recon-baseline", "IdempotencyKey"),
      correlationId: id("corr-s11-recon-baseline", "CorrelationIdentifier"),
    });

    const frozen = await first.productRefs.freezeProductBaseline({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      expectedVersion: validated.version,
      idempotencyKey: id("idem-s11-recon-freeze", "IdempotencyKey"),
      correlationId: id("corr-s11-recon-freeze", "CorrelationIdentifier"),
    });

    await first.routing.createExecutionRouting(
      createRoutingCommand({
        tenantId: created.workOrder.tenantId,
        workOrderId: created.workOrder.manufacturingWorkOrderId,
        expectedWorkOrderVersion: frozen.version,
        routingId: "routing-s11-recon",
      }),
    );

    const derived = await first.materials.deriveMaterialRequirements({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      expectedWorkOrderVersion: frozen.version + 1,
      idempotencyKey: id("idem-s11-recon-derive", "IdempotencyKey"),
      correlationId: id("corr-s11-recon-derive", "CorrelationIdentifier"),
      bomLines: [
        {
          bomLineId: "bom-line-s11-recon",
          inventoryItemRef: { tenantId: created.workOrder.tenantId, inventoryItemId: "inv-s11-recon" },
          quantityPerUnit: 1,
          unitOfMeasure: "EA",
          requiredByRoutingStepId: "step-s11-001",
        },
      ],
    });

    await expect(
      first.issues.issueMaterial({
        tenantId: created.workOrder.tenantId,
        workOrderId: created.workOrder.manufacturingWorkOrderId,
        materialRequirementId: derived.requirements[0]!.materialRequirementId,
        inventoryItemRef: derived.requirements[0]!.inventoryItemRef!,
        quantity: 1,
        unitOfMeasure: derived.requirements[0]!.unitOfMeasure,
        idempotencyKey: id("idem-s11-recon-issue", "IdempotencyKey"),
        correlationId: id("corr-s11-recon-issue", "CorrelationIdentifier"),
      }),
    ).rejects.toMatchObject({ classification: "MATERIAL_ISSUE_REQUIRES_RECONCILIATION" });

    const summaryBefore = first.materialQueries.getMaterialExecutionSummary(
      created.workOrder.tenantId,
      derived.requirements[0]!.materialRequirementId as string,
    );
    expect(summaryBefore.reconciliationRequired).toBe(true);

    await first.runtime.stop();

    const second = await createRuntime(rootDir);
    const summaryAfter = second.materialQueries.getMaterialExecutionSummary(
      created.workOrder.tenantId,
      derived.requirements[0]!.materialRequirementId as string,
    );
    expect(summaryAfter.reconciliationRequired).toBe(true);

    await second.runtime.stop();
    await rm(rootDir, { recursive: true, force: true });
  });
});
