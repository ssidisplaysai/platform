import { NextRequest } from "next/server";
import {
  GET as listProductionJobsApi,
  POST as createProductionJobApi,
} from "@/app/api/production-jobs/route";
import { GET as searchProductionJobsApi } from "@/app/api/production-jobs/search/route";
import {
  GET as getProductionJobApi,
  PATCH as patchProductionJobApi,
} from "@/app/api/production-jobs/[productionJobId]/route";
import { GET as productionJobAuditApi } from "@/app/api/production-jobs/[productionJobId]/audit/route";
import {
  GET as productionJobRevisionsApi,
  POST as createProductionJobRevisionApi,
} from "@/app/api/production-jobs/[productionJobId]/revisions/route";
import { GET as productionJobTimelineApi } from "@/app/api/production-jobs/[productionJobId]/timeline/route";
import { POST as createFromWorkOrderApi } from "@/app/api/production-jobs/from-work-order/[workOrderId]/route";
import { POST as releaseProductionJobApi } from "@/app/api/production-jobs/[productionJobId]/release/route";
import { POST as pauseProductionJobApi } from "@/app/api/production-jobs/[productionJobId]/pause/route";
import { POST as cancelProductionJobApi } from "@/app/api/production-jobs/[productionJobId]/cancel/route";
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
  queueProductionJob,
  readyProductionJob,
  resetProductionJobRepositoryForTests,
} from "@/modules/foundation/production-job-repository";

type SupportedRole =
  | "platform_admin"
  | "ops_manager"
  | "operations"
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

