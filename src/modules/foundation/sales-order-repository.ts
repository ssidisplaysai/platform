import {
  FoundationPersistenceConflictError,
  deepClone,
  loadPersistedState,
  resetPersistedState,
  savePersistedState,
} from "./foundation-persistence";
import { FOUNDATION_SALES_ORDERS } from "./sales-order-fixtures";
import { filterSalesOrders, searchSalesOrders } from "./sales-order-selectors";
import type {
  CreateSalesOrderFromQuoteInput,
  CreateSalesOrderInput,
  SalesOrderApprovalHistoryRecord,
  SalesOrderAuditEvent,
  SalesOrderPublishedEvent,
  SalesOrderRecord,
  SalesOrderRevisionRecord,
  SalesOrderTimelineEntry,
  SalesOrderValidationResult,
  SalesOrderStatus,
  UpdateSalesOrderDraftInput,
  SalesOrderListFilters,
  SalesOrderSearchFilters,
  SalesOrderSearchResult,
} from "./sales-order-types";
import {
  validateCreateSalesOrderInput,
  validateUpdateSalesOrderDraftInput,
} from "./sales-order-validation";
import {
  convertQuoteToOrderContract,
  getQuoteById,
  listQuoteAuditEvents,
} from "./quote-repository";

const PERSISTENCE_NAMESPACE = "sales-order-repository";

type SalesOrderRepositoryState = {
  orders: SalesOrderRecord[];
  auditEvents: SalesOrderAuditEvent[];
  publishedEvents: SalesOrderPublishedEvent[];
  sequenceByOrganization: Record<string, number>;
  orderIdByQuoteId: Record<string, string>;
};

const orderStore = new Map<string, SalesOrderRecord>();
const auditStore = new Map<string, SalesOrderAuditEvent>();
const eventStore = new Map<string, SalesOrderPublishedEvent>();
let sequenceByOrganization: Record<string, number> = {};
let orderIdByQuoteId: Record<string, string> = {};
let stateRevision = 0;

function nowIso(): string {
  return new Date().toISOString();
}

function createSeedState(): SalesOrderRepositoryState {
  return {
    orders: FOUNDATION_SALES_ORDERS.map((order) => deepClone(order)),
    auditEvents: [],
    publishedEvents: [],
    sequenceByOrganization: {},
    orderIdByQuoteId: {},
  };
}

function applyState(state: SalesOrderRepositoryState): void {
  orderStore.clear();
  state.orders.forEach((order) => {
    orderStore.set(order.documentId, deepClone(order));
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
  orderIdByQuoteId = { ...state.orderIdByQuoteId };
}

function snapshotState(): SalesOrderRepositoryState {
  return {
    orders: Array.from(orderStore.values()).map((order) => deepClone(order)),
    auditEvents: Array.from(auditStore.values()).map((event) => deepClone(event)),
    publishedEvents: Array.from(eventStore.values()).map((event) => deepClone(event)),
    sequenceByOrganization: { ...sequenceByOrganization },
    orderIdByQuoteId: { ...orderIdByQuoteId },
  };
}

function loadStateFromPersistence(): void {
  const loaded = loadPersistedState<SalesOrderRepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: createSeedState,
  });

  applyState(loaded.state);
  stateRevision = loaded.revision;
}

function persistCurrentState(): void {
  const saved = savePersistedState<SalesOrderRepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    state: snapshotState(),
    expectedRevision: stateRevision,
  });

  stateRevision = saved.revision;
}

loadStateFromPersistence();

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

function nextSequenceForOrganization(organizationId: string): number {
  const current = sequenceByOrganization[organizationId] ?? 0;
  const next = current + 1;
  sequenceByOrganization = {
    ...sequenceByOrganization,
    [organizationId]: next,
  };
  return next;
}

function createOrderId(organizationId: string, sequence: number): string {
  return `order-${organizationId}-${sequence.toString().padStart(6, "0")}`;
}

function createOrderNumber(organizationId: string, sequence: number): string {
  return `SO-${new Date().getUTCFullYear()}-${organizationId.slice(0, 4).toUpperCase()}-${sequence.toString().padStart(6, "0")}`;
}

