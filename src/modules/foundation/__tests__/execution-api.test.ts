import { NextRequest } from "next/server";
import { GET as listExecutionsApi, POST as createExecutionApi } from "@/app/api/executions/route";
import { GET as searchExecutionsApi } from "@/app/api/executions/search/route";
import { GET as getExecutionApi, PATCH as patchExecutionApi } from "@/app/api/executions/[executionId]/route";
import { GET as executionAuditApi } from "@/app/api/executions/[executionId]/audit/route";
import { GET as executionRevisionsApi } from "@/app/api/executions/[executionId]/revisions/route";
import { GET as executionTimelineApi } from "@/app/api/executions/[executionId]/timeline/route";
import { POST as transitionExecutionApi } from "@/app/api/executions/[executionId]/transition/route";
import { resetExecutionRepositoryForTests } from "@/modules/foundation/execution-repository";

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

function request(url: string, init?: ConstructorParameters<typeof NextRequest>[1]): NextRequest {
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

function executionBody(): Record<string, unknown> {
  return {
    organizationId: "led-display-warehouse",
    customerReference: "cust-ledw-stadium-group",
    ownerReference: "owner-ledw-commerce",
    salesRepresentativeReference: null,
    siteReference: "site-led-display-warehouse-production",
    executionNumber: "EX-2026-LEDW-000001",
    executionName: "API execution",
    scheduleId: "schedule-ledw-001",
    productionJobId: null,
    operationId: null,
    routingVersionId: null,
    workOrderId: "work-order-ledw-001",
    originSalesOrderId: "sales-order-ledw-001",
    originQuoteId: "quote-ledw-001",
    progress: 12,
    actualStart: null,
    actualFinish: null,
    elapsedDurationMinutes: null,
    estimatedDurationMinutes: 90,
    notes: "api notes",
    attachments: [],
    operatorReferences: [],
    machineReferences: [],
    telemetryReferences: [],
    lineage: {
      scheduleId: "schedule-ledw-001",
      productionJobId: null,
      operationId: null,
      routingVersionId: null,
      workOrderId: "work-order-ledw-001",
      originSalesOrderId: "sales-order-ledw-001",
      originQuoteId: "quote-ledw-001",
      organizationId: "led-display-warehouse",
      siteReference: "site-led-display-warehouse-production",
      correlationId: "corr-api-execution",
      causationId: "cause-api-execution",
      createdBy: "api",
      createdTimestamp: "2026-07-29T00:00:00.000Z",
    },
    metadata: { source: "api" },
  };
}

describe("GMP-0008A execution API", () => {
  beforeEach(() => {
    resetExecutionRepositoryForTests();
  });

  test("create, list, detail, search, revision, timeline, audit, and lifecycle routes work with auth", async () => {
    const denied = await createExecutionApi(
      request("http://localhost/api/executions", {
        method: "POST",
        headers: {
          ...authHeaders({ role: "viewer", organizationId: "led-display-warehouse" }),
          "content-type": "application/json",
        },
        body: JSON.stringify(executionBody()),
      }),
    );
    expect(denied.status).toBe(403);

    const created = await createExecutionApi(
      request("http://localhost/api/executions", {
        method: "POST",
        headers: {
          ...authHeaders({ role: "administrator", organizationId: "led-display-warehouse", actor: "ops" }),
          "content-type": "application/json",
        },
        body: JSON.stringify(executionBody()),
      }),
    );
    expect(created.status).toBe(201);
    const executionId = ((await created.json()) as { execution: { documentId: string } }).execution.documentId;

    const listed = await listExecutionsApi(
      request("http://localhost/api/executions", {
        headers: authHeaders({ role: "operations", organizationId: "led-display-warehouse" }),
      }),
    );
    expect(listed.status).toBe(200);

    const detail = await getExecutionApi(
      request(`http://localhost/api/executions/${executionId}`, {
        headers: authHeaders({ role: "operations", organizationId: "led-display-warehouse" }),
      }),
      { params: Promise.resolve({ executionId }) },
    );
    expect(detail.status).toBe(200);

    const search = await searchExecutionsApi(
      request("http://localhost/api/executions/search?query=API", {
        headers: authHeaders({ role: "operations", organizationId: "led-display-warehouse" }),
      }),
    );
    expect(search.status).toBe(200);

    const patch = await patchExecutionApi(
      request(`http://localhost/api/executions/${executionId}?expectedVersion=1`, {
        method: "PATCH",
        headers: {
          ...authHeaders({ role: "operations", organizationId: "led-display-warehouse", actor: "ops" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({ executionName: "API execution updated" }),
      }),
      { params: Promise.resolve({ executionId }) },
    );
    expect(patch.status).toBe(200);

    const ready = await transitionExecutionApi(
      request(`http://localhost/api/executions/${executionId}/transition`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "administrator", organizationId: "led-display-warehouse", actor: "ops" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "ready", reason: "ready" }),
      }),
      { params: Promise.resolve({ executionId }) },
    );
    expect(ready.status).toBe(200);

    const waiting = await transitionExecutionApi(
      request(`http://localhost/api/executions/${executionId}/transition`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "administrator", organizationId: "led-display-warehouse", actor: "ops" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "wait", reason: "waiting" }),
      }),
      { params: Promise.resolve({ executionId }) },
    );
    expect(waiting.status).toBe(200);

    const started = await transitionExecutionApi(
      request(`http://localhost/api/executions/${executionId}/transition`, {
        method: "POST",
        headers: {
          ...authHeaders({ role: "administrator", organizationId: "led-display-warehouse", actor: "ops" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "start", reason: "start" }),
      }),
      { params: Promise.resolve({ executionId }) },
    );
    expect(started.status).toBe(200);

    const audit = await executionAuditApi(
      request(`http://localhost/api/executions/${executionId}/audit`, {
        headers: authHeaders({ role: "operations", organizationId: "led-display-warehouse" }),
      }),
      { params: Promise.resolve({ executionId }) },
    );
    expect(audit.status).toBe(200);

    const revisions = await executionRevisionsApi(
      request(`http://localhost/api/executions/${executionId}/revisions`, {
        headers: authHeaders({ role: "operations", organizationId: "led-display-warehouse" }),
      }),
      { params: Promise.resolve({ executionId }) },
    );
    expect(revisions.status).toBe(200);

    const timeline = await executionTimelineApi(
      request(`http://localhost/api/executions/${executionId}/timeline`, {
        headers: authHeaders({ role: "operations", organizationId: "led-display-warehouse" }),
      }),
      { params: Promise.resolve({ executionId }) },
    );
    expect(timeline.status).toBe(200);
  });
});
