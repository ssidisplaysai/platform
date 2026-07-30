import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, hasOrganizationScope, isRecordInScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { createRoutingVersion, getRoutingById, listRoutingVersions } from "@/modules/foundation/routing-repository";
import type { CreateRoutingVersionInput } from "@/modules/foundation/routing-types";

type RouteContext = { params: Promise<{ routingId: string }> };

function actorFromRequest(request: NextRequest): string {
  return request.headers.get("x-gcp-actor") ?? "api";
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "routings:view_revisions");
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

  return NextResponse.json({ versions: listRoutingVersions(routingId) });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "routings:revise");
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

  const body = (await request.json()) as CreateRoutingVersionInput;
  const result = createRoutingVersion({
    routingId,
    actor: actorFromRequest(request),
    reason: body.reason,
    changedFields: body.changedFields,
  });

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.version) {
    return NextResponse.json({ error: "Routing not found" }, { status: 404 });
  }

  return NextResponse.json({ version: result.version }, { status: 201 });
}