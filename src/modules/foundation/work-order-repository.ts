import {
  FoundationPersistenceConflictError,
  deepClone,
  loadPersistedState,
  resetPersistedState,
  savePersistedState,
} from "./foundation-persistence";
import { getSalesOrderById } from "./sales-order-repository";
import { filterWorkOrders, searchWorkOrders } from "./work-order-selectors";
import type {
  NewWorkOrderFromOrderInput,
  NewWorkOrderInput,
  UpdateWorkOrderDraftInput,
  WorkOrderAuditEvent,
  WorkOrderPublishedEvent,
  WorkOrderRecord,
  WorkOrderRevisionRecord,
  WorkOrderSearchFilters,
  WorkOrderSearchResult,
  WorkOrderStatus,
  WorkOrderTimelineEntry,
  WorkOrderValidationResult,
  WorkOrderListFilters,
} from "./work-order-types";
import {
  validateNewWorkOrderInput,
  validateUpdateWorkOrderDraftInput,
} from "./work-order-validation";
import { FOUNDATION_WORK_ORDERS } from "./work-order-fixtures";

const PERSISTENCE_NAMESPACE = "work-order-repository";
const WORK_ORDER_EVENT_CONTRACT_VERSION = "v1.0.0";

type WorkOrderRepositoryState = {
  workOrders: WorkOrderRecord[];
  auditEvents: WorkOrderAuditEvent[];
  publishedEvents: WorkOrderPublishedEvent[];
  sequenceByOrganization: Record<string, number>;
  workOrderIdBySalesOrderId: Record<string, string>;
};

const workOrderStore = new Map<string, WorkOrderRecord>();
const auditStore = new Map<string, WorkOrderAuditEvent>();
const eventStore = new Map<string, WorkOrderPublishedEvent>();
let sequenceByOrganization: Record<string, number> = {};
let workOrderIdBySalesOrderId: Record<string, string> = {};
let stateRevision = 0;

function nowIso(): string {
  return new Date().toISOString();
}

function createSeedState(): WorkOrderRepositoryState {
  return {
    workOrders: FOUNDATION_WORK_ORDERS.map((entry) => deepClone(entry)),
    auditEvents: [],
    publishedEvents: [],
    sequenceByOrganization: {},
    workOrderIdBySalesOrderId: {},
  };
}

function applyState(state: WorkOrderRepositoryState): void {
  workOrderStore.clear();
  state.workOrders.forEach((entry) => {
    workOrderStore.set(entry.documentId, deepClone(entry));
  });

  auditStore.clear();
  state.auditEvents.forEach((event) => {
    auditStore.set(event.eventId, deepClone(event));
  });

  eventStore.clear();
  state.publishedEvents.forEach((event) => {
    eventStore.set(event.eventId, deepClone(event));
  });

  sequenceByOrganization = { ...state.sequenceByOrganization };
  workOrderIdBySalesOrderId = { ...state.workOrderIdBySalesOrderId };
}

function snapshotState(): WorkOrderRepositoryState {
  return {
    workOrders: Array.from(workOrderStore.values()).map((entry) => deepClone(entry)),
    auditEvents: Array.from(auditStore.values()).map((event) => deepClone(event)),
    publishedEvents: Array.from(eventStore.values()).map((event) => deepClone(event)),
    sequenceByOrganization: { ...sequenceByOrganization },
    workOrderIdBySalesOrderId: { ...workOrderIdBySalesOrderId },
  };
}

function loadStateFromPersistence(): void {
  const loaded = loadPersistedState<WorkOrderRepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: createSeedState,
  });

  applyState(loaded.state);
  stateRevision = loaded.revision;
}

function persistCurrentState(): void {
  const saved = savePersistedState<WorkOrderRepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    state: snapshotState(),
    expectedRevision: stateRevision,
  });

  stateRevision = saved.revision;
}

function mutateWithRollback<T>(mutator: () => T): T {
  const snapshot = snapshotState();

  try {
    const result = mutator();
    persistCurrentState();
    return result;
  } catch (error) {
    applyState(snapshot);
    throw error;
  }
}

