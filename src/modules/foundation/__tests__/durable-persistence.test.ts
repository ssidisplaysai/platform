import {
  createSite,
  getSiteById,
  resetSiteRepositoryForTests,
} from "@/modules/foundation/site-repository";
import {
  createInventoryMovement,
  listInventoryStock,
  resetInventoryRepositoryForTests,
} from "@/modules/foundation/inventory-repository";
import {
  createProduct,
  resetProductRepositoryForTests,
} from "@/modules/foundation/product-repository";
import {
  listCustomers,
  createCustomer,
  resetCustomerRepositoryForTests,
} from "@/modules/foundation/customer-repository";
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
  createSalesOrderFromQuote,
  resetSalesOrderRepositoryForTests,
} from "@/modules/foundation/sales-order-repository";
import {
  FoundationPersistenceConflictError,
  loadPersistedState,
  resetPersistedState,
  savePersistedState,
} from "@/modules/foundation/foundation-persistence";

describe("GCP-0002M1-R1B durable persistence and transaction foundation", () => {
  beforeEach(() => {
    resetSiteRepositoryForTests();
    resetProductRepositoryForTests();
    resetInventoryRepositoryForTests();
    resetCustomerRepositoryForTests();
    resetQuoteRepositoryForTests();
    resetSalesOrderRepositoryForTests();
  });

  test("sales order conversion persists durable quote lineage", () => {
    const createdQuote = createQuote({
      organizationId: "led-display-warehouse",
      customerReference: "cust-ledw-stadium-group",
      primaryContactReference: null,
      ownerReference: "owner-ledw-commerce",
      salesRepresentativeReference: "sales-ledw-001",
      siteReference: "site-led-display-warehouse-production",
      currency: "USD",
      effectiveDate: "2026-01-01T00:00:00.000Z",
      expirationDate: "2026-01-31T00:00:00.000Z",
      commercialTerms: { paymentTermsReference: null, freightTermsReference: null, exchangeRate: 1 },
      internalNotes: null,
      customerNotes: null,
      metadata: {},
      actor: "durable-test",
    });

    const quoteId = createdQuote.quote?.documentId as string;

    addQuoteLine({
      quoteId,
      actor: "durable-test",
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

    submitQuote({ quoteId, actor: "durable-approver", notes: null });
    approveQuote({ quoteId, actor: "durable-approver", notes: null });
    presentQuote({ quoteId, actor: "durable-seller", notes: null });
    acceptQuote({ quoteId, actor: "durable-customer", notes: null });

    const createdOrder = createSalesOrderFromQuote({
      payload: { quoteId, referenceNumber: "DURABLE-REF-1" },
      actor: "durable-test",
    });

    expect(createdOrder.validation.valid).toBe(true);
    expect(createdOrder.order).toBeTruthy();

    const persisted = loadPersistedState({
      namespace: "sales-order-repository",
      seedFactory: () => ({
        orders: [],
        auditEvents: [],
        publishedEvents: [],
        sequenceByOrganization: {},
        orderIdByQuoteId: {},
      }),
    });

    expect(Array.isArray(persisted.state.orders)).toBe(true);
    expect(persisted.state.orders.length).toBe(1);
    expect(persisted.state.orders[0].quoteLineage.quoteId).toBe(quoteId);
    expect(persisted.state.orders[0].quoteLineage.acceptedBy).toBe("durable-customer");
  });

  test("site mutations persist across module reload", () => {
    const created = createSite({
      organizationId: "led-display-warehouse",
      siteName: "Persistence Validation Site",
      displayName: "Persistence Validation Site",
      slug: "persistence-validation-site",
      domain: "persist.example.com",
      canonicalUrl: "https://persist.example.com",
      environment: "test",
      enabled: false,
      defaultContentType: "article",
      defaultPublicationStatus: "draft",
      defaultAuthorReference: null,
      defaultCategoryReferences: [],
      integrations: {
        wordpressApiBaseUrl: null,
        wordpressCredentialReference: null,
        workflowReference: null,
      },
      profiles: {
        promptProfileReference: null,
        imageProfileReference: null,
        seoProfileReference: null,
        brandProfileReference: null,
        analyticsProfileReference: null,
      },
      notes: null,
    });

    expect(created.validation.valid).toBe(true);
    const createdId = created.site?.siteId as string;

    const persisted = loadPersistedState({
      namespace: "site-repository",
      seedFactory: () => ({ sites: [] }),
    });

    const persistedSite = persisted.state.sites.find((site) => site.siteId === createdId);
    expect(persistedSite).toBeDefined();
    expect(persistedSite?.siteName).toBe("Persistence Validation Site");

    const local = getSiteById(createdId);
    expect(local).not.toBeNull();
  });

  test("inventory movement errors rollback stock mutations", () => {
    const before = listInventoryStock().find(
      (stock) =>
        stock.organizationId === "led-display-warehouse" &&
        stock.productId === "prod-indoor-led-video-wall" &&
        stock.locationId === "loc-ssi-main-warehouse",
    );

    expect(before).toBeDefined();

    const result = createInventoryMovement({
      organizationId: "led-display-warehouse",
      productId: "prod-indoor-led-video-wall",
      sourceLocationId: "loc-ssi-main-warehouse",
      destinationLocationId: null,
      movementType: "issue",
      quantity: 999999,
      unitOfMeasure: "ea",
      reasonCode: "rollback_validation",
      referenceType: "manual_adjustment",
      referenceId: "rollback-check",
      actorReference: "ops-user",
      correlationId: null,
      idempotencyKey: null,
      notes: "rollback test",
      evidenceReference: null,
    });

    expect(result.validation.valid).toBe(false);

    const after = listInventoryStock().find(
      (stock) =>
        stock.organizationId === "led-display-warehouse" &&
        stock.productId === "prod-indoor-led-video-wall" &&
        stock.locationId === "loc-ssi-main-warehouse",
    );

    expect(after).toEqual(before);
  });

  test("duplicate key conflicts remain normalized at repository boundary", () => {
    const duplicate = createProduct({
      organizationId: "led-display-warehouse",
      productName: "Duplicate Slug Product",
      displayName: "Duplicate Slug Product",
      slug: "indoor-led-video-wall",
      sku: "LEDW-DUP-001",
      modelNumber: null,
      shortDescription: "Short",
      fullDescription: "Full",
      productType: "led_display",
      productFamily: "validation",
      categoryIds: ["cat-led-displays"],
      manufacturerId: "mfr-ledw-internal",
      brandReference: null,
      primarySiteId: "site-led-display-warehouse-production",
      assignedSiteIds: ["site-led-display-warehouse-production"],
      siteAssignments: [
        {
          siteId: "site-led-display-warehouse-production",
          enabledForSite: true,
          siteSpecificSlug: "duplicate-slug-product",
          siteSpecificDisplayName: "Duplicate Slug Product",
          siteSpecificShortDescription: "Short",
          visibility: "internal",
          featured: false,
          sortOrder: 1,
          categoryIds: ["cat-led-displays"],
          defaultContentType: "article",
          publicationStatus: "not_ready",
          seoProfileReference: null,
          promptProfileReference: null,
          imageProfileReference: null,
          pricingDisplayMode: "request_quote",
          lastReadinessEvaluation: null,
          lastPublicationReference: null,
        },
      ],
      media: {
        primaryImageReference: null,
        galleryImageReferences: [],
        videoReferences: [],
      },
      documents: {
        technicalDrawingReferences: [],
        specSheetReferences: [],
        brochureReferences: [],
        manualReferences: [],
        installationGuideReferences: [],
        warrantyDocumentReferences: [],
      },
      specifications: [],
      seoProfileReference: null,
      promptProfileReference: null,
      businessGenomeObjectReference: null,
      sourceEvidenceReference: null,
      notes: null,
    });

    expect(duplicate.validation.valid).toBe(false);
    expect(duplicate.validation.issues.some((issue) => issue.field === "slug")).toBe(true);
  });

  test("persistence layer enforces optimistic concurrency tokens", () => {
    const namespace = "durable-persistence-concurrency-test";

    resetPersistedState({
      namespace,
      seedFactory: () => ({ value: 1 }),
    });

    const saved = savePersistedState({
      namespace,
      state: { value: 2 },
      expectedRevision: 0,
    });

    expect(saved.revision).toBe(1);

    expect(() =>
      savePersistedState({
        namespace,
        state: { value: 3 },
        expectedRevision: 0,
      }),
    ).toThrow(FoundationPersistenceConflictError);
  });

  test("customer reset restores deterministic fixture baseline", () => {
    const fixtureCount = listCustomers().length;

    const created = createCustomer({
      organizationId: "led-display-warehouse",
      accountName: "Reset Validation Customer",
      legalName: null,
      accountCode: "LEDW-RESET-001",
      accountType: "direct",
      lifecycleState: "active",
      enabled: true,
      primarySiteId: "site-led-display-warehouse-production",
      associatedSiteIds: ["site-led-display-warehouse-production"],
      communicationPreferences: {
        emailEnabled: true,
        smsEnabled: false,
        phoneEnabled: false,
        marketingOptIn: false,
        operationalAlertsEnabled: false,
        invoiceNoticesEnabled: true,
        preferredFrequency: "weekly",
        timezone: null,
      },
      taxExempt: false,
      tags: [],
      notes: null,
    });

    expect(created.validation.valid).toBe(true);
    expect(listCustomers().length).toBe(fixtureCount + 1);

    resetCustomerRepositoryForTests();
    expect(listCustomers().length).toBe(fixtureCount);
  });
});
