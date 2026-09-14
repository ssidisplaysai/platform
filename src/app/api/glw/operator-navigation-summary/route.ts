import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest } from "@/modules/foundation/api-auth";
import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import { listAllGlwCampaignTargets } from "@/modules/glw/campaign-target-repository";
import { deriveOperatorNavigationSummary } from "@/modules/glw/operator-navigation-summary";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = authorizeRequest(request, "workspace:view");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const campaigns = listGlwCampaigns();
  const targets = listAllGlwCampaignTargets();
  const organizationId = request.nextUrl.searchParams.get("organizationId")?.trim() || null;
  const siteId = request.nextUrl.searchParams.get("siteId")?.trim() || null;
  return NextResponse.json({
    ...deriveOperatorNavigationSummary({ campaigns, targets, organizationId, siteId }),
    mutationPerformed: false,
  });
}