function createWorkOrderId(organizationId: string, sequence: number): string {
  return `work-order-${organizationId}-${sequence.toString().padStart(6, "0")}`;
}

function createWorkOrderNumber(organizationId: string, sequence: number): string {
  return `WO-${new Date().getUTCFullYear()}-${organizationId.slice(0, 4).toUpperCase()}-${sequence
    .toString()
    .padStart(6, "0")}`;
}

function createAuditId(workOrderId: string): string {
  return `work-order-audit-${workOrderId}-${Date.now()}-${Math.round(Math.random() * 1000)}`;
}

function createEventId(workOrderId: string): string {
  return `work-order-event-${workOrderId}-${Date.now()}-${Math.round(Math.random() * 1000)}`;
}

function nextSequenceForOrganization(organizationId: string): number {
  const current = sequenceByOrganization[organizationId] ?? 0;
  const next = current + 1;
  sequenceByOrganization = {
    ...sequenceByOrganization,
    [organizationId]: next,
  };
  return next;
}

function normalizeFailure(field: string, error: unknown): WorkOrderValidationResult {
  return {
    valid: false,
    issues: [{ field, message: (error as Error).message }],
  };
}

function buildInitialRevisionRecord(input: {
  workOrder: WorkOrderRecord;
  author: string;
  reason: string;
}): WorkOrderRevisionRecord {
  return {
    revisionNumber: input.workOrder.revision,
    parentRevision: null,
    author: input.author,
    timestamp: nowIso(),
    reason: input.reason,
    changedFields: ["initial_creation"],
    previousState: input.workOrder.status,
    resultingState: input.workOrder.status,
    lineageContinuity: true,
  };
}

function buildRevisionRecord(input: {
  workOrder: WorkOrderRecord;
  author: string;
  reason: string;
  changedFields: readonly string[];
  resultingState: WorkOrderStatus;
}): WorkOrderRevisionRecord {
  return {
    revisionNumber: input.workOrder.revision + 1,
    parentRevision: input.workOrder.revision,
    author: input.author,
    timestamp: nowIso(),
    reason: input.reason,
    changedFields: input.changedFields.length > 0 ? [...input.changedFields] : ["unspecified_change"],
    previousState: input.workOrder.status,
    resultingState: input.resultingState,
    lineageContinuity: true,
  };
}

function appendAuditEvent(input: {
  workOrder: WorkOrderRecord;
  actor: string;
  action: WorkOrderAuditEvent["action"];
  previousState: WorkOrderStatus;
  resultingState: WorkOrderStatus;
  correlationId: string;
  causationId: string;
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}): WorkOrderAuditEvent {
  const event: WorkOrderAuditEvent = {
    eventId: createAuditId(input.workOrder.documentId),
    workOrderId: input.workOrder.documentId,
    organizationId: input.workOrder.organizationId,
    actor: input.actor,
    action: input.action,
    previousState: input.previousState,
    resultingState: input.resultingState,
    correlationId: input.correlationId,
    causationId: input.causationId,
    metadata: input.metadata ?? {},
    createdAt: nowIso(),
  };

  auditStore.set(event.eventId, event);
  return event;
}

function publishWorkOrderEvent(input: {
  workOrder: WorkOrderRecord;
  actor: string;
  type: WorkOrderPublishedEvent["type"];
  correlationId: string;
  causationId: string;
  payload?: Readonly<Record<string, string | number | boolean | null>>;
}): WorkOrderPublishedEvent {
  const event: WorkOrderPublishedEvent = {
    eventId: createEventId(input.workOrder.documentId),
    contractVersion: WORK_ORDER_EVENT_CONTRACT_VERSION,
    aggregateType: "work_order",
    aggregateId: input.workOrder.documentId,
    aggregateVersion: input.workOrder.version,
    correlationId: input.correlationId,
    causationId: input.causationId,
    timestamp: nowIso(),
    actor: input.actor,
    organizationId: input.workOrder.organizationId,
    type: input.type,
    payload: input.payload ?? {},
    metadata: {
      schemaRef: "gmp.work-order.event.v1",
      producedBy: "gmp",
      status: input.workOrder.status,
    },
  };

  eventStore.set(event.eventId, event);
  return event;
}

