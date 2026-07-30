import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, hasOrganizationScope, isRecordInScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { createRouting, listRoutings } from "@/modules/foundation/routing-repository";
import type { NewRoutingInput, RoutingStatus } from "@/modules/foundation/routing-types";

const STATUSES: readonly RoutingStatus[] = ["draft", "defined", "released", "superseded", "archived", "closed"];

function parseStatus(value: string | null): RoutingStatus | undefined {
  if (!value) {
    return undefined;
  }

  return STATUSES.includes(value as RoutingStatus) ? (value as RoutingStatus) : undefined;
}

function actorFromRequest(request: NextRequest): string {
  return request.headers.get("x-gcp-actor") ?? "api";
}

export async function GET(request: NextRequest) {
  const auth = authorizeRequest(request, "routings:read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const routings = listRoutings({
    organizationId: scope.organizationId ?? undefined,
    siteReference: scope.siteId ?? params.get("siteReference") ?? undefined,
    status: parseStatus(params.get("status")),
    productionJobId: params.get("productionJobId") ?? undefined,
    workOrderId: params.get("workOrderId") ?? undefined,
    salesOrderId: params.get("salesOrderId") ?? undefined,
    quoteId: params.get("quoteId") ?? undefined,
    productReference: params.get("productReference") ?? undefined,
    assemblyReference: params.get("assemblyReference") ?? undefined,
    operationReference: params.get("operationReference") ?? undefined,
    query: params.get("query") ?? undefined,
  }).filter((entry) =>
    isRecordInScope({ recordOrganizationId: entry.organizationId, recordSiteId: entry.siteReference, scope }),
  );

  return NextResponse.json({ routings });
}

export async function POST(request: NextRequest) {
  const auth = authorizeRequest(request, "routings:create");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as NewRoutingInput;

  if (body.organizationId !== scope.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (scope.siteId && body.siteReference && body.siteReference !== scope.siteId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = createRouting({ payload: body, actor: actorFromRequest(request) });
  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.routing) {
    return NextResponse.json({ error: "Unable to create routing." }, { status: 400 });
  }

  return NextResponse.json({ routing: result.routing }, { status: 201 });
}