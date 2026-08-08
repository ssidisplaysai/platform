import { compareDeterministicStrings, deterministicSort } from "../../shared";
import type {
  CommerceOrderReference,
  CompletedQuantity,
  CorrelationIdentifier,
  ExecutionRoutingId,
  IdempotencyKey,
  ManufacturingFailureClassification,
  ManufacturingWorkOrder,
  PlannedQuantity,
  ProductBomReference,
  ProductReference,
  ProductVariantReference,
  ProductVersionReference,
  RejectedQuantity,
  RequestedQuantity,
  ReworkQuantity,
  ScrapQuantity,
  TenantId,
  WorkOrderLifecycleState,
  WorkOrderNumber,
} from "../contracts";
import { ManufacturingDomainError } from "../domain";
import type {
  ManufacturingAuditSinkProvider,
  ManufacturingClockProvider,
  ManufacturingIdentifierProvider,
} from "../integration";

export type WorkOrderPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type ProductBaselineState = "UNVALIDATED" | "VALIDATED" | "FROZEN";

export type ManufacturingCommandMetadata = Readonly<{
  commandId: string;
  expectedVersion: number;
  requestedAt: string;
}>;

export type WorkOrderReadinessFlags = Readonly<{
  productBaselineReady: boolean;
  routingReady: boolean;
  materialsReady: boolean;
  requirementsReady: boolean;
  inventoryMaterialsReady: boolean;
  resourcesReady: boolean;
  executionReady: boolean;
}>;

export type WorkOrderProductBaselineSnapshot = Readonly<{
  productRef: ProductReference;
  productVariantRef?: ProductVariantReference;
  productVersionRef: ProductVersionReference;
  productBomRef: ProductBomReference;
  designRoutingReference?: string;
  contractVersion: string;
  validatedAt: string;
  frozenAt?: string;
}>;

export type WorkOrderExecutionStateProjection = Readonly<{
  workOrderId: string;
  tenantId: TenantId;
  lifecycleState: WorkOrderLifecycleState;
  productBaselineState: ProductBaselineState;
  readiness: WorkOrderReadinessFlags;
  holdState: "ACTIVE" | "ON_HOLD";
  plannedQuantity: PlannedQuantity;
  requestedQuantity: RequestedQuantity;
  completedQuantity: CompletedQuantity;
  rejectedQuantity: RejectedQuantity;
  scrapQuantity: ScrapQuantity;
  reworkQuantity: ReworkQuantity;
  runIds: readonly string[];
  batchIds: readonly string[];
  version: number;
}>;

export type ManufacturingWorkOrderRecord = Readonly<{
  workOrder: ManufacturingWorkOrder;
  metadata: Readonly<Record<string, string | number | boolean | null>>;
  priority: WorkOrderPriority;
  plannedStartAt?: string;
  plannedEndAt?: string;
  productBaselineState: ProductBaselineState;
  productBaselineSnapshot?: WorkOrderProductBaselineSnapshot;
  readiness: WorkOrderReadinessFlags;
  runIds: readonly string[];
  batchIds: readonly string[];
}>;

export type CreateManufacturingWorkOrder = Readonly<{
  workOrderId: ManufacturingWorkOrder["manufacturingWorkOrderId"];
  workOrderNumber: WorkOrderNumber;
  tenantId: TenantId;
  productRef: ProductReference;
  productVariantRef?: ProductVariantReference;
  productVersionRef: ProductVersionReference;
  productBomRef: ProductBomReference;
  requestedQuantity: RequestedQuantity;
  plannedQuantity: PlannedQuantity;
  priority: WorkOrderPriority;
  plannedStartAt?: string;
  plannedEndAt?: string;
  externalDemandRef?: CommerceOrderReference;
  idempotencyKey: IdempotencyKey;
  correlationId: CorrelationIdentifier;
  command: ManufacturingCommandMetadata;
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}>;

export type PlanManufacturingWorkOrder = Readonly<{
  workOrderId: ManufacturingWorkOrder["manufacturingWorkOrderId"];
  tenantId: TenantId;
  expectedVersion: number;
  idempotencyKey: IdempotencyKey;
  correlationId: CorrelationIdentifier;
  priority?: WorkOrderPriority;
  plannedStartAt?: string;
  plannedEndAt?: string;
  plannedQuantity?: PlannedQuantity;
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
  productBaselineState?: ProductBaselineState;
  readinessEvidence?: Readonly<{
    productBaselineReady?: boolean;
    routingReady?: boolean;
    materialsReady?: boolean;
    resourcesReady?: boolean;
  }>;
}>;

