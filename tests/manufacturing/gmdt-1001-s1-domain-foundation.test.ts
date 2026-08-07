import { describe, expect, it } from "@jest/globals";
import {
  MANUFACTURING_FAILURE_CLASSIFICATIONS,
  type ExecutionRouting,
  type ProductionTraceRecord,
  createBatchCode,
  createCompletedQuantity,
  createConcurrencyToken,
  createConsumedMaterialQuantity,
  createCycleTime,
  createDowntimeDuration,
  createEffectiveDateRange,
  createExecutionVersion,
  createExpectedVersion,
  createExpectedVersionPrimitive,
  createIdempotencyKey,
  createIssuedMaterialQuantity,
  createLaborDuration,
  createMachineDuration,
  createManufacturingIdentifier,
  createMetadataCollection,
  createPlannedQuantity,
  createQuantityWithUnit,
  createRejectedQuantity,
  createReworkQuantity,
  createRequiredMaterialQuantity,
  createRequestedQuantity,
  createReturnedMaterialQuantity,
  createRunCode,
  createScrapQuantity,
  createSequenceNumber,
  createSetupTime,
  createUnitOfMeasure,
  createVersionIdentifier,
  createYieldPercentage,
  assertBusinessIdentifierAvailable,
  assertExecutionVersionMonotonic,
  assertExpectedVersionMatches,
  assertVersionIdentifierMonotonic,
  classifyIdempotentReplay,
  compareBatchCodes,
  compareRunCodes,
  compareTraceRecords,
  compareWorkOrderNumbers,
  createIdempotencyRecord,
  deterministicOperationTransitions,
  deterministicTraceOrdering,
  deterministicWorkOrderTransitions,
  isOperationTerminal,
  isWorkOrderTerminal,
  operationLifecycleTransitions,
  sortRoutingStepsDeterministically,
  validateRoutingGraph,
  workOrderLifecycleTransitions,
  assertAppendOnlyTraceHistory,
  assertMaterialRequirementInvariants,
  assertOutputInvariants,
  assertResourceInvariants,
  assertUniqueTraceIdentities,
  assertValidOperationTransition,
  assertValidWorkOrderTransition,
  assertWipInvariants,
  assertWorkOrderInvariants,
} from "@/platform/manufacturing";

function id<T extends Parameters<typeof createManufacturingIdentifier>[1]>(value: string, brand: T) {
  return createManufacturingIdentifier(value, brand);
}

