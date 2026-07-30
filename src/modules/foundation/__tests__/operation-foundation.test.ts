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
  completeOperation,
  cancelOperation,
  closeOperation,
  createOperationFromProductionJob,
  createOperationRevision,
  defineOperation,
  getOperationById,
  listOperationAuditEvents,
  listOperationPublishedEvents,
  listOperationTimeline,
  readyOperation,
  releaseOperation,
  resetOperationRepositoryForTests,
  searchOperationRegistry,
  updateOperationDraft,
  waitOperation,
} from "@/modules/foundation/operation-repository";
import {
  createProductionJobFromWorkOrder,
  resetProductionJobRepositoryForTests,
} from "@/modules/foundation/production-job-repository";

function createReleasedProductionJobForOperation(): string {
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
      referenceNumber: "PO-OP-001",
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
      referenceNumber: "WO-OP-001",
      correlationId: null,
      causationId: null,
    },
    actor: "planner",
  });

  const workOrderId = workOrder.workOrder?.documentId as string;
  planWorkOrder({ workOrderId, actor: "planner" });
  releaseWorkOrder({ workOrderId, actor: "planner" });

  const productionJob = createProductionJobFromWorkOrder({
    payload: {
      workOrderId,
      referenceNumber: "PJ-OP-001",
      executionContext: "line-a",
      correlationId: null,
      causationId: null,
    },
    actor: "planner",
  });

  return productionJob.productionJob?.documentId as string;
}

