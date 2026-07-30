import {
  acceptQuote,
  addQuoteLine,
  approveQuote,
  createQuote,
  getQuoteById,
  presentQuote,
  resetQuoteRepositoryForTests,
  submitQuote,
} from "@/modules/foundation/quote-repository";
import {
  approveSalesOrder,
  cancelSalesOrder,
  createSalesOrderFromQuote,
  createSalesOrderRevision,
  getSalesOrderByQuoteId,
  listSalesOrderAuditEvents,
  listSalesOrderPublishedEvents,
  listSalesOrderTimeline,
  releaseSalesOrder,
  resetSalesOrderRepositoryForTests,
  searchSalesOrderRegistry,
} from "@/modules/foundation/sales-order-repository";

describe("GCP-0002I sales order foundation", () => {
  beforeEach(() => {
    resetQuoteRepositoryForTests();
    resetSalesOrderRepositoryForTests();
  });

  function createAcceptedQuote() {
    const created = createQuote({
      organizationId: "led-display-warehouse",
      customerReference: "cust-ledw-stadium-group",
      primaryContactReference: "contact-ledw-amy-richardson",
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
        requestSource: "test",
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

    return quoteId;
  }

  test("creates order from accepted quote with preserved lineage", () => {
    const quoteId = createAcceptedQuote();

    const created = createSalesOrderFromQuote({
      payload: {
        quoteId,
        referenceNumber: "PO-88421",
      },
      actor: "sales-rep",
    });

    expect(created.validation.valid).toBe(true);
    expect(created.order).toBeTruthy();
    expect(created.order?.quoteLineage.quoteId).toBe(quoteId);
    expect(created.order?.quoteLineage.quoteRevision).toBe(getQuoteById(quoteId)?.revision);
    expect(created.order?.quoteLineage.acceptedBy).toBe("customer");
    expect(created.order?.quoteLineage.conversionEventId.length).toBeGreaterThan(10);
    expect(created.order?.totals.grandTotal).toBe(1900);

    const duplicate = createSalesOrderFromQuote({
      payload: { quoteId, referenceNumber: null },
      actor: "sales-rep",
    });

    expect(duplicate.validation.valid).toBe(false);
  });

  test("lifecycle transitions are deterministic and publish events", () => {
    const quoteId = createAcceptedQuote();
    const created = createSalesOrderFromQuote({
      payload: { quoteId, referenceNumber: "REF-001" },
      actor: "sales-rep",
    });
    const orderId = created.order?.documentId as string;

    const approved = approveSalesOrder({
      orderId,
      actor: "sales-manager",
      notes: "approved",
    });
    expect(approved.validation.valid).toBe(true);
    expect(approved.order?.status).toBe("approved");

    const released = releaseSalesOrder({
      orderId,
      actor: "operations",
      notes: "released to fulfillment",
    });
    expect(released.validation.valid).toBe(true);
    expect(released.order?.status).toBe("released");

    const cancelled = cancelSalesOrder({
      orderId,
      actor: "operations",
      notes: "cancelled by customer request",
    });
    expect(cancelled.validation.valid).toBe(true);
    expect(cancelled.order?.status).toBe("cancelled");

    const events = listSalesOrderPublishedEvents(orderId);
    expect(events.some((event) => event.type === "OrderCreated")).toBe(true);
    expect(events.some((event) => event.type === "OrderApproved")).toBe(true);
    expect(events.some((event) => event.type === "OrderReleased")).toBe(true);
    expect(events.some((event) => event.type === "OrderCancelled")).toBe(true);
  });

  test("revision, audit, timeline, and search support order operations", () => {
    const quoteId = createAcceptedQuote();
    const created = createSalesOrderFromQuote({
      payload: { quoteId, referenceNumber: "EXT-REF-77" },
      actor: "sales-rep",
    });
    const orderId = created.order?.documentId as string;

    const revision = createSalesOrderRevision({
      orderId,
      actor: "sales-rep",
      reason: "Updated external reference context",
      changedFields: ["referenceNumber"],
    });

    expect(revision.validation.valid).toBe(true);

    const audit = listSalesOrderAuditEvents(orderId);
    expect(audit.length).toBeGreaterThan(0);
    expect(audit.some((event) => event.type === "order_revision_created")).toBe(true);

    const timeline = listSalesOrderTimeline(orderId);
    expect(timeline.length).toBeGreaterThan(0);

    const search = searchSalesOrderRegistry({
      organizationId: "led-display-warehouse",
      query: "REF-77",
    });
    expect(search.length).toBeGreaterThan(0);
    expect(search[0]?.orderId).toBe(orderId);

    const byQuote = getSalesOrderByQuoteId(quoteId);
    expect(byQuote?.documentId).toBe(orderId);
  });
});