function createReleasedWorkOrderForApi(): string {
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
      referenceNumber: "PO-API-PJ",
    },
    actor: "api-sales",
  });

  const orderId = order.order?.documentId as string;
  approveSalesOrder({
    orderId,
    actor: "api-approver",
    notes: "approved for work-order conversion",
  });

  const workOrder = createWorkOrderFromOrder({
    payload: {
      orderId,
      referenceNumber: "WO-API-PJ",
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

describe("GMP-0003 production job API", () => {
  beforeEach(() => {
    resetQuoteRepositoryForTests();
    resetSalesOrderRepositoryForTests();
    resetWorkOrderRepositoryForTests();
    resetProductionJobRepositoryForTests();
  });

  test("create from work order, list, detail, update, search, revision, timeline, and audit routes work with auth", async () => {
    const workOrderId = createReleasedWorkOrderForApi();

    const deniedCreate = await createFromWorkOrderApi(
      request(`http://localhost/api/production-jobs/from-work-order/${workOrderId}`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "viewer", organizationId: "led-display-warehouse" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({ referenceNumber: "PJ-API-1", executionContext: "line-a" }),
      }),
      { params: Promise.resolve({ workOrderId }) },
    );
    expect(deniedCreate.status).toBe(403);

    const created = await createFromWorkOrderApi(
      request(`http://localhost/api/production-jobs/from-work-order/${workOrderId}`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "manufacturing_planner", organizationId: "led-display-warehouse", actor: "planner" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({ referenceNumber: "PJ-API-1", executionContext: "line-a" }),
      }),
      { params: Promise.resolve({ workOrderId }) },
    );

    expect(created.status).toBe(201);
    const productionJobId = ((await created.json()) as { productionJob: { documentId: string } }).productionJob.documentId;

    const listed = await listProductionJobsApi(
      request("http://localhost/api/production-jobs", {
        headers: authHeaders({ role: "manufacturing_planner", organizationId: "led-display-warehouse" }),
      }),
    );
    expect(listed.status).toBe(200);

    const detail = await getProductionJobApi(
      request(`http://localhost/api/production-jobs/${productionJobId}`, {
        headers: authHeaders({ role: "manufacturing_planner", organizationId: "led-display-warehouse" }),
      }),
      { params: Promise.resolve({ productionJobId }) },
    );
    expect(detail.status).toBe(200);

    const patch = await patchProductionJobApi(
      request(`http://localhost/api/production-jobs/${productionJobId}`, {
        method: "PATCH",
        headers: {
          ...authHeaders({ role: "manufacturing_planner", organizationId: "led-display-warehouse", actor: "planner" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({ referenceNumber: "PJ-API-1-REV", expectedVersion: 1 }),
      }),
      { params: Promise.resolve({ productionJobId }) },
    );
    expect(patch.status).toBe(200);

    const revision = await createProductionJobRevisionApi(
      request(`http://localhost/api/production-jobs/${productionJobId}/revisions`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "manufacturing_planner", organizationId: "led-display-warehouse", actor: "planner" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({ reason: "Added execution details", changedFields: ["referenceNumber"] }),
      }),
      { params: Promise.resolve({ productionJobId }) },
    );
    expect(revision.status).toBe(201);

    const revisions = await productionJobRevisionsApi(
      request(`http://localhost/api/production-jobs/${productionJobId}/revisions`, {
        headers: authHeaders({ role: "manufacturing_planner", organizationId: "led-display-warehouse" }),
      }),
      { params: Promise.resolve({ productionJobId }) },
    );
    expect(revisions.status).toBe(200);

    const timeline = await productionJobTimelineApi(
      request(`http://localhost/api/production-jobs/${productionJobId}/timeline`, {
        headers: authHeaders({ role: "manufacturing_planner", organizationId: "led-display-warehouse" }),
      }),
      { params: Promise.resolve({ productionJobId }) },
    );
    expect(timeline.status).toBe(200);

    const searched = await searchProductionJobsApi(
      request("http://localhost/api/production-jobs/search?query=PJ-", {
        headers: authHeaders({ role: "manufacturing_planner", organizationId: "led-display-warehouse" }),
      }),
    );
    expect(searched.status).toBe(200);

    const auditDenied = await productionJobAuditApi(
      request(`http://localhost/api/production-jobs/${productionJobId}/audit`, {
        headers: authHeaders({ role: "viewer", organizationId: "led-display-warehouse" }),
      }),
      { params: Promise.resolve({ productionJobId }) },
    );
    expect(auditDenied.status).toBe(403);

    const auditAllowed = await productionJobAuditApi(
      request(`http://localhost/api/production-jobs/${productionJobId}/audit`, {
        headers: authHeaders({ role: "executive", organizationId: "led-display-warehouse" }),
      }),
      { params: Promise.resolve({ productionJobId }) },
    );
    expect(auditAllowed.status).toBe(200);
  });

  test("release, pause/resume, and cancel routes enforce permission and lifecycle checks", async () => {
    const workOrderId = createReleasedWorkOrderForApi();

    const created = await createFromWorkOrderApi(
      request(`http://localhost/api/production-jobs/from-work-order/${workOrderId}`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "manufacturing_planner", organizationId: "led-display-warehouse", actor: "planner" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({ referenceNumber: "PJ-API-2", executionContext: "line-b" }),
      }),
      { params: Promise.resolve({ workOrderId }) },
    );

    const productionJobId = ((await created.json()) as { productionJob: { documentId: string } }).productionJob.documentId;

    const releaseDenied = await releaseProductionJobApi(
      request(`http://localhost/api/production-jobs/${productionJobId}/release`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "executive", organizationId: "led-display-warehouse", actor: "exec" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ productionJobId }) },
    );
    expect(releaseDenied.status).toBe(403);

    const releaseInvalid = await releaseProductionJobApi(
      request(`http://localhost/api/production-jobs/${productionJobId}/release`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "production_supervisor", organizationId: "led-display-warehouse", actor: "supervisor" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ productionJobId }) },
    );
    expect(releaseInvalid.status).toBe(400);

    queueProductionJob({ productionJobId, actor: "planner" });
    readyProductionJob({ productionJobId, actor: "planner" });

    const releaseOk = await releaseProductionJobApi(
      request(`http://localhost/api/production-jobs/${productionJobId}/release`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "production_supervisor", organizationId: "led-display-warehouse", actor: "supervisor" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ productionJobId }) },
    );
    expect(releaseOk.status).toBe(200);

    const startAndPause = await pauseProductionJobApi(
      request(`http://localhost/api/production-jobs/${productionJobId}/pause`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "operations", organizationId: "led-display-warehouse", actor: "ops" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "start" }),
      }),
      { params: Promise.resolve({ productionJobId }) },
    );
    expect(startAndPause.status).toBe(200);

    const pauseOk = await pauseProductionJobApi(
      request(`http://localhost/api/production-jobs/${productionJobId}/pause`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "operations", organizationId: "led-display-warehouse", actor: "ops" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "pause" }),
      }),
      { params: Promise.resolve({ productionJobId }) },
    );
    expect(pauseOk.status).toBe(200);

    const resumeOk = await pauseProductionJobApi(
      request(`http://localhost/api/production-jobs/${productionJobId}/pause`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "operations", organizationId: "led-display-warehouse", actor: "ops" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "resume" }),
      }),
      { params: Promise.resolve({ productionJobId }) },
    );
    expect(resumeOk.status).toBe(200);

    const cancelOk = await cancelProductionJobApi(
      request(`http://localhost/api/production-jobs/${productionJobId}/cancel`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "operations", organizationId: "led-display-warehouse", actor: "ops" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ productionJobId }) },
    );
    expect(cancelOk.status).toBe(200);
  });

  test("direct create route supports explicit payloads", async () => {
    const workOrderId = createReleasedWorkOrderForApi();

    const fromWorkOrder = await createFromWorkOrderApi(
      request(`http://localhost/api/production-jobs/from-work-order/${workOrderId}`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "manufacturing_planner", organizationId: "led-display-warehouse", actor: "planner" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({ referenceNumber: "PJ-API-3", executionContext: "line-c" }),
      }),
      { params: Promise.resolve({ workOrderId }) },
    );

    const sourceJob = ((await fromWorkOrder.json()) as {
      productionJob: {
        organizationId: string;
        customerReference: string;
        ownerReference: string;
        salesRepresentativeReference: string | null;
        siteReference: string | null;
        executionContext: string | null;
        requestedStartDate: string | null;
        requestedCompletionDate: string | null;
        lineage: {
          workOrderId: string;
          workOrderRevision: number;
          originSalesOrderId: string;
          originSalesOrderRevision: number;
          originQuoteId: string;
          originQuoteRevision: number;
          organizationId: string;
          correlationId: string;
          causationId: string;
          manufacturingVersion: string;
          createdBy: string;
          createdTimestamp: string;
        };
        lines: readonly {
          lineId: string;
          workOrderLineId: string;
          productId: string;
          sku: string;
          displayName: string;
          quantity: number;
          unitOfMeasure: string;
          metadata: Record<string, string>;
        }[];
      };
    }).productionJob;

    const directCreate = await createProductionJobApi(
      request("http://localhost/api/production-jobs", {
        method: "POST",
        headers: {
          ...authHeaders({ role: "administrator", organizationId: "led-display-warehouse", actor: "admin" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          organizationId: sourceJob.organizationId,
          customerReference: sourceJob.customerReference,
          ownerReference: sourceJob.ownerReference,
          salesRepresentativeReference: sourceJob.salesRepresentativeReference,
          siteReference: sourceJob.siteReference,
          referenceNumber: "PJ-DIRECT-1",
          executionContext: sourceJob.executionContext,
          requestedStartDate: sourceJob.requestedStartDate,
          requestedCompletionDate: sourceJob.requestedCompletionDate,
          lineage: {
            ...sourceJob.lineage,
            workOrderId: `${sourceJob.lineage.workOrderId}-direct`,
            correlationId: `${sourceJob.lineage.correlationId}-direct`,
            causationId: `${sourceJob.lineage.causationId}-direct`,
          },
          lines: sourceJob.lines,
          metadata: { source: "direct" },
        }),
      }),
    );

    expect(directCreate.status).toBe(201);
  });
});