describe("GMP-0004 operation foundation", () => {
  beforeEach(() => {
    resetQuoteRepositoryForTests();
    resetSalesOrderRepositoryForTests();
    resetWorkOrderRepositoryForTests();
    resetProductionJobRepositoryForTests();
    resetOperationRepositoryForTests();
  });

  test("creates operations from a production job and preserves upstream lineage", () => {
    const productionJobId = createReleasedProductionJobForOperation();

    const created = createOperationFromProductionJob({
      payload: {
        productionJobId,
        referenceNumber: "OP-REF-001",
        operationType: "assembly",
        sequenceNumber: 1,
        operationName: "Assemble Cabinet",
        description: "Primary assembly step",
        requiredCapability: "assembly",
        estimatedDurationMinutes: 45,
        requiredWorkCenterReference: "wc-assembly-01",
        requiredMachineTypeReference: "mt-assembly-01",
        requiredSkill: "assembler",
        predecessorOperationIds: [],
        successorOperationIds: [],
        referenceDocuments: ["eng-draw-001"],
        engineeringNotes: "Initial build notes",
        correlationId: null,
        causationId: null,
      },
      actor: "planner",
    });

    expect(created.validation.valid).toBe(true);
    expect(created.operation).toBeTruthy();
    expect(created.operation?.lineage.productionJobId).toBe(productionJobId);
    expect(created.operation?.lineage.workOrderId.length).toBeGreaterThan(0);
    expect(created.operation?.lineage.originSalesOrderId.length).toBeGreaterThan(0);
    expect(created.operation?.lineage.originQuoteId.length).toBeGreaterThan(0);

    const duplicate = createOperationFromProductionJob({
      payload: {
        productionJobId,
        referenceNumber: null,
        operationType: "assembly",
        sequenceNumber: 1,
        operationName: "Assemble Cabinet Duplicate",
        description: null,
        requiredCapability: null,
        estimatedDurationMinutes: null,
        requiredWorkCenterReference: null,
        requiredMachineTypeReference: null,
        requiredSkill: null,
        predecessorOperationIds: [],
        successorOperationIds: [],
        referenceDocuments: [],
        engineeringNotes: null,
        correlationId: null,
        causationId: null,
      },
      actor: "planner",
    });

    expect(duplicate.validation.valid).toBe(false);
  });

  test("deterministic lifecycle transitions publish events and enforce terminal guards", () => {
    const productionJobId = createReleasedProductionJobForOperation();
    const created = createOperationFromProductionJob({
      payload: {
        productionJobId,
        referenceNumber: "OP-REF-002",
        operationType: "inspection",
        sequenceNumber: 2,
        operationName: "Inspect Cabinet",
        description: null,
        requiredCapability: "inspection",
        estimatedDurationMinutes: 15,
        requiredWorkCenterReference: "wc-inspection-01",
        requiredMachineTypeReference: "mt-inspection-01",
        requiredSkill: "inspector",
        predecessorOperationIds: [],
        successorOperationIds: [],
        referenceDocuments: [],
        engineeringNotes: null,
        correlationId: null,
        causationId: null,
      },
      actor: "planner",
    });

    const operationId = created.operation?.documentId as string;

    expect(defineOperation({ operationId, actor: "planner" }).validation.valid).toBe(true);
    expect(readyOperation({ operationId, actor: "planner" }).validation.valid).toBe(true);
    expect(releaseOperation({ operationId, actor: "supervisor" }).validation.valid).toBe(true);
    expect(waitOperation({ operationId, actor: "supervisor" }).validation.valid).toBe(true);
    expect(completeOperation({ operationId, actor: "supervisor" }).validation.valid).toBe(true);
    const closed = closeOperation({ operationId, actor: "supervisor" });
    expect(closed.validation.valid).toBe(true);

    const cancelledAfterClose = cancelOperation({ operationId, actor: "supervisor" });
    expect(cancelledAfterClose).toMatchObject({
      valid: false,
      issues: [{ field: "operation", message: expect.any(String) }],
    });

    const events = listOperationPublishedEvents(operationId);
    expect(events.some((event) => event.type === "OperationCreated")).toBe(true);
    expect(events.some((event) => event.type === "OperationReleased")).toBe(true);
    expect(events.some((event) => event.type === "OperationCompleted")).toBe(true);
    expect(events.some((event) => event.type === "OperationClosed")).toBe(true);
  });

  test("revision, audit, timeline, and search expose bounded traceability", () => {
    const productionJobId = createReleasedProductionJobForOperation();
    const created = createOperationFromProductionJob({
      payload: {
        productionJobId,
        referenceNumber: "OP-SEARCH-77",
        operationType: "assembly",
        sequenceNumber: 3,
        operationName: "Searchable Operation",
        description: "Search case",
        requiredCapability: "assembly",
        estimatedDurationMinutes: 30,
        requiredWorkCenterReference: "wc-search-01",
        requiredMachineTypeReference: "mt-search-01",
        requiredSkill: "assembler",
        predecessorOperationIds: [],
        successorOperationIds: [],
        referenceDocuments: [],
        engineeringNotes: null,
        correlationId: null,
        causationId: null,
      },
      actor: "planner",
    });

    const operationId = created.operation?.documentId as string;

    const updated = updateOperationDraft({
      operationId,
      patch: {
        operationName: "Searchable Operation Updated",
        referenceNumber: "OP-SEARCH-77A",
      },
      actor: "planner",
      expectedVersion: 1,
    });
    expect(updated.validation.valid).toBe(true);

    const revision = createOperationRevision({
      operationId,
      actor: "planner",
      reason: "Clarified inspection note",
      changedFields: ["operationName", "referenceNumber"],
    });
    expect(revision.validation.valid).toBe(true);

    const audit = listOperationAuditEvents(operationId);
    expect(audit.length).toBeGreaterThan(0);
    expect(audit.some((event) => event.action === "operation_revision_created")).toBe(true);

    const timeline = listOperationTimeline(operationId);
    expect(timeline.length).toBeGreaterThan(0);

    const search = searchOperationRegistry({
      organizationId: "led-display-warehouse",
      query: "SEARCH-77",
    });
    expect(search.length).toBeGreaterThan(0);
    expect(search[0]?.operationId).toBe(operationId);

    expect(getOperationById(operationId)?.revisionHistory.length).toBeGreaterThan(0);
  });
});