function createAuditId(orderId: string): string {
  return `order-audit-${orderId}-${Date.now()}-${Math.round(Math.random() * 1000)}`;
}

function createEventId(orderId: string): string {
  return `order-event-${orderId}-${Date.now()}-${Math.round(Math.random() * 1000)}`;
}

function createApprovalEntry(input: {
  status: SalesOrderApprovalHistoryRecord["status"];
  actor: string;
  notes: string | null;
}): SalesOrderApprovalHistoryRecord {
  return {
    status: input.status,
    actor: input.actor,
    timestamp: nowIso(),
    notes: input.notes,
  };
}

function appendAuditEvent(input: {
  order: SalesOrderRecord;
  type: SalesOrderAuditEvent["type"];
  actor: string;
  summary: string;
  correlationId?: string | null;
}): SalesOrderAuditEvent {
  const event: SalesOrderAuditEvent = {
    eventId: createAuditId(input.order.documentId),
    orderId: input.order.documentId,
    organizationId: input.order.organizationId,
    type: input.type,
    actor: input.actor,
    createdAt: nowIso(),
    summary: input.summary,
    correlationId: input.correlationId ?? null,
  };

  auditStore.set(event.eventId, event);
  return event;
}

function publishOrderEvent(input: {
  order: SalesOrderRecord;
  type: SalesOrderPublishedEvent["type"];
  actor: string;
  payload?: Readonly<Record<string, string | number | boolean | null>>;
}): SalesOrderPublishedEvent {
  const event: SalesOrderPublishedEvent = {
    eventId: createEventId(input.order.documentId),
    orderId: input.order.documentId,
    organizationId: input.order.organizationId,
    type: input.type,
    actor: input.actor,
    createdAt: nowIso(),
    payload: input.payload ?? {},
  };

  eventStore.set(event.eventId, event);
  return event;
}

function buildInitialRevisionRecord(input: {
  order: SalesOrderRecord;
  author: string;
  reason: string;
}): SalesOrderRevisionRecord {
  return {
    revisionNumber: input.order.revision,
    parentRevision: null,
    author: input.author,
    timestamp: nowIso(),
    reason: input.reason,
    changedFields: ["initial_creation"],
    previousStatus: input.order.status,
    nextStatus: input.order.status,
    previousTotals: deepClone(input.order.totals),
    nextTotals: deepClone(input.order.totals),
  };
}

function buildRevisionRecord(input: {
  order: SalesOrderRecord;
  author: string;
  reason: string;
  changedFields: readonly string[];
  nextStatus: SalesOrderStatus;
}): SalesOrderRevisionRecord {
  return {
    revisionNumber: input.order.revision + 1,
    parentRevision: input.order.revision,
    author: input.author,
    timestamp: nowIso(),
    reason: input.reason,
    changedFields: input.changedFields.length > 0 ? [...input.changedFields] : ["unspecified_change"],
    previousStatus: input.order.status,
    nextStatus: input.nextStatus,
    previousTotals: deepClone(input.order.totals),
    nextTotals: deepClone(input.order.totals),
  };
}

function getTransitionViolationMessage(input: {
  status: SalesOrderStatus;
  action: "submit" | "approve" | "release" | "cancel" | "close";
}): string | null {
  if (input.action === "submit") {
    return input.status === "draft" ? null : "Only draft orders can be submitted for approval.";
  }

  if (input.action === "approve") {
    return input.status === "pending_approval" || input.status === "draft"
      ? null
      : "Only draft or pending approval orders can be approved.";
  }

  if (input.action === "release") {
    return input.status === "approved" ? null : "Only approved orders can be released.";
  }

  if (input.action === "cancel") {
    return input.status === "completed" || input.status === "closed"
      ? "Completed or closed orders cannot be cancelled."
      : null;
  }

  if (input.action === "close") {
    return input.status === "completed" || input.status === "cancelled"
      ? null
      : "Only completed or cancelled orders can be closed.";
  }

  return null;
}

