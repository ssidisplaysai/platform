import { describe, expect, it } from "@jest/globals";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
  type ManufacturingInventoryIntegrationPort,
  type ManufacturingProductIntegrationPort,
  type ManufacturingRuntime,
  type TenantId,
} from "@/platform/manufacturing";

function id<T extends Parameters<typeof createManufacturingIdentifier>[1]>(value: string, brand: T) {
  return createManufacturingIdentifier(value, brand);
}

function createProductPort(): ManufacturingProductIntegrationPort {
  return {
    async validateProductReference() { return { valid: true }; },
    async validateVariantReference() { return { valid: true }; },
    async validateProductVersionReference() { return { valid: true }; },
    async validateBomReference() { return { valid: true }; },
    async validateRoutingReference() { return { valid: true }; },
    async validateConfigurationReference() { return { valid: true }; },
  };
}

function createInventoryPort(): ManufacturingInventoryIntegrationPort {
  return {
    async queryAvailability() { return { valid: true, availableQuantity: 100 }; },
    async requestReservation() { return { accepted: true, referenceId: "res-1" }; },
    async requestAllocation() { return { accepted: true, referenceId: "alloc-1" }; },
    async releaseReservation() { return { accepted: true, referenceId: "rel-res-1" }; },
    async releaseAllocation() { return { accepted: true, referenceId: "rel-alloc-1" }; },
    async requestMaterialIssue(input) { return { accepted: true, referenceId: `issue-${input.inventoryItemId}`, acceptedQuantity: input.quantity }; },
    async requestMaterialReturn(input) { return { accepted: true, referenceId: `return-${input.inventoryItemId}`, acceptedQuantity: input.quantity }; },
    async requestFinishedGoodsReceipt(input) { return { accepted: true, referenceId: `receipt-${input.inventoryItemId}`, acceptedQuantity: input.quantity }; },
    async requestWriteOff(input) { return { accepted: true, referenceId: `writeoff-${input.inventoryItemId}`, acceptedQuantity: input.quantity }; },
    async validateInventoryMovement() { return { valid: true }; },
    async validateLot() { return { valid: true }; },
    async validateSerial() { return { valid: true }; },
  };
}

