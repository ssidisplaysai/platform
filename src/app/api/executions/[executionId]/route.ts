import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, hasOrganizationScope, isRecordInScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { getExecutionById, updateExecutionDraft } from "@/modules/foundation/execution-repository";
import type { UpdateExecutionDraftInput } from "@/modules/foundation/execution-types";

function actorFromRequest(request: NextRequest): string {
  return request.headers.get("x-gcp-actor") ?? "api";
}

export async function GET(request: NextRequest, context: { params: Promise<{ executionId: string }> }) {
  const auth = authorizeRequest(request, "executions:read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { executionId } = await context.params;
  const execution = getExecutionById(executionId);
  if (!execution) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope) || !isRecordInScope({ recordOrganizationId: execution.organizationId, recordSiteId: execution.lineage.siteReference, scope })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ execution });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ executionId: string }> }) {
  const auth = authorizeRequest(request, "executions:update");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { executionId } = await context.params;
  const scope = resolveRequestScope(request);
  const execution = getExecutionById(executionId);
  if (!execution) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!hasOrganizationScope(scope) || !isRecordInScope({ recordOrganizationId: execution.organizationId, recordSiteId: execution.lineage.siteReference, scope })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const patch = (await request.json()) as UpdateExecutionDraftInput;
  const result = updateExecutionDraft({
    executionId,
    patch,
    actor: actorFromRequest(request),
    expectedVersion: typeof request.nextUrl.searchParams.get("expectedVersion") === "string" ? Number(request.nextUrl.searchParams.get("expectedVersion")) : undefined,
  });

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.execution) {
    return NextResponse.json({ error: "Unable to update execution." }, { status: 400 });
  }

  return NextResponse.json({ execution: result.execution });
}
