import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  isRecordInScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import {
  getProductionJobById,
  listProductionJobAuditEvents,
} from "@/modules/foundation/production-job-repository";

type RouteContext = {
  params: Promise<{ productionJobId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "production_jobs:view_audit");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { productionJobId } = await context.params;
  const productionJob = getProductionJobById(productionJobId);
  if (!productionJob) {
    return NextResponse.json({ error: "Production job not found" }, { status: 404 });
  }

  if (
    !isRecordInScope({
      recordOrganizationId: productionJob.organizationId,
      recordSiteId: productionJob.siteReference,
      scope,
    })
  ) {
    return NextResponse.json({ error: "Production job not found" }, { status: 404 });
  }

  return NextResponse.json({ events: listProductionJobAuditEvents(productionJobId) });
}
