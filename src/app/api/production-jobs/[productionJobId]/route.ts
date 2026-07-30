import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  isRecordInScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import {
  getProductionJobById,
  markProductionJobViewed,
  updateProductionJobDraft,
} from "@/modules/foundation/production-job-repository";
import type { UpdateProductionJobDraftInput } from "@/modules/foundation/production-job-types";

type RouteContext = {
  params: Promise<{ productionJobId: string }>;
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
  const auth = authorizeRequest(request, "production_jobs:read");
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

  markProductionJobViewed({
    productionJobId,
    actor: actorFromRequest(request),
    correlationId: request.headers.get("x-gcp-correlation-id"),
    causationId: request.headers.get("x-gcp-causation-id"),
  });

  return NextResponse.json({ productionJob });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "production_jobs:revise");
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

  const body = (await request.json()) as UpdateProductionJobDraftInput & { expectedVersion?: number };

  const result = updateProductionJobDraft({
    productionJobId,
    patch: body,
    actor: actorFromRequest(request),
    expectedVersion: expectedVersionFromRequest(request, body),
  });

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.productionJob) {
    return NextResponse.json({ error: "Production job not found" }, { status: 404 });
  }

  return NextResponse.json({ productionJob: result.productionJob });
}
