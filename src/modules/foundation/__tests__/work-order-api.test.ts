import { NextRequest } from "next/server";
import {
  GET as listWorkOrdersApi,
  POST as createWorkOrderApi,
} from "@/app/api/work-orders/route";
import { GET as searchWorkOrdersApi } from "@/app/api/work-orders/search/route";
import {
  GET as getWorkOrderApi,
  PATCH as patchWorkOrderApi,
} from "@/app/api/work-orders/[workOrderId]/route";
import { GET as workOrderAuditApi } from "@/app/api/work-orders/[workOrderId]/audit/route";
import {
  GET as workOrderRevisionsApi,
  POST as createWorkOrderRevisionApi,
} from "@/app/api/work-orders/[workOrderId]/revisions/route";
import { GET as workOrderTimelineApi } from "@/app/api/work-orders/[workOrderId]/timeline/route";
import { POST as createFromOrderApi } from "@/app/api/work-orders/from-order/[orderId]/route";
import { POST as releaseWorkOrderApi } from "@/app/api/work-orders/[workOrderId]/release/route";
import { POST as pauseWorkOrderApi } from "@/app/api/work-orders/[workOrderId]/pause/route";
import { POST as cancelWorkOrderApi } from "@/app/api/work-orders/[workOrderId]/cancel/route";
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
import { resetWorkOrderRepositoryForTests } from "@/modules/foundation/work-order-repository";

type SupportedRole =
  | "platform_admin"
  | "ops_manager"
  | "company_operator"
  | "analyst"
  | "viewer"
  | "manufacturing_planner"
  | "production_supervisor"
  | "executive"
  | "administrator";

function request(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, init);
}

