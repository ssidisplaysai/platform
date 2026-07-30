import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  isRecordInScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import {
  getWorkOrderById,
  releaseWorkOrder,
} from "@/modules/foundation/work-order-repository";

type RouteContext = {
  params: Promise<{ workOrderId: string }>;
};

function actorFromRequest(request: NextRequest): string {
  return request.headers.get("x-gcp-actor") ?? "api";
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "work_orders:release");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { workOrderId } = await context.params;
  const existing = getWorkOrderById(workOrderId);
  if (!existing) {
    return NextResponse.json({ error: "Work order not found" }, { status: 404 });
  }

  if (
    !isRecordInScope({
      recordOrganizationId: existing.organizationId,
      recordSiteId: existing.siteReference,
      scope,
    })
  ) {
    return NextResponse.json({ error: "Work order not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { expectedVersion?: number };

  const result = releaseWorkOrder({
    workOrderId,
    actor: actorFromRequest(request),
    expectedVersion:
      typeof body.expectedVersion === "number" && Number.isFinite(body.expectedVersion)
        ? body.expectedVersion
        : undefined,
    correlationId: request.headers.get("x-gcp-correlation-id"),
    causationId: request.headers.get("x-gcp-causation-id"),
  });

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.workOrder) {
    return NextResponse.json({ error: "Unable to release work order." }, { status: 400 });
  }

  return NextResponse.json({ workOrder: result.workOrder });
}
