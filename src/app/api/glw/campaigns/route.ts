import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import {
  createGlwCampaign,
  listGlwCampaigns,
} from "@/modules/glw/campaign-repository";
import type { NewGlwCampaignInput } from "@/modules/glw/campaign-types";

export async function GET(request: NextRequest) {
  const auth = authorizeRequest(request, "schedules:read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const campaigns = listGlwCampaigns().filter(
    (campaign) =>
      campaign.organizationId === scope.organizationId &&
      (!scope.siteId || campaign.siteId === scope.siteId),
  );

  return NextResponse.json({ campaigns });
}

export async function POST(request: NextRequest) {
  const auth = authorizeRequest(request, "schedules:create");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as NewGlwCampaignInput;
  if (body.organizationId !== scope.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (scope.siteId && body.siteId !== scope.siteId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = createGlwCampaign(body);
  if (!result.campaign) {
    return NextResponse.json({ errors: result.errors }, { status: 400 });
  }

  return NextResponse.json({ campaign: result.campaign }, { status: 201 });
}