function authHeaders(input: {
  role?: SupportedRole;
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

function createSalesOrderForWorkOrderApi(): string {
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

  const order = createSalesOrderFromQuote({
    payload: {
      quoteId,
      referenceNumber: "PO-API-WO",
    },
    actor: "api-sales",
  });

  const orderId = order.order?.documentId as string;
  approveSalesOrder({
    orderId,
    actor: "api-approver",
    notes: "approved for work-order conversion",
  });

  return orderId;
}

describe("GMP-0002 work order API", () => {
  beforeEach(() => {
    resetQuoteRepositoryForTests();
    resetSalesOrderRepositoryForTests();
    resetWorkOrderRepositoryForTests();
  });

  test("create from order, list, detail, update, search, revision, timeline, and audit routes work with auth", async () => {
    const orderId = createSalesOrderForWorkOrderApi();

    const deniedCreate = await createFromOrderApi(
      request(`http://localhost/api/work-orders/from-order/${orderId}`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "viewer", organizationId: "led-display-warehouse" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({ referenceNumber: "WO-API-1" }),
      }),
      { params: Promise.resolve({ orderId }) },
    );
    expect(deniedCreate.status).toBe(403);

    const created = await createFromOrderApi(
      request(`http://localhost/api/work-orders/from-order/${orderId}`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "manufacturing_planner", organizationId: "led-display-warehouse", actor: "planner" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({ referenceNumber: "WO-API-1" }),
      }),
      { params: Promise.resolve({ orderId }) },
    );

    expect(created.status).toBe(201);
    const workOrderId = ((await created.json()) as { workOrder: { documentId: string } }).workOrder.documentId;

    const listed = await listWorkOrdersApi(
      request("http://localhost/api/work-orders", {
        headers: authHeaders({ role: "manufacturing_planner", organizationId: "led-display-warehouse" }),
      }),
    );
    expect(listed.status).toBe(200);

    const detail = await getWorkOrderApi(
      request(`http://localhost/api/work-orders/${workOrderId}`, {
        headers: authHeaders({ role: "manufacturing_planner", organizationId: "led-display-warehouse" }),
      }),
      { params: Promise.resolve({ workOrderId }) },
    );
    expect(detail.status).toBe(200);

    const patch = await patchWorkOrderApi(
      request(`http://localhost/api/work-orders/${workOrderId}`, {
        method: "PATCH",
        headers: {
          ...authHeaders({ role: "manufacturing_planner", organizationId: "led-display-warehouse", actor: "planner" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({ referenceNumber: "WO-API-1-REV", expectedVersion: 1 }),
      }),
      { params: Promise.resolve({ workOrderId }) },
    );
    expect(patch.status).toBe(200);

    const revision = await createWorkOrderRevisionApi(
      request(`http://localhost/api/work-orders/${workOrderId}/revisions`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "manufacturing_planner", organizationId: "led-display-warehouse", actor: "planner" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({ reason: "Added planning details", changedFields: ["referenceNumber"] }),
      }),
      { params: Promise.resolve({ workOrderId }) },
    );
    expect(revision.status).toBe(201);

    const revisions = await workOrderRevisionsApi(
      request(`http://localhost/api/work-orders/${workOrderId}/revisions`, {
        headers: authHeaders({ role: "manufacturing_planner", organizationId: "led-display-warehouse" }),
      }),
      { params: Promise.resolve({ workOrderId }) },
    );
    expect(revisions.status).toBe(200);

    const timeline = await workOrderTimelineApi(
      request(`http://localhost/api/work-orders/${workOrderId}/timeline`, {
        headers: authHeaders({ role: "manufacturing_planner", organizationId: "led-display-warehouse" }),
      }),
      { params: Promise.resolve({ workOrderId }) },
    );
    expect(timeline.status).toBe(200);

    const searched = await searchWorkOrdersApi(
      request("http://localhost/api/work-orders/search?query=WO-", {
        headers: authHeaders({ role: "manufacturing_planner", organizationId: "led-display-warehouse" }),
      }),
    );
    expect(searched.status).toBe(200);

    const auditDenied = await workOrderAuditApi(
      request(`http://localhost/api/work-orders/${workOrderId}/audit`, {
        headers: authHeaders({ role: "viewer", organizationId: "led-display-warehouse" }),
      }),
      { params: Promise.resolve({ workOrderId }) },
    );
    expect(auditDenied.status).toBe(403);

    const auditAllowed = await workOrderAuditApi(
      request(`http://localhost/api/work-orders/${workOrderId}/audit`, {
        headers: authHeaders({ role: "executive", organizationId: "led-display-warehouse" }),
      }),
      { params: Promise.resolve({ workOrderId }) },
    );
    expect(auditAllowed.status).toBe(200);
  });

  test("release, pause, and cancel routes enforce permission and lifecycle checks", async () => {
    const orderId = createSalesOrderForWorkOrderApi();
    const created = await createFromOrderApi(
      request(`http://localhost/api/work-orders/from-order/${orderId}`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "manufacturing_planner", organizationId: "led-display-warehouse", actor: "planner" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({ referenceNumber: "WO-API-2" }),
      }),
      { params: Promise.resolve({ orderId }) },
    );

    const workOrderId = ((await created.json()) as { workOrder: { documentId: string } }).workOrder.documentId;

    const releaseDenied = await releaseWorkOrderApi(
      request(`http://localhost/api/work-orders/${workOrderId}/release`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "executive", organizationId: "led-display-warehouse", actor: "exec" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ workOrderId }) },
    );
    expect(releaseDenied.status).toBe(403);

    const releaseInvalid = await releaseWorkOrderApi(
      request(`http://localhost/api/work-orders/${workOrderId}/release`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "production_supervisor", organizationId: "led-display-warehouse", actor: "supervisor" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ workOrderId }) },
    );
    expect(releaseInvalid.status).toBe(400);

    const cancel = await cancelWorkOrderApi(
      request(`http://localhost/api/work-orders/${workOrderId}/cancel`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "production_supervisor", organizationId: "led-display-warehouse", actor: "supervisor" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ workOrderId }) },
    );
    expect(cancel.status).toBe(200);

    const pauseAfterCancel = await pauseWorkOrderApi(
      request(`http://localhost/api/work-orders/${workOrderId}/pause`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "production_supervisor", organizationId: "led-display-warehouse", actor: "supervisor" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "pause" }),
      }),
      { params: Promise.resolve({ workOrderId }) },
    );
    expect(pauseAfterCancel.status).toBe(400);
  });

  test("direct create route supports explicit payloads", async () => {
    const orderId = createSalesOrderForWorkOrderApi();
    const created = await createFromOrderApi(
      request(`http://localhost/api/work-orders/from-order/${orderId}`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "manufacturing_planner", organizationId: "led-display-warehouse", actor: "planner" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({ referenceNumber: "WO-API-3" }),
      }),
      { params: Promise.resolve({ orderId }) },
    );

    const sourceWorkOrder = ((await created.json()) as {
      workOrder: {
        organizationId: string;
        customerReference: string;
        ownerReference: string;
        salesRepresentativeReference: string | null;
        siteReference: string | null;
        requestedStartDate: string | null;
        requestedCompletionDate: string | null;
        commercialLineage: {
          originSalesOrderId: string;
          originSalesOrderRevision: number;
          originQuoteId: string;
          originQuoteRevision: number;
          organizationId: string;
          pricingSnapshotReference: string;
          conversionEventId: string;
          correlationId: string;
          causationId: string;
          createdBy: string;
          createdTimestamp: string;
          manufacturingVersion: string;
        };
        lines: readonly {
          lineId: string;
          productId: string;
          sku: string;
          displayName: string;
          quantity: number;
          unitOfMeasure: string;
          sourceSalesOrderLineId: string | null;
          metadata: Record<string, string>;
        }[];
      };
    }).workOrder;

    const directCreate = await createWorkOrderApi(
      request("http://localhost/api/work-orders", {
        method: "POST",
        headers: {
          ...authHeaders({ role: "administrator", organizationId: "led-display-warehouse", actor: "admin" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          organizationId: sourceWorkOrder.organizationId,
          customerReference: sourceWorkOrder.customerReference,
          ownerReference: sourceWorkOrder.ownerReference,
          salesRepresentativeReference: sourceWorkOrder.salesRepresentativeReference,
          siteReference: sourceWorkOrder.siteReference,
          referenceNumber: "WO-DIRECT-1",
          requestedStartDate: sourceWorkOrder.requestedStartDate,
          requestedCompletionDate: sourceWorkOrder.requestedCompletionDate,
          commercialLineage: {
            ...sourceWorkOrder.commercialLineage,
            originSalesOrderId: `${sourceWorkOrder.commercialLineage.originSalesOrderId}-direct`,
            conversionEventId: `${sourceWorkOrder.commercialLineage.conversionEventId}-direct`,
            correlationId: `${sourceWorkOrder.commercialLineage.correlationId}-direct`,
            causationId: `${sourceWorkOrder.commercialLineage.causationId}-direct`,
          },
          lines: sourceWorkOrder.lines,
          metadata: { source: "direct" },
        }),
      }),
    );

    expect(directCreate.status).toBe(201);
  });
});
