import { NextRequest, NextResponse } from "next/server";
import { getSiteById, updateSite } from "@/modules/foundation/site-repository";
import type { UpdateSiteInput } from "@/modules/foundation/types";
import {
  authorizeRequest,
  hasOrganizationScope,
  isRecordInScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { recordSiteActivity } from "@/modules/foundation/site-audit";

type RouteContext = {
  params: Promise<{
    siteId: string;
  }>;
};

export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  const auth = authorizeRequest(request, "sites:read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { siteId } = await context.params;
  const site = getSiteById(siteId);

  if (!site || !isRecordInScope({ recordOrganizationId: site.organizationId, recordSiteId: site.siteId, scope })) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  return NextResponse.json({ site });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "sites:update");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { siteId } = await context.params;
  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = getSiteById(siteId);

  if (
    !existing ||
    !isRecordInScope({
      recordOrganizationId: existing.organizationId,
      recordSiteId: existing.siteId,
      scope,
    })
  ) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }
  const patch = (await request.json()) as UpdateSiteInput;
  const result = updateSite(siteId, patch);

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  recordSiteActivity({
    siteId: result.site.siteId,
    organizationId: result.site.organizationId,
    type: "site_updated",
    actor: "api",
    summary: "Site updated through bounded site foundation API.",
  });

  return NextResponse.json({ site: result.site });
}