function normalizeFailure(field: string, error: unknown): SalesOrderValidationResult {
  return {
    valid: false,
    issues: [{ field, message: (error as Error).message }],
  };
}

export function listSalesOrders(filters: SalesOrderListFilters = {}): readonly SalesOrderRecord[] {
  return filterSalesOrders(Array.from(orderStore.values()), filters);
}

export function getSalesOrderById(orderId: string): SalesOrderRecord | null {
  return orderStore.get(orderId) ?? null;
}

export function getSalesOrderByQuoteId(quoteId: string): SalesOrderRecord | null {
  const orderId = orderIdByQuoteId[quoteId];
  if (!orderId) {
    return null;
  }
  return getSalesOrderById(orderId);
}

export function listSalesOrderAuditEvents(orderId: string): readonly SalesOrderAuditEvent[] {
  return Array.from(auditStore.values())
    .filter((event) => event.orderId === orderId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function listSalesOrderRevisions(orderId: string): readonly SalesOrderRevisionRecord[] {
  const order = orderStore.get(orderId);
  return order ? order.revisionHistory : [];
}

export function listSalesOrderPublishedEvents(orderId: string): readonly SalesOrderPublishedEvent[] {
  return Array.from(eventStore.values())
    .filter((event) => event.orderId === orderId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function listSalesOrderTimeline(orderId: string): readonly SalesOrderTimelineEntry[] {
  const order = orderStore.get(orderId);
  if (!order) {
    return [];
  }

  const auditEntries: SalesOrderTimelineEntry[] = listSalesOrderAuditEvents(orderId).map((event) => ({
    timestamp: event.createdAt,
    category: "audit",
    title: event.type,
    detail: event.summary,
  }));

  const revisionEntries: SalesOrderTimelineEntry[] = order.revisionHistory.map((revision) => ({
    timestamp: revision.timestamp,
    category: "revision",
    title: `Revision ${revision.revisionNumber}`,
    detail: `${revision.author}: ${revision.reason}`,
  }));

  const eventEntries: SalesOrderTimelineEntry[] = listSalesOrderPublishedEvents(orderId).map((event) => ({
    timestamp: event.createdAt,
    category: "event",
    title: event.type,
    detail: `Published by ${event.actor}`,
  }));

  return [...auditEntries, ...revisionEntries, ...eventEntries].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp),
  );
}

export function searchSalesOrderRegistry(filters: SalesOrderSearchFilters): readonly SalesOrderSearchResult[] {
  return searchSalesOrders(Array.from(orderStore.values()), filters);
}

export function createSalesOrder(input: CreateSalesOrderInput & { actor: string }): {
  validation: SalesOrderValidationResult;
  order: SalesOrderRecord | null;
} {
  const validation = validateCreateSalesOrderInput(input);
  if (!validation.valid) {
    return { validation, order: null };
  }

  if (orderIdByQuoteId[input.quoteLineage.quoteId]) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "quoteLineage.quoteId", message: "Sales order already exists for this quote." }],
      },
      order: null,
    };
  }

  try {
    const created = mutateWithRollback(() => {
      const sequence = nextSequenceForOrganization(input.organizationId);
      const orderId = createOrderId(input.organizationId, sequence);
      const orderNumber = createOrderNumber(input.organizationId, sequence);
      const timestamp = nowIso();

      const order: SalesOrderRecord = {
        documentId: orderId,
        documentNumber: orderNumber,
        orderNumber,
        organizationId: input.organizationId,
        owningApplicationId: "gcp",
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
        revision: 1,
        lifecycleState: "active",
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
          correlationId: null,
        },
        quoteLineage: input.quoteLineage,
        currency: input.currency,
        status: "draft",
        approvalStatus: "none",
        referenceNumber: input.referenceNumber,
        orderDate: input.orderDate,
        requestedDeliveryDate: input.requestedDeliveryDate,
        lines: input.lines.map((line) => deepClone(line)),
        totals: deepClone(input.totals),
        revisionHistory: [],
        approvalHistory: [],
      };

      order.revisionHistory = [
        buildInitialRevisionRecord({
          order,
          author: input.actor,
          reason: "Sales order created",
        }),
      ];

      orderStore.set(order.documentId, order);
      orderIdByQuoteId = {
        ...orderIdByQuoteId,
        [order.quoteLineage.quoteId]: order.documentId,
      };

      appendAuditEvent({
        order,
        type: "order_created",
        actor: input.actor,
        summary: `Sales order ${order.orderNumber} created from quote ${order.quoteLineage.quoteId}.`,
      });

      publishOrderEvent({
        order,
        type: "OrderCreated",
        actor: input.actor,
        payload: {
          quoteId: order.quoteLineage.quoteId,
          quoteRevision: order.quoteLineage.quoteRevision,
          customerReference: order.customerReference,
        },
      });

      return order;
    });

    return {
      validation,
      order: created,
    };
  } catch (error) {
    return {
      validation: normalizeFailure("order", error),
      order: null,
    };
  }
}