export type WorkOrderLifecycleCommand = Readonly<{
  workOrderId: ManufacturingWorkOrder["manufacturingWorkOrderId"];
  tenantId: TenantId;
  expectedVersion: number;
  idempotencyKey: IdempotencyKey;
  correlationId: CorrelationIdentifier;
}>;

type StoredIdempotency = Readonly<{
  payloadFingerprint: string;
  result: ManufacturingWorkOrderRecord;
}>;

function stableJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stableJson(item));
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort((left, right) => compareDeterministicStrings(left, right))) {
      result[key] = stableJson((value as Record<string, unknown>)[key]);
    }
    return result;
  }
  return value;
}

function createFingerprint(payload: unknown): string {
  return JSON.stringify(stableJson(payload));
}

function cloneRecord(record: ManufacturingWorkOrderRecord): ManufacturingWorkOrderRecord {
  return structuredClone(record);
}

function assertTimestampOrder(startAt?: string, endAt?: string): void {
  if (!startAt || !endAt) {
    return;
  }
  const start = Date.parse(startAt);
  const end = Date.parse(endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    throw new ManufacturingDomainError("INVALID_WORK_ORDER_QUANTITY", "planned start/end range is invalid", false);
  }
}

function asProductionStatus(value: string): ManufacturingWorkOrder["productionStatus"] {
  return value as ManufacturingWorkOrder["productionStatus"];
}

function asWipStatus(value: string): ManufacturingWorkOrder["workInProgressStatus"] {
  return value as ManufacturingWorkOrder["workInProgressStatus"];
}

function withExecutionReady(readiness: Omit<WorkOrderReadinessFlags, "executionReady">): WorkOrderReadinessFlags {
  const executionReady =
    readiness.productBaselineReady && readiness.routingReady && readiness.materialsReady && readiness.resourcesReady;
  return {
    ...readiness,
    executionReady,
  };
}

export class ManufacturingWorkOrderService {
  private readonly byId = new Map<string, ManufacturingWorkOrderRecord>();
  private readonly idByTenantAndNumber = new Map<string, string>();
  private readonly idempotency = new Map<string, StoredIdempotency>();

  constructor(
    private readonly dependencies: {
      clock: ManufacturingClockProvider;
      identifier: ManufacturingIdentifierProvider;
      audit: ManufacturingAuditSinkProvider;
    },
  ) {}