describe("GMDT-1001-S1 Manufacturing domain foundation", () => {
  it("creates valid identifiers and rejects invalid identifiers", () => {
    expect(id("wo-001", "ManufacturingWorkOrderId")).toBe("wo-001");
    expect(id("tenant-001", "TenantId")).toBe("tenant-001");
    expect(() => id("?", "ManufacturingWorkOrderId")).toThrow("invalid ManufacturingWorkOrderId");
  });

  it("enforces deterministic business identifier availability and retirement rules", () => {
    assertBusinessIdentifierAvailable("WO-100", ["WO-101"], ["WO-001"], false);
    expect(() => assertBusinessIdentifierAvailable("WO-101", ["WO-101"], [], false)).toThrow(
      "duplicate business identifier",
    );
    expect(() => assertBusinessIdentifierAvailable("WO-001", [], ["WO-001"], false)).toThrow("cannot be reused");
  });

  it("enforces quantity primitives and rejects negative values", () => {
    const unit = createUnitOfMeasure("EA");
    expect(createRequestedQuantity(1, unit).value).toBe(1);
    expect(createPlannedQuantity(2, unit).value).toBe(2);
    expect(createCompletedQuantity(0, unit).value).toBe(0);
    expect(createRejectedQuantity(0, unit).value).toBe(0);
    expect(createScrapQuantity(0, unit).value).toBe(0);
    expect(createRequiredMaterialQuantity(5, unit).value).toBe(5);
    expect(createIssuedMaterialQuantity(3, unit).value).toBe(3);
    expect(createConsumedMaterialQuantity(2, unit).value).toBe(2);
    expect(createReturnedMaterialQuantity(1, unit).value).toBe(1);
    expect(() => createQuantityWithUnit(-1, unit)).toThrow("must be >= 0");
  });

  it("enforces lifecycle transitions and terminal-state behavior", () => {
    assertValidWorkOrderTransition("DRAFT", "PLANNED");
    assertValidOperationTransition("READY", "IN_PROGRESS");
    expect(() => assertValidWorkOrderTransition("ARCHIVED", "READY")).toThrow("invalid work order lifecycle transition");
    expect(() => assertValidOperationTransition("CLOSED", "READY")).toThrow("invalid operation lifecycle transition");
    expect(isWorkOrderTerminal("ARCHIVED")).toBe(true);
    expect(isOperationTerminal("CLOSED")).toBe(true);

    const orderedWorkOrder = deterministicWorkOrderTransitions("IN_PROGRESS");
    expect([...orderedWorkOrder].sort()).toEqual(orderedWorkOrder);

    const orderedOperation = deterministicOperationTransitions("IN_PROGRESS");
    expect([...orderedOperation].sort()).toEqual(orderedOperation);
  });

  it("validates routing graph primitives, ordering, and cycle detection", () => {
    const tenantId = id("tenant-001", "TenantId");
    const routing: ExecutionRouting = {
      executionRoutingId: id("route-001", "ExecutionRoutingId"),
      tenantId,
      workOrderId: id("wo-001", "ManufacturingWorkOrderId"),
      sourceProductVersionRef: { tenantId, productVersionId: id("pv-001", "ProductVersionIdentifier") },
      sourceBomRef: {
        tenantId,
        productBomId: id("bom-001", "ProductBomIdentifier"),
        bomVersion: id("1.0.0", "VersionIdentifier"),
      },
      status: "READY" as never,
      steps: [
        {
          routingStepId: id("step-001", "RoutingStepId"),
          tenantId,
          routingStepCode: id("RS-001", "RoutingStepCode"),
          sequenceNumber: createSequenceNumber(1),
          predecessorStepIds: [],
          successorStepIds: [id("step-002", "RoutingStepId")],
          reworkStepIds: [],
          conditionalStepIds: [],
        },
        {
          routingStepId: id("step-002", "RoutingStepId"),
          tenantId,
          routingStepCode: id("RS-002", "RoutingStepCode"),
          sequenceNumber: createSequenceNumber(2),
          predecessorStepIds: [id("step-001", "RoutingStepId")],
          successorStepIds: [],
          reworkStepIds: [id("step-001", "RoutingStepId")],
          conditionalStepIds: [],
        },
      ],
      version: 1,
    };

    const validation = validateRoutingGraph(routing);
    expect(validation.orderedStepIds).toEqual([id("step-001", "RoutingStepId"), id("step-002", "RoutingStepId")]);
    expect(validation.reworkEdges).toHaveLength(1);

    const sortedSteps = sortRoutingStepsDeterministically(routing.steps);
    expect(sortedSteps.map((step) => step.routingStepId)).toEqual([
      id("step-001", "RoutingStepId"),
      id("step-002", "RoutingStepId"),
    ]);

    const selfCycleRouting: ExecutionRouting = {
      ...routing,
      steps: [
        {
          ...routing.steps[0],
          successorStepIds: [routing.steps[0].routingStepId],
        },
      ],
    };
    expect(() => validateRoutingGraph(selfCycleRouting)).toThrow("cannot self-reference");

    const twoNodeCycleRouting: ExecutionRouting = {
      ...routing,
      steps: [
        {
          ...routing.steps[0],
          predecessorStepIds: [id("step-002", "RoutingStepId")],
          successorStepIds: [id("step-002", "RoutingStepId")],
        },
        {
          ...routing.steps[1],
          predecessorStepIds: [id("step-001", "RoutingStepId")],
          successorStepIds: [id("step-001", "RoutingStepId")],
          reworkStepIds: [],
        },
      ],
    };
    expect(() => validateRoutingGraph(twoNodeCycleRouting)).toThrow("invalid structural routing cycle");
  });

  it("validates work order, material, output, and WIP invariants", () => {
    const tenantId = id("tenant-001", "TenantId");
    const unit = createUnitOfMeasure("EA");

    const workOrder = {
      manufacturingWorkOrderId: id("wo-001", "ManufacturingWorkOrderId"),
      workOrderNumber: id("WO-001", "WorkOrderNumber"),
      tenantId,
      productRef: { tenantId, productId: id("prod-001", "ProductIdentifier") },
      productVersionRef: { tenantId, productVersionId: id("ver-001", "ProductVersionIdentifier") },
      productBomRef: {
        tenantId,
        productBomId: id("bom-001", "ProductBomIdentifier"),
        bomVersion: id("1.0.0", "VersionIdentifier"),
      },
      requestedQuantity: createRequestedQuantity(10, unit),
      plannedQuantity: createPlannedQuantity(10, unit),
      completedQuantity: createCompletedQuantity(6, unit),
      rejectedQuantity: createRejectedQuantity(1, unit),
      scrapQuantity: createScrapQuantity(1, unit),
      reworkQuantity: createReworkQuantity(2, unit),
      workOrderState: "IN_PROGRESS" as const,
      productionStatus: "IN_PROGRESS" as never,
      workInProgressStatus: "ACTIVE" as never,
      correlationId: id("corr-001", "CorrelationIdentifier"),
      idempotencyKey: id("idem-001", "IdempotencyKey"),
      version: 5,
    };
    assertWorkOrderInvariants(workOrder as never);

    const requirement = {
      materialRequirementId: id("mr-001", "MaterialRequirementId"),
      tenantId,
      workOrderId: id("wo-001", "ManufacturingWorkOrderId"),
      productVersionRef: { tenantId, productVersionId: id("ver-001", "ProductVersionIdentifier") },
      productBomRef: {
        tenantId,
        productBomId: id("bom-001", "ProductBomIdentifier"),
        bomVersion: id("1.0.0", "VersionIdentifier"),
      },
      inventoryItemRef: { tenantId, inventoryItemId: id("itm-001", "InventoryItemIdentifier") },
      requiredQuantity: createRequiredMaterialQuantity(10, unit),
      issuedQuantity: createIssuedMaterialQuantity(8, unit),
      consumedQuantity: createConsumedMaterialQuantity(7, unit),
      returnedQuantity: createReturnedMaterialQuantity(1, unit),
      reservationRefs: [],
      allocationRefs: [],
      status: "ACTIVE" as never,
      version: 2,
    };
    assertMaterialRequirementInvariants(requirement as never);

    const output = {
      productionOutputId: id("out-001", "ProductionOutputId"),
      tenantId,
      workOrderId: id("wo-001", "ManufacturingWorkOrderId"),
      productRef: { tenantId, productId: id("prod-001", "ProductIdentifier") },
      quantity: createCompletedQuantity(4, unit),
      disposition: "COMPLETED" as const,
      idempotencyKey: id("idem-002", "IdempotencyKey"),
      correlationId: id("corr-002", "CorrelationIdentifier"),
      recordedAt: "2026-08-07T10:00:00.000Z",
      version: 1,
    };
    assertOutputInvariants(output as never);

    const wip = {
      wipStateId: "wip-001",
      tenantId,
      workOrderId: id("wo-001", "ManufacturingWorkOrderId"),
      quantityWaiting: createRequestedQuantity(2, unit),
      quantityInProcess: createPlannedQuantity(3, unit),
      quantityCompleted: createCompletedQuantity(4, unit),
      quantityRejected: createRejectedQuantity(1, unit),
      holdState: "ACTIVE" as never,
      status: "ACTIVE" as never,
      version: 1,
    };
    assertWipInvariants(wip as never);
  });

  it("validates resource assignment semantics and foreign reference boundaries", () => {
    const tenantId = id("tenant-001", "TenantId");

    assertResourceInvariants({
      workCenter: {
        workCenterId: id("wc-001", "WorkCenterId"),
        workCenterCode: id("WCC-001", "WorkCenterCode"),
        tenantId,
        status: "ACTIVE" as never,
        capacityUnits: 10,
        version: 1,
      },
      productionCell: {
        productionCellId: id("cell-001", "ProductionCellId"),
        productionCellCode: id("PCC-001", "ProductionCellCode"),
        tenantId,
        workCenterId: id("wc-001", "WorkCenterId"),
        status: "ACTIVE" as never,
        capacityUnits: 5,
        version: 1,
      },
      machineAssignment: {
        machineAssignmentId: id("ma-001", "MachineAssignmentId"),
        tenantId,
        operationExecutionId: id("opx-001", "OperationExecutionId"),
        machineRef: { tenantId, assetId: id("asset-001", "AssetIdentifier") },
        version: 1,
      },
      toolAssignment: {
        toolAssignmentId: id("ta-001", "ToolAssignmentId"),
        tenantId,
        operationExecutionId: id("opx-001", "OperationExecutionId"),
        toolRef: { tenantId, assetId: id("asset-002", "AssetIdentifier") },
        version: 1,
      },
      laborAssignment: {
        laborAssignmentId: id("la-001", "LaborAssignmentId"),
        tenantId,
        operationExecutionId: id("opx-001", "OperationExecutionId"),
        laborRef: { tenantId, personOrContactId: id("person-001", "PersonOrContactIdentifier") },
        roleCode: "OPERATOR",
        version: 1,
      },
    });
  });

  it("validates downtime primitives and duration ordering", () => {
    expect(createDowntimeDuration(5)).toBe(5);
    expect(() => createDowntimeDuration(-1)).toThrow("must be a non-negative finite duration");
    expect(createEffectiveDateRange("2026-08-07T10:00:00.000Z", "2026-08-07T10:05:00.000Z")).toBeTruthy();
    expect(() => createEffectiveDateRange("2026-08-07T10:05:00.000Z", "2026-08-07T10:00:00.000Z")).toThrow(
      "end must be >= start",
    );
  });

  it("supports deterministic trace ordering, append-only behavior, and duplicate rejection", () => {
    const tenantId = id("tenant-001", "TenantId");
    const traceA: ProductionTraceRecord = {
      productionTraceId: id("trace-001", "ProductionTraceId"),
      tenantId,
      correlationId: id("corr-001", "CorrelationIdentifier"),
      sourceType: "WORK_ORDER",
      sourceId: id("wo-001", "ManufacturingWorkOrderId"),
      targetType: "OPERATION",
      targetId: id("opx-001", "OperationExecutionId"),
      occurredAt: "2026-08-07T10:00:00.000Z",
      metadata: createMetadataCollection({ sequence: 1 }),
    };
    const traceB: ProductionTraceRecord = {
      ...traceA,
      productionTraceId: id("trace-002", "ProductionTraceId"),
      occurredAt: "2026-08-07T10:00:01.000Z",
      metadata: createMetadataCollection({ sequence: 2 }),
    };

    const ordered = deterministicTraceOrdering([traceB, traceA]);
    expect(ordered[0].productionTraceId).toBe(traceA.productionTraceId);
    expect(compareTraceRecords(traceA, traceB)).toBeLessThan(0);

    assertUniqueTraceIdentities([traceA, traceB]);
    expect(() => assertUniqueTraceIdentities([traceA, traceA])).toThrow("duplicate trace identity");

    assertAppendOnlyTraceHistory([traceA], [traceA, traceB]);
    expect(() => assertAppendOnlyTraceHistory([traceA, traceB], [traceA])).toThrow("cannot shrink");
  });

  it("validates concurrency and idempotency primitives", () => {
    const expected = createExpectedVersionPrimitive(2);
    expect(expected).toBe(2);
    assertExpectedVersionMatches(2, expected);
    expect(() => assertExpectedVersionMatches(3, expected)).toThrow("stale expected version");

    const v1 = createExecutionVersion(1);
    const v2 = createExecutionVersion(2);
    assertExecutionVersionMonotonic(v1, v2);
    expect(() => assertExecutionVersionMonotonic(v2, v1)).toThrow("must increase monotonically");

    const replayClassification = classifyIdempotentReplay("hash-a", "hash-a");
    expect(replayClassification).toBe("REPLAY");
    const conflictClassification = classifyIdempotentReplay("hash-a", "hash-b");
    expect(conflictClassification).toBe("CONFLICT");

    const record = createIdempotencyRecord({
      tenantId: id("tenant-001", "TenantId"),
      commandFamily: "WORK_ORDER",
      key: id("idem-001", "IdempotencyKey"),
      payloadFingerprint: "fingerprint-1",
      acceptedResultIdentity: id("wo-001", "ManufacturingWorkOrderId"),
      classification: "ACCEPTED",
    });
    expect(record.classification).toBe("ACCEPTED");
  });

  it("preserves deterministic helpers and failure taxonomy uniqueness", () => {
    expect(compareWorkOrderNumbers(id("WO-001", "WorkOrderNumber"), id("WO-002", "WorkOrderNumber"))).toBeLessThan(0);
    expect(compareRunCodes(id("RUN-001", "RunCode"), id("RUN-002", "RunCode"))).toBeLessThan(0);
    expect(compareBatchCodes(id("BATCH-001", "BatchCode"), id("BATCH-002", "BatchCode"))).toBeLessThan(0);

    expect(new Set(MANUFACTURING_FAILURE_CLASSIFICATIONS).size).toBe(MANUFACTURING_FAILURE_CLASSIFICATIONS.length);
  });
});
