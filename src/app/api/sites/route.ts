import { NextRequest, NextResponse } from "next/server";
import { createSite, listSites } from "@/modules/foundation/site-repository";
import type { NewSiteInput } from "@/modules/foundation/types";
import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { recordSiteActivity } from "@/modules/foundation/site-audit";

export async function GET(request: NextRequest) {
  const auth = authorizeRequest(request, "sites:read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const scopedSites = listSites().filter((site) => {
    if (site.organizationId !== scope.organizationId) {
      return false;
    }

    if (scope.siteId && site.siteId !== scope.siteId) {
      return false;
    }

    return true;
  });

  return NextResponse.json({ sites: scopedSites });
}

export async function POST(request: NextRequest) {
  const auth = authorizeRequest(request, "sites:create");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
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
