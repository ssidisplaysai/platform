import { NextRequest } from "next/server";
import {
  GET as listOrdersApi,
  POST as createOrderApi,
} from "@/app/api/orders/route";
import { GET as orderSearchApi } from "@/app/api/orders/search/route";
import {
  GET as getOrderApi,
  PATCH as patchOrderApi,
} from "@/app/api/orders/[orderId]/route";
import { GET as orderTimelineApi } from "@/app/api/orders/[orderId]/timeline/route";
import {
  GET as orderAuditApi,
} from "@/app/api/orders/[orderId]/audit/route";
import {
  GET as orderRevisionsApi,
  POST as createOrderRevisionApi,
} from "@/app/api/orders/[orderId]/revisions/route";
import { POST as approveOrderApi } from "@/app/api/orders/[orderId]/approve/route";
import { POST as releaseOrderApi } from "@/app/api/orders/[orderId]/release/route";
import { POST as cancelOrderApi } from "@/app/api/orders/[orderId]/cancel/route";
import { POST as createFromQuoteApi } from "@/app/api/orders/from-quote/[quoteId]/route";
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
  resetSalesOrderRepositoryForTests,
} from "@/modules/foundation/sales-order-repository";

type ApiOrderPayload = {
  documentId: string;
  organizationId: string;
  customerReference: string;
  ownerReference: string;
  salesRepresentativeReference: string | null;
  siteReference: string | null;
  currency: string;
  quoteLineage: {
    quoteId: string;
    quoteRevision: number;
    acceptanceTimestamp: string;
    acceptedBy: string;
    pricingSnapshotReference: string;
    conversionEventId: string;
  };
  orderDate: string;
  lines: readonly unknown[];
  totals: {
    subtotal: number;
    discountTotal: number;
    taxPlaceholder: number;
    freightPlaceholder: number;
    fees: number;
    grandTotal: number;
  };
};

function request(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, init);
}

function authHeaders(input: {
  role?: "platform_admin" | "ops_manager" | "company_operator" | "analyst" | "viewer";
  organizationId?: string;
  siteId?: string;
  actor?: string;
}): Record<string, string> {
  const headers: Record<string, string> = {};
  if (input.role) {
    headers["x-gcp-roles"] = input.role;
  }
  if (input.organizationId) {
    headers["x-gcp-organization-id"] = input.organizationId;
  }
  if (input.siteId) {
    headers["x-gcp-site-id"] = input.siteId;
  }
  if (input.actor) {
    headers["x-gcp-actor"] = input.actor;
  }
  return headers;
}