function transitionViolationMessage(input: {
  status: WorkOrderStatus;
  action: "plan" | "release" | "start" | "pause" | "resume" | "complete" | "cancel" | "close";
}): string | null {
  if (input.action === "plan") {
    return input.status === "draft" ? null : "Only draft work orders can be planned.";
  }

  if (input.action === "release") {
    return input.status === "planned" ? null : "Only planned work orders can be released.";
  }

  if (input.action === "start") {
    return input.status === "released" ? null : "Only released work orders can enter production.";
  }

  if (input.action === "pause") {
    return input.status === "in_production" ? null : "Only in production work orders can be paused.";
  }

  if (input.action === "resume") {
    return input.status === "paused" ? null : "Only paused work orders can be resumed.";
  }

  if (input.action === "complete") {
    return input.status === "in_production" ? null : "Only in production work orders can be completed.";
  }

  if (input.action === "cancel") {
    return input.status === "completed" || input.status === "closed"
      ? "Completed or closed work orders cannot be cancelled."
      : null;
  }

  if (input.action === "close") {
    return input.status === "completed" || input.status === "cancelled"
      ? null
      : "Only completed or cancelled work orders can be closed.";
  }

  return null;
}

loadStateFromPersistence();

export function listWorkOrders(filters: WorkOrderListFilters = {}): readonly WorkOrderRecord[] {
  return filterWorkOrders(Array.from(workOrderStore.values()), filters);
}

export function getWorkOrderById(workOrderId: string): WorkOrderRecord | null {
  return workOrderStore.get(workOrderId) ?? null;
}

export function getWorkOrderBySalesOrderId(salesOrderId: string): WorkOrderRecord | null {
  const workOrderId = workOrderIdBySalesOrderId[salesOrderId];
  if (!workOrderId) {
    return null;
  }
  return getWorkOrderById(workOrderId);
}

