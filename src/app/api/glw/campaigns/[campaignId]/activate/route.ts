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
import { getGlwCampaignReferenceApproval, getGovernedLocalCampaignReferenceApproval } from "@/modules/glw/campaign-reference-approval-repository";
import {
  initializeGlwCampaignTargets,
  initializeGlwCityCampaignTargets,
  listGlwCampaignTargets,
} from "@/modules/glw/campaign-target-repository";
import {
  applyRecoveredCityCampaignTargetAdoption,
  planRecoveredCityCampaignTargetAdoption,
} from "@/modules/glw/campaign-recovered-target-adoption";
import { GLW_CAMPAIGN_US_STATES } from "@/modules/glw/campaign-geography";
import { glwPageExecutionRepository } from "@/modules/glw/page-execution-repository";
import { recordGlwCampaignLaunchActivated, requireGlwCampaignLaunchReservationOwnership } from "@/modules/glw/campaign-launch-authority";
import { claimGlwCampaignActivationGrant, consumeGlwCampaignActivationGrant } from "@/modules/glw/campaign-activation-authorization";
import { requireGlwCampaignActivationReleaseCapability } from "@/modules/glw/campaign-release-capability";

type Context = {
  params: Promise<{ campaignId: string }>;
};

function normalizeCitySlug(value?: string | null): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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

  return NextResponse.json({ campaign, targets });
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

    try {
      recordGlwCampaignLaunchActivated(campaign, targets);
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Campaign activation journal recovery failed.",
          campaign,
          targets,
          activationRecoveryRequired: true,
        },
        { status: 503 },
      );
    }

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

  try {
    requireGlwCampaignActivationReleaseCapability({
      organizationId: campaign.organizationId,
      siteId: campaign.siteId,
      runningReleaseSha: process.env.GIT_COMMIT?.trim().toLowerCase() ?? "",
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Campaign activation release capability is required.",
      code: "GLW_CAMPAIGN_ACTIVATION_RELEASE_CAPABILITY_REQUIRED",
    }, { status: 503 });
  }

  const body = await request.json().catch(() => null) as {
    referenceStateCode?: string;
    referenceCitySlug?: string;
  } | null;

  const isCityCampaign = campaign.pageType === "city_service";
  const referenceStateCode = isCityCampaign
    ? body?.referenceStateCode?.trim().toUpperCase() ?? ""
    : "CA";
  const referenceCitySlug = isCityCampaign
    ? normalizeCitySlug(body?.referenceCitySlug)
    : null;

  if (!campaign.stateCodes.includes(referenceStateCode)) {
    return NextResponse.json(
      {
        error: isCityCampaign
          ? "City campaign activation requires a reference state included in the campaign."
          : "California must be included as the approved reference target for this campaign.",
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

  const cityTarget = isCityCampaign
    ? campaign.cityTargets?.find(
        (candidate) =>
          candidate.stateCode === referenceStateCode
          && normalizeCitySlug(candidate.citySlug) === referenceCitySlug,
      ) ?? null
    : null;

  if (isCityCampaign && (!referenceCitySlug || !cityTarget)) {
    return NextResponse.json(
      {
        error:
          "City campaign activation requires an exact reference city included in the campaign.",
      },
      { status: 409 },
    );
  }

  const approval = getGlwCampaignReferenceApproval(
    campaign.campaignId,
    referenceStateCode,
    referenceCitySlug,
  );

  if (!approval) {
    return NextResponse.json(
      {
        error: isCityCampaign
          ? "Campaign activation requires an approved city reference."
          : "Campaign activation requires an approved California reference.",
      },
      { status: 409 },
    );
  }

  const governedReferenceApproval = referenceCitySlug
    ? getGovernedLocalCampaignReferenceApproval(campaign.campaignId, referenceStateCode, referenceCitySlug)
    : null;
  const wordpressApproval = approval.approvalKind === "GOVERNED_LOCAL_REFERENCE" ? null : approval;
  const referenceJob = wordpressApproval
    ? await glwPageExecutionRepository.getById(wordpressApproval.jobId)
    : null;

  if (!governedReferenceApproval && (
    !referenceJob
    || referenceJob.organizationId !== campaign.organizationId
    || referenceJob.siteId !== campaign.siteId
    || referenceJob.productId !== campaign.productId
    || referenceJob.state !== state.name
    || (isCityCampaign && referenceJob.city !== cityTarget?.cityName)
    || referenceJob.status !== "COMPLETE"
    || referenceJob.qaStatus !== "COMPLETE"
    || referenceJob.wordpressStatus !== "draft"
    || referenceJob.wordpressObjectId !== wordpressApproval?.wordpressObjectId
    || !referenceJob.wordpressObjectId
    || (campaign.imageRequired && referenceJob.featuredImagePresent !== true)
  )) {
    return NextResponse.json(
      {
        error:
          "Approved reference no longer satisfies campaign activation gates.",
      },
      { status: 409 },
    );
  }

  requireGlwCampaignLaunchReservationOwnership(campaign);

  const initializedTargets = isCityCampaign
    ? initializeGlwCityCampaignTargets({
        campaignId: campaign.campaignId,
        organizationId: campaign.organizationId,
        siteId: campaign.siteId,
        productId: campaign.productId,
        cityTargets: campaign.cityTargets ?? [],
        referenceTarget: {
          stateCode: referenceStateCode,
          citySlug: referenceCitySlug!,
        },
        referenceJobId: referenceJob?.jobId ?? null,
        referenceWordpressObjectId: referenceJob?.wordpressObjectId ?? null,
      })
    : initializeGlwCampaignTargets({
        campaignId: campaign.campaignId,
        organizationId: campaign.organizationId,
        siteId: campaign.siteId,
        productId: campaign.productId,
        stateCodes: campaign.stateCodes,
        referenceStateCode,
        referenceJobId: referenceJob!.jobId,
        referenceWordpressObjectId: referenceJob!.wordpressObjectId!,
      });

  let recoveredTargetCount = 0;
  let targets = initializedTargets;

  if (isCityCampaign) {
    const localExecutions = await glwPageExecutionRepository.list();
    const recovered = planRecoveredCityCampaignTargetAdoption({
      organizationId: campaign.organizationId,
      siteId: campaign.siteId,
      productId: campaign.productId,
      cityTargets: campaign.cityTargets ?? [],
      referenceTarget: {
        stateCode: referenceStateCode,
        citySlug: referenceCitySlug!,
      },
      executions: localExecutions,
      imageRequired: campaign.imageRequired,
    });

    recoveredTargetCount = recovered.length;
    targets = applyRecoveredCityCampaignTargetAdoption({
      campaignId: campaign.campaignId,
      dispositions: recovered,
    });
  }

  const referenceTargets = targets.filter(
    (target) => target.status === "reference_complete",
  );

  const queuedTargets = targets.filter(
    (target) => target.status === "queued",
  );

  const draftReadyTargets = targets.filter(
    (target) => target.status === "draft_ready",
  );

  const publishedTargets = targets.filter(
    (target) => target.status === "published",
  );

  const skippedTargets = targets.filter(
    (target) => target.status === "skipped",
  );

  const expectedTargetCount = isCityCampaign
    ? campaign.cityTargets?.length ?? 0
    : campaign.stateCodes.length;

  const referenceIdentityMatches = isCityCampaign
    ? referenceTargets[0]?.stateCode === referenceStateCode
      && referenceTargets[0]?.citySlug === referenceCitySlug
    : referenceTargets[0]?.stateCode === referenceStateCode;

  const allCityTargetsAccountedFor = isCityCampaign
    ? referenceTargets.length
      + queuedTargets.length
      + draftReadyTargets.length
      + publishedTargets.length
      + skippedTargets.length === expectedTargetCount
    : true;

  if (
    targets.length !== expectedTargetCount
    || referenceTargets.length !== 1
    || !referenceIdentityMatches
    || !allCityTargetsAccountedFor
    || (!isCityCampaign && queuedTargets.length !== expectedTargetCount - 1)
  ) {
    return NextResponse.json(
      {
        error:
          "Campaign target queue failed activation integrity checks.",
      },
      { status: 500 },
    );
  }

  let activationGrant;
  try {
    if (!governedReferenceApproval) throw new Error("GOVERNED_REFERENCE_APPROVAL_REQUIRED");
    activationGrant = claimGlwCampaignActivationGrant({
      campaign,
      targets,
      certifiedReleaseSha: process.env.GIT_COMMIT?.trim().toLowerCase() ?? "",
      referenceApproval: governedReferenceApproval,
      claimedBy: auth.roles.includes("platform_admin") ? "platform_admin" : "authorized_scheduler",
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Campaign-scoped activation authorization is required.",
      code: "CAMPAIGN_ACTIVATION_AUTHORIZATION_REQUIRED",
    }, { status: 403 });
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

  try {
    consumeGlwCampaignActivationGrant({
      grantId: activationGrant.grant.grantId,
      claimId: activationGrant.claimId,
      consumedBy: auth.roles.includes("platform_admin") ? "platform_admin" : "authorized_scheduler",
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Campaign activated but scoped authorization recovery is required.",
      campaign: activation.campaign,
      targets,
      activationAuthorizationRecoveryRequired: true,
    }, { status: 503 });
  }

  try {
    recordGlwCampaignLaunchActivated(activation.campaign, targets);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Campaign activated but launch journal recovery is required.",
        campaign: activation.campaign,
        targets,
        activationRecoveryRequired: true,
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    campaign: activation.campaign,
    targets,
    activation: {
      referenceStateCode,
      referenceCitySlug,
      referenceCityName: cityTarget?.cityName ?? null,
      referenceJobId: referenceJob?.jobId ?? null,
      referenceWordpressObjectId:
        referenceJob?.wordpressObjectId ?? null,
      totalTargets: targets.length,
      referenceComplete: referenceTargets.length,
      recovered: recoveredTargetCount,
      queued: queuedTargets.length,
      draftReady: draftReadyTargets.length,
      published: publishedTargets.length,
      skipped: skippedTargets.length,
      pagesPerDay: activation.campaign.pagesPerDay,
      publicationPolicy:
        activation.campaign.publicationPolicy,
    },
  });
}
