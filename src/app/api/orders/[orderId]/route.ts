import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  isRecordInScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import {
  getSalesOrderById,
  markSalesOrderViewed,
  updateSalesOrderDraft,
} from "@/modules/foundation/sales-order-repository";
import type { UpdateSalesOrderDraftInput } from "@/modules/foundation/sales-order-types";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

function actorFromRequest(request: NextRequest): string {
  return request.headers.get("x-gcp-actor") ?? "api";
}

function expectedVersionFromRequest(request: NextRequest, body: { expectedVersion?: unknown }): number | undefined {
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
  const auth = authorizeRequest(request, "orders:read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orderId } = await context.params;
  const order = getSalesOrderById(orderId);
  if (!order) {
    return NextResponse.json({ error: "Sales order not found" }, { status: 404 });
  }

  if (!isRecordInScope({
    recordOrganizationId: order.organizationId,
    recordSiteId: order.siteReference,
    scope,
  })) {
    return NextResponse.json({ error: "Sales order not found" }, { status: 404 });
  }

  markSalesOrderViewed({
    orderId,
    actor: actorFromRequest(request),
    correlationId: request.headers.get("x-gcp-correlation-id"),
  });

  return NextResponse.json({ order });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "orders:update");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orderId } = await context.params;
  const existing = getSalesOrderById(orderId);
  if (!existing) {
    return NextResponse.json({ error: "Sales order not found" }, { status: 404 });
  }

  if (!isRecordInScope({
    recordOrganizationId: existing.organizationId,
    recordSiteId: existing.siteReference,
    scope,
  })) {
    return NextResponse.json({ error: "Sales order not found" }, { status: 404 });
  }

  const body = (await request.json()) as UpdateSalesOrderDraftInput & {
    expectedVersion?: number;
  };

  const result = updateSalesOrderDraft({
    orderId,
    patch: body,
    actor: actorFromRequest(request),
    expectedVersion: expectedVersionFromRequest(request, body),
  });

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.order) {
    return NextResponse.json({ error: "Sales order not found" }, { status: 404 });
  }

  return NextResponse.json({ order: result.order });
}