export function listWorkOrderAuditEvents(workOrderId: string): readonly WorkOrderAuditEvent[] {
  return Array.from(auditStore.values())
    .filter((event) => event.workOrderId === workOrderId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function listWorkOrderRevisions(workOrderId: string): readonly WorkOrderRevisionRecord[] {
  const workOrder = workOrderStore.get(workOrderId);
  return workOrder ? workOrder.revisionHistory : [];
}

export function listWorkOrderPublishedEvents(workOrderId: string): readonly WorkOrderPublishedEvent[] {
  return Array.from(eventStore.values())
    .filter((event) => event.aggregateId === workOrderId)
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

export function listWorkOrderTimeline(workOrderId: string): readonly WorkOrderTimelineEntry[] {
  const workOrder = workOrderStore.get(workOrderId);
  if (!workOrder) {
    return [];
  }

  const auditEntries: WorkOrderTimelineEntry[] = listWorkOrderAuditEvents(workOrderId).map((entry) => ({
    timestamp: entry.createdAt,
    category: "audit",
    title: entry.action,
    detail: `${entry.previousState} -> ${entry.resultingState}`,
  }));

  const revisionEntries: WorkOrderTimelineEntry[] = workOrder.revisionHistory.map((entry) => ({
    timestamp: entry.timestamp,
    category: "revision",
    title: `Revision ${entry.revisionNumber}`,
    detail: `${entry.author}: ${entry.reason}`,
  }));

  const eventEntries: WorkOrderTimelineEntry[] = listWorkOrderPublishedEvents(workOrderId).map((entry) => ({
    timestamp: entry.timestamp,
    category: "event",
    title: entry.type,
    detail: `Published by ${entry.actor}`,
  }));

  return [...auditEntries, ...revisionEntries, ...eventEntries].sort((left, right) =>
    left.timestamp.localeCompare(right.timestamp),
  );
}

export function searchWorkOrderRegistry(filters: WorkOrderSearchFilters): readonly WorkOrderSearchResult[] {
  return searchWorkOrders(Array.from(workOrderStore.values()), filters);
}

export function createWorkOrder(input: NewWorkOrderInput & { actor: string }): {
  validation: WorkOrderValidationResult;
  workOrder: WorkOrderRecord | null;
} {
  const validation = validateNewWorkOrderInput(input);
  if (!validation.valid) {
    return { validation, workOrder: null };
  }

  if (workOrderIdBySalesOrderId[input.commercialLineage.originSalesOrderId]) {
    return {
      validation: {
        valid: false,
        issues: [
          {
            field: "commercialLineage.originSalesOrderId",
            message: "Work order already exists for this sales order.",
          },
        ],
      },
      workOrder: null,
    };
  }

  try {
    const created = mutateWithRollback(() => {
      const sequence = nextSequenceForOrganization(input.organizationId);
      const workOrderId = createWorkOrderId(input.organizationId, sequence);
      const workOrderNumber = createWorkOrderNumber(input.organizationId, sequence);
      const timestamp = nowIso();

      const workOrder: WorkOrderRecord = {
        documentId: workOrderId,
        documentNumber: workOrderNumber,
        workOrderNumber,
        organizationId: input.organizationId,
        owningApplicationId: "gmp",
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
        revision: 1,
        lifecycleState: "draft",
        customerReference: input.customerReference,
        customerContactReferences: [],
        ownerReference: input.ownerReference,
        salesRepresentativeReference: input.salesRepresentativeReference,
        billingAddress: null,
        shippingAddress: null,
        installationAddress: null,
        serviceAddress: null,
        attachments: [],
        notes: [],
        metadata: input.metadata,
        auditEnvelope: {
          createdBy: input.actor,
          updatedBy: input.actor,
          correlationId: input.commercialLineage.correlationId,
        },
        status: "draft",
        referenceNumber: input.referenceNumber,
        requestedStartDate: input.requestedStartDate,
        requestedCompletionDate: input.requestedCompletionDate,
        commercialLineage: input.commercialLineage,
        lines: input.lines.map((line) => deepClone(line)),
        revisionHistory: [],
      };

      workOrder.revisionHistory = [
        buildInitialRevisionRecord({
          workOrder,
          author: input.actor,
          reason: "Work order created",
        }),
      ];

      workOrderStore.set(workOrder.documentId, workOrder);
      workOrderIdBySalesOrderId = {
        ...workOrderIdBySalesOrderId,
        [workOrder.commercialLineage.originSalesOrderId]: workOrder.documentId,
      };

      appendAuditEvent({
        workOrder,
        actor: input.actor,
        action: "work_order_created",
        previousState: "draft",
        resultingState: "draft",
        correlationId: workOrder.commercialLineage.correlationId,
        causationId: workOrder.commercialLineage.causationId,
        metadata: {
          salesOrderId: workOrder.commercialLineage.originSalesOrderId,
          quoteId: workOrder.commercialLineage.originQuoteId,
        },
      });

      publishWorkOrderEvent({
        workOrder,
        actor: input.actor,
        type: "WorkOrderCreated",
        correlationId: workOrder.commercialLineage.correlationId,
        causationId: workOrder.commercialLineage.causationId,
        payload: {
          salesOrderId: workOrder.commercialLineage.originSalesOrderId,
          quoteId: workOrder.commercialLineage.originQuoteId,
        },
      });

      return workOrder;
    });

    return { validation, workOrder: created };
  } catch (error) {
    return { validation: normalizeFailure("workOrder", error), workOrder: null };
  }
}

export function createWorkOrderFromOrder(input: {
  payload: NewWorkOrderFromOrderInput;
  actor: string;
}): {
  validation: WorkOrderValidationResult;
  workOrder: WorkOrderRecord | null;
} {
  const order = getSalesOrderById(input.payload.orderId);
  if (!order) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "orderId", message: "Sales order not found." }],
      },
      workOrder: null,
    };
  }

  if (!["approved", "released", "completed"].includes(order.status)) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "order", message: "Sales order must be approved or released before conversion." }],
      },
      workOrder: null,
    };
  }

  if (order.lines.length === 0) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "order", message: "Sales order must include at least one line for conversion." }],
      },
      workOrder: null,
    };
  }

  const existing = getWorkOrderBySalesOrderId(order.documentId);
  if (existing) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "orderId", message: "Work order already exists for this sales order." }],
      },
      workOrder: null,
    };
  }

  const conversionEventId = createEventId(`convert-${order.documentId}`);

  return createWorkOrder({
    organizationId: order.organizationId,
    customerReference: order.customerReference,
    ownerReference: order.ownerReference,
    salesRepresentativeReference: order.salesRepresentativeReference,
    siteReference: order.siteReference,
    referenceNumber: input.payload.referenceNumber,
    requestedStartDate: null,
    requestedCompletionDate: null,
    commercialLineage: {
      originSalesOrderId: order.documentId,
      originSalesOrderRevision: order.revision,
      originQuoteId: order.quoteLineage.quoteId,
      originQuoteRevision: order.quoteLineage.quoteRevision,
      organizationId: order.organizationId,
      pricingSnapshotReference: order.quoteLineage.pricingSnapshotReference,
      conversionEventId,
      correlationId: input.payload.correlationId ?? conversionEventId,
      causationId: input.payload.causationId ?? conversionEventId,
      createdBy: input.actor,
      createdTimestamp: nowIso(),
      manufacturingVersion: "v1.0.0",
    },
    lines: order.lines.map((line) => ({
      lineId: `wo-line-${line.lineId}`,
      productId: line.productId,
      sku: line.sku,
      displayName: line.displayName,
      quantity: line.quantity,
      unitOfMeasure: line.unitOfMeasure,
      sourceSalesOrderLineId: line.lineId,
      metadata: line.metadata,
    })),
    metadata: {
      source: "sales_order_conversion",
      salesOrderNumber: order.orderNumber,
      quoteId: order.quoteLineage.quoteId,
      quoteRevision: String(order.quoteLineage.quoteRevision),
    },
    actor: input.actor,
  });
}

