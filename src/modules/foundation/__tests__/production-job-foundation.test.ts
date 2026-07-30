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
  createWorkOrderFromOrder,
  planWorkOrder,
  releaseWorkOrder,
  resetWorkOrderRepositoryForTests,
} from "@/modules/foundation/work-order-repository";
import {
  cancelProductionJob,
  completeProductionJob,
  createProductionJobFromWorkOrder,
  createProductionJobRevision,
  getProductionJobByWorkOrderId,
  listProductionJobAuditEvents,
  listProductionJobPublishedEvents,
  listProductionJobTimeline,
  pauseProductionJob,
  queueProductionJob,
  readyProductionJob,
  releaseProductionJob,
  resetProductionJobRepositoryForTests,
  resumeProductionJob,
  searchProductionJobRegistry,
  startProductionJob,
} from "@/modules/foundation/production-job-repository";

function createReleasedWorkOrderForProductionJob(): string {
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
    metadata: { source: "test" },
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
      referenceNumber: "PO-PJ-001",
    },
    actor: "sales-rep",
  });

  const orderId = order.order?.documentId as string;
  approveSalesOrder({
    orderId,
    actor: "sales-manager",
    notes: "approved for manufacturing conversion",
  });

  const workOrder = createWorkOrderFromOrder({
    payload: {
      orderId,
      referenceNumber: "WO-PJ-001",
      correlationId: null,
      causationId: null,
    },
    actor: "planner",
  });

  const workOrderId = workOrder.workOrder?.documentId as string;
  planWorkOrder({ workOrderId, actor: "planner" });
  releaseWorkOrder({ workOrderId, actor: "planner" });

  return workOrderId;
}

describe("GMP-0003 production job foundation", () => {
  beforeEach(() => {
    resetQuoteRepositoryForTests();
    resetSalesOrderRepositoryForTests();
    resetWorkOrderRepositoryForTests();
    resetProductionJobRepositoryForTests();
  });

  test("creates production job from released work order with immutable lineage", () => {
    const workOrderId = createReleasedWorkOrderForProductionJob();

    const created = createProductionJobFromWorkOrder({
      payload: {
        workOrderId,
        referenceNumber: "PJ-REF-001",
        executionContext: "line-a",
        correlationId: null,
        causationId: null,
      },
      actor: "planner",
    });

    expect(created.validation.valid).toBe(true);
    expect(created.productionJob).toBeTruthy();
    expect(created.productionJob?.lineage.workOrderId).toBe(workOrderId);
    expect(created.productionJob?.lineage.originSalesOrderId.length).toBeGreaterThan(0);
    expect(created.productionJob?.lineage.originQuoteId.length).toBeGreaterThan(0);

    const duplicate = createProductionJobFromWorkOrder({
      payload: {
        workOrderId,
        referenceNumber: null,
        executionContext: null,
        correlationId: null,
        causationId: null,
      },
      actor: "planner",
    });

    expect(duplicate.validation.valid).toBe(false);
    expect(getProductionJobByWorkOrderId(workOrderId)?.documentId).toBe(created.productionJob?.documentId);
  });

  test("lifecycle transitions are deterministic and publish events", () => {
    const workOrderId = createReleasedWorkOrderForProductionJob();

    const created = createProductionJobFromWorkOrder({
      payload: {
        workOrderId,
        referenceNumber: "PJ-REF-002",
        executionContext: "line-b",
        correlationId: "corr-2",
        causationId: "cause-2",
      },
      actor: "planner",
    });

    const productionJobId = created.productionJob?.documentId as string;

    const releaseFromDraft = releaseProductionJob({ productionJobId, actor: "supervisor" });
    expect(releaseFromDraft.validation.valid).toBe(false);

    const queued = queueProductionJob({ productionJobId, actor: "planner" });
    expect(queued.validation.valid).toBe(true);

    const ready = readyProductionJob({ productionJobId, actor: "planner" });
    expect(ready.validation.valid).toBe(true);

    const released = releaseProductionJob({ productionJobId, actor: "supervisor" });
    expect(released.validation.valid).toBe(true);

    const started = startProductionJob({ productionJobId, actor: "supervisor" });
    expect(started.validation.valid).toBe(true);

    const paused = pauseProductionJob({ productionJobId, actor: "supervisor" });
    expect(paused.validation.valid).toBe(true);

    const resumed = resumeProductionJob({ productionJobId, actor: "supervisor" });
    expect(resumed.validation.valid).toBe(true);

    const completed = completeProductionJob({ productionJobId, actor: "supervisor" });
    expect(completed.validation.valid).toBe(true);

    const cancelAfterComplete = cancelProductionJob({ productionJobId, actor: "supervisor" });
    expect(cancelAfterComplete.validation.valid).toBe(false);

    const events = listProductionJobPublishedEvents(productionJobId);
    expect(events.some((event) => event.type === "ProductionJobCreated")).toBe(true);
    expect(events.some((event) => event.type === "ProductionJobReleased")).toBe(true);
    expect(events.some((event) => event.type === "ProductionJobStarted")).toBe(true);
    expect(events.some((event) => event.type === "ProductionJobPaused")).toBe(true);
    expect(events.some((event) => event.type === "ProductionJobResumed")).toBe(true);
    expect(events.some((event) => event.type === "ProductionJobCompleted")).toBe(true);
  });

  test("revision, audit, timeline, and search provide traceability", () => {
    const workOrderId = createReleasedWorkOrderForProductionJob();

    const created = createProductionJobFromWorkOrder({
      payload: {
        workOrderId,
        referenceNumber: "PJ-SEARCH-77",
        executionContext: "line-c",
        correlationId: null,
        causationId: null,
      },
      actor: "planner",
    });

    const productionJobId = created.productionJob?.documentId as string;

    const revision = createProductionJobRevision({
      productionJobId,
      actor: "planner",
      reason: "Updated execution reference",
      changedFields: ["referenceNumber"],
    });

    expect(revision.validation.valid).toBe(true);

    const audit = listProductionJobAuditEvents(productionJobId);
    expect(audit.length).toBeGreaterThan(0);
    expect(audit.some((event) => event.action === "production_job_revision_created")).toBe(true);

    const timeline = listProductionJobTimeline(productionJobId);
    expect(timeline.length).toBeGreaterThan(0);

    const search = searchProductionJobRegistry({
      organizationId: "led-display-warehouse",
      query: "SEARCH-77",
    });

    expect(search.length).toBeGreaterThan(0);
    expect(search[0]?.productionJobId).toBe(productionJobId);
  });
});
