import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  isRecordInScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { createExecution, listExecutions } from "@/modules/foundation/execution-repository";
import type { ExecutionStatus, NewExecutionInput } from "@/modules/foundation/execution-types";

const STATUSES: readonly ExecutionStatus[] = [
  "created",
  "ready",
  "waiting",
  "running",
  "paused",
  "blocked",
  "resumed",
  "completed",
  "cancelled",
  "failed",
  "recovered",
  "archived",
];

function parseStatus(value: string | null): ExecutionStatus | undefined {
  if (!value) {
    return undefined;
  }

  return STATUSES.includes(value as ExecutionStatus) ? (value as ExecutionStatus) : undefined;
}

function actorFromRequest(request: NextRequest): string {
  return request.headers.get("x-gcp-actor") ?? "api";
}

export async function GET(request: NextRequest) {
  const auth = authorizeRequest(request, "executions:read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const requestedOrganizationId = params.get("organizationId");
  if (requestedOrganizationId && requestedOrganizationId !== scope.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requestedSiteId = params.get("siteReference") ?? params.get("siteId");
  if (scope.siteId && requestedSiteId && requestedSiteId !== scope.siteId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const executions = listExecutions({
    organizationId: scope.organizationId ?? undefined,
    siteReference: scope.siteId ?? requestedSiteId ?? undefined,
    status: parseStatus(params.get("status")),
    scheduleId: params.get("scheduleId") ?? undefined,
    productionJobId: params.get("productionJobId") ?? undefined,
    operationId: params.get("operationId") ?? undefined,
    routingVersionId: params.get("routingVersionId") ?? undefined,
    workOrderId: params.get("workOrderId") ?? undefined,
    query: params.get("query") ?? undefined,
  }).filter((entry) =>
    isRecordInScope({
      recordOrganizationId: entry.organizationId,
      recordSiteId: entry.lineage.siteReference,
      scope,
    }),
  );

  return NextResponse.json({ executions });
}

export async function POST(request: NextRequest) {
  const auth = authorizeRequest(request, "executions:create");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as NewExecutionInput;

  if (body.organizationId !== scope.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (scope.siteId && body.siteReference && body.siteReference !== scope.siteId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = createExecution({
    payload: body,
    actor: actorFromRequest(request),
  });

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.execution) {
    return NextResponse.json({ error: "Unable to create execution." }, { status: 400 });
  }

  return NextResponse.json({ execution: result.execution }, { status: 201 });
}
