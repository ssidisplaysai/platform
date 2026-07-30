import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  isRecordInScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import {
  createProductionJobRevision,
  getProductionJobById,
  listProductionJobRevisions,
} from "@/modules/foundation/production-job-repository";

type RouteContext = {
  params: Promise<{ productionJobId: string }>;
};

function actorFromRequest(request: NextRequest): string {
  return request.headers.get("x-gcp-actor") ?? "api";
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "production_jobs:view_revisions");
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

  return NextResponse.json({ revisions: listProductionJobRevisions(productionJobId) });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "production_jobs:revise");
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

  const body = (await request.json()) as {
    reason: string;
    changedFields?: readonly string[];
    expectedVersion?: number;
  };

  const result = createProductionJobRevision({
    productionJobId,
    actor: actorFromRequest(request),
    reason: body.reason,
    changedFields: body.changedFields ?? [],
    expectedVersion:
      typeof body.expectedVersion === "number" && Number.isFinite(body.expectedVersion)
        ? body.expectedVersion
        : undefined,
  });

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.productionJob || !result.revision) {
    return NextResponse.json({ error: "Unable to create revision." }, { status: 400 });
  }

  return NextResponse.json({ productionJob: result.productionJob, revision: result.revision }, { status: 201 });
}