export function createSalesOrderFromQuote(input: {
  payload: CreateSalesOrderFromQuoteInput;
  actor: string;
}): {
  validation: SalesOrderValidationResult;
  order: SalesOrderRecord | null;
} {
  const quote = getQuoteById(input.payload.quoteId);
  if (!quote) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "quoteId", message: "Quote not found." }],
      },
      order: null,
    };
  }

  if (quote.commercialStatus !== "accepted" && quote.commercialStatus !== "converted") {
    return {
      validation: {
        valid: false,
        issues: [{ field: "quote", message: "Quote must be accepted before conversion to sales order." }],
      },
      order: null,
    };
  }

  if (quote.lines.length === 0) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "quote", message: "Quote must include at least one line for order conversion." }],
      },
      order: null,
    };
  }

  const existingOrder = getSalesOrderByQuoteId(quote.documentId);
  if (existingOrder) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "quoteId", message: "Sales order already exists for this quote." }],
      },
      order: null,
    };
  }

  const acceptanceEvent = listQuoteAuditEvents(quote.documentId)
    .filter((event) => event.type === "accepted")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];

  if (!acceptanceEvent) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "quote", message: "Quote acceptance event is required for conversion." }],
      },
      order: null,
    };
  }

  if (quote.commercialStatus === "accepted") {
    const conversionResult = convertQuoteToOrderContract({
      quoteId: quote.documentId,
      actor: input.actor,
      notes: "Sales order conversion initiated",
    });
    if (!conversionResult.validation.valid) {
      return {
        validation: conversionResult.validation,
        order: null,
      };
    }
  }

  const conversionEventId = createEventId(`convert-${quote.documentId}`);

  return createSalesOrder({
    organizationId: quote.organizationId,
    customerReference: quote.customerReference,
    ownerReference: quote.ownerReference,
    salesRepresentativeReference: quote.salesRepresentativeReference,
    siteReference: quote.siteReference,
    currency: quote.currency,
    quoteLineage: {
      quoteId: quote.documentId,
      quoteRevision: quote.revision,
      acceptanceTimestamp: acceptanceEvent.createdAt,
      acceptedBy: acceptanceEvent.actor,
      pricingSnapshotReference: `quote-pricing:${quote.documentId}:rev-${quote.revision}`,
      conversionEventId,
    },
    referenceNumber: input.payload.referenceNumber,
    orderDate: nowIso(),
    requestedDeliveryDate: null,
    lines: quote.lines.map((line) => ({ ...deepClone(line) })),
    totals: deepClone(quote.totals),
    metadata: {
      source: "quote_conversion",
      quoteNumber: quote.quoteNumber,
      quoteRevision: String(quote.revision),
    },
    actor: input.actor,
  });
}

