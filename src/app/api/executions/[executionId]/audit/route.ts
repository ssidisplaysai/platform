import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, hasOrganizationScope, isRecordInScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { getExecutionById, listExecutionAuditEvents } from "@/modules/foundation/execution-repository";

export async function GET(request: NextRequest, context: { params: Promise<{ executionId: string }> }) {
  const auth = authorizeRequest(request, "executions:view_audit");
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

  return NextResponse.json({ auditEvents: listExecutionAuditEvents(executionId) });
}
