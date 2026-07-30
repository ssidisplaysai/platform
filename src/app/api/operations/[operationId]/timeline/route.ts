import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  isRecordInScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { getOperationById, listOperationTimeline } from "@/modules/foundation/operation-repository";

type RouteContext = {
  params: Promise<{ operationId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "operations:read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { operationId } = await context.params;
  const operation = getOperationById(operationId);
  if (!operation) {
    return NextResponse.json({ error: "Operation not found" }, { status: 404 });
  }

  if (
    !isRecordInScope({
      recordOrganizationId: operation.organizationId,
      recordSiteId: operation.siteReference,
      scope,
    })
  ) {
    return NextResponse.json({ error: "Operation not found" }, { status: 404 });
  }

  return NextResponse.json({ timeline: listOperationTimeline(operationId) });
}
