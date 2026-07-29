import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  isRecordInScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import {
  createSalesOrderRevision,
  getSalesOrderById,
  listSalesOrderRevisions,
} from "@/modules/foundation/sales-order-repository";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

function actorFromRequest(request: NextRequest): string {
  return request.headers.get("x-gcp-actor") ?? "api";
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "orders:read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orderId } = await context.params;
  const order = getSalesOrderById(orderId);
  if (!order) {
    return NextResponse.json({ error: "Sales order not found" }, { status: 404 });
  }

  if (!isRecordInScope({
    recordOrganizationId: order.organizationId,
    recordSiteId: order.siteReference,
    scope,
  })) {
    return NextResponse.json({ error: "Sales order not found" }, { status: 404 });
  }

  return NextResponse.json({ revisions: listSalesOrderRevisions(orderId) });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "orders:revise");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orderId } = await context.params;
  const order = getSalesOrderById(orderId);
  if (!order) {
    return NextResponse.json({ error: "Sales order not found" }, { status: 404 });
  }

  if (!isRecordInScope({
    recordOrganizationId: order.organizationId,
    recordSiteId: order.siteReference,
    scope,
  })) {
    return NextResponse.json({ error: "Sales order not found" }, { status: 404 });
  }

  const body = (await request.json()) as {
    reason: string;
    changedFields?: string[];
    expectedVersion?: number;
  };

  const result = createSalesOrderRevision({
    orderId,
    actor: actorFromRequest(request),
    reason: body.reason,
    changedFields: body.changedFields ?? [],
    expectedVersion: body.expectedVersion,
  });

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.order || !result.revision) {
    return NextResponse.json({ error: "Unable to create revision" }, { status: 400 });
  }

  return NextResponse.json({ order: result.order, revision: result.revision }, { status: 201 });
}
