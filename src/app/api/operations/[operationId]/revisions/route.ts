import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  isRecordInScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import {
  createOperationRevision,
  getOperationById,
} from "@/modules/foundation/operation-repository";

type RouteContext = {
  params: Promise<{ operationId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "operations:view_revisions");
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

  return NextResponse.json({ revisions: operation.revisionHistory });
}

function actorFromRequest(request: NextRequest): string {
  return request.headers.get("x-gcp-actor") ?? "api";
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "operations:revise");
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

  const body = (await request.json().catch(() => ({}))) as {
    reason?: string;
    changedFields?: readonly string[];
  };

  const result = createOperationRevision({
    operationId,
    actor: actorFromRequest(request),
    reason: body.reason ?? "Revision update",
    changedFields: body.changedFields ?? [],
  });

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.operation) {
    return NextResponse.json({ error: "Operation not found" }, { status: 404 });
  }

  return NextResponse.json({ operation: result.operation }, { status: 201 });
}
