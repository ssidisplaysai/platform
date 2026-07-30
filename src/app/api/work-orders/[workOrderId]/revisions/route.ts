import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  isRecordInScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import {
  createWorkOrderRevision,
  getWorkOrderById,
  listWorkOrderRevisions,
} from "@/modules/foundation/work-order-repository";

type RouteContext = {
  params: Promise<{ workOrderId: string }>;
};

function actorFromRequest(request: NextRequest): string {
  return request.headers.get("x-gcp-actor") ?? "api";
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "work_orders:view_revisions");
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

  return NextResponse.json({ revisions: listWorkOrderRevisions(workOrderId) });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "work_orders:revise");
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

  const body = (await request.json()) as {
    reason: string;
    changedFields?: readonly string[];
    expectedVersion?: number;
  };

  const result = createWorkOrderRevision({
    workOrderId,
    actor: actorFromRequest(request),
    reason: body.reason,
    changedFields: body.changedFields ?? [],
    expectedVersion:
      typeof body.expectedVersion === "number" && Number.isFinite(body.expectedVersion)
        ? body.expectedVersion
        : undefined,
  });

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.workOrder || !result.revision) {
    return NextResponse.json({ error: "Unable to create revision." }, { status: 400 });
  }

  return NextResponse.json({ workOrder: result.workOrder, revision: result.revision }, { status: 201 });
}
