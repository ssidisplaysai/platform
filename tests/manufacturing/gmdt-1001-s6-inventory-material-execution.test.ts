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
  type ManufacturingMaterialExecutionQueryService,
  type ManufacturingMaterialQueryService,
  type ManufacturingProductReferenceService,
  type ManufacturingWorkOrderService,
  type MaterialConsumptionService,
  type MaterialIssueService,
  type MaterialRequirementService,
} from "@/platform/manufacturing";

function id<T extends Parameters<typeof createManufacturingIdentifier>[1]>(value: string, brand: T) {
  return createManufacturingIdentifier(value, brand);
}

type InventoryBehavior = Readonly<{
  issueAcceptedQuantity?: number;
  rejectReturn?: boolean;
  invalidMovement?: boolean;
}>;

function createBaseWorkOrder(tenantId = id("tenant-006", "TenantId"), suffix = "001"): CreateManufacturingWorkOrder {
  const unit = createUnitOfMeasure("EA");
  return {
    workOrderId: id(`wo-s6-${suffix}`, "ManufacturingWorkOrderId"),
    workOrderNumber: id(`WO-S6-${suffix}`, "WorkOrderNumber"),
    tenantId,
    productRef: { tenantId, productId: id(`prod-s6-${suffix}`, "ProductIdentifier") },
    productVariantRef: { tenantId, productVariantId: id(`var-s6-${suffix}`, "ProductVariantIdentifier") },
    productVersionRef: { tenantId, productVersionId: id(`pv-s6-${suffix}`, "ProductVersionIdentifier") },
    productBomRef: {
      tenantId,
      productBomId: id(`bom-s6-${suffix}`, "ProductBomIdentifier"),
      bomVersion: id("1.0.0", "VersionIdentifier"),
    },
    requestedQuantity: createRequestedQuantity(10, unit),
    plannedQuantity: createPlannedQuantity(10, unit),
    priority: "HIGH",
    idempotencyKey: id(`idem-s6-wo-${suffix}`, "IdempotencyKey"),
    correlationId: id(`corr-s6-wo-${suffix}`, "CorrelationIdentifier"),
    command: {
      commandId: `cmd-s6-wo-${suffix}`,
      expectedVersion: 0,
      requestedAt: "2026-08-09T00:00:00.000Z",
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
    sourceRoutingReference: id("prod-routing-s6", "ProductRoutingReferenceId"),
    sourceProductVersionRef: { tenantId: input.tenantId, productVersionId: id("pv-s6-001", "ProductVersionIdentifier") },
    sourceBomRef: {
      tenantId: input.tenantId,
      productBomId: id("bom-s6-001", "ProductBomIdentifier"),
      bomVersion: id("1.0.0", "VersionIdentifier"),
    },
    steps: [
      {
        routingStepId: id("step-s6-001", "RoutingStepId"),
        operationExecutionId: id("opexec-s6-001", "OperationExecutionId"),
        operationCode: id("OP-S6-001", "OperationCode"),
        routingStepCode: id("STEP-S6-001", "RoutingStepCode"),
        sequenceNumber: createSequenceNumber(10),
        predecessorStepIds: [],
        successorStepIds: [],
        conditionalEligibility: { state: "ELIGIBLE" as const },
        explicitReworkEdges: [],
        reworkStepIds: [],
        conditionalStepIds: [],
        executionState: { readiness: "READY" as const, operationState: "READY" as const },
        tenantId: input.tenantId,
      },
    ],
    expectedWorkOrderVersion: input.expectedWorkOrderVersion,
    expectedVersion: 0,
    idempotencyKey: id(`idem-s6-routing-${input.routingId}`, "IdempotencyKey"),
    correlationId: id(`corr-s6-routing-${input.routingId}`, "CorrelationIdentifier"),
  };
}

async function createRuntime(behavior: InventoryBehavior = {}) {
  const dependencies = createDefaultManufacturingRuntimeDependencies();
  const runtime = await createManufacturingRuntime({
    runtimeId: "manufacturing-runtime-s6-test",
    dependencies,
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
          return { accepted: true, referenceId: "reservation-s6" } as const;
        },
        async requestAllocation() {
          return { accepted: true, referenceId: "allocation-s6" } as const;
        },
        async releaseReservation() {
          return { accepted: true, referenceId: "release-reservation-s6" } as const;
        },
        async releaseAllocation() {
          return { accepted: true, referenceId: "release-allocation-s6" } as const;
        },
        async requestMaterialIssue(input) {
          return {
            accepted: true,
            referenceId: "issue-s6",
            acceptedQuantity: behavior.issueAcceptedQuantity ?? input.quantity,
          } as const;
        },
        async requestMaterialReturn() {
          if (behavior.rejectReturn) {
            return { accepted: false, reason: "return rejected" } as const;
          }
          return { accepted: true, referenceId: "return-s6" } as const;
        },
        async requestFinishedGoodsReceipt() {
          return { accepted: true, referenceId: "receipt-s6" } as const;
        },
        async requestWriteOff() {
          return { accepted: true, referenceId: "writeoff-s6" } as const;
        },
        async validateInventoryMovement() {
          if (behavior.invalidMovement) {
            return { valid: false, reason: "movement missing" } as const;
          }
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
  const materials = runtime.services.require("manufacturing.service.material-requirement").value as MaterialRequirementService;
  const materialQueries = runtime.services.require("manufacturing.query.material").value as ManufacturingMaterialQueryService;
  const issueService = runtime.services.require("manufacturing.service.material-issue").value as MaterialIssueService;
  const consumptionService = runtime.services.require(
    "manufacturing.service.material-consumption",
  ).value as MaterialConsumptionService;
  const executionQueries = runtime.services.require(
    "manufacturing.query.material-execution",
  ).value as ManufacturingMaterialExecutionQueryService;
  const routing = runtime.services.require("manufacturing.service.execution-routing").value as {
    createExecutionRouting: (input: CreateExecutionRouting) => Promise<{ routing: { version: number } }>;
  };

  const created = await workOrders.createWorkOrder(createBaseWorkOrder());
  const validated = await productRefs.validateProductBaseline({
    tenantId: created.workOrder.tenantId,
    workOrderId: created.workOrder.manufacturingWorkOrderId,
    expectedVersion: created.workOrder.version,
    productRef: created.workOrder.productRef,
    productVariantRef: created.workOrder.productVariantRef,
    productVersionRef: created.workOrder.productVersionRef,
    productBomRef: created.workOrder.productBomRef,
    designRoutingReference: "prod-routing-s6",
    idempotencyKey: id("idem-s6-baseline-validate", "IdempotencyKey"),
    correlationId: id("corr-s6-baseline-validate", "CorrelationIdentifier"),
  });
  const frozen = await productRefs.freezeProductBaseline({
    tenantId: created.workOrder.tenantId,
    workOrderId: created.workOrder.manufacturingWorkOrderId,
    expectedVersion: validated.version,
    idempotencyKey: id("idem-s6-baseline-freeze", "IdempotencyKey"),
    correlationId: id("corr-s6-baseline-freeze", "CorrelationIdentifier"),
  });

  await routing.createExecutionRouting(
    createRoutingCommand({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      expectedWorkOrderVersion: frozen.version,
      routingId: "routing-s6-001",
    }),
  );

  const stateAfterRouting = workOrders.getExecutionState(created.workOrder.tenantId, created.workOrder.manufacturingWorkOrderId);
  const derive = await materials.deriveMaterialRequirements({
    tenantId: created.workOrder.tenantId,
    workOrderId: created.workOrder.manufacturingWorkOrderId,
    expectedWorkOrderVersion: stateAfterRouting.version,
    idempotencyKey: id("idem-s6-material-derive", "IdempotencyKey"),
    correlationId: id("corr-s6-material-derive", "CorrelationIdentifier"),
    bomLines: [
      {
        bomLineId: "bom-line-s6-a",
        inventoryItemRef: { tenantId: created.workOrder.tenantId, inventoryItemId: "inv-s6-a" },
        quantityPerUnit: 1,
        unitOfMeasure: "EA",
        requiredByRoutingStepId: "step-s6-001",
      },
    ],
  });

  return {
    runtime,
    created,
    requirement: derive.requirements[0],
    workOrders,
    materialQueries,
    issueService,
    consumptionService,
    executionQueries,
  };
}

describe("GMDT-1001-S6 Inventory integration, issue, consumption, and return", () => {
  it("issues material, records consumption, processes return, and exposes deterministic execution summary", async () => {
    const { runtime, created, requirement, materialQueries, issueService, consumptionService, executionQueries } = await createRuntime();

    const firstIssue = await issueService.issueMaterial({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      materialRequirementId: requirement.materialRequirementId,
      inventoryItemRef: requirement.inventoryItemRef!,
      quantity: 6,
      unitOfMeasure: requirement.unitOfMeasure,
      idempotencyKey: id("idem-s6-issue-1", "IdempotencyKey"),
      correlationId: id("corr-s6-issue-1", "CorrelationIdentifier"),
    });
    expect(firstIssue.status).toBe("PARTIALLY_ISSUED");

    await issueService.issueMaterial({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      materialRequirementId: requirement.materialRequirementId,
      inventoryItemRef: requirement.inventoryItemRef!,
      quantity: 4,
      unitOfMeasure: requirement.unitOfMeasure,
      idempotencyKey: id("idem-s6-issue-2", "IdempotencyKey"),
      correlationId: id("corr-s6-issue-2", "CorrelationIdentifier"),
    });

    await consumptionService.recordConsumption({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      operationExecutionId: id("opexec-s6-001", "OperationExecutionId"),
      materialRequirementId: requirement.materialRequirementId,
      consumedQuantity: 8,
      unitOfMeasure: requirement.unitOfMeasure,
      inventoryMovementId: "move-s6-001",
      idempotencyKey: id("idem-s6-consume-1", "IdempotencyKey"),
      correlationId: id("corr-s6-consume-1", "CorrelationIdentifier"),
    });

    await issueService.returnMaterial({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      materialRequirementId: requirement.materialRequirementId,
      inventoryItemRef: requirement.inventoryItemRef!,
      returnQuantity: 2,
      unitOfMeasure: requirement.unitOfMeasure,
      idempotencyKey: id("idem-s6-return-1", "IdempotencyKey"),
      correlationId: id("corr-s6-return-1", "CorrelationIdentifier"),
    });

    const readiness = materialQueries.getMaterialReadiness(created.workOrder.tenantId, created.workOrder.manufacturingWorkOrderId);
    expect(readiness.inventoryMaterialsReady).toBe(true);

    const summary = executionQueries.getMaterialExecutionSummary(created.workOrder.tenantId, requirement.materialRequirementId as string);
    expect(summary.requiredQuantity).toBe(10);
    expect(summary.issuedQuantity).toBe(10);
    expect(summary.consumedQuantity).toBe(8);
    expect(summary.returnedQuantity).toBe(2);
    expect(summary.remainingToIssue).toBe(0);
    expect(summary.remainingToConsume).toBe(2);
    expect(summary.reconciliationRequired).toBe(false);

    await runtime.stop();
  });

  it("enforces idempotency replay and rejects conflicting issue payload", async () => {
    const { runtime, created, requirement, issueService } = await createRuntime();

    const command = {
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      materialRequirementId: requirement.materialRequirementId,
      inventoryItemRef: requirement.inventoryItemRef!,
      quantity: 3,
      unitOfMeasure: requirement.unitOfMeasure,
      idempotencyKey: id("idem-s6-issue-replay", "IdempotencyKey"),
      correlationId: id("corr-s6-issue-replay", "CorrelationIdentifier"),
    };

    const first = await issueService.issueMaterial(command);
    const replay = await issueService.issueMaterial(command);
    expect(replay).toEqual(first);

    await expect(
      issueService.issueMaterial({
        ...command,
        quantity: 5,
      }),
    ).rejects.toMatchObject({ classification: "CONFLICTING_IDEMPOTENCY_PAYLOAD" });

    await runtime.stop();
  });

  it("rejects invalid movement validation before mutating consumption state", async () => {
    const { runtime, created, requirement, issueService, consumptionService, executionQueries } = await createRuntime({
      invalidMovement: true,
    });

    await issueService.issueMaterial({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      materialRequirementId: requirement.materialRequirementId,
      inventoryItemRef: requirement.inventoryItemRef!,
      quantity: 4,
      unitOfMeasure: requirement.unitOfMeasure,
      idempotencyKey: id("idem-s6-issue-before-move", "IdempotencyKey"),
      correlationId: id("corr-s6-issue-before-move", "CorrelationIdentifier"),
    });

    await expect(
      consumptionService.recordConsumption({
        tenantId: created.workOrder.tenantId,
        workOrderId: created.workOrder.manufacturingWorkOrderId,
        operationExecutionId: id("opexec-s6-001", "OperationExecutionId"),
        materialRequirementId: requirement.materialRequirementId,
        consumedQuantity: 1,
        unitOfMeasure: requirement.unitOfMeasure,
        inventoryMovementId: "move-invalid",
        idempotencyKey: id("idem-s6-consume-invalid-move", "IdempotencyKey"),
        correlationId: id("corr-s6-consume-invalid-move", "CorrelationIdentifier"),
      }),
    ).rejects.toMatchObject({ classification: "INVENTORY_MOVEMENT_INVALID" });

    const summary = executionQueries.getMaterialExecutionSummary(created.workOrder.tenantId, requirement.materialRequirementId as string);
    expect(summary.consumedQuantity).toBe(0);

    await runtime.stop();
  });

  it("rejects return request on external rejection and keeps local returned quantity unchanged", async () => {
    const { runtime, created, requirement, issueService, executionQueries } = await createRuntime({
      rejectReturn: true,
    });

    await issueService.issueMaterial({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      materialRequirementId: requirement.materialRequirementId,
      inventoryItemRef: requirement.inventoryItemRef!,
      quantity: 5,
      unitOfMeasure: requirement.unitOfMeasure,
      idempotencyKey: id("idem-s6-issue-before-return-reject", "IdempotencyKey"),
      correlationId: id("corr-s6-issue-before-return-reject", "CorrelationIdentifier"),
    });

    await expect(
      issueService.returnMaterial({
        tenantId: created.workOrder.tenantId,
        workOrderId: created.workOrder.manufacturingWorkOrderId,
        materialRequirementId: requirement.materialRequirementId,
        inventoryItemRef: requirement.inventoryItemRef!,
        returnQuantity: 1,
        unitOfMeasure: requirement.unitOfMeasure,
        idempotencyKey: id("idem-s6-return-rejected", "IdempotencyKey"),
        correlationId: id("corr-s6-return-rejected", "CorrelationIdentifier"),
      }),
    ).rejects.toMatchObject({ classification: "INVENTORY_RETURN_REJECTED" });

    const summary = executionQueries.getMaterialExecutionSummary(created.workOrder.tenantId, requirement.materialRequirementId as string);
    expect(summary.returnedQuantity).toBe(0);

    await runtime.stop();
  });

  it("marks reconciliation required when external issue accepts but local commit fails", async () => {
    const { runtime, created, requirement, issueService, executionQueries } = await createRuntime({
      issueAcceptedQuantity: -1,
    });

    await expect(
      issueService.issueMaterial({
        tenantId: created.workOrder.tenantId,
        workOrderId: created.workOrder.manufacturingWorkOrderId,
        materialRequirementId: requirement.materialRequirementId,
        inventoryItemRef: requirement.inventoryItemRef!,
        quantity: 2,
        unitOfMeasure: requirement.unitOfMeasure,
        idempotencyKey: id("idem-s6-issue-reconciliation", "IdempotencyKey"),
        correlationId: id("corr-s6-issue-reconciliation", "CorrelationIdentifier"),
      }),
    ).rejects.toMatchObject({ classification: "MATERIAL_ISSUE_REQUIRES_RECONCILIATION" });

    const summary = executionQueries.getMaterialExecutionSummary(created.workOrder.tenantId, requirement.materialRequirementId as string);
    expect(summary.reconciliationRequired).toBe(true);

    await runtime.stop();
  });
});