  async createWorkOrder(command: CreateManufacturingWorkOrder): Promise<ManufacturingWorkOrderRecord> {
    this.assertForeignReferenceShape(command);
    this.assertQuantityState(command.requestedQuantity, command.plannedQuantity);
    assertTimestampOrder(command.plannedStartAt, command.plannedEndAt);

    const payloadFingerprint = createFingerprint(command);
    const idempotencyKey = this.createIdempotencyKey(command.tenantId, "WORK_ORDER_CREATE", command.idempotencyKey);
    const replay = this.idempotency.get(idempotencyKey);
    if (replay) {
      if (replay.payloadFingerprint !== payloadFingerprint) {
        await this.audit(
          "CONFLICTING_IDEMPOTENCY_PAYLOAD",
          "Work order create rejected due to conflicting idempotency payload.",
          command,
          command.workOrderId,
          command.workOrderNumber,
          0,
          0,
        );
        throw new ManufacturingDomainError("CONFLICTING_IDEMPOTENCY_PAYLOAD", "conflicting idempotency payload", false);
      }
      await this.audit(
        "INVALID_COMMAND",
        "Work order create replay accepted.",
        command,
        command.workOrderId,
        command.workOrderNumber,
        replay.result.workOrder.version,
        replay.result.workOrder.version,
      );
      return cloneRecord(replay.result);
    }

    const workOrderId = command.workOrderId as string;
    if (this.byId.has(workOrderId)) {
      await this.audit(
        "DUPLICATE_WORK_ORDER_ID",
        "Work order create rejected due to duplicate identity.",
        command,
        command.workOrderId,
        command.workOrderNumber,
        0,
        0,
      );
      throw new ManufacturingDomainError("DUPLICATE_WORK_ORDER_ID", `duplicate work order id: ${workOrderId}`, false);
    }

    const numberKey = this.createTenantNumberKey(command.tenantId, command.workOrderNumber);
    if (this.idByTenantAndNumber.has(numberKey)) {
      await this.audit(
        "DUPLICATE_WORK_ORDER_NUMBER",
        "Work order create rejected due to duplicate work order number.",
        command,
        command.workOrderId,
        command.workOrderNumber,
        0,
        0,
      );
      throw new ManufacturingDomainError(
        "DUPLICATE_WORK_ORDER_NUMBER",
        `duplicate work order number within tenant: ${command.workOrderNumber}`,
        false,
      );
    }

    if (command.command.expectedVersion !== 0) {
      await this.audit(
        "STALE_EXPECTED_VERSION",
        "Work order create rejected due to non-zero expected version.",
        command,
        command.workOrderId,
        command.workOrderNumber,
        0,
        0,
      );
      throw new ManufacturingDomainError("STALE_EXPECTED_VERSION", "expected version must be 0 for create", false);
    }

    const zeroComplete = this.zeroQuantity(command.plannedQuantity) as CompletedQuantity;
    const zeroRejected = this.zeroQuantity(command.plannedQuantity) as RejectedQuantity;
    const zeroScrap = this.zeroQuantity(command.plannedQuantity) as ScrapQuantity;
    const zeroRework = this.zeroQuantity(command.plannedQuantity) as ReworkQuantity;

    const readiness = withExecutionReady({
      productBaselineReady: false,
      routingReady: false,
      materialsReady: false,
      requirementsReady: false,
      inventoryMaterialsReady: false,
      resourcesReady: false,
    });

    const created: ManufacturingWorkOrderRecord = {
      workOrder: {
        manufacturingWorkOrderId: command.workOrderId,
        workOrderNumber: command.workOrderNumber,
        tenantId: command.tenantId,
        productRef: command.productRef,
        productVariantRef: command.productVariantRef,
        productVersionRef: command.productVersionRef,
        productBomRef: command.productBomRef,
        requestedQuantity: command.requestedQuantity,
        plannedQuantity: command.plannedQuantity,
        completedQuantity: zeroComplete,
        rejectedQuantity: zeroRejected,
        scrapQuantity: zeroScrap,
        reworkQuantity: zeroRework,
        workOrderState: "DRAFT",
        productionStatus: asProductionStatus("PLANNED"),
        workInProgressStatus: asWipStatus("NOT_STARTED"),
        externalDemandRef: command.externalDemandRef,
        correlationId: command.correlationId,
        idempotencyKey: command.idempotencyKey,
        version: 1,
      },
      metadata: { ...(command.metadata ?? {}) },
      priority: command.priority,
      plannedStartAt: command.plannedStartAt,
      plannedEndAt: command.plannedEndAt,
      productBaselineState: "UNVALIDATED",
      readiness,
      runIds: [],
      batchIds: [],
    };

    this.byId.set(workOrderId, created);
    this.idByTenantAndNumber.set(numberKey, workOrderId);
    this.idempotency.set(idempotencyKey, {
      payloadFingerprint,
      result: cloneRecord(created),
    });

    await this.audit(
      "INVALID_COMMAND",
      "Work order created.",
      command,
      created.workOrder.manufacturingWorkOrderId,
      created.workOrder.workOrderNumber,
      0,
      created.workOrder.version,
    );

    return cloneRecord(created);
  }

  async planWorkOrder(command: PlanManufacturingWorkOrder): Promise<ManufacturingWorkOrderRecord> {
    return this.mutateLifecycle("WORK_ORDER_PLAN", command, "PLANNED", async (current) => {
      const readinessEvidence = command.readinessEvidence;
      const nextReadinessBase = {
        productBaselineReady: readinessEvidence?.productBaselineReady ?? current.readiness.productBaselineReady,
        routingReady: readinessEvidence?.routingReady ?? current.readiness.routingReady,
        materialsReady: readinessEvidence?.materialsReady ?? current.readiness.materialsReady,
        requirementsReady: current.readiness.requirementsReady,
        inventoryMaterialsReady: current.readiness.inventoryMaterialsReady,
        resourcesReady: readinessEvidence?.resourcesReady ?? current.readiness.resourcesReady,
      };

      if (command.plannedQuantity) {
        this.assertQuantityState(current.workOrder.requestedQuantity, command.plannedQuantity);
      }

      assertTimestampOrder(command.plannedStartAt ?? current.plannedStartAt, command.plannedEndAt ?? current.plannedEndAt);

      const productBaselineState = this.resolveProductBaselineState(current.productBaselineState, command.productBaselineState);

      return {
        ...current,
        workOrder: {
          ...current.workOrder,
          plannedQuantity: command.plannedQuantity ?? current.workOrder.plannedQuantity,
          workOrderState: "PLANNED",
        },
        metadata: {
          ...current.metadata,
          ...(command.metadata ?? {}),
        },
        priority: command.priority ?? current.priority,
        plannedStartAt: command.plannedStartAt ?? current.plannedStartAt,
        plannedEndAt: command.plannedEndAt ?? current.plannedEndAt,
        productBaselineState,
        readiness: withExecutionReady(nextReadinessBase),
      };
    });
  }

