import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, hasOrganizationScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { evaluateCampaignProductMediaReadiness, resolveCampaignPresentationHero, resolveEffectiveCampaignMediaRecords, resolveGlwCampaignMediaPolicy } from "@/modules/glw/campaign-media-policy";
import { listGlwCampaigns, updateGlwCampaignMediaPolicy } from "@/modules/glw/campaign-repository";
import { listProductMediaAuthority } from "@/modules/glw/product-media-authority";

type Context = { params: Promise<{ campaignId: string }> };

function resolveCampaign(campaignId: string, organizationId: string, siteId: string | null) {
  return listGlwCampaigns().find((campaign) =>
    campaign.campaignId === campaignId
    && campaign.organizationId === organizationId
    && (!siteId || campaign.siteId === siteId),
  ) ?? null;
}

function buildPayload(input: { campaignId: string; organizationId: string; siteId: string | null; stateCode: string | null }) {
  const campaign = resolveCampaign(input.campaignId, input.organizationId, input.siteId);
  if (!campaign) {
    return null;
  }

  const productMediaRecords = listProductMediaAuthority({
    organizationId: campaign.organizationId,
    siteId: campaign.siteId,
    productId: campaign.productId,
  });
  const policy = resolveGlwCampaignMediaPolicy(campaign);
  const effectiveRecords = resolveEffectiveCampaignMediaRecords({ campaign, productMediaRecords });
  const readiness = evaluateCampaignProductMediaReadiness({
    campaign,
    productMediaRecords,
    stateCode: input.stateCode,
  });
  const hero = resolveCampaignPresentationHero({ campaign, effectiveMediaRecords: effectiveRecords });

  return {
    campaign,
    policy,
    effectiveMediaAuthorityIds: effectiveRecords.map((record) => record.mediaAuthorityId),
    readiness,
    campaignHeroMediaAuthorityId: hero.campaignHeroMediaAuthorityId,
    effectiveHeroMediaAuthorityId: hero.hero?.mediaAuthorityId ?? null,
    productDefaultHeroMediaAuthorityId: productMediaRecords.find((record) => record.ownerApproval === "APPROVED" && record.heroSelected && record.heroEligible)?.mediaAuthorityId ?? null,
  };
}

export async function GET(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "products:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { campaignId } = await context.params;
  const stateCode = request.nextUrl.searchParams.get("stateCode");
  const payload = buildPayload({
    campaignId,
    organizationId: scope.organizationId!,
    siteId: scope.siteId,
    stateCode,
  });

  if (!payload) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

  return NextResponse.json({
    campaignId: payload.campaign.campaignId,
    productId: payload.campaign.productId,
    policy: payload.policy,
    effectiveMediaAuthorityIds: payload.effectiveMediaAuthorityIds,
    readiness: payload.readiness,
    campaignHeroMediaAuthorityId: payload.campaignHeroMediaAuthorityId,
    effectiveHeroMediaAuthorityId: payload.effectiveHeroMediaAuthorityId,
    productDefaultHeroMediaAuthorityId: payload.productDefaultHeroMediaAuthorityId,
  });
}

export async function PATCH(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "products:update");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { campaignId } = await context.params;
  const campaign = resolveCampaign(campaignId, scope.organizationId!, scope.siteId);
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

  const body = await request.json().catch(() => null) as {
    mode?: "INHERIT_PRODUCT_MEDIA" | "EXPLICIT_ALLOWLIST";
    allowlistMediaAuthorityIds?: string[];
    campaignHeroMediaAuthorityId?: string | null;
  } | null;

  const mode = body?.mode;
  if (mode !== "INHERIT_PRODUCT_MEDIA" && mode !== "EXPLICIT_ALLOWLIST") {
    return NextResponse.json({ error: "Invalid campaign media policy mode." }, { status: 400 });
  }

  const allowlistMediaAuthorityIds = Array.isArray(body?.allowlistMediaAuthorityIds)
    ? body!.allowlistMediaAuthorityIds
    : [];
  const campaignHeroMediaAuthorityId = typeof body?.campaignHeroMediaAuthorityId === "string"
    ? body.campaignHeroMediaAuthorityId.trim() || null
    : body?.campaignHeroMediaAuthorityId === null
      ? null
      : (campaign.campaignMediaPolicy?.campaignHeroMediaAuthorityId?.trim() || null);

  if (campaignHeroMediaAuthorityId) {
    const productMediaRecords = listProductMediaAuthority({
      organizationId: campaign.organizationId,
      siteId: campaign.siteId,
      productId: campaign.productId,
    });
    const nextCampaign = {
      ...campaign,
      campaignMediaPolicy: {
        mode,
        allowlistMediaAuthorityIds,
        campaignHeroMediaAuthorityId,
      },
    };
    const effectiveRecords = resolveEffectiveCampaignMediaRecords({
      campaign: nextCampaign,
      productMediaRecords,
    });
    const heroRecord = effectiveRecords.find((record) => record.mediaAuthorityId === campaignHeroMediaAuthorityId);
    if (!heroRecord || heroRecord.ownerApproval !== "APPROVED" || !heroRecord.heroEligible) {
      return NextResponse.json({ error: "Campaign hero must be approved, hero-eligible, and campaign-effective." }, { status: 409 });
    }
  }

  const result = updateGlwCampaignMediaPolicy({
    campaignId,
    mode,
    allowlistMediaAuthorityIds,
    campaignHeroMediaAuthorityId,
  });
  if (!result.campaign) {
    return NextResponse.json({ errors: result.errors }, { status: 400 });
  }

  const stateCode = request.nextUrl.searchParams.get("stateCode");
  const payload = buildPayload({
    campaignId,
    organizationId: scope.organizationId!,
    siteId: scope.siteId,
    stateCode,
  });

  if (!payload) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }

  return NextResponse.json({
    campaign: payload.campaign,
    policy: payload.policy,
    effectiveMediaAuthorityIds: payload.effectiveMediaAuthorityIds,
    readiness: payload.readiness,
    campaignHeroMediaAuthorityId: payload.campaignHeroMediaAuthorityId,
    effectiveHeroMediaAuthorityId: payload.effectiveHeroMediaAuthorityId,
    productDefaultHeroMediaAuthorityId: payload.productDefaultHeroMediaAuthorityId,
  });
}
