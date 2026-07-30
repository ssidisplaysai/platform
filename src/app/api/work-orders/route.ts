import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  isRecordInScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import {
  createWorkOrder,
  listWorkOrders,
} from "@/modules/foundation/work-order-repository";
import type { NewWorkOrderInput, WorkOrderStatus } from "@/modules/foundation/work-order-types";

const STATUSES: readonly WorkOrderStatus[] = [
  "draft",
  "planned",
  "released",
  "in_production",
  "paused",
  "completed",
  "cancelled",
  "closed",
];

function parseStatus(value: string | null): WorkOrderStatus | undefined {
  if (!value) {
    return undefined;
  }

  return STATUSES.includes(value as WorkOrderStatus) ? (value as WorkOrderStatus) : undefined;
}

function actorFromRequest(request: NextRequest): string {
  return request.headers.get("x-gcp-actor") ?? "api";
}

export async function GET(request: NextRequest) {
  const auth = authorizeRequest(request, "work_orders:read");
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

  const workOrders = listWorkOrders({
    organizationId: scope.organizationId ?? undefined,
    siteReference: scope.siteId ?? requestedSiteId ?? undefined,
    status: parseStatus(params.get("status")),
    salesOrderId: params.get("salesOrderId") ?? undefined,
    quoteId: params.get("quoteId") ?? undefined,
    customerReference: params.get("customerReference") ?? undefined,
    query: params.get("query") ?? undefined,
  }).filter((entry) =>
    isRecordInScope({
      recordOrganizationId: entry.organizationId,
      recordSiteId: entry.siteReference,
      scope,
    }),
  );

  return NextResponse.json({ workOrders });
}

export async function POST(request: NextRequest) {
  const auth = authorizeRequest(request, "work_orders:create");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as NewWorkOrderInput;

  if (body.organizationId !== scope.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (scope.siteId && body.siteReference && body.siteReference !== scope.siteId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = createWorkOrder({
    ...body,
    actor: actorFromRequest(request),
  });

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.workOrder) {
    return NextResponse.json({ error: "Unable to create work order." }, { status: 400 });
  }

  return NextResponse.json({ workOrder: result.workOrder }, { status: 201 });
}
