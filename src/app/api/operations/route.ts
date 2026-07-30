import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  isRecordInScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import {
  createOperation,
  listOperations,
} from "@/modules/foundation/operation-repository";
import type { NewOperationInput, OperationStatus } from "@/modules/foundation/operation-types";

const STATUSES: readonly OperationStatus[] = [
  "draft",
  "defined",
  "ready",
  "released",
  "waiting",
  "completed",
  "cancelled",
  "closed",
];

function parseStatus(value: string | null): OperationStatus | undefined {
  if (!value) {
    return undefined;
  }

  return STATUSES.includes(value as OperationStatus) ? (value as OperationStatus) : undefined;
}

function actorFromRequest(request: NextRequest): string {
  return request.headers.get("x-gcp-actor") ?? "api";
}

export async function GET(request: NextRequest) {
  const auth = authorizeRequest(request, "operations:read");
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

  const operations = listOperations({
    organizationId: scope.organizationId ?? undefined,
    siteReference: scope.siteId ?? requestedSiteId ?? undefined,
    status: parseStatus(params.get("status")),
    productionJobId: params.get("productionJobId") ?? undefined,
    workOrderId: params.get("workOrderId") ?? undefined,
    salesOrderId: params.get("salesOrderId") ?? undefined,
    quoteId: params.get("quoteId") ?? undefined,
    operationType: params.get("operationType") ?? undefined,
    query: params.get("query") ?? undefined,
  }).filter((entry) =>
    isRecordInScope({
      recordOrganizationId: entry.organizationId,
      recordSiteId: entry.siteReference,
      scope,
    }),
  );

  return NextResponse.json({ operations });
}

export async function POST(request: NextRequest) {
  const auth = authorizeRequest(request, "operations:create");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as NewOperationInput;

  if (body.organizationId !== scope.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (scope.siteId && body.siteReference && body.siteReference !== scope.siteId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = createOperation({
    payload: body,
    actor: actorFromRequest(request),
  });

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.operation) {
    return NextResponse.json({ error: "Unable to create operation." }, { status: 400 });
  }

  return NextResponse.json({ operation: result.operation }, { status: 201 });
}
