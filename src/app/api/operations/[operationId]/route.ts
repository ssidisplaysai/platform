import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  isRecordInScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import {
  getOperationById,
  updateOperationDraft,
} from "@/modules/foundation/operation-repository";
import type { UpdateOperationDraftInput } from "@/modules/foundation/operation-types";

type RouteContext = {
  params: Promise<{ operationId: string }>;
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

  return NextResponse.json({ operation });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "operations:update");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { operationId } = await context.params;
  const existing = getOperationById(operationId);
  if (!existing) {
    return NextResponse.json({ error: "Operation not found" }, { status: 404 });
  }

  if (
    !isRecordInScope({
      recordOrganizationId: existing.organizationId,
      recordSiteId: existing.siteReference,
      scope,
    })
  ) {
    return NextResponse.json({ error: "Operation not found" }, { status: 404 });
  }

  const body = (await request.json()) as UpdateOperationDraftInput & { expectedVersion?: number };
  const result = updateOperationDraft({
    operationId,
    patch: body,
    actor: actorFromRequest(request),
    expectedVersion: expectedVersionFromRequest(request, body),
  });

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.operation) {
    return NextResponse.json({ error: "Operation not found" }, { status: 404 });
  }

  return NextResponse.json({ operation: result.operation });
}