export function updateWorkOrderDraft(input: {
  workOrderId: string;
  patch: UpdateWorkOrderDraftInput;
  actor: string;
  expectedVersion?: number;
}): {
  validation: WorkOrderValidationResult;
  workOrder: WorkOrderRecord | null;
} {
  const existing = workOrderStore.get(input.workOrderId);
  if (!existing) {
    return {
      validation: { valid: false, issues: [{ field: "workOrderId", message: "Work order not found." }] },
      workOrder: null,
    };
  }

  if (input.expectedVersion !== undefined && input.expectedVersion !== existing.version) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "expectedVersion", message: "Version conflict detected." }],
      },
      workOrder: null,
    };
  }

  const validation = validateUpdateWorkOrderDraftInput(existing, input.patch);
  if (!validation.valid) {
    return { validation, workOrder: null };
  }

  try {
    const updated = mutateWithRollback(() => {
      const next: WorkOrderRecord = {
        ...existing,
        ...input.patch,
        metadata: input.patch.metadata ?? existing.metadata,
        updatedAt: nowIso(),
        version: existing.version + 1,
        auditEnvelope: {
          ...existing.auditEnvelope,
          updatedBy: input.actor,
        },
      };

      workOrderStore.set(next.documentId, next);

      appendAuditEvent({
        workOrder: next,
        actor: input.actor,
        action: "work_order_updated",
        previousState: existing.status,
        resultingState: next.status,
        correlationId: next.commercialLineage.correlationId,
        causationId: next.commercialLineage.causationId,
      });

      return next;
    });

    return { validation, workOrder: updated };
  } catch (error) {
    return { validation: normalizeFailure("workOrder", error), workOrder: null };
  }
}

