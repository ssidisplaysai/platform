import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  isRecordInScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import {
  getSalesOrderById,
  listSalesOrderAuditEvents,
} from "@/modules/foundation/sales-order-repository";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "orders:view_audit");
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

  return NextResponse.json({ events: listSalesOrderAuditEvents(orderId) });
}