function createAcceptedQuoteForApi(): string {
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
    commercialTerms: { paymentTermsReference: null, freightTermsReference: null, exchangeRate: 1 },
    internalNotes: null,
    customerNotes: null,
    metadata: {},
    actor: "api-test",
  });

  const quoteId = created.quote?.documentId as string;

  addQuoteLine({
    quoteId,
    actor: "api-test",
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

  submitQuote({ quoteId, actor: "api-approver", notes: null });
  approveQuote({ quoteId, actor: "api-approver", notes: null });
  presentQuote({ quoteId, actor: "api-seller", notes: null });
  acceptQuote({ quoteId, actor: "api-customer", notes: "accepted" });

  return quoteId;
}

describe("GCP-0002I sales order API", () => {
  beforeEach(() => {
    resetQuoteRepositoryForTests();
    resetSalesOrderRepositoryForTests();
  });

  test("create from quote, list, search, detail, revision, timeline, and audit routes work with auth", async () => {
    const quoteId = createAcceptedQuoteForApi();

    const deniedCreate = await createFromQuoteApi(
      request(`http://localhost/api/orders/from-quote/${quoteId}`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "viewer", organizationId: "led-display-warehouse" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({ referenceNumber: "PO-API-1" }),
      }),
      { params: Promise.resolve({ quoteId }) },
    );
    expect(deniedCreate.status).toBe(403);

    const created = await createFromQuoteApi(
      request(`http://localhost/api/orders/from-quote/${quoteId}`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "ops_manager", organizationId: "led-display-warehouse", actor: "api-sales" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({ referenceNumber: "PO-API-1" }),
      }),
      { params: Promise.resolve({ quoteId }) },
    );

    expect(created.status).toBe(201);
    const orderId = ((await created.json()) as { order: { documentId: string } }).order.documentId;

    const listed = await listOrdersApi(
      request("http://localhost/api/orders", {
        headers: authHeaders({ role: "ops_manager", organizationId: "led-display-warehouse" }),
      }),
    );
    expect(listed.status).toBe(200);

    const searched = await orderSearchApi(
      request("http://localhost/api/orders/search?query=SO-", {
        headers: authHeaders({ role: "ops_manager", organizationId: "led-display-warehouse" }),
      }),
    );
    expect(searched.status).toBe(200);

    const detail = await getOrderApi(
      request(`http://localhost/api/orders/${orderId}`, {
        headers: authHeaders({ role: "ops_manager", organizationId: "led-display-warehouse" }),
      }),
      { params: Promise.resolve({ orderId }) },
    );
    expect(detail.status).toBe(200);

    const patch = await patchOrderApi(
      request(`http://localhost/api/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          ...authHeaders({ role: "ops_manager", organizationId: "led-display-warehouse", actor: "api-sales" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({ referenceNumber: "PO-API-1-REV", expectedVersion: 1 }),
      }),
      { params: Promise.resolve({ orderId }) },
    );
    expect(patch.status).toBe(200);

    const revision = await createOrderRevisionApi(
      request(`http://localhost/api/orders/${orderId}/revisions`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "ops_manager", organizationId: "led-display-warehouse", actor: "api-sales" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({ reason: "Added internal revision note", changedFields: ["referenceNumber"] }),
      }),
      { params: Promise.resolve({ orderId }) },
    );
    expect(revision.status).toBe(201);

    const revisions = await orderRevisionsApi(
      request(`http://localhost/api/orders/${orderId}/revisions`, {
        headers: authHeaders({ role: "ops_manager", organizationId: "led-display-warehouse" }),
      }),
      { params: Promise.resolve({ orderId }) },
    );
    expect(revisions.status).toBe(200);

    const timeline = await orderTimelineApi(
      request(`http://localhost/api/orders/${orderId}/timeline`, {
        headers: authHeaders({ role: "ops_manager", organizationId: "led-display-warehouse" }),
      }),
      { params: Promise.resolve({ orderId }) },
    );
    expect(timeline.status).toBe(200);

    const auditDenied = await orderAuditApi(
      request(`http://localhost/api/orders/${orderId}/audit`, {
        headers: authHeaders({ role: "viewer", organizationId: "led-display-warehouse" }),
      }),
      { params: Promise.resolve({ orderId }) },
    );
    expect(auditDenied.status).toBe(403);

    const auditAllowed = await orderAuditApi(
      request(`http://localhost/api/orders/${orderId}/audit`, {
        headers: authHeaders({ role: "analyst", organizationId: "led-display-warehouse" }),
      }),
      { params: Promise.resolve({ orderId }) },
    );
    expect(auditAllowed.status).toBe(200);
  });

  test("approve, release, and cancel routes enforce lifecycle", async () => {
    const quoteId = createAcceptedQuoteForApi();

    const created = await createFromQuoteApi(
      request(`http://localhost/api/orders/from-quote/${quoteId}`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "ops_manager", organizationId: "led-display-warehouse", actor: "api-sales" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({ referenceNumber: "PO-API-2" }),
      }),
      { params: Promise.resolve({ quoteId }) },
    );

    const orderId = ((await created.json()) as { order: { documentId: string } }).order.documentId;

    const approve = await approveOrderApi(
      request(`http://localhost/api/orders/${orderId}/approve`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "platform_admin", organizationId: "led-display-warehouse", actor: "sales-manager" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({ notes: "approved" }),
      }),
      { params: Promise.resolve({ orderId }) },
    );
    expect(approve.status).toBe(200);

    const release = await releaseOrderApi(
      request(`http://localhost/api/orders/${orderId}/release`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "ops_manager", organizationId: "led-display-warehouse", actor: "operations" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({ notes: "released" }),
      }),
      { params: Promise.resolve({ orderId }) },
    );
    expect(release.status).toBe(200);

    const cancel = await cancelOrderApi(
      request(`http://localhost/api/orders/${orderId}/cancel`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "ops_manager", organizationId: "led-display-warehouse", actor: "operations" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({ notes: "customer cancellation" }),
      }),
      { params: Promise.resolve({ orderId }) },
    );
    expect(cancel.status).toBe(200);
  });

  test("direct create route supports explicit payloads", async () => {
    const quoteId = createAcceptedQuoteForApi();

    const createFromQuote = await createFromQuoteApi(
      request(`http://localhost/api/orders/from-quote/${quoteId}`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "ops_manager", organizationId: "led-display-warehouse", actor: "api-sales" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({ referenceNumber: "PO-API-3" }),
      }),
      { params: Promise.resolve({ quoteId }) },
    );

    const sourceOrder = ((await createFromQuote.json()) as { order: ApiOrderPayload }).order;

    const directCreate = await createOrderApi(
      request("http://localhost/api/orders", {
        method: "POST",
        headers: {
          ...authHeaders({ role: "platform_admin", organizationId: "led-display-warehouse", actor: "api-admin" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          organizationId: sourceOrder.organizationId,
          customerReference: sourceOrder.customerReference,
          ownerReference: sourceOrder.ownerReference,
          salesRepresentativeReference: sourceOrder.salesRepresentativeReference,
          siteReference: sourceOrder.siteReference,
          currency: sourceOrder.currency,
          quoteLineage: {
            ...sourceOrder.quoteLineage,
            quoteId: `${sourceOrder.quoteLineage.quoteId}-direct`,
            conversionEventId: `${sourceOrder.quoteLineage.conversionEventId}-direct`,
          },
          referenceNumber: "PO-DIRECT-1",
          orderDate: sourceOrder.orderDate,
          requestedDeliveryDate: null,
          lines: sourceOrder.lines,
          totals: sourceOrder.totals,
          metadata: { source: "direct" },
        }),
      }),
    );

    expect(directCreate.status).toBe(201);
  });
});