  async releaseWorkOrder(command: WorkOrderLifecycleCommand): Promise<ManufacturingWorkOrderRecord> {
    return this.mutateLifecycle("WORK_ORDER_RELEASE", command, "RELEASED", async (current) => {
      this.assertReleaseReadiness(current);
      return {
        ...current,
        workOrder: {
          ...current.workOrder,
          workOrderState: "RELEASED",
        },
      };
    });
  }

  async startWorkOrderExecution(command: WorkOrderLifecycleCommand): Promise<ManufacturingWorkOrderRecord> {
    const current = this.require(command.tenantId, command.workOrderId);
    if (!current.readiness.executionReady) {
      throw new ManufacturingDomainError("WORK_ORDER_NOT_READY", "work order execution readiness is not satisfied", false);
    }
    return this.mutateLifecycle("WORK_ORDER_START", command, "IN_PROGRESS", async (record) => record);
  }

  async pauseWorkOrder(command: WorkOrderLifecycleCommand): Promise<ManufacturingWorkOrderRecord> {
    return this.mutateLifecycle("WORK_ORDER_PAUSE", command, "PAUSED", async (current) => ({
      ...current,
      workOrder: {
        ...current.workOrder,
        workOrderState: "PAUSED",
      },
    }));
  }

  async resumeWorkOrder(command: WorkOrderLifecycleCommand): Promise<ManufacturingWorkOrderRecord> {
    return this.mutateLifecycle("WORK_ORDER_RESUME", command, "IN_PROGRESS", async (current) => {
      this.assertReleaseReadiness(current);
      return {
        ...current,
        workOrder: {
          ...current.workOrder,
          workOrderState: "IN_PROGRESS",
        },
      };
    });
  }

  async placeOnHoldWorkOrder(command: WorkOrderLifecycleCommand): Promise<ManufacturingWorkOrderRecord> {
    return this.mutateLifecycle("WORK_ORDER_HOLD", command, "ON_HOLD", async (current) => ({
      ...current,
      workOrder: {
        ...current.workOrder,
        workOrderState: "ON_HOLD",
      },
    }));
  }

  async releaseHoldWorkOrder(command: WorkOrderLifecycleCommand): Promise<ManufacturingWorkOrderRecord> {
    return this.mutateLifecycle("WORK_ORDER_RELEASE_HOLD", command, "READY", async (current) => ({
      ...current,
      workOrder: {
        ...current.workOrder,
        workOrderState: "READY",
      },
    }));
  }

  async cancelWorkOrder(command: WorkOrderLifecycleCommand): Promise<ManufacturingWorkOrderRecord> {
    return this.mutateLifecycle("WORK_ORDER_CANCEL", command, "CANCELLED", async (current) => ({
      ...current,
      workOrder: {
        ...current.workOrder,
        workOrderState: "CANCELLED",
      },
    }));
  }

  async completeWorkOrder(command: WorkOrderLifecycleCommand): Promise<ManufacturingWorkOrderRecord> {
    return this.mutateLifecycle("WORK_ORDER_COMPLETE", command, "COMPLETED", async (current) => {
      if (!current.readiness.executionReady) {
        throw new ManufacturingDomainError("WORK_ORDER_NOT_READY", "work order execution readiness is not satisfied", false);
      }
      return {
        ...current,
        workOrder: {
          ...current.workOrder,
          workOrderState: "COMPLETED",
        },
      };
    });
  }

  async closeWorkOrder(command: WorkOrderLifecycleCommand): Promise<ManufacturingWorkOrderRecord> {
    return this.mutateLifecycle("WORK_ORDER_CLOSE", command, "CLOSED", async (current) => ({
      ...current,
      workOrder: {
        ...current.workOrder,
        workOrderState: "CLOSED",
      },
    }));
  }

  getWorkOrder(tenantId: TenantId, workOrderId: string): ManufacturingWorkOrderRecord | undefined {
    const found = this.byId.get(workOrderId);
    if (!found || found.workOrder.tenantId !== tenantId) {
      return undefined;
    }
    return cloneRecord(found);
  }

