import { NextRequest, NextResponse } from "next/server";
import { getSiteById, updateSite } from "@/modules/foundation/site-repository";
import type { UpdateSiteInput } from "@/modules/foundation/types";
import { isAuthorized } from "@/modules/foundation/api-auth";
import { recordSiteActivity } from "@/modules/foundation/site-audit";

type RouteContext = {
  params: Promise<{
    siteId: string;
  }>;
};

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  const { siteId } = await context.params;
  const site = getSiteById(siteId);

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  return NextResponse.json({ site });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!isAuthorized(request, "sites:update")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { siteId } = await context.params;
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
