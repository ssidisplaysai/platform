import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  isRecordInScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import {
  createProductionJob,
  listProductionJobs,
} from "@/modules/foundation/production-job-repository";
import type { NewProductionJobInput, ProductionJobStatus } from "@/modules/foundation/production-job-types";

const STATUSES: readonly ProductionJobStatus[] = [
  "draft",
  "queued",
  "ready",
  "released",
  "running",
  "paused",
  "completed",
  "cancelled",
  "closed",
];

function parseStatus(value: string | null): ProductionJobStatus | undefined {
  if (!value) {
    return undefined;
  }
  return STATUSES.includes(value as ProductionJobStatus) ? (value as ProductionJobStatus) : undefined;
}

function actorFromRequest(request: NextRequest): string {
  return request.headers.get("x-gcp-actor") ?? "api";
}

export async function GET(request: NextRequest) {
  const auth = authorizeRequest(request, "production_jobs:read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const requestedOrganizationId = params.get("organizationId");
  if (requestedOrganizationId && requestedOrganizationId !== scope.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requestedSiteId = params.get("siteReference") ?? params.get("siteId");
  if (scope.siteId && requestedSiteId && requestedSiteId !== scope.siteId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const jobs = listProductionJobs({
    organizationId: scope.organizationId ?? undefined,
    siteReference: scope.siteId ?? requestedSiteId ?? undefined,
    status: parseStatus(params.get("status")),
    workOrderId: params.get("workOrderId") ?? undefined,
    salesOrderId: params.get("salesOrderId") ?? undefined,
    quoteId: params.get("quoteId") ?? undefined,
    customerReference: params.get("customerReference") ?? undefined,
    query: params.get("query") ?? undefined,
  }).filter((entry) =>
    isRecordInScope({
      recordOrganizationId: entry.organizationId,
      recordSiteId: entry.siteReference,
      scope,
    }),
  );

  return NextResponse.json({ productionJobs: jobs });
}

export async function POST(request: NextRequest) {
  const auth = authorizeRequest(request, "production_jobs:create");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as NewProductionJobInput;

  if (body.organizationId !== scope.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (scope.siteId && body.siteReference && body.siteReference !== scope.siteId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = createProductionJob({
    ...body,
    actor: actorFromRequest(request),
  });

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.productionJob) {
    return NextResponse.json({ error: "Unable to create production job." }, { status: 400 });
  }

  return NextResponse.json({ productionJob: result.productionJob }, { status: 201 });
}
