import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  isRecordInScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import {
  getWorkOrderById,
  listWorkOrderAuditEvents,
} from "@/modules/foundation/work-order-repository";

type RouteContext = {
  params: Promise<{ workOrderId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "work_orders:view_audit");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { workOrderId } = await context.params;
  const workOrder = getWorkOrderById(workOrderId);
  if (!workOrder) {
    return NextResponse.json({ error: "Work order not found" }, { status: 404 });
  }

  if (
    !isRecordInScope({
      recordOrganizationId: workOrder.organizationId,
      recordSiteId: workOrder.siteReference,
      scope,
    })
  ) {
    return NextResponse.json({ error: "Work order not found" }, { status: 404 });
  }

  return NextResponse.json({ events: listWorkOrderAuditEvents(workOrderId) });
}
