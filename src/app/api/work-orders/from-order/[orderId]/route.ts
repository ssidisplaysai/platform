import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { getSalesOrderById } from "@/modules/foundation/sales-order-repository";
import { createWorkOrderFromOrder } from "@/modules/foundation/work-order-repository";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

function actorFromRequest(request: NextRequest): string {
  return request.headers.get("x-gcp-actor") ?? "api";
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "work_orders:create");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orderId } = await context.params;
  const salesOrder = getSalesOrderById(orderId);
  if (!salesOrder) {
    return NextResponse.json({ error: "Sales order not found" }, { status: 404 });
  }

  if (salesOrder.organizationId !== scope.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (scope.siteId && salesOrder.siteReference && scope.siteId !== salesOrder.siteReference) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    referenceNumber?: string | null;
    correlationId?: string | null;
    causationId?: string | null;
  };

  const result = createWorkOrderFromOrder({
    payload: {
      orderId,
      referenceNumber: body.referenceNumber ?? null,
      correlationId: body.correlationId ?? request.headers.get("x-gcp-correlation-id"),
      causationId: body.causationId ?? request.headers.get("x-gcp-causation-id"),
    },
    actor: actorFromRequest(request),
  });

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.workOrder) {
    return NextResponse.json({ error: "Unable to create work order from sales order." }, { status: 400 });
  }

  return NextResponse.json({ workOrder: result.workOrder }, { status: 201 });
}
