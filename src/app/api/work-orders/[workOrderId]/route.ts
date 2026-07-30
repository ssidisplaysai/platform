import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  isRecordInScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import {
  getWorkOrderById,
  markWorkOrderViewed,
  updateWorkOrderDraft,
} from "@/modules/foundation/work-order-repository";
import type { UpdateWorkOrderDraftInput } from "@/modules/foundation/work-order-types";

type RouteContext = {
  params: Promise<{ workOrderId: string }>;
};

function actorFromRequest(request: NextRequest): string {
  return request.headers.get("x-gcp-actor") ?? "api";
}

function expectedVersionFromRequest(
  request: NextRequest,
  body: { expectedVersion?: unknown },
): number | undefined {
  const headerValue = request.headers.get("x-gcp-expected-version");
  if (headerValue) {
    const parsed = Number(headerValue);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  if (typeof body.expectedVersion === "number" && Number.isFinite(body.expectedVersion)) {
    return body.expectedVersion;
  }

  return undefined;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "work_orders:read");
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

  markWorkOrderViewed({
    workOrderId,
    actor: actorFromRequest(request),
    correlationId: request.headers.get("x-gcp-correlation-id"),
    causationId: request.headers.get("x-gcp-causation-id"),
  });

  return NextResponse.json({ workOrder });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "work_orders:update");
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

  const body = (await request.json()) as UpdateWorkOrderDraftInput & { expectedVersion?: number };

  const result = updateWorkOrderDraft({
    workOrderId,
    patch: body,
    actor: actorFromRequest(request),
    expectedVersion: expectedVersionFromRequest(request, body),
  });

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.workOrder) {
    return NextResponse.json({ error: "Work order not found" }, { status: 404 });
  }

  return NextResponse.json({ workOrder: result.workOrder });
}