export function updateSalesOrderDraft(input: {
  orderId: string;
  patch: UpdateSalesOrderDraftInput;
  actor: string;
  expectedVersion?: number;
}): {
  validation: SalesOrderValidationResult;
  order: SalesOrderRecord | null;
} {
  const existing = orderStore.get(input.orderId);
  if (!existing) {
    return {
      validation: { valid: false, issues: [{ field: "orderId", message: "Sales order not found." }] },
      order: null,
    };
  }

  if (input.expectedVersion !== undefined && input.expectedVersion !== existing.version) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "expectedVersion", message: "Version conflict detected." }],
      },
      order: null,
    };
  }

  const validation = validateUpdateSalesOrderDraftInput(existing, input.patch);
  if (!validation.valid) {
    return {
      validation,
      order: null,
    };
  }

  try {
    const updated = mutateWithRollback(() => {
      const next: SalesOrderRecord = {
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

      orderStore.set(next.documentId, next);
      appendAuditEvent({
        order: next,
        type: "order_updated",
        actor: input.actor,
        summary: "Sales order draft updated.",
      });

      return next;
    });

    return { validation, order: updated };
  } catch (error) {
    return {
      validation: normalizeFailure("order", error),
      order: null,
    };
  }
}

export function createSalesOrderRevision(input: {
  orderId: string;
  actor: string;
  reason: string;
  changedFields: readonly string[];
  expectedVersion?: number;
}): {
  validation: SalesOrderValidationResult;
  order: SalesOrderRecord | null;
  revision: SalesOrderRevisionRecord | null;
} {
  const order = orderStore.get(input.orderId);
  if (!order) {
    return {
      validation: { valid: false, issues: [{ field: "orderId", message: "Sales order not found." }] },
      order: null,
      revision: null,
    };
  }

  if (input.expectedVersion !== undefined && input.expectedVersion !== order.version) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "expectedVersion", message: "Version conflict detected." }],
      },
      order: null,
      revision: null,
    };
  }

  if (!input.reason || input.reason.trim().length < 3) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "reason", message: "Revision reason is required." }],
      },
      order: null,
      revision: null,
    };
  }

  try {
    const { updated, revision } = mutateWithRollback(() => {
      const revision = buildRevisionRecord({
        order,
        author: input.actor,
        reason: input.reason,
        changedFields: input.changedFields,
        nextStatus: order.status,
      });

      const next: SalesOrderRecord = {
        ...order,
        revision: revision.revisionNumber,
        revisionHistory: [...order.revisionHistory, revision],
        updatedAt: nowIso(),
        version: order.version + 1,
        auditEnvelope: {
          ...order.auditEnvelope,
          updatedBy: input.actor,
        },
      };

      orderStore.set(next.documentId, next);

      appendAuditEvent({
        order: next,
        type: "order_revision_created",
        actor: input.actor,
        summary: `Revision ${revision.revisionNumber} created: ${input.reason}`,
      });

      publishOrderEvent({
        order: next,
        type: "OrderRevised",
        actor: input.actor,
        payload: {
          revisionNumber: revision.revisionNumber,
          reason: input.reason,
        },
      });

      return { updated: next, revision };
    });

    return {
      validation: { valid: true, issues: [] },
      order: updated,
      revision,
    };
  } catch (error) {
    return {
      validation: normalizeFailure("revision", error),
      order: null,
      revision: null,
    };
  }
}

