import { NextRequest, NextResponse } from "next/server";

import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import {
  activateGlwCampaign,
  listGlwCampaigns,
} from "@/modules/glw/campaign-repository";
import { getGlwCampaignReferenceApproval } from "@/modules/glw/campaign-reference-approval-repository";
import {
  initializeGlwCampaignTargets,
  listGlwCampaignTargets,
} from "@/modules/glw/campaign-target-repository";
import { GLW_CAMPAIGN_US_STATES } from "@/modules/glw/campaign-geography";
import { glwPageExecutionRepository } from "@/modules/glw/page-execution-repository";

type Context = {
  params: Promise<{ campaignId: string }>;
};

export async function GET(
  request: NextRequest,
  context: Context,
) {
  const auth = authorizeRequest(request, "schedules:read");

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status },
    );
  }

  const scope = resolveRequestScope(request);

  if (!hasOrganizationScope(scope)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 },
    );
  }

  const { campaignId } = await context.params;

  const campaign = listGlwCampaigns().find(
    (candidate) =>
      candidate.campaignId === campaignId
      && candidate.organizationId === scope.organizationId
      && (!scope.siteId || candidate.siteId === scope.siteId),
  ) ?? null;

  if (!campaign) {
    return NextResponse.json(
      { error: "Campaign not found." },
      { status: 404 },
    );
  }

  const targets = listGlwCampaignTargets(campaign.campaignId);

  return NextResponse.json({
    campaign,
    targets,
  });
}

export async function POST(
  request: NextRequest,
  context: Context,
) {
  const auth = authorizeRequest(request, "schedules:create");

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status },
    );
  }

  const scope = resolveRequestScope(request);

  if (!hasOrganizationScope(scope)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 },
    );
  }

  const { campaignId } = await context.params;

  const campaign = listGlwCampaigns().find(
    (candidate) =>
      candidate.campaignId === campaignId
      && candidate.organizationId === scope.organizationId,
  ) ?? null;

  if (!campaign) {
    return NextResponse.json(
      { error: "Campaign not found." },
      { status: 404 },
    );
  }

  if (scope.siteId && campaign.siteId !== scope.siteId) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 },
    );
  }

  if (campaign.status === "active") {
    const targets = listGlwCampaignTargets(campaign.campaignId);

    return NextResponse.json({
      campaign,
      targets,
      alreadyActive: true,
    });
  }

  if (campaign.status !== "draft") {
    return NextResponse.json(
      {
        error:
          `Campaign cannot activate from status ${campaign.status}.`,
      },
      { status: 409 },
    );
  }

  const referenceStateCode = "CA";

  if (!campaign.stateCodes.includes(referenceStateCode)) {
    return NextResponse.json(
      {
        error:
          "California must be included as the approved reference target for this campaign.",
      },
      { status: 409 },
    );
  }

  const approval = getGlwCampaignReferenceApproval(
    campaign.campaignId,
    referenceStateCode,
  );

  if (!approval) {
    return NextResponse.json(
      {
        error:
          "Campaign activation requires an approved California reference.",
      },
      { status: 409 },
    );
  }

  const state = GLW_CAMPAIGN_US_STATES.find(
    (candidate) => candidate.code === referenceStateCode,
  ) ?? null;

  if (!state) {
    return NextResponse.json(
      { error: "Reference state is not recognized." },
      { status: 500 },
    );
  }

  const referenceJob =
    await glwPageExecutionRepository.getById(approval.jobId);

  if (
    !referenceJob
    || referenceJob.organizationId !== campaign.organizationId
    || referenceJob.siteId !== campaign.siteId
    || referenceJob.productId !== campaign.productId
    || referenceJob.state !== state.name
    || referenceJob.status !== "COMPLETE"
    || referenceJob.qaStatus !== "COMPLETE"
    || referenceJob.wordpressStatus !== "draft"
    || referenceJob.wordpressObjectId !== approval.wordpressObjectId
    || !referenceJob.wordpressObjectId
    || (
      campaign.imageRequired
      && referenceJob.featuredImagePresent !== true
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Approved reference no longer satisfies campaign activation gates.",
      },
      { status: 409 },
    );
  }

  const targets = initializeGlwCampaignTargets({
    campaignId: campaign.campaignId,
    organizationId: campaign.organizationId,
    siteId: campaign.siteId,
    productId: campaign.productId,
    stateCodes: campaign.stateCodes,
    referenceStateCode,
    referenceJobId: referenceJob.jobId,
    referenceWordpressObjectId: referenceJob.wordpressObjectId,
  });

  const referenceTargets = targets.filter(
    (target) => target.status === "reference_complete",
  );

  const queuedTargets = targets.filter(
    (target) => target.status === "queued",
  );

  if (
    targets.length !== campaign.stateCodes.length
    || referenceTargets.length !== 1
    || referenceTargets[0]?.stateCode !== referenceStateCode
    || queuedTargets.length !== campaign.stateCodes.length - 1
  ) {
    return NextResponse.json(
      {
        error:
          "Campaign target queue failed activation integrity checks.",
      },
      { status: 500 },
    );
  }

  const activation = activateGlwCampaign(campaign.campaignId);

  if (!activation.campaign) {
    return NextResponse.json(
      {
        errors: activation.errors,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    campaign: activation.campaign,
    targets,
    activation: {
      referenceStateCode,
      referenceJobId: referenceJob.jobId,
      referenceWordpressObjectId:
        referenceJob.wordpressObjectId,
      totalTargets: targets.length,
      referenceComplete: referenceTargets.length,
      queued: queuedTargets.length,
      pagesPerDay: activation.campaign.pagesPerDay,
      publicationPolicy:
        activation.campaign.publicationPolicy,
    },
  });
}