  listWorkOrders(tenantId: TenantId): ManufacturingWorkOrderRecord[] {
    const values = [...this.byId.values()].filter((item) => item.workOrder.tenantId === tenantId);
    return deterministicSort(values, (item) => `${item.workOrder.workOrderNumber}:${item.workOrder.manufacturingWorkOrderId}`).map((item) =>
      cloneRecord(item),
    );
  }

  listWorkOrdersByProduct(tenantId: TenantId, productId: string): ManufacturingWorkOrderRecord[] {
    return this.listWorkOrders(tenantId).filter((item) => item.workOrder.productRef.productId === productId);
  }

  listWorkOrdersByStatus(tenantId: TenantId, status: WorkOrderLifecycleState): ManufacturingWorkOrderRecord[] {
    return this.listWorkOrders(tenantId).filter((item) => item.workOrder.workOrderState === status);
  }

  getExecutionState(tenantId: TenantId, workOrderId: string): WorkOrderExecutionStateProjection {
    const current = this.require(tenantId, workOrderId as ManufacturingWorkOrder["manufacturingWorkOrderId"]);
    return {
      workOrderId: current.workOrder.manufacturingWorkOrderId,
      tenantId: current.workOrder.tenantId,
      lifecycleState: current.workOrder.workOrderState,
      productBaselineState: current.productBaselineState,
      readiness: current.readiness,
      holdState: current.workOrder.workOrderState === "ON_HOLD" ? "ON_HOLD" : "ACTIVE",
      plannedQuantity: current.workOrder.plannedQuantity,
      requestedQuantity: current.workOrder.requestedQuantity,
      completedQuantity: current.workOrder.completedQuantity,
      rejectedQuantity: current.workOrder.rejectedQuantity,
      scrapQuantity: current.workOrder.scrapQuantity,
      reworkQuantity: current.workOrder.reworkQuantity,
      runIds: [...current.runIds],
      batchIds: [...current.batchIds],
      version: current.workOrder.version,
    };
  }

  registerRunBinding(tenantId: TenantId, workOrderId: ManufacturingWorkOrder["manufacturingWorkOrderId"], runId: string): void {
    const current = this.require(tenantId, workOrderId);
    if (current.runIds.includes(runId)) {
      return;
    }
    this.byId.set(workOrderId, {
      ...current,
      runIds: [...current.runIds, runId].sort(compareDeterministicStrings),
    });
  }

  registerRoutingBinding(input: {
    tenantId: TenantId;
    workOrderId: ManufacturingWorkOrder["manufacturingWorkOrderId"];
    executionRoutingId: ExecutionRoutingId;
    expectedVersion: number;
  }): ManufacturingWorkOrderRecord {
    const current = this.require(input.tenantId, input.workOrderId);
    this.assertExpectedVersion(current, input.expectedVersion);

    if (
      current.workOrder.executionRoutingId &&
      current.workOrder.executionRoutingId !== input.executionRoutingId
    ) {
      throw new ManufacturingDomainError("INVALID_ROUTING_REFERENCE", "work order already bound to a different routing", false);
    }

    const nextReadinessBase = {
      productBaselineReady: current.readiness.productBaselineReady,
      routingReady: true,
      materialsReady: current.readiness.materialsReady,
      requirementsReady: current.readiness.requirementsReady,
      inventoryMaterialsReady: current.readiness.inventoryMaterialsReady,
      resourcesReady: current.readiness.resourcesReady,
    };

    const updated: ManufacturingWorkOrderRecord = {
      ...current,
      workOrder: {
        ...current.workOrder,
        executionRoutingId: input.executionRoutingId,
        version: current.workOrder.version + 1,
      },
      readiness: withExecutionReady(nextReadinessBase),
    };

    this.byId.set(input.workOrderId as string, updated);
    return cloneRecord(updated);
  }

  registerBatchBinding(tenantId: TenantId, workOrderId: ManufacturingWorkOrder["manufacturingWorkOrderId"], batchId: string): void {
    const current = this.require(tenantId, workOrderId);
    if (current.batchIds.includes(batchId)) {
      return;
    }
    this.byId.set(workOrderId, {
      ...current,
      batchIds: [...current.batchIds, batchId].sort(compareDeterministicStrings),
    });
  }