function transitionSalesOrder(input: {
  orderId: string;
  actor: string;
  action: "submit" | "approve" | "release" | "cancel" | "close";
  notes: string | null;
  expectedVersion?: number;
}): {
  validation: SalesOrderValidationResult;
  order: SalesOrderRecord | null;
} {
  const order = orderStore.get(input.orderId);
  if (!order) {
    return {
      validation: { valid: false, issues: [{ field: "orderId", message: "Sales order not found." }] },
      order: null,
    };
  }

  if (input.expectedVersion !== undefined && input.expectedVersion !== order.version) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "expectedVersion", message: "Version conflict detected." }],
      },
      order: null,
    };
  }

  const violation = getTransitionViolationMessage({
    status: order.status,
    action: input.action,
  });
  if (violation) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "status", message: violation }],
      },
      order: null,
    };
  }

  try {
    const updated = mutateWithRollback(() => {
      let nextStatus = order.status;
      let nextApprovalStatus = order.approvalStatus;
      let nextLifecycleState = order.lifecycleState;
      let auditType: SalesOrderAuditEvent["type"] = "order_updated";
      let eventType: SalesOrderPublishedEvent["type"] | null = null;
      const approvalHistory = [...order.approvalHistory];

      if (input.action === "submit") {
        nextStatus = "pending_approval";
        nextApprovalStatus = "pending";
        nextLifecycleState = "pending_review";
        auditType = "order_submitted";
        approvalHistory.push(createApprovalEntry({ status: "pending", actor: input.actor, notes: input.notes }));
      } else if (input.action === "approve") {
        nextStatus = "approved";
        nextApprovalStatus = "approved";
        nextLifecycleState = "approved";
        auditType = "order_approved";
        eventType = "OrderApproved";
        approvalHistory.push(createApprovalEntry({ status: "approved", actor: input.actor, notes: input.notes }));
      } else if (input.action === "release") {
        nextStatus = "released";
        nextLifecycleState = "active";
        auditType = "order_released";
        eventType = "OrderReleased";
      } else if (input.action === "cancel") {
        nextStatus = "cancelled";
        nextLifecycleState = "cancelled";
        auditType = "order_cancelled";
        eventType = "OrderCancelled";
      } else if (input.action === "close") {
        nextStatus = "closed";
        nextLifecycleState = "closed";
        auditType = "order_closed";
        eventType = "OrderClosed";
      }

      const next: SalesOrderRecord = {
        ...order,
        status: nextStatus,
        approvalStatus: nextApprovalStatus,
        lifecycleState: nextLifecycleState,
        approvalHistory,
        updatedAt: nowIso(),
        version: order.version + 1,
        auditEnvelope: {
          ...order.auditEnvelope,
          updatedBy: input.actor,
        },
      };

      orderStore.set(next.documentId, next);

      appendAuditEvent({
        order: next,
        type: auditType,
        actor: input.actor,
        summary: `Order status transition: ${order.status} -> ${nextStatus}`,
      });

      if (eventType) {
        publishOrderEvent({
          order: next,
          type: eventType,
          actor: input.actor,
          payload: {
            previousStatus: order.status,
            nextStatus,
          },
        });
      }

      return next;
    });

    return {
      validation: { valid: true, issues: [] },
      order: updated,
    };
  } catch (error) {
    return {
      validation: normalizeFailure("status", error),
      order: null,
    };
  }
}

export function submitSalesOrder(input: {
  orderId: string;
  actor: string;
  notes: string | null;
  expectedVersion?: number;
}) {
  return transitionSalesOrder({ ...input, action: "submit" });
}

export function approveSalesOrder(input: {
  orderId: string;
  actor: string;
  notes: string | null;
  expectedVersion?: number;
}) {
  return transitionSalesOrder({ ...input, action: "approve" });
}

export function releaseSalesOrder(input: {
  orderId: string;
  actor: string;
  notes: string | null;
  expectedVersion?: number;
}) {
  return transitionSalesOrder({ ...input, action: "release" });
}

export function cancelSalesOrder(input: {
  orderId: string;
  actor: string;
  notes: string | null;
  expectedVersion?: number;
}) {
  return transitionSalesOrder({ ...input, action: "cancel" });
}

export function closeSalesOrder(input: {
  orderId: string;
  actor: string;
  notes: string | null;
  expectedVersion?: number;
}) {
  return transitionSalesOrder({ ...input, action: "close" });
}

export function markSalesOrderViewed(input: {
  orderId: string;
  actor: string;
  correlationId?: string | null;
}): void {
  const order = orderStore.get(input.orderId);
  if (!order) {
    return;
  }

  try {
    mutateWithRollback(() => {
      appendAuditEvent({
        order,
        type: "order_viewed",
        actor: input.actor,
        summary: `Sales order ${order.orderNumber} viewed.`,
        correlationId: input.correlationId,
      });
      return true;
    });
  } catch {
    // Viewing should not fail route responses.
  }
}

export function resetSalesOrderRepositoryForTests(): void {
  const reset = resetPersistedState<SalesOrderRepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: createSeedState,
  });

  applyState(reset.state);
  stateRevision = reset.revision;
}

export function isSalesOrderVersionConflict(error: unknown): boolean {
  return error instanceof FoundationPersistenceConflictError;
}
