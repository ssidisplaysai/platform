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
  type ManufacturingMaterialQueryService,
  type ManufacturingProductReferenceService,
  type ManufacturingWorkOrderService,
  type MaterialRequirementService,
} from "@/platform/manufacturing";

function id<T extends Parameters<typeof createManufacturingIdentifier>[1]>(value: string, brand: T) {
  return createManufacturingIdentifier(value, brand);
}

function createBaseWorkOrder(tenantId = id("tenant-005", "TenantId"), suffix = "001"): CreateManufacturingWorkOrder {
  const unit = createUnitOfMeasure("EA");
  return {
    workOrderId: id(`wo-s5-${suffix}`, "ManufacturingWorkOrderId"),
    workOrderNumber: id(`WO-S5-${suffix}`, "WorkOrderNumber"),
    tenantId,
    productRef: { tenantId, productId: id(`prod-s5-${suffix}`, "ProductIdentifier") },
    productVariantRef: { tenantId, productVariantId: id(`var-s5-${suffix}`, "ProductVariantIdentifier") },
    productVersionRef: { tenantId, productVersionId: id(`pv-s5-${suffix}`, "ProductVersionIdentifier") },
    productBomRef: {
      tenantId,
      productBomId: id(`bom-s5-${suffix}`, "ProductBomIdentifier"),
      bomVersion: id("1.0.0", "VersionIdentifier"),
    },
    requestedQuantity: createRequestedQuantity(12, unit),
    plannedQuantity: createPlannedQuantity(10, unit),
    priority: "HIGH",
    idempotencyKey: id(`idem-s5-wo-${suffix}`, "IdempotencyKey"),
    correlationId: id(`corr-s5-wo-${suffix}`, "CorrelationIdentifier"),
    command: {
      commandId: `cmd-s5-wo-${suffix}`,
      expectedVersion: 0,
      requestedAt: "2026-08-08T00:00:00.000Z",
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
    sourceRoutingReference: id("prod-routing-s5", "ProductRoutingReferenceId"),
    sourceProductVersionRef: { tenantId: input.tenantId, productVersionId: id("pv-s5-001", "ProductVersionIdentifier") },
    sourceBomRef: {
      tenantId: input.tenantId,
      productBomId: id("bom-s5-001", "ProductBomIdentifier"),
      bomVersion: id("1.0.0", "VersionIdentifier"),
    },
    steps: [
      {
        routingStepId: id("step-s5-001", "RoutingStepId"),
        operationExecutionId: id("opexec-s5-001", "OperationExecutionId"),
        operationCode: id("OP-S5-001", "OperationCode"),
        routingStepCode: id("STEP-S5-001", "RoutingStepCode"),
        sequenceNumber: createSequenceNumber(10),
        predecessorStepIds: [],
        successorStepIds: [id("step-s5-002", "RoutingStepId")],
        conditionalEligibility: { state: "ELIGIBLE" as const },
        explicitReworkEdges: [],
        reworkStepIds: [],
        conditionalStepIds: [],
        executionState: { readiness: "READY" as const, operationState: "READY" as const },
        tenantId: input.tenantId,
      },
      {
        routingStepId: id("step-s5-002", "RoutingStepId"),
        operationExecutionId: id("opexec-s5-002", "OperationExecutionId"),
        operationCode: id("OP-S5-002", "OperationCode"),
        routingStepCode: id("STEP-S5-002", "RoutingStepCode"),
        sequenceNumber: createSequenceNumber(20),
        predecessorStepIds: [id("step-s5-001", "RoutingStepId")],
        successorStepIds: [],
        conditionalEligibility: { state: "ELIGIBLE" as const },
        explicitReworkEdges: [],
        reworkStepIds: [],
        conditionalStepIds: [],
        executionState: { readiness: "BLOCKED" as const, operationState: "BLOCKED" as const },
        tenantId: input.tenantId,
      },
    ],
    expectedWorkOrderVersion: input.expectedWorkOrderVersion,
    expectedVersion: 0,
    idempotencyKey: id(`idem-s5-routing-${input.routingId}`, "IdempotencyKey"),
    correlationId: id(`corr-s5-routing-${input.routingId}`, "CorrelationIdentifier"),
  };
}

async function createRuntime(invalidBom = false) {
  const baseDependencies = createDefaultManufacturingRuntimeDependencies();
  const runtime = await createManufacturingRuntime({
    runtimeId: "manufacturing-runtime-s5-test",
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
          if (invalidBom) {
            return { valid: false, reason: "bom missing" } as const;
          }
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
          return { valid: true } as const;
        },
        async requestReservation() {
          return { accepted: true, referenceId: "reservation-s5" } as const;
        },
        async requestAllocation() {
          return { accepted: true, referenceId: "allocation-s5" } as const;
        },
        async releaseReservation() {
          return { accepted: true, referenceId: "release-reservation-s5" } as const;
        },
        async releaseAllocation() {
          return { accepted: true, referenceId: "release-allocation-s5" } as const;
        },
        async requestMaterialIssue() {
          return { accepted: true, referenceId: "issue-s5" } as const;
        },
        async requestMaterialReturn() {
          return { accepted: true, referenceId: "return-s5" } as const;
        },
        async requestFinishedGoodsReceipt() {
          return { accepted: true, referenceId: "receipt-s5" } as const;
        },
        async requestWriteOff() {
          return { accepted: true, referenceId: "writeoff-s5" } as const;
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
    materials: runtime.services.require("manufacturing.service.material-requirement").value as MaterialRequirementService,
    materialQueries: runtime.services.require("manufacturing.query.material").value as ManufacturingMaterialQueryService,
    routing: runtime.services.require("manufacturing.service.execution-routing").value as {
      createExecutionRouting: (input: CreateExecutionRouting) => Promise<{ routing: { version: number } }>;
    },
  };
}

describe("GMDT-1001-S5 Product/BOM integration and material requirements", () => {
  it("validates and freezes product baseline, then derives deterministic material requirements and updates readiness truthfully", async () => {
    const { runtime, workOrders, productRefs, materials, materialQueries, routing } = await createRuntime();
    const created = await workOrders.createWorkOrder(createBaseWorkOrder());

    const validated = await productRefs.validateProductBaseline({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      expectedVersion: created.workOrder.version,
      productRef: created.workOrder.productRef,
      productVariantRef: created.workOrder.productVariantRef,
      productVersionRef: created.workOrder.productVersionRef,
      productBomRef: created.workOrder.productBomRef,
      designRoutingReference: "prod-routing-s5",
      idempotencyKey: id("idem-s5-baseline-validate", "IdempotencyKey"),
      correlationId: id("corr-s5-baseline-validate", "CorrelationIdentifier"),
    });
    expect(validated.baselineState).toBe("VALIDATED");

    const frozen = await productRefs.freezeProductBaseline({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      expectedVersion: validated.version,
      idempotencyKey: id("idem-s5-baseline-freeze", "IdempotencyKey"),
      correlationId: id("corr-s5-baseline-freeze", "CorrelationIdentifier"),
    });
    expect(frozen.baselineState).toBe("FROZEN");

    await routing.createExecutionRouting(
      createRoutingCommand({
        tenantId: created.workOrder.tenantId,
        workOrderId: created.workOrder.manufacturingWorkOrderId,
        expectedWorkOrderVersion: frozen.version,
        routingId: "routing-s5-001",
      }),
    );

    const stateAfterRouting = workOrders.getExecutionState(created.workOrder.tenantId, created.workOrder.manufacturingWorkOrderId);
    const result = await materials.deriveMaterialRequirements({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      expectedWorkOrderVersion: stateAfterRouting.version,
      idempotencyKey: id("idem-s5-material-derive", "IdempotencyKey"),
      correlationId: id("corr-s5-material-derive", "CorrelationIdentifier"),
      bomLines: [
        {
          bomLineId: "bom-line-b",
          inventoryItemRef: { tenantId: created.workOrder.tenantId, inventoryItemId: "inv-s5-b" },
          quantityPerUnit: 1.5,
          unitOfMeasure: "EA",
          requiredByRoutingStepId: "step-s5-002",
        },
        {
          bomLineId: "bom-line-a",
          inventoryItemRef: { tenantId: created.workOrder.tenantId, inventoryItemId: "inv-s5-a" },
          quantityPerUnit: 2,
          unitOfMeasure: "EA",
          requiredByRoutingStepId: "step-s5-001",
        },
      ],
    });

    expect(result.requirements).toHaveLength(2);
    expect(result.requirements[0].requiredQuantity.value).toBe(20);
    expect(result.requirements[1].requiredQuantity.value).toBe(15);

    const listed = materialQueries.listMaterialRequirements(created.workOrder.tenantId, created.workOrder.manufacturingWorkOrderId);
    expect(listed.map((entry) => entry.bomLineId)).toEqual(["bom-line-a", "bom-line-b"]);

    const readiness = materialQueries.getMaterialReadiness(created.workOrder.tenantId, created.workOrder.manufacturingWorkOrderId);
    expect(readiness.requirementsReady).toBe(true);
    expect(readiness.inventoryMaterialsReady).toBe(false);
    expect(readiness.materialsReady).toBe(false);
    expect(readiness.requirementCount).toBe(2);

    await runtime.stop();
  });

  it("enforces idempotency and rejects conflicting replay payloads for derivation", async () => {
    const { runtime, workOrders, productRefs, materials, routing } = await createRuntime();
    const created = await workOrders.createWorkOrder(createBaseWorkOrder(id("tenant-005", "TenantId"), "002"));

    const validated = await productRefs.validateProductBaseline({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      expectedVersion: created.workOrder.version,
      productRef: created.workOrder.productRef,
      productVariantRef: created.workOrder.productVariantRef,
      productVersionRef: created.workOrder.productVersionRef,
      productBomRef: created.workOrder.productBomRef,
      idempotencyKey: id("idem-s5-validate-002", "IdempotencyKey"),
      correlationId: id("corr-s5-validate-002", "CorrelationIdentifier"),
    });
    const frozen = await productRefs.freezeProductBaseline({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      expectedVersion: validated.version,
      idempotencyKey: id("idem-s5-freeze-002", "IdempotencyKey"),
      correlationId: id("corr-s5-freeze-002", "CorrelationIdentifier"),
    });

    await routing.createExecutionRouting(
      createRoutingCommand({
        tenantId: created.workOrder.tenantId,
        workOrderId: created.workOrder.manufacturingWorkOrderId,
        expectedWorkOrderVersion: frozen.version,
        routingId: "routing-s5-002",
      }),
    );

    const state = workOrders.getExecutionState(created.workOrder.tenantId, created.workOrder.manufacturingWorkOrderId);
    const first = await materials.deriveMaterialRequirements({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      expectedWorkOrderVersion: state.version,
      idempotencyKey: id("idem-s5-material-002", "IdempotencyKey"),
      correlationId: id("corr-s5-material-002", "CorrelationIdentifier"),
      bomLines: [
        {
          bomLineId: "bom-line-1",
          inventoryItemRef: { tenantId: created.workOrder.tenantId, inventoryItemId: "inv-a" },
          quantityPerUnit: 1,
          unitOfMeasure: "EA",
          requiredByRoutingStepId: "step-s5-001",
        },
      ],
    });

    const replay = await materials.deriveMaterialRequirements({
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      expectedWorkOrderVersion: state.version,
      idempotencyKey: id("idem-s5-material-002", "IdempotencyKey"),
      correlationId: id("corr-s5-material-002", "CorrelationIdentifier"),
      bomLines: [
        {
          bomLineId: "bom-line-1",
          inventoryItemRef: { tenantId: created.workOrder.tenantId, inventoryItemId: "inv-a" },
          quantityPerUnit: 1,
          unitOfMeasure: "EA",
          requiredByRoutingStepId: "step-s5-001",
        },
      ],
    });

    expect(replay).toEqual(first);

    await expect(
      materials.deriveMaterialRequirements({
        tenantId: created.workOrder.tenantId,
        workOrderId: created.workOrder.manufacturingWorkOrderId,
        expectedWorkOrderVersion: state.version,
        idempotencyKey: id("idem-s5-material-002", "IdempotencyKey"),
        correlationId: id("corr-s5-material-002", "CorrelationIdentifier"),
        bomLines: [
          {
            bomLineId: "bom-line-2",
            inventoryItemRef: { tenantId: created.workOrder.tenantId, inventoryItemId: "inv-b" },
            quantityPerUnit: 3,
            unitOfMeasure: "EA",
            requiredByRoutingStepId: "step-s5-002",
          },
        ],
      }),
    ).rejects.toMatchObject({ classification: "CONFLICTING_IDEMPOTENCY_PAYLOAD" });

    await runtime.stop();
  });

  it("rejects invalid product/BOM references through bounded product authority", async () => {
    const { runtime, workOrders, productRefs } = await createRuntime(true);
    const created = await workOrders.createWorkOrder(createBaseWorkOrder(id("tenant-005", "TenantId"), "003"));

    await expect(
      productRefs.validateProductBaseline({
        tenantId: created.workOrder.tenantId,
        workOrderId: created.workOrder.manufacturingWorkOrderId,
        expectedVersion: created.workOrder.version,
        productRef: created.workOrder.productRef,
        productVariantRef: created.workOrder.productVariantRef,
        productVersionRef: created.workOrder.productVersionRef,
        productBomRef: created.workOrder.productBomRef,
        idempotencyKey: id("idem-s5-invalid-bom", "IdempotencyKey"),
        correlationId: id("corr-s5-invalid-bom", "CorrelationIdentifier"),
      }),
    ).rejects.toMatchObject({ classification: "PRODUCT_BOM_INVALID" });

    await runtime.stop();
  });
});