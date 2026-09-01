import { NextRequest, NextResponse } from "next/server";

import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import {
  previewGlwCampaignTargetLease,
  summarizeGlwCampaignTargets,
} from "@/modules/glw/campaign-target-repository";

type Context = {
  params: Promise<{ campaignId: string }>;
};

function resolveDispatchDate(
  request: NextRequest,
): string {
  const requested = request.nextUrl.searchParams
    .get("dispatchDate")
    ?.trim();

  if (requested) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(requested)) {
      throw new Error(
        "dispatchDate must use YYYY-MM-DD.",
      );
    }

    return requested;
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function GET(
  request: NextRequest,
  context: Context,
) {
  const auth = authorizeRequest(
    request,
    "schedules:read",
  );

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status },
    );
  }

  const scope = resolveRequestScope(request);

  if (!hasOrganizationScope(scope)) {
    return NextResponse.json(
      { error: "Organization scope is required." },
      { status: 403 },
    );
  }

  const { campaignId } = await context.params;

  const campaign = listGlwCampaigns().find(
    (candidate) =>
      candidate.campaignId === campaignId
      && candidate.organizationId === scope.organizationId
      && (
        !scope.siteId
        || candidate.siteId === scope.siteId
      ),
  ) ?? null;

  if (!campaign) {
    return NextResponse.json(
      { error: "Campaign not found." },
      { status: 404 },
    );
  }

  if (campaign.status !== "active") {
    return NextResponse.json(
      {
        error:
          "Only active campaigns have a production schedule.",
      },
      { status: 409 },
    );
  }

  let dispatchDate: string;

  try {
    dispatchDate = resolveDispatchDate(request);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Invalid dispatch date.",
      },
      { status: 400 },
    );
  }

  const queue = summarizeGlwCampaignTargets(
    campaign.campaignId,
  );

  const preview = previewGlwCampaignTargetLease({
    campaignId: campaign.campaignId,
    pagesPerDay: campaign.pagesPerDay,
    dispatchDate,
  });

  return NextResponse.json({
    campaign: {
      campaignId: campaign.campaignId,
      status: campaign.status,
      pagesPerDay: campaign.pagesPerDay,
      publicationPolicy:
        campaign.publicationPolicy,
    },
    dispatchDate,
    queue,
    schedule: {
      dailyLimit: campaign.pagesPerDay,
      alreadyDispatchedToday:
        preview.alreadyDispatchedToday,
      remainingAllowance: preview.allowance,
      nextTargets: preview.selected.map(
        (target) => ({
          targetId: target.targetId,
          stateCode: target.stateCode,
          status: target.status,
        }),
      ),
    },
    dryRun: true,
  });
}