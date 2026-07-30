import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { createProductionJobFromWorkOrder } from "@/modules/foundation/production-job-repository";
import { getWorkOrderById } from "@/modules/foundation/work-order-repository";

type RouteContext = {
  params: Promise<{ workOrderId: string }>;
};

function actorFromRequest(request: NextRequest): string {
  return request.headers.get("x-gcp-actor") ?? "api";
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "production_jobs:create");
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

  if (workOrder.organizationId !== scope.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (scope.siteId && workOrder.siteReference && scope.siteId !== workOrder.siteReference) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    referenceNumber?: string | null;
    executionContext?: string | null;
    correlationId?: string | null;
    causationId?: string | null;
  };

  const result = createProductionJobFromWorkOrder({
    payload: {
      workOrderId,
      referenceNumber: body.referenceNumber ?? null,
      executionContext: body.executionContext ?? null,
      correlationId: body.correlationId ?? request.headers.get("x-gcp-correlation-id"),
      causationId: body.causationId ?? request.headers.get("x-gcp-causation-id"),
    },
    actor: actorFromRequest(request),
  });

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.productionJob) {
    return NextResponse.json({ error: "Unable to create production job from work order." }, { status: 400 });
  }

  return NextResponse.json({ productionJob: result.productionJob }, { status: 201 });
}