  setProductBaselineState(input: {
    tenantId: TenantId;
    workOrderId: ManufacturingWorkOrder["manufacturingWorkOrderId"];
    expectedVersion: number;
    baselineState: ProductBaselineState;
    snapshot: WorkOrderProductBaselineSnapshot;
  }): ManufacturingWorkOrderRecord {
    const current = this.require(input.tenantId, input.workOrderId);
    this.assertExpectedVersion(current, input.expectedVersion);

    if (current.productBaselineState === "FROZEN") {
      const existing = current.productBaselineSnapshot;
      if (!existing) {
        throw new ManufacturingDomainError("PRODUCT_BASELINE_ALREADY_FROZEN", "product baseline is already frozen", false);
      }
      const unchanged =
        existing.productRef.productId === input.snapshot.productRef.productId &&
        existing.productVersionRef.productVersionId === input.snapshot.productVersionRef.productVersionId &&
        existing.productBomRef.productBomId === input.snapshot.productBomRef.productBomId &&
        existing.productBomRef.bomVersion === input.snapshot.productBomRef.bomVersion &&
        existing.designRoutingReference === input.snapshot.designRoutingReference;

      if (!unchanged) {
        throw new ManufacturingDomainError("PRODUCT_BASELINE_DRIFT", "frozen product baseline drift detected", false);
      }
      throw new ManufacturingDomainError("PRODUCT_BASELINE_ALREADY_FROZEN", "product baseline is already frozen", false);
    }

    if (input.baselineState === "FROZEN" && current.productBaselineState !== "VALIDATED") {
      throw new ManufacturingDomainError("PRODUCT_BASELINE_NOT_VALIDATED", "product baseline must be validated before freeze", false);
    }

    const nextReadinessBase = {
      productBaselineReady: input.baselineState === "FROZEN",
      routingReady: current.readiness.routingReady,
      materialsReady: current.readiness.materialsReady,
      requirementsReady: current.readiness.requirementsReady,
      inventoryMaterialsReady: current.readiness.inventoryMaterialsReady,
      resourcesReady: current.readiness.resourcesReady,
    };

    const updatedSnapshot: WorkOrderProductBaselineSnapshot = {
      ...input.snapshot,
      frozenAt: input.baselineState === "FROZEN" ? input.snapshot.frozenAt ?? this.dependencies.clock.now() : undefined,
    };

    const updated: ManufacturingWorkOrderRecord = {
      ...current,
      productBaselineState: input.baselineState,
      productBaselineSnapshot: updatedSnapshot,
      readiness: withExecutionReady(nextReadinessBase),
      workOrder: {
        ...current.workOrder,
        version: current.workOrder.version + 1,
      },
    };

    this.byId.set(input.workOrderId as string, updated);
    return cloneRecord(updated);
  }

  setMaterialRequirementModelReadiness(input: {
    tenantId: TenantId;
    workOrderId: ManufacturingWorkOrder["manufacturingWorkOrderId"];
    expectedVersion: number;
    requirementsReady: boolean;
    inventoryMaterialsReady?: boolean;
  }): ManufacturingWorkOrderRecord {
    const current = this.require(input.tenantId, input.workOrderId);
    this.assertExpectedVersion(current, input.expectedVersion);

    const inventoryMaterialsReady = input.inventoryMaterialsReady ?? current.readiness.inventoryMaterialsReady;
    const nextReadinessBase = {
      productBaselineReady: current.readiness.productBaselineReady,
      routingReady: current.readiness.routingReady,
      materialsReady: inventoryMaterialsReady,
      requirementsReady: input.requirementsReady,
      inventoryMaterialsReady,
      resourcesReady: current.readiness.resourcesReady,
    };

    const updated: ManufacturingWorkOrderRecord = {
      ...current,
      readiness: withExecutionReady(nextReadinessBase),
      workOrder: {
        ...current.workOrder,
        version: current.workOrder.version + 1,
      },
    };

    this.byId.set(input.workOrderId as string, updated);
    return cloneRecord(updated);
  }

  require(tenantId: TenantId, workOrderId: ManufacturingWorkOrder["manufacturingWorkOrderId"]): ManufacturingWorkOrderRecord {
    const found = this.byId.get(workOrderId as string);
    if (!found) {
      throw new ManufacturingDomainError("INVALID_WORK_ORDER_REFERENCE", `work order not found: ${workOrderId}`, false);
    }
    if (found.workOrder.tenantId !== tenantId) {
      throw new ManufacturingDomainError("TENANT_MISMATCH", "work order tenant mismatch", false);
    }
    return found;
  }

