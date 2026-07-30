import { NextRequest } from "next/server";
import { GET as listRoutingsApi, POST as createRoutingApi } from "@/app/api/routings/route";
import { GET as searchRoutingsApi } from "@/app/api/routings/search/route";
import { GET as getRoutingApi, PATCH as patchRoutingApi } from "@/app/api/routings/[routingId]/route";
import { GET as routingVersionsApi, POST as createRoutingVersionApi } from "@/app/api/routings/[routingId]/versions/route";
import { GET as routingAuditApi } from "@/app/api/routings/[routingId]/audit/route";
import { GET as routingRevisionsApi } from "@/app/api/routings/[routingId]/revisions/route";
import { GET as routingTimelineApi } from "@/app/api/routings/[routingId]/timeline/route";
import { POST as releaseRoutingApi } from "@/app/api/routings/[routingId]/release/route";
import { POST as archiveRoutingApi } from "@/app/api/routings/[routingId]/archive/route";
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
  defineRouting,
  createRouting,
  releaseRouting,
  resetRoutingRepositoryForTests,
} from "@/modules/foundation/routing-repository";

function request(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, init);
}

function authHeaders(input: {
  role?: "manufacturing_planner" | "manufacturing_engineer" | "production_supervisor" | "executive" | "administrator";
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

function createInstantiatedProductionJob(): string {
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
      productId: "prod-led-routing",
      sku: "LED-RTE-001",
      productRevision: "rev-1",
      catalogRevision: "cat-1",
      displayName: "Routing Product",
      description: null,
      quantity: 1,
      unitOfMeasure: "ea",
      unitPrice: 500,
      discount: 0,
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

  const order = createSalesOrderFromQuote({ payload: { quoteId, referenceNumber: "SO-RTE-API-001" }, actor: "sales-rep" });
  const orderId = order.order?.documentId as string;
  approveSalesOrder({ orderId, actor: "sales-manager", notes: "approved" });

  const workOrder = createWorkOrderFromOrder({
    payload: { orderId, referenceNumber: "WO-RTE-API-001", correlationId: null, causationId: null },
    actor: "planner",
  });

  const workOrderId = workOrder.workOrder?.documentId as string;
  planWorkOrder({ workOrderId, actor: "planner" });
  releaseWorkOrder({ workOrderId, actor: "planner" });

  const productionJob = createProductionJobFromWorkOrder({
    payload: {
      workOrderId,
      referenceNumber: "PJ-RTE-API-001",
      executionContext: "line-a",
      correlationId: null,
      causationId: null,
    },
    actor: "planner",
  });

  return productionJob.productionJob?.documentId as string;
}

function routingBody(productionJobId: string) {
  return {
    organizationId: "led-display-warehouse",
    customerReference: "cust-ledw-stadium-group",
    ownerReference: "owner-ledw-engineering",
    salesRepresentativeReference: "sales-ledw-001",
    siteReference: "site-led-display-warehouse-production",
    routingNumber: "RT-2026-LEDW-API-001",
    routingName: "API Routing",
    description: "Route for API verification",
    effectiveDate: "2026-02-01T00:00:00.000Z",
    productReference: "prod-led-cabinet",
    assemblyReference: "asm-led-cabinet",
    operationSequence: [
      {
        stepId: "step-1",
        operationReference: "op-a",
        sequenceNumber: 1,
        predecessorOperationIds: [],
        successorOperationIds: ["step-2"],
        parallelGroupReference: null,
        conditionalBranchReference: null,
        estimatedCycleTimeMinutes: 20,
        estimatedSetupTimeMinutes: 5,
        estimatedRunTimeMinutes: 15,
        estimatedChangeoverTimeMinutes: 2,
        referencedWorkCenter: "wc-1",
        referencedMachineType: "mt-1",
        referencedSkill: "operator",
        engineeringNotes: null,
        referenceDocuments: ["doc-1"],
      },
      {
        stepId: "step-2",
        operationReference: "op-b",
        sequenceNumber: 2,
        predecessorOperationIds: ["step-1"],
        successorOperationIds: [],
        parallelGroupReference: null,
        conditionalBranchReference: null,
        estimatedCycleTimeMinutes: 30,
        estimatedSetupTimeMinutes: 5,
        estimatedRunTimeMinutes: 25,
        estimatedChangeoverTimeMinutes: 3,
        referencedWorkCenter: "wc-2",
        referencedMachineType: "mt-2",
        referencedSkill: "assembler",
        engineeringNotes: null,
        referenceDocuments: ["doc-2"],
      },
    ],
    parallelOperationGroups: [{ groupId: "group-1", operationReferences: ["op-a", "op-b"], branchReference: null }],
    conditionalBranchReferences: ["branch-main"],
    estimatedCycleTimeMinutes: 50,
    estimatedSetupTimeMinutes: 10,
    estimatedRunTimeMinutes: 40,
    estimatedChangeoverTimeMinutes: 5,
    referencedWorkCenters: ["wc-1", "wc-2"],
    referencedMachineTypes: ["mt-1", "mt-2"],
    referencedSkills: ["operator", "assembler"],
    engineeringNotes: "Declarative API routing",
    referenceDocuments: ["eng-001"],
    lineage: {
      productionJobId,
      productionJobRevision: 1,
      workOrderId: "wo-routing-api",
      workOrderRevision: 1,
      originSalesOrderId: "so-routing-api",
      originSalesOrderRevision: 1,
      originQuoteId: "quote-routing-api",
      originQuoteRevision: 1,
      organizationId: "led-display-warehouse",
      siteReference: "site-led-display-warehouse-production",
      correlationId: "corr-routing-api",
      causationId: "cause-routing-api",
      createdBy: "planner",
      createdTimestamp: "2026-02-01T00:00:00.000Z",
      manufacturingVersion: "gmp-routing-v1",
    },
    metadata: { source: "test" },
  };
}

describe("GMP-0005 routing API", () => {
  beforeEach(() => {
    resetQuoteRepositoryForTests();
    resetSalesOrderRepositoryForTests();
    resetWorkOrderRepositoryForTests();
    resetProductionJobRepositoryForTests();
    resetRoutingRepositoryForTests();
  });

  test("create, list, detail, update, search, versions, timeline, and audit routes work with auth", async () => {
    const productionJobId = createInstantiatedProductionJob();

    const created = await createRoutingApi(
      request("http://localhost/api/routings", {
        method: "POST",
        headers: {
          ...authHeaders({ role: "manufacturing_engineer", organizationId: "led-display-warehouse", actor: "engineer" }),
          "content-type": "application/json",
        },
        body: JSON.stringify(routingBody(productionJobId)),
      }),
    );

    expect(created.status).toBe(201);
    const createdBody = await created.json();
    const routingId = createdBody.routing.documentId as string;

    const list = await listRoutingsApi(
      request("http://localhost/api/routings?organizationId=led-display-warehouse", {
        headers: authHeaders({ role: "executive", organizationId: "led-display-warehouse" }),
      }),
    );
    expect(list.status).toBe(200);

    const detail = await getRoutingApi(
      request(`http://localhost/api/routings/${routingId}`, {
        headers: authHeaders({ role: "executive", organizationId: "led-display-warehouse" }),
      }),
      { params: Promise.resolve({ routingId }) },
    );
    expect(detail.status).toBe(200);

    const update = await patchRoutingApi(
      request(`http://localhost/api/routings/${routingId}`, {
        method: "PATCH",
        headers: {
          ...authHeaders({ role: "manufacturing_engineer", organizationId: "led-display-warehouse", actor: "engineer" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({ routingName: "API Routing Updated" }),
      }),
      { params: Promise.resolve({ routingId }) },
    );
    expect(update.status).toBe(200);

    const search = await searchRoutingsApi(
      request("http://localhost/api/routings/search?query=API%20Routing", {
        headers: authHeaders({ role: "manufacturing_engineer", organizationId: "led-display-warehouse" }),
      }),
    );
    expect(search.status).toBe(200);

    const versions = await routingVersionsApi(
      request(`http://localhost/api/routings/${routingId}/versions`, {
        headers: authHeaders({ role: "executive", organizationId: "led-display-warehouse" }),
      }),
      { params: Promise.resolve({ routingId }) },
    );
    expect(versions.status).toBe(200);

    const versionCreate = await createRoutingVersionApi(
      request(`http://localhost/api/routings/${routingId}/versions`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "manufacturing_engineer", organizationId: "led-display-warehouse", actor: "engineer" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({ reason: "Version publish", changedFields: ["routingName"] }),
      }),
      { params: Promise.resolve({ routingId }) },
    );
    expect(versionCreate.status).toBe(201);

    const audit = await routingAuditApi(
      request(`http://localhost/api/routings/${routingId}/audit`, {
        headers: authHeaders({ role: "executive", organizationId: "led-display-warehouse" }),
      }),
      { params: Promise.resolve({ routingId }) },
    );
    expect(audit.status).toBe(200);

    const revisions = await routingRevisionsApi(
      request(`http://localhost/api/routings/${routingId}/revisions`, {
        headers: authHeaders({ role: "executive", organizationId: "led-display-warehouse" }),
      }),
      { params: Promise.resolve({ routingId }) },
    );
    expect(revisions.status).toBe(200);

    const timeline = await routingTimelineApi(
      request(`http://localhost/api/routings/${routingId}/timeline`, {
        headers: authHeaders({ role: "executive", organizationId: "led-display-warehouse" }),
      }),
      { params: Promise.resolve({ routingId }) },
    );
    expect(timeline.status).toBe(200);
  });

  test("release and archive routes enforce permission and lifecycle guards", async () => {
    const productionJobId = createInstantiatedProductionJob();
    const created = createRouting({
      payload: routingBody(productionJobId),
      actor: "engineer",
    });

    const routingId = created.routing?.documentId as string;
    defineRouting({ routingId, actor: "engineer" });

    const release = await releaseRoutingApi(
      request(`http://localhost/api/routings/${routingId}/release`, {
        method: "POST",
        headers: authHeaders({ role: "production_supervisor", organizationId: "led-display-warehouse", actor: "supervisor" }),
      }),
      { params: Promise.resolve({ routingId }) },
    );
    expect(release.status).toBe(200);

    const archive = await archiveRoutingApi(
      request(`http://localhost/api/routings/${routingId}/archive`, {
        method: "POST",
        headers: authHeaders({ role: "production_supervisor", organizationId: "led-display-warehouse", actor: "supervisor" }),
      }),
      { params: Promise.resolve({ routingId }) },
    );
    expect(archive.status).toBe(200);

    const invalidRelease = releaseRouting({ routingId, actor: "supervisor" });
    expect(invalidRelease.validation.valid).toBe(false);
  });
});