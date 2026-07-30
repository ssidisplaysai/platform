import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  isRecordInScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import {
  cancelProductionJob,
  getProductionJobById,
} from "@/modules/foundation/production-job-repository";

type RouteContext = {
  params: Promise<{ productionJobId: string }>;
};

function actorFromRequest(request: NextRequest): string {
  return request.headers.get("x-gcp-actor") ?? "api";
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "production_jobs:cancel");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { productionJobId } = await context.params;
  const existing = getProductionJobById(productionJobId);
  if (!existing) {
    return NextResponse.json({ error: "Production job not found" }, { status: 404 });
  }

  if (
    !isRecordInScope({
      recordOrganizationId: existing.organizationId,
      recordSiteId: existing.siteReference,
      scope,
    })
  ) {
    return NextResponse.json({ error: "Production job not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { expectedVersion?: number };

  const result = cancelProductionJob({
    productionJobId,
    actor: actorFromRequest(request),
    expectedVersion:
      typeof body.expectedVersion === "number" && Number.isFinite(body.expectedVersion)
        ? body.expectedVersion
        : undefined,
    correlationId: request.headers.get("x-gcp-correlation-id"),
    causationId: request.headers.get("x-gcp-causation-id"),
  });

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.productionJob) {
    return NextResponse.json({ error: "Unable to cancel production job." }, { status: 400 });
  }

  return NextResponse.json({ productionJob: result.productionJob });
}
