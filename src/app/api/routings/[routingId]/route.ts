import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, hasOrganizationScope, isRecordInScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { getRoutingById, updateRoutingDraft } from "@/modules/foundation/routing-repository";
import type { UpdateRoutingDraftInput } from "@/modules/foundation/routing-types";

type RouteContext = { params: Promise<{ routingId: string }> };

function actorFromRequest(request: NextRequest): string {
  return request.headers.get("x-gcp-actor") ?? "api";
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "routings:read");
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

  return NextResponse.json({ routing });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "routings:update");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { routingId } = await context.params;
  const existing = getRoutingById(routingId);
  if (!existing) {
    return NextResponse.json({ error: "Routing not found" }, { status: 404 });
  }

  if (!isRecordInScope({ recordOrganizationId: existing.organizationId, recordSiteId: existing.siteReference, scope })) {
    return NextResponse.json({ error: "Routing not found" }, { status: 404 });
  }

  const body = (await request.json()) as UpdateRoutingDraftInput & { expectedVersion?: number };
  const result = updateRoutingDraft({
    routingId,
    patch: body,
    actor: actorFromRequest(request),
  });

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.routing) {
    return NextResponse.json({ error: "Routing not found" }, { status: 404 });
  }

  return NextResponse.json({ routing: result.routing });
}