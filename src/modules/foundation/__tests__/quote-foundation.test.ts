import {
  addQuoteLine,
  approveQuote,
  acceptQuote,
  createQuote,
  createQuoteRevision,
  getQuoteById,
  listQuoteAuditEvents,
  listQuotes,
  presentQuote,
  rejectQuote,
  resetQuoteRepositoryForTests,
  submitQuote,
  updateQuoteDraft,
  updateQuoteLine,
  removeQuoteLine,
  convertQuoteToOrderContract,
} from "@/modules/foundation/quote-repository";

describe("GCP-0002H quote foundation", () => {
  beforeEach(() => {
    resetQuoteRepositoryForTests();
  });

  test("quote create and list works", () => {
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

    expect(created.validation.valid).toBe(true);
    expect(created.quote).toBeTruthy();

    const listed = listQuotes({ organizationId: "led-display-warehouse" });
    expect(listed.length).toBe(1);
  });

  test("line add/update/remove recalculates totals", () => {
    const created = createQuote({
      organizationId: "led-display-warehouse",
      customerReference: "cust-ledw-stadium-group",
      primaryContactReference: null,
      ownerReference: "owner-ledw-commerce",
      salesRepresentativeReference: null,
      siteReference: "site-led-display-warehouse-production",
      currency: "USD",
      effectiveDate: "2026-01-01T00:00:00.000Z",
      expirationDate: "2026-01-31T00:00:00.000Z",
      commercialTerms: { paymentTermsReference: null, freightTermsReference: null, exchangeRate: 1 },
      internalNotes: null,
      customerNotes: null,
      metadata: {},
      actor: "test",
    });

    const quoteId = created.quote?.documentId as string;

    const added = addQuoteLine({
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

    expect(added.validation.valid).toBe(true);
    expect(added.quote?.totals.grandTotal).toBe(1900);

    const lineId = added.line?.lineId as string;

    const updated = updateQuoteLine({
      quoteId,
      lineId,
      actor: "test",
      patch: {
        quantity: 3,
        discount: 150,
      },
    });

    expect(updated.validation.valid).toBe(true);
    expect(updated.quote?.totals.grandTotal).toBe(2850);

    const removed = removeQuoteLine({ quoteId, lineId, actor: "test" });
    expect(removed.validation.valid).toBe(true);
    expect(removed.quote?.lines.length).toBe(0);
    expect(removed.quote?.totals.grandTotal).toBe(0);
  });

  test("state transitions and revision history enforce lifecycle", () => {
    const created = createQuote({
      organizationId: "led-display-warehouse",
      customerReference: "cust-ledw-stadium-group",
      primaryContactReference: null,
      ownerReference: "owner-ledw-commerce",
      salesRepresentativeReference: null,
      siteReference: "site-led-display-warehouse-production",
      currency: "USD",
      effectiveDate: "2026-01-01T00:00:00.000Z",
      expirationDate: "2026-01-31T00:00:00.000Z",
      commercialTerms: { paymentTermsReference: null, freightTermsReference: null, exchangeRate: 1 },
      internalNotes: null,
      customerNotes: null,
      metadata: {},
      actor: "test",
    });

    const quoteId = created.quote?.documentId as string;

    const revision = createQuoteRevision({
      quoteId,
      actor: "test",
      reason: "Initial negotiated change",
      changedFields: ["commercialTerms", "customerNotes"],
    });
    expect(revision.validation.valid).toBe(true);

    const submit = submitQuote({ quoteId, actor: "approver", notes: null });
    expect(submit.validation.valid).toBe(true);
    expect(submit.quote?.commercialStatus).toBe("pending_approval");

    const reject = rejectQuote({ quoteId, actor: "approver", notes: "Need revision" });
    expect(reject.validation.valid).toBe(true);
    expect(reject.quote?.commercialStatus).toBe("rejected");

    const resubmit = submitQuote({ quoteId, actor: "approver", notes: null });
    expect(resubmit.validation.valid).toBe(true);

    const approved = approveQuote({ quoteId, actor: "approver", notes: "Approved" });
    expect(approved.validation.valid).toBe(true);
    expect(approved.quote?.commercialStatus).toBe("approved");

    const presented = presentQuote({ quoteId, actor: "seller", notes: null });
    expect(presented.validation.valid).toBe(true);
    expect(presented.quote?.commercialStatus).toBe("presented");

    const convertDenied = convertQuoteToOrderContract({ quoteId, actor: "seller", notes: null });
    expect(convertDenied.validation.valid).toBe(false);

    const invalidDraftUpdate = updateQuoteDraft({
      quoteId,
      actor: "seller",
      patch: { ownerReference: "owner-change" },
    });
    expect(invalidDraftUpdate.validation.valid).toBe(false);

    const current = getQuoteById(quoteId);
    expect(current?.revisionHistory.length).toBeGreaterThanOrEqual(2);
  });

  test("conversion contract stub set only after acceptance", () => {
    const created = createQuote({
      organizationId: "led-display-warehouse",
      customerReference: "cust-ledw-stadium-group",
      primaryContactReference: null,
      ownerReference: "owner-ledw-commerce",
      salesRepresentativeReference: null,
      siteReference: "site-led-display-warehouse-production",
      currency: "USD",
      effectiveDate: "2026-01-01T00:00:00.000Z",
      expirationDate: "2026-01-31T00:00:00.000Z",
      commercialTerms: { paymentTermsReference: null, freightTermsReference: null, exchangeRate: 1 },
      internalNotes: null,
      customerNotes: null,
      metadata: {},
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
        quantity: 1,
        unitOfMeasure: "ea",
        unitPrice: 100,
        discount: 0,
        currency: "USD",
        taxClassification: null,
        siteReference: "site-led-display-warehouse-production",
        metadata: {},
      },
    });

    submitQuote({ quoteId, actor: "approver", notes: null });
    approveQuote({ quoteId, actor: "approver", notes: null });
    presentQuote({ quoteId, actor: "seller", notes: null });

    const accepted = acceptQuote({
      quoteId,
      actor: "customer",
      notes: "accepted",
    });
    expect(accepted.validation.valid).toBe(true);

    const converted = convertQuoteToOrderContract({ quoteId, actor: "seller", notes: null });
    expect(converted.validation.valid).toBe(true);
    expect(converted.conversion?.status).toBe("requested");
  });

  test("audit trail records key events", () => {
    const created = createQuote({
      organizationId: "led-display-warehouse",
      customerReference: "cust-ledw-stadium-group",
      primaryContactReference: null,
      ownerReference: "owner-ledw-commerce",
      salesRepresentativeReference: null,
      siteReference: "site-led-display-warehouse-production",
      currency: "USD",
      effectiveDate: "2026-01-01T00:00:00.000Z",
      expirationDate: "2026-01-31T00:00:00.000Z",
      commercialTerms: { paymentTermsReference: null, freightTermsReference: null, exchangeRate: 1 },
      internalNotes: null,
      customerNotes: null,
      metadata: {},
      actor: "test",
    });

    const quoteId = created.quote?.documentId as string;
    const events = listQuoteAuditEvents(quoteId);

    expect(events.length).toBeGreaterThan(0);
    expect(events.some((event) => event.type === "quote_created")).toBe(true);
  });
});