  private resolveProductBaselineState(current: ProductBaselineState, candidate?: ProductBaselineState): ProductBaselineState {
    if (!candidate || candidate === current) {
      return current;
    }
    const order: ProductBaselineState[] = ["UNVALIDATED", "VALIDATED", "FROZEN"];
    if (order.indexOf(candidate) < order.indexOf(current)) {
      throw new ManufacturingDomainError("INVALID_COMMAND", "product baseline state cannot move backwards", false);
    }
    return candidate;
  }

  private assertReleaseReadiness(current: ManufacturingWorkOrderRecord): void {
    if (current.productBaselineState !== "FROZEN") {
      throw new ManufacturingDomainError("PRODUCT_BASELINE_NOT_READY", "product baseline is not frozen", false);
    }
    if (!current.readiness.routingReady) {
      throw new ManufacturingDomainError("ROUTING_NOT_READY", "routing readiness is not satisfied", false);
    }
    if (!current.readiness.materialsReady) {
      throw new ManufacturingDomainError("MATERIALS_NOT_READY", "materials readiness is not satisfied", false);
    }
    if (!current.readiness.resourcesReady) {
      throw new ManufacturingDomainError("RESOURCES_NOT_READY", "resources readiness is not satisfied", false);
    }
  }

  private async mutateLifecycle(
    commandFamily: string,
    command: WorkOrderLifecycleCommand | PlanManufacturingWorkOrder,
    nextState: WorkOrderLifecycleState,
    mutate: (current: ManufacturingWorkOrderRecord) => Promise<ManufacturingWorkOrderRecord>,
  ): Promise<ManufacturingWorkOrderRecord> {
    const current = this.require(command.tenantId, command.workOrderId);
    this.assertMutableState(current.workOrder.workOrderState);

    const idempotencyKey = this.createIdempotencyKey(command.tenantId, commandFamily, command.idempotencyKey);
    const payloadFingerprint = createFingerprint(command);
    const replay = this.idempotency.get(idempotencyKey);
    if (replay) {
      if (replay.payloadFingerprint !== payloadFingerprint) {
        await this.audit(
          "CONFLICTING_IDEMPOTENCY_PAYLOAD",
          "Lifecycle command rejected due to conflicting idempotency payload.",
          command,
          current.workOrder.manufacturingWorkOrderId,
          current.workOrder.workOrderNumber,
          current.workOrder.version,
          current.workOrder.version,
        );
        throw new ManufacturingDomainError("CONFLICTING_IDEMPOTENCY_PAYLOAD", "conflicting idempotency payload", false);
      }
      await this.audit(
        "INVALID_COMMAND",
        "Lifecycle command replay accepted.",
        command,
        current.workOrder.manufacturingWorkOrderId,
        current.workOrder.workOrderNumber,
        replay.result.workOrder.version,
        replay.result.workOrder.version,
      );
      return cloneRecord(replay.result);
    }

    this.assertExpectedVersion(current, command.expectedVersion);

    const priorState = current.workOrder.workOrderState;
    const validTransition = this.isTransitionAllowed(priorState, nextState);
    if (!validTransition) {
      await this.audit(
        "INVALID_LIFECYCLE_TRANSITION",
        `Invalid lifecycle transition ${priorState} -> ${nextState}.`,
        command,
        current.workOrder.manufacturingWorkOrderId,
        current.workOrder.workOrderNumber,
        current.workOrder.version,
        current.workOrder.version,
      );
      throw new ManufacturingDomainError(
        "INVALID_LIFECYCLE_TRANSITION",
        `invalid work order lifecycle transition: ${priorState} -> ${nextState}`,
        false,
      );
    }

    const proposed = await mutate(cloneRecord(current));

    const updated: ManufacturingWorkOrderRecord = {
      ...proposed,
      workOrder: {
        ...proposed.workOrder,
        workOrderState: nextState,
        version: current.workOrder.version + 1,
      },
    };

    this.byId.set(updated.workOrder.manufacturingWorkOrderId as string, updated);
    this.idempotency.set(idempotencyKey, {
      payloadFingerprint,
      result: cloneRecord(updated),
    });

    await this.audit(
      "INVALID_COMMAND",
      `Work order lifecycle changed: ${priorState} -> ${nextState}`,
      command,
      updated.workOrder.manufacturingWorkOrderId,
      updated.workOrder.workOrderNumber,
      current.workOrder.version,
      updated.workOrder.version,
    );

    return cloneRecord(updated);
  }

