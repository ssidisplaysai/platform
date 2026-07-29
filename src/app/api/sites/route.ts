import { NextRequest, NextResponse } from "next/server";
import { createSite, listSites } from "@/modules/foundation/site-repository";
import type { NewSiteInput } from "@/modules/foundation/types";
import { isAuthorized } from "@/modules/foundation/api-auth";
import { recordSiteActivity } from "@/modules/foundation/site-audit";

export async function GET() {
  return NextResponse.json({ sites: listSites() });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request, "sites:create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as NewSiteInput;
  const result = createSite(body);

  if (!result.validation.valid) {
    return NextResponse.json(
      { issues: result.validation.issues },
      { status: 400 },
    );
  }

  if (!result.site) {
    return NextResponse.json({ error: "Unable to create site." }, { status: 400 });
  }

  recordSiteActivity({
    siteId: result.site.siteId,
    organizationId: result.site.organizationId,
    type: "site_created",
    actor: "api",
    summary: "Site created through bounded site foundation API.",
  });

  return NextResponse.json({ site: result.site }, { status: 201 });
}