function createWorkOrder(tenantId = id("tenant-001", "TenantId"), suffix = "001"): CreateManufacturingWorkOrder {
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
      requestedAt: "2026-08-10T18:00:00.000Z",
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
    sourceRoutingReference: id("prod-routing-001", "ProductRoutingReferenceId"),
    sourceProductVersionRef: { tenantId: input.tenantId, productVersionId: id("pv-001", "ProductVersionIdentifier") },
    sourceBomRef: { tenantId: input.tenantId, productBomId: id("bom-001", "ProductBomIdentifier"), bomVersion: id("1.0.0", "VersionIdentifier") },
    steps: [
      {
        routingStepId: id("step-001", "RoutingStepId"),
        operationExecutionId: id("opexec-001", "OperationExecutionId"),
        operationCode: id("OP-001", "OperationCode"),
        routingStepCode: id("STEP-001", "RoutingStepCode"),
        sequenceNumber: createSequenceNumber(10),
        predecessorStepIds: [],
        successorStepIds: [id("step-002", "RoutingStepId")],
        conditionalEligibility: { state: "ELIGIBLE" as const },
        explicitReworkEdges: [],
        reworkStepIds: [],
        conditionalStepIds: [],
        executionState: { readiness: "READY" as const, operationState: "READY" as const },
        tenantId: input.tenantId,
      },
      {
        routingStepId: id("step-002", "RoutingStepId"),
        operationExecutionId: id("opexec-002", "OperationExecutionId"),
        operationCode: id("OP-002", "OperationCode"),
        routingStepCode: id("STEP-002", "RoutingStepCode"),
        sequenceNumber: createSequenceNumber(20),
        predecessorStepIds: [id("step-001", "RoutingStepId")],
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
    idempotencyKey: id(`idem-routing-${input.routingId}`, "IdempotencyKey"),
    correlationId: id(`corr-routing-${input.routingId}`, "CorrelationIdentifier"),
  };
}

async function createRuntime(rootDir: string): Promise<ManufacturingRuntime> {
  const baseDependencies = createDefaultManufacturingRuntimeDependencies();
  return createManufacturingRuntime({
    runtimeId: "manufacturing-runtime-s10-test",
    persistence: { rootDir },
    dependencies: {
      ...baseDependencies,
      clockProvider: {
        ...baseDependencies.clockProvider,
        now: () => "2026-08-10T18:00:00.000Z",
      },
    },
    productIntegration: {
      integrationId: "product-port",
      port: createProductPort(),
    },
    inventoryIntegration: {
      integrationId: "inventory-port",
      port: createInventoryPort(),
    },
  });
}

function tenantFilePath(rootDir: string, tenantId: string): string {
  return join(rootDir, "tenants", `${Buffer.from(tenantId.trim(), "utf8").toString("hex")}.json`);
}

describe("GMDT-1001-S10 Manufacturing persistence and recovery", () => {
  it("initializes first-run empty state and reaches READY", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gmdt-s10-first-run-"));
    const runtime = await createRuntime(rootDir);

    expect(runtime.isReady()).toBe(true);
    const persistence = runtime.services.require("manufacturing.service.persistence").value;
    expect(persistence.getStatus().lastLoadStatus).toBe("FIRST_RUN_EMPTY");

    await runtime.stop();
    await rm(rootDir, { recursive: true, force: true });
  });

  it("persists work orders, routing, operations, product baseline, and trace across restart while preserving idempotency and version state", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gmdt-s10-restart-"));
    const runtime1 = await createRuntime(rootDir);
    const tenantId = id("tenant-001", "TenantId");
    const workOrders1 = runtime1.services.require("manufacturing.service.work-order").value;
    const routing1 = runtime1.services.require("manufacturing.service.execution-routing").value;
    const operations1 = runtime1.services.require("manufacturing.service.operation-execution").value;
    const baselines1 = runtime1.services.require("manufacturing.service.product-reference").value;
    const trace1 = runtime1.services.require("manufacturing.service.traceability").value;

    const command = createWorkOrder(tenantId, "001");
    const created = await workOrders1.createWorkOrder(command);
    const routed = await routing1.createExecutionRouting(
      createRoutingCommand({
        tenantId,
        workOrderId: created.workOrder.manufacturingWorkOrderId,
        expectedWorkOrderVersion: created.workOrder.version,
        routingId: "routing-001",
      }),
    );
    const initialized = await operations1.initializeOperations({
      tenantId,
      executionRoutingId: routed.routing.executionRoutingId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      expectedRoutingVersion: routed.routing.version,
      idempotencyKey: id("idem-op-init-001", "IdempotencyKey"),
      correlationId: id("corr-op-init-001", "CorrelationIdentifier"),
    });
    const validated = await baselines1.validateProductBaseline({
      tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      expectedVersion: created.workOrder.version + 1,
      productRef: created.workOrder.productRef,
      productVariantRef: created.workOrder.productVariantRef,
      productVersionRef: created.workOrder.productVersionRef,
      productBomRef: created.workOrder.productBomRef,
      idempotencyKey: id("idem-baseline-validate-001", "IdempotencyKey"),
      correlationId: id("corr-baseline-validate-001", "CorrelationIdentifier"),
    });
    const frozen = await baselines1.freezeProductBaseline({
      tenantId,
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      expectedVersion: validated.version,
      idempotencyKey: id("idem-baseline-freeze-001", "IdempotencyKey"),
      correlationId: id("corr-baseline-freeze-001", "CorrelationIdentifier"),
    });
    await trace1.appendTrace({
      tenantId,
      productionTraceId: id("trace-001", "ProductionTraceId"),
      sourceType: "WORK_ORDER",
      sourceId: created.workOrder.manufacturingWorkOrderId,
      targetType: "PRODUCT_VERSION",
      targetId: created.workOrder.productVersionRef.productVersionId as string,
      relationType: "WORK_ORDER_PRODUCT_BASELINE",
      workOrderId: created.workOrder.manufacturingWorkOrderId,
      idempotencyKey: id("idem-trace-001", "IdempotencyKey"),
      correlationId: id("corr-trace-001", "CorrelationIdentifier"),
    });

    await runtime1.stop();

    const runtime2 = await createRuntime(rootDir);
    const workOrders2 = runtime2.services.require("manufacturing.service.work-order").value;
    const routing2 = runtime2.services.require("manufacturing.service.execution-routing").value;
    const operations2 = runtime2.services.require("manufacturing.service.operation-execution").value;
    const trace2 = runtime2.services.require("manufacturing.service.traceability").value;

    const recovered = workOrders2.require(tenantId, created.workOrder.manufacturingWorkOrderId);
    expect(recovered.productBaselineState).toBe("FROZEN");
    expect(recovered.productBaselineSnapshot?.frozenAt).toBeDefined();
    expect(routing2.getExecutionRouting(tenantId, routed.routing.executionRoutingId as string)).toBeDefined();
    expect(operations2.listOperationsByWorkOrder(tenantId, created.workOrder.manufacturingWorkOrderId)).toHaveLength(initialized.length);
    expect(trace2.listProductionTrace(tenantId)).toHaveLength(1);

    const replay = await workOrders2.createWorkOrder(command);
    expect(replay.workOrder.manufacturingWorkOrderId).toBe(created.workOrder.manufacturingWorkOrderId);

    await expect(
      workOrders2.createWorkOrder({
        ...command,
        workOrderNumber: id("WO-CHANGED", "WorkOrderNumber"),
      }),
    ).rejects.toMatchObject({ classification: "CONFLICTING_IDEMPOTENCY_PAYLOAD" });

    await expect(
      workOrders2.planWorkOrder({
        workOrderId: created.workOrder.manufacturingWorkOrderId,
        tenantId,
        expectedVersion: 0,
        idempotencyKey: id("idem-plan-stale-001", "IdempotencyKey"),
        correlationId: id("corr-plan-stale-001", "CorrelationIdentifier"),
      }),
    ).rejects.toMatchObject({ classification: "STALE_EXPECTED_VERSION" });

    expect(frozen.baselineState).toBe("FROZEN");
    await runtime2.stop();
    await rm(rootDir, { recursive: true, force: true });
  });

  it("fails closed for unsupported schema, malformed manifest, duplicate work orders, and tenant mismatch", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gmdt-s10-corrupt-"));
    const runtime = await createRuntime(rootDir);
    const tenantId = id("tenant-corrupt", "TenantId");
    const workOrders = runtime.services.require("manufacturing.service.work-order").value;
    const created = await workOrders.createWorkOrder(createWorkOrder(tenantId, "101"));
    await runtime.stop();

    const manifestPath = join(rootDir, "manufacturing-manifest.json");
    const tenantPath = tenantFilePath(rootDir, tenantId);

    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
    const tenantPartition = JSON.parse(await readFile(tenantPath, "utf8")) as Record<string, unknown>;

    await writeFile(manifestPath, JSON.stringify({ ...manifest, manifest: { ...(manifest.manifest as Record<string, unknown>), schemaVersion: "9.9.9" } }, null, 2));
    await expect(createRuntime(rootDir)).rejects.toMatchObject({ code: "PARTIAL_INITIALIZATION_REJECTED" });

    await writeFile(manifestPath, "{ broken json", "utf8");
    await expect(createRuntime(rootDir)).rejects.toMatchObject({ code: "PARTIAL_INITIALIZATION_REJECTED" });

    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
    const duplicateTenant = structuredClone(tenantPartition) as Record<string, unknown>;
    duplicateTenant.workOrders = [
      ...((tenantPartition.workOrders as unknown[]) ?? []),
      structuredClone(((tenantPartition.workOrders as unknown[]) ?? [])[0]),
    ];
    await writeFile(tenantPath, JSON.stringify(duplicateTenant, null, 2), "utf8");
    await expect(createRuntime(rootDir)).rejects.toMatchObject({ code: "PARTIAL_INITIALIZATION_REJECTED" });

    const mismatchTenant = structuredClone(tenantPartition) as Record<string, unknown>;
    mismatchTenant.tenantId = "tenant-other";
    await writeFile(tenantPath, JSON.stringify(mismatchTenant, null, 2), "utf8");
    await expect(createRuntime(rootDir)).rejects.toMatchObject({ code: "PARTIAL_INITIALIZATION_REJECTED" });

    void created;
    await rm(rootDir, { recursive: true, force: true });
  });

  it("rolls back in-memory mutation when durable write fails and preserves the prior valid state", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gmdt-s10-write-fail-"));
    const runtime1 = await createRuntime(rootDir);
    const persistence = runtime1.services.require("manufacturing.service.persistence").value as { store?: { saveAll(envelope: unknown): Promise<void> } };
    const coordinator = persistence as unknown as { store: { saveAll(envelope: unknown): Promise<void> } };
    const originalSave = coordinator.store.saveAll.bind(coordinator.store);
    let failNext = true;
    coordinator.store.saveAll = async (envelope: unknown) => {
      if (failNext) {
        failNext = false;
        throw new Error("simulated durable write failure");
      }
      await originalSave(envelope);
    };

    const tenantId = id("tenant-write-fail", "TenantId");
    const workOrders1 = runtime1.services.require("manufacturing.service.work-order").value;
    await expect(workOrders1.createWorkOrder(createWorkOrder(tenantId, "500"))).rejects.toMatchObject({
      classification: "PERSISTENCE_WRITE_FAILURE",
    });
    expect(workOrders1.listWorkOrders(tenantId)).toHaveLength(0);
    await runtime1.stop();

    const runtime2 = await createRuntime(rootDir);
    const workOrders2 = runtime2.services.require("manufacturing.service.work-order").value;
    expect(workOrders2.listWorkOrders(tenantId)).toHaveLength(0);
    await runtime2.stop();
    await rm(rootDir, { recursive: true, force: true });
  });

  it("keeps tenant partitions deterministic and isolated", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gmdt-s10-tenants-"));
    const runtime1 = await createRuntime(rootDir);
    const workOrders1 = runtime1.services.require("manufacturing.service.work-order").value;
    const tenantA = id("tenant-a", "TenantId");
    const tenantB = id("tenant-b", "TenantId");
    const workOrderA = await workOrders1.createWorkOrder(createWorkOrder(tenantA, "201"));
    const workOrderB = await workOrders1.createWorkOrder(createWorkOrder(tenantB, "202"));
    await runtime1.stop();

    const manifest = JSON.parse(await readFile(join(rootDir, "manufacturing-manifest.json"), "utf8")) as {
      manifest: { tenantIds: string[] };
    };
    expect(manifest.manifest.tenantIds).toEqual([tenantA, tenantB]);

    const runtime2 = await createRuntime(rootDir);
    const workOrders2 = runtime2.services.require("manufacturing.service.work-order").value;
    expect(workOrders2.require(tenantA, workOrderA.workOrder.manufacturingWorkOrderId)).toBeDefined();
    expect(workOrders2.require(tenantB, workOrderB.workOrder.manufacturingWorkOrderId)).toBeDefined();
    expect(workOrders2.getWorkOrder(tenantA, workOrderB.workOrder.manufacturingWorkOrderId)).toBeUndefined();
    await runtime2.stop();
    await rm(rootDir, { recursive: true, force: true });
  });
});
