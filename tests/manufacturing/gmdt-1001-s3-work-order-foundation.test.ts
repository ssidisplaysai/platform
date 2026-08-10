import { describe, expect, it } from "@jest/globals";
import {
  createCompletedQuantity,
  createDefaultManufacturingRuntimeDependencies,
  createManufacturingIdentifier,
  createPlannedQuantity,
  createRequestedQuantity,
  createUnitOfMeasure,
  createManufacturingRuntime,
  type ManufacturingFoundationQueryService,
  type ManufacturingWorkOrderService,
  type ProductionBatchService,
  type ProductionRunService,
  type CreateManufacturingWorkOrder,
} from "@/platform/manufacturing";

function id<T extends Parameters<typeof createManufacturingIdentifier>[1]>(value: string, brand: T) {
  return createManufacturingIdentifier(value, brand);
}

function createDefaultWorkOrderCommand(): CreateManufacturingWorkOrder {
  const tenantId = id("tenant-001", "TenantId");
  const unit = createUnitOfMeasure("EA");
  return {
    workOrderId: id("wo-001", "ManufacturingWorkOrderId"),
    workOrderNumber: id("WO-001", "WorkOrderNumber"),
    tenantId,
    productRef: { tenantId, productId: id("prod-001", "ProductIdentifier") },
    productVariantRef: { tenantId, productVariantId: id("var-001", "ProductVariantIdentifier") },
    productVersionRef: { tenantId, productVersionId: id("pv-001", "ProductVersionIdentifier") },
    productBomRef: { tenantId, productBomId: id("bom-001", "ProductBomIdentifier"), bomVersion: id("1.0.0", "VersionIdentifier") },
    requestedQuantity: createRequestedQuantity(10, unit),
    plannedQuantity: createPlannedQuantity(8, unit),
    priority: "HIGH",
    plannedStartAt: "2026-08-07T17:00:00.000Z",
    plannedEndAt: "2026-08-07T18:00:00.000Z",
    idempotencyKey: id("idem-wo-create-001", "IdempotencyKey"),
    correlationId: id("corr-wo-create-001", "CorrelationIdentifier"),
    command: {
      commandId: "cmd-001",
      expectedVersion: 0,
      requestedAt: "2026-08-07T16:30:00.000Z",
    },
  };
}

