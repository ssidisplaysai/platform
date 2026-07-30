import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, hasOrganizationScope, isRecordInScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { getRoutingById, listRoutingTimeline } from "@/modules/foundation/routing-repository";

type RouteContext = { params: Promise<{ routingId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "routings:view_audit");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { routingId } = await context.params;
  const routing = getRoutingById(routingId);
  if (!routing) {
    return NextResponse.json({ error: "Routing not found" }, { status: 404 });
  }

  if (!isRecordInScope({ recordOrganizationId: routing.organizationId, recordSiteId: routing.siteReference, scope })) {
    return NextResponse.json({ error: "Routing not found" }, { status: 404 });
  }

  return NextResponse.json({ timeline: listRoutingTimeline(routingId) });
}