export function createWorkOrderRevision(input: {
  workOrderId: string;
  actor: string;
  reason: string;
  changedFields: readonly string[];
  expectedVersion?: number;
}): {
  validation: WorkOrderValidationResult;
  workOrder: WorkOrderRecord | null;
  revision: WorkOrderRevisionRecord | null;
} {
  const workOrder = workOrderStore.get(input.workOrderId);
  if (!workOrder) {
    return {
      validation: { valid: false, issues: [{ field: "workOrderId", message: "Work order not found." }] },
      workOrder: null,
      revision: null,
    };
  }

  if (input.expectedVersion !== undefined && input.expectedVersion !== workOrder.version) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "expectedVersion", message: "Version conflict detected." }],
      },
      workOrder: null,
      revision: null,
    };
  }

  if (!input.reason || input.reason.trim().length < 3) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "reason", message: "Revision reason is required." }],
      },
      workOrder: null,
      revision: null,
    };
  }

  try {
    const result = mutateWithRollback(() => {
      const revision = buildRevisionRecord({
        workOrder,
        author: input.actor,
        reason: input.reason,
        changedFields: input.changedFields,
        resultingState: workOrder.status,
      });

      const next: WorkOrderRecord = {
        ...workOrder,
        revision: revision.revisionNumber,
        revisionHistory: [...workOrder.revisionHistory, revision],
        updatedAt: nowIso(),
        version: workOrder.version + 1,
        auditEnvelope: {
          ...workOrder.auditEnvelope,
          updatedBy: input.actor,
        },
      };

      workOrderStore.set(next.documentId, next);

      appendAuditEvent({
        workOrder: next,
        actor: input.actor,
        action: "work_order_revision_created",
        previousState: workOrder.status,
        resultingState: next.status,
        correlationId: next.commercialLineage.correlationId,
        causationId: next.commercialLineage.causationId,
        metadata: {
          revisionNumber: revision.revisionNumber,
          reason: input.reason,
        },
      });

      publishWorkOrderEvent({
        workOrder: next,
        actor: input.actor,
        type: "WorkOrderRevised",
        correlationId: next.commercialLineage.correlationId,
        causationId: next.commercialLineage.causationId,
        payload: {
          revisionNumber: revision.revisionNumber,
          reason: input.reason,
        },
      });

      return { workOrder: next, revision };
    });

    return {
      validation: { valid: true, issues: [] },
      workOrder: result.workOrder,
      revision: result.revision,
    };
  } catch (error) {
    return {
      validation: normalizeFailure("revision", error),
      workOrder: null,
      revision: null,
    };
  }
}

function transitionWorkOrder(input: {
  workOrderId: string;
  actor: string;
  action: "plan" | "release" | "start" | "pause" | "resume" | "complete" | "cancel" | "close";
  expectedVersion?: number;
  correlationId?: string | null;
  causationId?: string | null;
}): {
  validation: WorkOrderValidationResult;
  workOrder: WorkOrderRecord | null;
} {
  const existing = workOrderStore.get(input.workOrderId);
  if (!existing) {
    return {
      validation: { valid: false, issues: [{ field: "workOrderId", message: "Work order not found." }] },
      workOrder: null,
    };
  }

  if (input.expectedVersion !== undefined && input.expectedVersion !== existing.version) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "expectedVersion", message: "Version conflict detected." }],
      },
      workOrder: null,
    };
  }

  const violation = transitionViolationMessage({
    status: existing.status,
    action: input.action,
  });

  if (violation) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "status", message: violation }],
      },
      workOrder: null,
    };
  }

  try {
    const updated = mutateWithRollback(() => {
      let status = existing.status;
      let lifecycleState = existing.lifecycleState;
      let action: WorkOrderAuditEvent["action"] = "work_order_updated";
      let eventType: WorkOrderPublishedEvent["type"] | null = null;

      if (input.action === "plan") {
        status = "planned";
        lifecycleState = "pending_review";
        action = "work_order_planned";
      } else if (input.action === "release") {
        status = "released";
        lifecycleState = "approved";
        action = "work_order_released";
        eventType = "WorkOrderReleased";
      } else if (input.action === "start") {
        status = "in_production";
        lifecycleState = "active";
        action = "work_order_resumed";
        eventType = "WorkOrderResumed";
      } else if (input.action === "pause") {
        status = "paused";
        lifecycleState = "active";
        action = "work_order_paused";
        eventType = "WorkOrderPaused";
      } else if (input.action === "resume") {
        status = "in_production";
        lifecycleState = "active";
        action = "work_order_resumed";
        eventType = "WorkOrderResumed";
      } else if (input.action === "complete") {
        status = "completed";
        lifecycleState = "closed";
        action = "work_order_completed";
        eventType = "WorkOrderCompleted";
      } else if (input.action === "cancel") {
        status = "cancelled";
        lifecycleState = "cancelled";
        action = "work_order_cancelled";
        eventType = "WorkOrderCancelled";
      } else if (input.action === "close") {
        status = "closed";
        lifecycleState = "closed";
        action = "work_order_closed";
        eventType = "WorkOrderClosed";
      }

      const next: WorkOrderRecord = {
        ...existing,
        status,
        lifecycleState,
        updatedAt: nowIso(),
        version: existing.version + 1,
        auditEnvelope: {
          ...existing.auditEnvelope,
          updatedBy: input.actor,
          correlationId: input.correlationId ?? existing.commercialLineage.correlationId,
        },
      };

      workOrderStore.set(next.documentId, next);

      const correlationId = input.correlationId ?? existing.commercialLineage.correlationId;
      const causationId = input.causationId ?? existing.commercialLineage.causationId;

      appendAuditEvent({
        workOrder: next,
        actor: input.actor,
        action,
        previousState: existing.status,
        resultingState: next.status,
        correlationId,
        causationId,
      });

      if (eventType) {
        publishWorkOrderEvent({
          workOrder: next,
          actor: input.actor,
          type: eventType,
          correlationId,
          causationId,
          payload: {
            previousState: existing.status,
            resultingState: next.status,
          },
        });
      }

      return next;
    });

    return {
      validation: { valid: true, issues: [] },
      workOrder: updated,
    };
  } catch (error) {
    return {
      validation: normalizeFailure("status", error),
      workOrder: null,
    };
  }
}