async function createRuntimeForFoundationTests() {
  const audits: Array<Record<string, unknown>> = [];
  const baseDependencies = createDefaultManufacturingRuntimeDependencies();
  const runtime = await createManufacturingRuntime({
    runtimeId: "manufacturing-runtime-s3-test",
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

  const workOrders = runtime.services.require("manufacturing.service.work-order").value as ManufacturingWorkOrderService;
  const runs = runtime.services.require("manufacturing.service.production-run").value as ProductionRunService;
  const batches = runtime.services.require("manufacturing.service.production-batch").value as ProductionBatchService;
  const queries = runtime.services.require("manufacturing.query.foundation").value as ManufacturingFoundationQueryService;

  return { runtime, workOrders, runs, batches, queries, audits };
}

describe("GMDT-1001-S3 Work Order and core execution foundation", () => {
  it("creates work orders, rejects duplicate identity/number, enforces tenant isolation, and lists deterministically", async () => {
    const { runtime, workOrders } = await createRuntimeForFoundationTests();
    const base = createDefaultWorkOrderCommand();

    const created = await workOrders.createWorkOrder(base);
    expect(created.workOrder.version).toBe(1);
    expect(created.workOrder.workOrderState).toBe("DRAFT");
    expect(created.workOrder.completedQuantity.value).toBe(0);
    expect(created.workOrder.rejectedQuantity.value).toBe(0);
    expect(created.workOrder.scrapQuantity.value).toBe(0);
    expect(created.workOrder.reworkQuantity.value).toBe(0);

    await expect(workOrders.createWorkOrder(base)).resolves.toMatchObject({
      workOrder: { manufacturingWorkOrderId: base.workOrderId },
    });

    await expect(
      workOrders.createWorkOrder({
        ...base,
        idempotencyKey: id("idem-wo-create-002", "IdempotencyKey"),
      }),
    ).rejects.toMatchObject({ classification: "DUPLICATE_WORK_ORDER_ID" });

    await expect(
      workOrders.createWorkOrder({
        ...base,
        workOrderId: id("wo-002", "ManufacturingWorkOrderId"),
        idempotencyKey: id("idem-wo-create-003", "IdempotencyKey"),
      }),
    ).rejects.toMatchObject({ classification: "DUPLICATE_WORK_ORDER_NUMBER" });

    const tenant2 = id("tenant-002", "TenantId");
    const createdTenant2 = await workOrders.createWorkOrder({
      ...base,
      tenantId: tenant2,
      workOrderId: id("wo-002", "ManufacturingWorkOrderId"),
      workOrderNumber: id("WO-001", "WorkOrderNumber"),
      productRef: { tenantId: tenant2, productId: id("prod-002", "ProductIdentifier") },
      productVariantRef: { tenantId: tenant2, productVariantId: id("var-002", "ProductVariantIdentifier") },
      productVersionRef: { tenantId: tenant2, productVersionId: id("pv-002", "ProductVersionIdentifier") },
      productBomRef: { tenantId: tenant2, productBomId: id("bom-002", "ProductBomIdentifier"), bomVersion: id("1.0.0", "VersionIdentifier") },
      idempotencyKey: id("idem-wo-create-tenant2", "IdempotencyKey"),
      correlationId: id("corr-wo-create-tenant2", "CorrelationIdentifier"),
    });
    expect(createdTenant2.workOrder.tenantId).toBe(tenant2);

    const listed = workOrders.listWorkOrders(base.tenantId);
    expect(listed.map((entry) => entry.workOrder.manufacturingWorkOrderId)).toEqual([base.workOrderId]);

    await runtime.stop();
  });

  it("enforces quantity and immutable identity boundaries", async () => {
    const { runtime, workOrders } = await createRuntimeForFoundationTests();
    const base = createDefaultWorkOrderCommand();

    await expect(
      workOrders.createWorkOrder({
        ...base,
        requestedQuantity: createRequestedQuantity(5, createUnitOfMeasure("EA")),
        plannedQuantity: createPlannedQuantity(6, createUnitOfMeasure("EA")),
        idempotencyKey: id("idem-invalid-quantity", "IdempotencyKey"),
      }),
    ).rejects.toMatchObject({ classification: "INVALID_WORK_ORDER_QUANTITY" });

    const created = await workOrders.createWorkOrder(base);
    await expect(
      workOrders.planWorkOrder({
        workOrderId: created.workOrder.manufacturingWorkOrderId,
        tenantId: created.workOrder.tenantId,
        expectedVersion: created.workOrder.version,
        idempotencyKey: id("idem-plan-identity", "IdempotencyKey"),
        correlationId: id("corr-plan-identity", "CorrelationIdentifier"),
        metadata: { marker: "v1" },
      }),
    ).resolves.toMatchObject({
      workOrder: {
        manufacturingWorkOrderId: created.workOrder.manufacturingWorkOrderId,
        workOrderNumber: created.workOrder.workOrderNumber,
      },
    });

    await runtime.stop();
  });

  it("enforces lifecycle transitions, terminal mutation protection, and stale-version rejection", async () => {
    const { runtime, workOrders } = await createRuntimeForFoundationTests();
    const base = createDefaultWorkOrderCommand();
    const created = await workOrders.createWorkOrder(base);

    await expect(
      workOrders.releaseWorkOrder({
        workOrderId: created.workOrder.manufacturingWorkOrderId,
        tenantId: created.workOrder.tenantId,
        expectedVersion: created.workOrder.version,
        idempotencyKey: id("idem-release-before-plan", "IdempotencyKey"),
        correlationId: id("corr-release-before-plan", "CorrelationIdentifier"),
      }),
    ).rejects.toMatchObject({ classification: "INVALID_LIFECYCLE_TRANSITION" });

    const planned = await workOrders.planWorkOrder({
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      tenantId: created.workOrder.tenantId,
      expectedVersion: created.workOrder.version,
      idempotencyKey: id("idem-plan-transition", "IdempotencyKey"),
      correlationId: id("corr-plan-transition", "CorrelationIdentifier"),
    });
    expect(planned.workOrder.version).toBe(created.workOrder.version + 1);

    await expect(
      workOrders.planWorkOrder({
        workOrderId: planned.workOrder.manufacturingWorkOrderId,
        tenantId: planned.workOrder.tenantId,
        expectedVersion: created.workOrder.version,
        idempotencyKey: id("idem-plan-stale", "IdempotencyKey"),
        correlationId: id("corr-plan-stale", "CorrelationIdentifier"),
      }),
    ).rejects.toMatchObject({ classification: "STALE_EXPECTED_VERSION" });

    const cancelled = await workOrders.cancelWorkOrder({
      workOrderId: planned.workOrder.manufacturingWorkOrderId,
      tenantId: planned.workOrder.tenantId,
      expectedVersion: planned.workOrder.version,
      idempotencyKey: id("idem-cancel", "IdempotencyKey"),
      correlationId: id("corr-cancel", "CorrelationIdentifier"),
    });

    const closed = await workOrders.closeWorkOrder({
      workOrderId: cancelled.workOrder.manufacturingWorkOrderId,
      tenantId: cancelled.workOrder.tenantId,
      expectedVersion: cancelled.workOrder.version,
      idempotencyKey: id("idem-close", "IdempotencyKey"),
      correlationId: id("corr-close", "CorrelationIdentifier"),
    });

    await expect(
      workOrders.planWorkOrder({
        workOrderId: closed.workOrder.manufacturingWorkOrderId,
        tenantId: closed.workOrder.tenantId,
        expectedVersion: closed.workOrder.version,
        idempotencyKey: id("idem-plan-terminal", "IdempotencyKey"),
        correlationId: id("corr-plan-terminal", "CorrelationIdentifier"),
      }),
    ).rejects.toMatchObject({ classification: "TERMINAL_WORK_ORDER_MUTATION" });

    await runtime.stop();
  });

  it("keeps readiness truthful and blocks release/start when readiness is absent", async () => {
    const { runtime, workOrders } = await createRuntimeForFoundationTests();
    const created = await workOrders.createWorkOrder(createDefaultWorkOrderCommand());

    const state = workOrders.getExecutionState(created.workOrder.tenantId, created.workOrder.manufacturingWorkOrderId);
    expect(state.readiness.executionReady).toBe(false);

    const planned = await workOrders.planWorkOrder({
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      tenantId: created.workOrder.tenantId,
      expectedVersion: created.workOrder.version,
      idempotencyKey: id("idem-plan-readiness", "IdempotencyKey"),
      correlationId: id("corr-plan-readiness", "CorrelationIdentifier"),
      productBaselineState: "FROZEN",
      readinessEvidence: {
        productBaselineReady: true,
        routingReady: false,
        materialsReady: false,
        resourcesReady: false,
      },
    });
    expect(planned.readiness.executionReady).toBe(false);

    await expect(
      workOrders.releaseWorkOrder({
        workOrderId: planned.workOrder.manufacturingWorkOrderId,
        tenantId: planned.workOrder.tenantId,
        expectedVersion: planned.workOrder.version,
        idempotencyKey: id("idem-release-not-ready", "IdempotencyKey"),
        correlationId: id("corr-release-not-ready", "CorrelationIdentifier"),
      }),
    ).rejects.toMatchObject({ classification: "ROUTING_NOT_READY" });

    await expect(
      workOrders.startWorkOrderExecution({
        workOrderId: planned.workOrder.manufacturingWorkOrderId,
        tenantId: planned.workOrder.tenantId,
        expectedVersion: planned.workOrder.version,
        idempotencyKey: id("idem-start-not-ready", "IdempotencyKey"),
        correlationId: id("corr-start-not-ready", "CorrelationIdentifier"),
      }),
    ).rejects.toMatchObject({ classification: "WORK_ORDER_NOT_READY" });

    await runtime.stop();
  });

  it("enforces idempotent replay and conflicting idempotency rejection", async () => {
    const { runtime, workOrders } = await createRuntimeForFoundationTests();
    const create = createDefaultWorkOrderCommand();

    const first = await workOrders.createWorkOrder(create);
    const replay = await workOrders.createWorkOrder(create);
    expect(replay.workOrder.version).toBe(first.workOrder.version);

    await expect(
      workOrders.createWorkOrder({
        ...create,
        plannedQuantity: createPlannedQuantity(7, createUnitOfMeasure("EA")),
      }),
    ).rejects.toMatchObject({ classification: "CONFLICTING_IDEMPOTENCY_PAYLOAD" });

    const planned = await workOrders.planWorkOrder({
      workOrderId: first.workOrder.manufacturingWorkOrderId,
      tenantId: first.workOrder.tenantId,
      expectedVersion: first.workOrder.version,
      idempotencyKey: id("idem-plan-replay", "IdempotencyKey"),
      correlationId: id("corr-plan-replay", "CorrelationIdentifier"),
    });
    const plannedReplay = await workOrders.planWorkOrder({
      workOrderId: first.workOrder.manufacturingWorkOrderId,
      tenantId: first.workOrder.tenantId,
      expectedVersion: first.workOrder.version,
      idempotencyKey: id("idem-plan-replay", "IdempotencyKey"),
      correlationId: id("corr-plan-replay", "CorrelationIdentifier"),
    });
    expect(plannedReplay.workOrder.version).toBe(planned.workOrder.version);

    await runtime.stop();
  });

  it("creates production runs and batches with tenant/work-order boundaries and deterministic listing", async () => {
    const { runtime, workOrders, runs, batches } = await createRuntimeForFoundationTests();
    const created = await workOrders.createWorkOrder(createDefaultWorkOrderCommand());

    const run = await runs.createProductionRun({
      productionRunId: id("run-001", "ProductionRunId"),
      runCode: id("RUN-001", "RunCode"),
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      expectedVersion: 0,
      idempotencyKey: id("idem-run-create", "IdempotencyKey"),
      correlationId: id("corr-run-create", "CorrelationIdentifier"),
    });
    expect(run.run.version).toBe(1);

    await expect(
      runs.createProductionRun({
        ...run.run,
        expectedVersion: 0,
        idempotencyKey: id("idem-run-dup-id", "IdempotencyKey"),
        correlationId: id("corr-run-dup-id", "CorrelationIdentifier"),
      }),
    ).rejects.toMatchObject({ classification: "DUPLICATE_PRODUCTION_RUN_ID" });

    const batch = await batches.createProductionBatch({
      productionBatchId: id("batch-001", "ProductionBatchId"),
      batchCode: id("BATCH-001", "BatchCode"),
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      productionRunId: run.run.productionRunId,
      expectedVersion: 0,
      idempotencyKey: id("idem-batch-create", "IdempotencyKey"),
      correlationId: id("corr-batch-create", "CorrelationIdentifier"),
    });
    expect(batch.inventoryLotBinding).toBeNull();

    await expect(
      batches.createProductionBatch({
        ...batch.batch,
        expectedVersion: 0,
        idempotencyKey: id("idem-batch-dup-id", "IdempotencyKey"),
        correlationId: id("corr-batch-dup-id", "CorrelationIdentifier"),
      }),
    ).rejects.toMatchObject({ classification: "DUPLICATE_PRODUCTION_BATCH_ID" });

    const tenant2 = id("tenant-002", "TenantId");
    await expect(
      runs.createProductionRun({
        productionRunId: id("run-tenant2", "ProductionRunId"),
        runCode: id("RUN-002", "RunCode"),
        tenantId: tenant2,
        workOrderId: created.workOrder.manufacturingWorkOrderId,
        expectedVersion: 0,
        idempotencyKey: id("idem-run-tenant2", "IdempotencyKey"),
        correlationId: id("corr-run-tenant2", "CorrelationIdentifier"),
      }),
    ).rejects.toMatchObject({ classification: "TENANT_MISMATCH" });

    expect(runs.listProductionRuns(created.workOrder.tenantId)).toHaveLength(1);
    expect(batches.listProductionBatches(created.workOrder.tenantId)).toHaveLength(1);

    await runtime.stop();
  });

  it("exposes deterministic read-only query surface and runtime registration boundaries", async () => {
    const { runtime, workOrders, runs, batches, queries } = await createRuntimeForFoundationTests();
    const created = await workOrders.createWorkOrder(createDefaultWorkOrderCommand());
    await runs.createProductionRun({
      productionRunId: id("run-qa-001", "ProductionRunId"),
      runCode: id("RUN-QA-001", "RunCode"),
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      expectedVersion: 0,
      idempotencyKey: id("idem-run-qa", "IdempotencyKey"),
      correlationId: id("corr-run-qa", "CorrelationIdentifier"),
    });
    await batches.createProductionBatch({
      productionBatchId: id("batch-qa-001", "ProductionBatchId"),
      batchCode: id("BATCH-QA-001", "BatchCode"),
      tenantId: created.workOrder.tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      expectedVersion: 0,
      idempotencyKey: id("idem-batch-qa", "IdempotencyKey"),
      correlationId: id("corr-batch-qa", "CorrelationIdentifier"),
    });

    expect(queries.getManufacturingWorkOrder(created.workOrder.tenantId, created.workOrder.manufacturingWorkOrderId)).toBeTruthy();
    expect(queries.listManufacturingWorkOrders(created.workOrder.tenantId)).toHaveLength(1);
    expect(queries.listWorkOrdersByProduct(created.workOrder.tenantId, created.workOrder.productRef.productId)).toHaveLength(1);
    expect(queries.listWorkOrdersByStatus(created.workOrder.tenantId, "DRAFT")).toHaveLength(1);
    expect(queries.listProductionRuns(created.workOrder.tenantId)).toHaveLength(1);
    expect(queries.listProductionRunsByWorkOrder(created.workOrder.tenantId, created.workOrder.manufacturingWorkOrderId)).toHaveLength(1);
    expect(queries.listProductionBatches(created.workOrder.tenantId)).toHaveLength(1);
    expect(queries.listProductionBatchesByWorkOrder(created.workOrder.tenantId, created.workOrder.manufacturingWorkOrderId)).toHaveLength(1);
    expect(queries.listProductionBatchesByRun(created.workOrder.tenantId, id("run-qa-001", "ProductionRunId"))).toHaveLength(0);
    expect(queries.getWorkOrderExecutionState(created.workOrder.tenantId, created.workOrder.manufacturingWorkOrderId).readiness.executionReady).toBe(false);

    const runtimeServiceIds = runtime.services.list().map((service) => service.serviceId);
    expect(runtimeServiceIds).toContain("manufacturing.service.work-order");
    expect(runtimeServiceIds).toContain("manufacturing.service.production-run");
    expect(runtimeServiceIds).toContain("manufacturing.service.production-batch");
    expect(runtimeServiceIds).toContain("manufacturing.query.foundation");
    expect(runtimeServiceIds).toContain("manufacturing.service.execution-routing");
    expect(runtimeServiceIds).toContain("manufacturing.service.operation-execution");
    expect(runtimeServiceIds).toContain("manufacturing.query.routing");
    expect(runtimeServiceIds).toContain("manufacturing.service.material-requirement");
    expect(runtimeServiceIds).toContain("manufacturing.query.material");
    expect(runtimeServiceIds).toContain("manufacturing.service.production-output");
    expect(runtimeServiceIds).toContain("manufacturing.query.production-result");
    expect(runtimeServiceIds).toContain("manufacturing.service.work-center");
    expect(runtimeServiceIds).toContain("manufacturing.service.production-cell");
    expect(runtimeServiceIds).toContain("manufacturing.service.machine-assignment");
    expect(runtimeServiceIds).toContain("manufacturing.service.tool-assignment");
    expect(runtimeServiceIds).toContain("manufacturing.service.labor-assignment");
    expect(runtimeServiceIds).toContain("manufacturing.service.resource-readiness");
    expect(runtimeServiceIds).toContain("manufacturing.service.downtime");
    expect(runtimeServiceIds).toContain("manufacturing.service.execution-exception");
    expect(runtimeServiceIds).toContain("manufacturing.service.traceability");
    expect(runtimeServiceIds).toContain("manufacturing.query.resource");
    expect(runtimeServiceIds).toContain("manufacturing.query.traceability");
    expect(runtimeServiceIds).toContain("manufacturing.service.persistence");
    expect(runtimeServiceIds.some((id) => id.includes("maintenance"))).toBe(false);
    expect(runtimeServiceIds.some((id) => id.includes("quality-management"))).toBe(false);
    expect(runtimeServiceIds.some((id) => id.includes("observability"))).toBe(false);

    await runtime.stop();
  });
});
