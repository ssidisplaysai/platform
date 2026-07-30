import { NextRequest } from "next/server";
import {
  GET as listOperationsApi,
  POST as createOperationApi,
} from "@/app/api/operations/route";
import { GET as searchOperationsApi } from "@/app/api/operations/search/route";
import { POST as createOperationFromJobApi } from "@/app/api/operations/from-job/[productionJobId]/route";
import {
  GET as getOperationApi,
  PATCH as patchOperationApi,
} from "@/app/api/operations/[operationId]/route";
import { GET as operationAuditApi } from "@/app/api/operations/[operationId]/audit/route";
import {
  GET as operationRevisionsApi,
  POST as createOperationRevisionApi,
} from "@/app/api/operations/[operationId]/revisions/route";
import { GET as operationTimelineApi } from "@/app/api/operations/[operationId]/timeline/route";
import { POST as releaseOperationApi } from "@/app/api/operations/[operationId]/release/route";
import { POST as cancelOperationApi } from "@/app/api/operations/[operationId]/cancel/route";
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
  createProductionJobFromWorkOrder,
  resetProductionJobRepositoryForTests,
} from "@/modules/foundation/production-job-repository";
import {
  defineOperation,
  readyOperation,
  resetOperationRepositoryForTests,
} from "@/modules/foundation/operation-repository";
import { getProductionJobById } from "@/modules/foundation/production-job-repository";

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

function createReleasedProductionJobForOperationApi(): string {
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
      referenceNumber: "PO-API-OP",
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
      referenceNumber: "WO-API-OP",
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
      referenceNumber: "PJ-API-OP",
      executionContext: "line-a",
      correlationId: null,
      causationId: null,
    },
    actor: "planner",
  });

  return productionJob.productionJob?.documentId as string;
}

function operationBody(input: { productionJobId: string; sequenceNumber: number; referenceNumber: string }): Record<string, unknown> {
  const productionJob = getProductionJobById(input.productionJobId)!;
  return {
    organizationId: productionJob.organizationId,
    customerReference: productionJob.customerReference,
    ownerReference: productionJob.ownerReference,
    salesRepresentativeReference: productionJob.salesRepresentativeReference,
    siteReference: productionJob.siteReference,
    referenceNumber: input.referenceNumber,
    operationType: "assembly",
    sequenceNumber: input.sequenceNumber,
    operationName: `Operation ${input.sequenceNumber}`,
    description: "API created operation",
    requiredCapability: "assembly",
    estimatedDurationMinutes: 25,
    requiredWorkCenterReference: "wc-assembly-01",
    requiredMachineTypeReference: "mt-assembly-01",
    requiredSkill: "assembler",
    predecessorOperationIds: [],
    successorOperationIds: [],
    referenceDocuments: ["doc-api-op"],
    engineeringNotes: "api notes",
    lineage: {
      productionJobId: productionJob.documentId,
      productionJobRevision: productionJob.revision,
      workOrderId: productionJob.lineage.workOrderId,
      workOrderRevision: productionJob.lineage.workOrderRevision,
      originSalesOrderId: productionJob.lineage.originSalesOrderId,
      originSalesOrderRevision: productionJob.lineage.originSalesOrderRevision,
      originQuoteId: productionJob.lineage.originQuoteId,
      originQuoteRevision: productionJob.lineage.originQuoteRevision,
      organizationId: productionJob.organizationId,
      siteReference: productionJob.siteReference,
      correlationId: productionJob.lineage.correlationId,
      causationId: productionJob.lineage.causationId,
      manufacturingVersion: productionJob.lineage.manufacturingVersion,
      createdBy: "api",
      createdTimestamp: "2026-07-29T00:00:00.000Z",
    },
    metadata: { source: "api" },
  };
}

