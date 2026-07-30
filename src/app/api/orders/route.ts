import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  isRecordInScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import {
  createSalesOrder,
  listSalesOrders,
} from "@/modules/foundation/sales-order-repository";
import type {
  CreateSalesOrderInput,
  SalesOrderStatus,
} from "@/modules/foundation/sales-order-types";

function parseStatus(value: string | null): SalesOrderStatus | undefined {
  if (!value) {
    return undefined;
  }

  const values: readonly SalesOrderStatus[] = [
    "draft",
    "pending_approval",
    "approved",
    "released",
    "in_fulfillment",
    "completed",
    "cancelled",
    "closed",
  ];

  return values.includes(value as SalesOrderStatus)
    ? (value as SalesOrderStatus)
    : undefined;
}

function actorFromRequest(request: NextRequest): string {
  return request.headers.get("x-gcp-actor") ?? "api";
}

export async function GET(request: NextRequest) {
  const auth = authorizeRequest(request, "orders:read");
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

  const orders = listSalesOrders({
    organizationId: scope.organizationId ?? undefined,
    siteReference: scope.siteId ?? requestedSiteId ?? undefined,
    customerReference: params.get("customerReference") ?? undefined,
    status: parseStatus(params.get("status")),
    salespersonReference: params.get("salespersonReference") ?? undefined,
    referenceNumber: params.get("referenceNumber") ?? undefined,
    query: params.get("query") ?? undefined,
  }).filter((order) =>
    isRecordInScope({
      recordOrganizationId: order.organizationId,
      recordSiteId: order.siteReference,
      scope,
    }),
  );

  return NextResponse.json({ orders });
}

export async function POST(request: NextRequest) {
  const auth = authorizeRequest(request, "orders:create");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as CreateSalesOrderInput;
  if (body.organizationId !== scope.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (scope.siteId && body.siteReference && body.siteReference !== scope.siteId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = createSalesOrder({
    ...body,
    actor: actorFromRequest(request),
  });

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.order) {
    return NextResponse.json({ error: "Unable to create sales order." }, { status: 400 });
  }

  return NextResponse.json({ order: result.order }, { status: 201 });
}