export function planWorkOrder(input: {
  workOrderId: string;
  actor: string;
  expectedVersion?: number;
  correlationId?: string | null;
  causationId?: string | null;
}) {
  return transitionWorkOrder({ ...input, action: "plan" });
}

export function releaseWorkOrder(input: {
  workOrderId: string;
  actor: string;
  expectedVersion?: number;
  correlationId?: string | null;
  causationId?: string | null;
}) {
  return transitionWorkOrder({ ...input, action: "release" });
}

export function pauseWorkOrder(input: {
  workOrderId: string;
  actor: string;
  expectedVersion?: number;
  correlationId?: string | null;
  causationId?: string | null;
}) {
  return transitionWorkOrder({ ...input, action: "pause" });
}

export function cancelWorkOrder(input: {
  workOrderId: string;
  actor: string;
  expectedVersion?: number;
  correlationId?: string | null;
  causationId?: string | null;
}) {
  return transitionWorkOrder({ ...input, action: "cancel" });
}

export function resumeWorkOrder(input: {
  workOrderId: string;
  actor: string;
  expectedVersion?: number;
  correlationId?: string | null;
  causationId?: string | null;
}) {
  return transitionWorkOrder({ ...input, action: "resume" });
}

export function completeWorkOrder(input: {
  workOrderId: string;
  actor: string;
  expectedVersion?: number;
  correlationId?: string | null;
  causationId?: string | null;
}) {
  return transitionWorkOrder({ ...input, action: "complete" });
}

export function closeWorkOrder(input: {
  workOrderId: string;
  actor: string;
  expectedVersion?: number;
  correlationId?: string | null;
  causationId?: string | null;
}) {
  return transitionWorkOrder({ ...input, action: "close" });
}

export function markWorkOrderViewed(input: {
  workOrderId: string;
  actor: string;
  correlationId?: string | null;
  causationId?: string | null;
}): void {
  const workOrder = workOrderStore.get(input.workOrderId);
  if (!workOrder) {
    return;
  }

  try {
    mutateWithRollback(() => {
      appendAuditEvent({
        workOrder,
        actor: input.actor,
        action: "work_order_viewed",
        previousState: workOrder.status,
        resultingState: workOrder.status,
        correlationId: input.correlationId ?? workOrder.commercialLineage.correlationId,
        causationId: input.causationId ?? workOrder.commercialLineage.causationId,
      });
      return true;
    });
  } catch {
    // Viewing should not fail caller responses.
  }
}

export function resetWorkOrderRepositoryForTests(): void {
  const reset = resetPersistedState<WorkOrderRepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: createSeedState,
  });

  applyState(reset.state);
  stateRevision = reset.revision;
}

export function isWorkOrderVersionConflict(error: unknown): boolean {
  return error instanceof FoundationPersistenceConflictError;
}