describe("GMP-0004 operation API", () => {
  beforeEach(() => {
    resetQuoteRepositoryForTests();
    resetSalesOrderRepositoryForTests();
    resetWorkOrderRepositoryForTests();
    resetProductionJobRepositoryForTests();
    resetOperationRepositoryForTests();
  });

  test("create, list, detail, update, search, revisions, timeline, and audit routes work with auth", async () => {
    const productionJobId = createReleasedProductionJobForOperationApi();

    const deniedCreate = await createOperationFromJobApi(
      request(`http://localhost/api/operations/from-job/${productionJobId}`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "viewer", organizationId: "led-display-warehouse" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({ referenceNumber: "OP-API-1", operationName: "API denied" }),
      }),
      { params: Promise.resolve({ productionJobId }) },
    );
    expect(deniedCreate.status).toBe(403);

    const created = await createOperationFromJobApi(
      request(`http://localhost/api/operations/from-job/${productionJobId}`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "administrator", organizationId: "led-display-warehouse", actor: "ops" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({ referenceNumber: "OP-API-1", operationType: "assembly", sequenceNumber: 1, operationName: "API Create" }),
      }),
      { params: Promise.resolve({ productionJobId }) },
    );
    expect(created.status).toBe(201);
    const operationId = ((await created.json()) as { operation: { documentId: string } }).operation.documentId;

    const listed = await listOperationsApi(
      request("http://localhost/api/operations", {
        headers: authHeaders({ role: "operations", organizationId: "led-display-warehouse" }),
      }),
    );
    expect(listed.status).toBe(200);

    const detail = await getOperationApi(
      request(`http://localhost/api/operations/${operationId}`, {
        headers: authHeaders({ role: "operations", organizationId: "led-display-warehouse" }),
      }),
      { params: Promise.resolve({ operationId }) },
    );
    expect(detail.status).toBe(200);

    const patch = await patchOperationApi(
      request(`http://localhost/api/operations/${operationId}`, {
        method: "PATCH",
        headers: {
          ...authHeaders({ role: "operations", organizationId: "led-display-warehouse", actor: "ops" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({ operationName: "API Create Updated", expectedVersion: 1 }),
      }),
      { params: Promise.resolve({ operationId }) },
    );
    expect(patch.status).toBe(200);

    const revision = await createOperationRevisionApi(
      request(`http://localhost/api/operations/${operationId}/revisions`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "operations", organizationId: "led-display-warehouse", actor: "ops" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({ reason: "Adjusted step detail", changedFields: ["operationName"] }),
      }),
      { params: Promise.resolve({ operationId }) },
    );
    expect(revision.status).toBe(201);

    const revisions = await operationRevisionsApi(
      request(`http://localhost/api/operations/${operationId}/revisions`, {
        headers: authHeaders({ role: "operations", organizationId: "led-display-warehouse" }),
      }),
      { params: Promise.resolve({ operationId }) },
    );
    expect(revisions.status).toBe(200);

    const timeline = await operationTimelineApi(
      request(`http://localhost/api/operations/${operationId}/timeline`, {
        headers: authHeaders({ role: "operations", organizationId: "led-display-warehouse" }),
      }),
      { params: Promise.resolve({ operationId }) },
    );
    expect(timeline.status).toBe(200);

    const search = await searchOperationsApi(
      request("http://localhost/api/operations/search?query=API", {
        headers: authHeaders({ role: "operations", organizationId: "led-display-warehouse" }),
      }),
    );
    expect(search.status).toBe(200);

    const auditDenied = await operationAuditApi(
      request(`http://localhost/api/operations/${operationId}/audit`, {
        headers: authHeaders({ role: "viewer", organizationId: "led-display-warehouse" }),
      }),
      { params: Promise.resolve({ operationId }) },
    );
    expect(auditDenied.status).toBe(403);

    const auditAllowed = await operationAuditApi(
      request(`http://localhost/api/operations/${operationId}/audit`, {
        headers: authHeaders({ role: "executive", organizationId: "led-display-warehouse" }),
      }),
      { params: Promise.resolve({ operationId }) },
    );
    expect(auditAllowed.status).toBe(200);
  });

  test("release and cancel routes enforce permission and lifecycle guards", async () => {
    const productionJobId = createReleasedProductionJobForOperationApi();

    const created = await createOperationFromJobApi(
      request(`http://localhost/api/operations/from-job/${productionJobId}`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "administrator", organizationId: "led-display-warehouse", actor: "ops" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({ referenceNumber: "OP-API-2", operationType: "inspection", sequenceNumber: 2, operationName: "Release Test" }),
      }),
      { params: Promise.resolve({ productionJobId }) },
    );

    const operationId = ((await created.json()) as { operation: { documentId: string } }).operation.documentId;

    const releaseDenied = await releaseOperationApi(
      request(`http://localhost/api/operations/${operationId}/release`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "viewer", organizationId: "led-display-warehouse", actor: "viewer" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ operationId }) },
    );
    expect(releaseDenied.status).toBe(403);

    defineOperation({ operationId, actor: "ops" });
    readyOperation({ operationId, actor: "ops" });

    const releaseOk = await releaseOperationApi(
      request(`http://localhost/api/operations/${operationId}/release`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "operations", organizationId: "led-display-warehouse", actor: "ops" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ operationId }) },
    );
    expect(releaseOk.status).toBe(200);

    const cancelOk = await cancelOperationApi(
      request(`http://localhost/api/operations/${operationId}/cancel`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "operations", organizationId: "led-display-warehouse", actor: "ops" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ operationId }) },
    );
    expect(cancelOk.status).toBe(200);
  });

  test("direct create route supports explicit lineage payloads", async () => {
    const productionJobId = createReleasedProductionJobForOperationApi();
    const rootCreate = await createOperationApi(
      request("http://localhost/api/operations", {
        method: "POST",
        headers: {
          ...authHeaders({ role: "administrator", organizationId: "led-display-warehouse", actor: "admin" }),
          "content-type": "application/json",
        },
        body: JSON.stringify(operationBody({ productionJobId, sequenceNumber: 3, referenceNumber: "OP-ROOT-1" })),
      }),
    );

    expect(rootCreate.status).toBe(201);
  });
});
