import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  isRecordInScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import {
  cancelSalesOrder,
  getSalesOrderById,
} from "@/modules/foundation/sales-order-repository";

type RouteContext = { params: Promise<{ orderId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "orders:cancel");
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

  const body = (await request.json()) as { notes?: string | null; expectedVersion?: number };
  const result = cancelSalesOrder({
    orderId,
    actor: request.headers.get("x-gcp-actor") ?? "api",
    notes: body.notes ?? null,
    expectedVersion: body.expectedVersion,
  });

  if (!result.validation.valid || !result.order) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  return NextResponse.json({ order: result.order });
}
