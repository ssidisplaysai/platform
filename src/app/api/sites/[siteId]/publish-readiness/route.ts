import { NextRequest, NextResponse } from "next/server";

import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { resolvePermissions } from "@/modules/foundation/permissions";
import { certifySitePublishReadiness } from "@/modules/foundation/site-publish-readiness-certification";
import { evaluateSiteReadiness } from "@/modules/foundation/site-readiness";
import { getSiteById } from "@/modules/foundation/site-repository";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ siteId: string }> },
) {
  const auth = authorizeRequest(request, "sites:read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });
  }

  const { siteId } = await context.params;
  const site = getSiteById(siteId);

  if (
    !site
    || site.organizationId !== scope.organizationId
    || (scope.siteId && scope.siteId !== site.siteId)
  ) {
    return NextResponse.json({ error: "Site not found." }, { status: 404 });
  }

  const permissions = resolvePermissions(auth.roles);
  const candidate = {
    ...site,
    publishingStatus: "ready" as const,
  };

  const readiness = evaluateSiteReadiness({
    site: candidate,
    organizationActive: true,
    requiredPermission: "sites:manage_integrations",
    permissions,
    intent: "publish",
    requireWorkflowReference: true,
  });

  return NextResponse.json({
    siteId: site.siteId,
    currentPublishingStatus: site.publishingStatus,
    certifiable: readiness.ready,
    blockingReasons: readiness.blockingReasons,
    warnings: readiness.warnings,
    checkedConditions: readiness.checkedConditions,
    certificationPerformed: false,
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ siteId: string }> },
) {
  const auth = authorizeRequest(request, "sites:manage_integrations");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { confirm?: string } | null;
  if (body?.confirm !== "CERTIFY_SITE_PUBLISH_READINESS") {
    return NextResponse.json({ error: "Explicit publish-readiness certification confirmation is required." }, { status: 400 });
  }

  const { siteId } = await context.params;
  const site = getSiteById(siteId);

  if (
    !site
    || site.organizationId !== scope.organizationId
    || (scope.siteId && scope.siteId !== site.siteId)
  ) {
    return NextResponse.json({ error: "Site not found." }, { status: 404 });
  }

  const result = certifySitePublishReadiness({
    site,
    organizationActive: true,
    permissions: resolvePermissions(auth.roles),
  });

  return NextResponse.json({
    siteId: site.siteId,
    certified: result.certified,
    publishingStatus: result.site?.publishingStatus ?? site.publishingStatus,
    blockingReasons: result.blockingReasons,
    warnings: result.warnings,
    certificationPerformed: result.certified,
  }, { status: result.certified ? 200 : 409 });
}