  private isTransitionAllowed(from: WorkOrderLifecycleState, to: WorkOrderLifecycleState): boolean {
    const table: Readonly<Record<WorkOrderLifecycleState, readonly WorkOrderLifecycleState[]>> = {
      DRAFT: ["PLANNED", "CANCELLED"],
      PLANNED: ["RELEASED", "CANCELLED"],
      RELEASED: ["READY", "ON_HOLD", "CANCELLED"],
      READY: ["IN_PROGRESS", "ON_HOLD", "CANCELLED"],
      IN_PROGRESS: ["PAUSED", "ON_HOLD", "PARTIALLY_COMPLETED", "COMPLETED", "CANCELLED"],
      PAUSED: ["IN_PROGRESS", "ON_HOLD", "CANCELLED"],
      BLOCKED: ["READY", "ON_HOLD", "CANCELLED"],
      ON_HOLD: ["READY", "CANCELLED"],
      PARTIALLY_COMPLETED: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
      COMPLETED: ["CLOSED"],
      CANCELLED: ["CLOSED"],
      CLOSED: ["ARCHIVED"],
      ARCHIVED: [],
    };
    return table[from].includes(to);
  }

  private assertExpectedVersion(record: ManufacturingWorkOrderRecord, expectedVersion: number): void {
    if (record.workOrder.version !== expectedVersion) {
      throw new ManufacturingDomainError(
        "STALE_EXPECTED_VERSION",
        `stale expected version: expected ${expectedVersion}, current ${record.workOrder.version}`,
        false,
      );
    }
  }

  private assertMutableState(state: WorkOrderLifecycleState): void {
    if (state === "ARCHIVED" || state === "CLOSED") {
      throw new ManufacturingDomainError("TERMINAL_WORK_ORDER_MUTATION", `terminal work order mutation: ${state}`, false);
    }
  }

  private assertForeignReferenceShape(command: CreateManufacturingWorkOrder): void {
    if (command.productRef.tenantId !== command.tenantId) {
      throw new ManufacturingDomainError("INVALID_WORK_ORDER_REFERENCE", "product tenant mismatch", false);
    }
    if (command.productVariantRef && command.productVariantRef.tenantId !== command.tenantId) {
      throw new ManufacturingDomainError("INVALID_WORK_ORDER_REFERENCE", "product variant tenant mismatch", false);
    }
    if (command.productVersionRef.tenantId !== command.tenantId || command.productBomRef.tenantId !== command.tenantId) {
      throw new ManufacturingDomainError("INVALID_WORK_ORDER_REFERENCE", "product baseline tenant mismatch", false);
    }
  }

  private assertQuantityState(requested: RequestedQuantity, planned: PlannedQuantity): void {
    if (requested.value < 0 || planned.value < 0) {
      throw new ManufacturingDomainError("INVALID_WORK_ORDER_QUANTITY", "quantities must be non-negative", false);
    }
    if (requested.unitOfMeasure !== planned.unitOfMeasure) {
      throw new ManufacturingDomainError("INVALID_WORK_ORDER_QUANTITY", "requested and planned units must match", false);
    }
    if (planned.value > requested.value) {
      throw new ManufacturingDomainError("INVALID_WORK_ORDER_QUANTITY", "planned quantity cannot exceed requested quantity", false);
    }
  }

  private zeroQuantity(quantity: PlannedQuantity | RequestedQuantity): PlannedQuantity {
    return {
      value: 0,
      unitOfMeasure: quantity.unitOfMeasure,
    } as PlannedQuantity;
  }

  private createTenantNumberKey(tenantId: TenantId, workOrderNumber: WorkOrderNumber): string {
    return `${tenantId}:${workOrderNumber}`;
  }

  private createIdempotencyKey(tenantId: TenantId, commandFamily: string, idempotencyKey: IdempotencyKey): string {
    return `${tenantId}:${commandFamily}:${idempotencyKey}`;
  }

  private async audit(
    classification: ManufacturingFailureClassification,
    message: string,
    command: { tenantId: TenantId; correlationId: CorrelationIdentifier; idempotencyKey: IdempotencyKey },
    entityId: ManufacturingWorkOrder["manufacturingWorkOrderId"],
    businessIdentifier: WorkOrderNumber,
    priorVersion: number,
    resultingVersion: number,
  ): Promise<void> {
    await this.dependencies.audit.recordAudit({
      eventType: "manufacturing.work-order",
      message,
      recordedAt: this.dependencies.clock.now(),
      details: {
        tenantId: command.tenantId,
        entityType: "WORK_ORDER",
        entityId,
        businessIdentifier,
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
