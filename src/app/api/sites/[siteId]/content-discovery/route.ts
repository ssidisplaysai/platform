import { NextRequest, NextResponse } from "next/server";

import { isAuthorized } from "@/modules/foundation/api-auth";
import {
  discoverSiteContent,
} from "@/modules/foundation/site-content-discovery";
import {
  getSiteById,
} from "@/modules/foundation/site-repository";

type RouteContext = {
  params: Promise<{
    siteId: string;
  }>;
};

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  if (!isAuthorized(request, "sites:read")) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 },
    );
  }

  const { siteId } = await context.params;
  const site = getSiteById(siteId);

  if (!site) {
    return NextResponse.json(
      { error: "Site not found" },
      { status: 404 },
    );
  }

  const requestedOrganizationId =
    request.headers.get("x-gcp-organization-id")?.trim();

  if (
    !requestedOrganizationId ||
    requestedOrganizationId !== site.organizationId
  ) {
    return NextResponse.json(
      { error: "Organization scope mismatch" },
      { status: 403 },
    );
  }

  const result = await discoverSiteContent(site);

  return NextResponse.json(
    { result },
    { status: result.ok ? 200 : 502 },
  );
}