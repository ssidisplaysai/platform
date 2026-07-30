import {
  acceptQuote,
  addQuoteLine,
  approveQuote,
  createQuote,
  presentQuote,
  resetQuoteRepositoryForTests,
  submitQuote,
} from "@/modules/foundation/quote-repository";
import {
  approveSalesOrder,
  createSalesOrderFromQuote,
  resetSalesOrderRepositoryForTests,
} from "@/modules/foundation/sales-order-repository";
import {
  cancelWorkOrder,
  completeWorkOrder,
  createWorkOrderFromOrder,
  createWorkOrderRevision,
  getWorkOrderBySalesOrderId,
  listWorkOrderAuditEvents,
  listWorkOrderPublishedEvents,
  listWorkOrderTimeline,
  pauseWorkOrder,
  planWorkOrder,
  releaseWorkOrder,
  resetWorkOrderRepositoryForTests,
  resumeWorkOrder,
  searchWorkOrderRegistry,
} from "@/modules/foundation/work-order-repository";

function createReleasedSalesOrderForWorkOrder(): string {
  const created = createQuote({
    organizationId: "led-display-warehouse",
    customerReference: "cust-ledw-stadium-group",
    primaryContactReference: null,
    ownerReference: "owner-ledw-commerce",
    salesRepresentativeReference: "sales-ledw-001",
    siteReference: "site-led-display-warehouse-production",
    currency: "USD",
    effectiveDate: "2026-01-01T00:00:00.000Z",
    expirationDate: "2026-01-31T00:00:00.000Z",
    commercialTerms: {
      paymentTermsReference: "net-30",
      freightTermsReference: "fob",
      exchangeRate: 1,
    },
    internalNotes: null,
    customerNotes: null,
    metadata: {
      source: "test",
    },
    actor: "test",
  });

  const quoteId = created.quote?.documentId as string;

  addQuoteLine({
    quoteId,
    actor: "test",
    line: {
      productId: "prod-indoor-led-video-wall",
      sku: "LEDW-IN-001",
      productRevision: "rev-1",
      catalogRevision: "cat-1",
      displayName: "Indoor LED Wall",
      description: null,
      quantity: 2,
      unitOfMeasure: "ea",
      unitPrice: 1000,
      discount: 100,
      currency: "USD",
      taxClassification: null,
      siteReference: "site-led-display-warehouse-production",
      metadata: {},
    },
  });

  submitQuote({ quoteId, actor: "sales-manager", notes: null });
  approveQuote({ quoteId, actor: "sales-manager", notes: "approved" });
  presentQuote({ quoteId, actor: "sales-rep", notes: null });
  acceptQuote({ quoteId, actor: "customer", notes: "accepted" });

  const order = createSalesOrderFromQuote({
    payload: {
      quoteId,
      referenceNumber: "PO-WO-001",
    },
    actor: "sales-rep",
  });

  const orderId = order.order?.documentId as string;
  approveSalesOrder({
    orderId,
    actor: "sales-manager",
    notes: "approved for manufacturing conversion",
  });

  return orderId;
}

describe("GMP-0002 work order foundation", () => {
  beforeEach(() => {
    resetQuoteRepositoryForTests();
    resetSalesOrderRepositoryForTests();
    resetWorkOrderRepositoryForTests();
  });

  test("creates work order from sales order with immutable commercial lineage", () => {
    const orderId = createReleasedSalesOrderForWorkOrder();

    const created = createWorkOrderFromOrder({
      payload: {
        orderId,
        referenceNumber: "WO-REF-001",
        correlationId: null,
        causationId: null,
      },
      actor: "planner",
    });

    expect(created.validation.valid).toBe(true);
    expect(created.workOrder).toBeTruthy();
    expect(created.workOrder?.commercialLineage.originSalesOrderId).toBe(orderId);
    expect(created.workOrder?.commercialLineage.originQuoteId.length).toBeGreaterThan(0);
    expect(created.workOrder?.lines.length).toBeGreaterThan(0);

    const duplicate = createWorkOrderFromOrder({
      payload: {
        orderId,
        referenceNumber: null,
        correlationId: null,
        causationId: null,
      },
      actor: "planner",
    });

    expect(duplicate.validation.valid).toBe(false);
    expect(getWorkOrderBySalesOrderId(orderId)?.documentId).toBe(created.workOrder?.documentId);
  });

  test("release pause resume cancel lifecycle emits deterministic events", () => {
    const orderId = createReleasedSalesOrderForWorkOrder();
    const created = createWorkOrderFromOrder({
      payload: {
        orderId,
        referenceNumber: "WO-REF-002",
        correlationId: "corr-2",
        causationId: "cause-2",
      },
      actor: "planner",
    });

    const workOrderId = created.workOrder?.documentId as string;

    const releaseFromDraft = releaseWorkOrder({ workOrderId, actor: "planner" });
    expect(releaseFromDraft.validation.valid).toBe(false);

    const pauseFromDraft = pauseWorkOrder({ workOrderId, actor: "supervisor" });
    expect(pauseFromDraft.validation.valid).toBe(false);

    const planned = planWorkOrder({ workOrderId, actor: "planner" });
    expect(planned.validation.valid).toBe(true);
    expect(planned.workOrder?.status).toBe("planned");

    const released = releaseWorkOrder({ workOrderId, actor: "planner" });
    expect(released.validation.valid).toBe(true);
    expect(released.workOrder?.status).toBe("released");

    const resumeWhileReleased = resumeWorkOrder({ workOrderId, actor: "supervisor" });
    expect(resumeWhileReleased.validation.valid).toBe(false);

    const pauseWhileReleased = pauseWorkOrder({ workOrderId, actor: "supervisor" });
    expect(pauseWhileReleased.validation.valid).toBe(false);

    const completed = completeWorkOrder({ workOrderId, actor: "supervisor" });
    expect(completed.validation.valid).toBe(false);

    const cancelled = cancelWorkOrder({ workOrderId, actor: "supervisor" });
    expect(cancelled.validation.valid).toBe(true);
    expect(cancelled.workOrder?.status).toBe("cancelled");

    const events = listWorkOrderPublishedEvents(workOrderId);
    expect(events.some((event) => event.type === "WorkOrderCreated")).toBe(true);
    expect(events.some((event) => event.type === "WorkOrderReleased")).toBe(true);
    expect(events.some((event) => event.type === "WorkOrderCancelled")).toBe(true);
  });

  test("revision, audit, timeline, and search provide work-order traceability", () => {
    const orderId = createReleasedSalesOrderForWorkOrder();
    const created = createWorkOrderFromOrder({
      payload: {
        orderId,
        referenceNumber: "WO-SEARCH-77",
        correlationId: null,
        causationId: null,
      },
      actor: "planner",
    });

    const workOrderId = created.workOrder?.documentId as string;

    const revision = createWorkOrderRevision({
      workOrderId,
      actor: "planner",
      reason: "Updated manufacturing reference",
      changedFields: ["referenceNumber"],
    });

    expect(revision.validation.valid).toBe(true);

    const audit = listWorkOrderAuditEvents(workOrderId);
    expect(audit.length).toBeGreaterThan(0);
    expect(audit.some((event) => event.action === "work_order_revision_created")).toBe(true);

    const timeline = listWorkOrderTimeline(workOrderId);
    expect(timeline.length).toBeGreaterThan(0);

    const search = searchWorkOrderRegistry({
      organizationId: "led-display-warehouse",
      query: "SEARCH-77",
    });

    expect(search.length).toBeGreaterThan(0);
    expect(search[0]?.workOrderId).toBe(workOrderId);
  });
});
