import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, hasOrganizationScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { getProductById } from "@/modules/foundation/product-repository";
import { getSiteById } from "@/modules/foundation/site-repository";
import { createGlwCampaign, listGlwCampaigns } from "@/modules/glw/campaign-repository";
import { GLW_CITIES } from "@/modules/glw/page-generation";
import type { NewGlwCampaignInput } from "@/modules/glw/campaign-types";

export async function POST(request: NextRequest) {
  const auth = authorizeRequest(request, "schedules:create");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });
  const body = await request.json().catch(() => null) as Partial<NewGlwCampaignInput> | null;
  if (!body || !body.siteId || !body.productId || !body.name || !body.pageType || !Array.isArray(body.stateCodes)) return NextResponse.json({ error: "A complete campaign draft is required." }, { status: 400 });
  const site = getSiteById(body.siteId);
  const product = getProductById(body.productId);
  if (!site || !product || site.organizationId !== scope.organizationId || product.organizationId !== scope.organizationId || !product.assignedSiteIds.includes(site.siteId) || (scope.siteId && scope.siteId !== site.siteId)) return NextResponse.json({ error: "Site and product authority are required." }, { status: 403 });
  if (body.parentCampaignId) {
    const parent = listGlwCampaigns().find((campaign) => campaign.campaignId === body.parentCampaignId);
    if (!parent || parent.organizationId !== scope.organizationId || parent.siteId !== site.siteId || parent.productId !== product.productId) return NextResponse.json({ error: "Parent campaign authority is required." }, { status: 403 });
  }
  const stateCodes = [...new Set(body.stateCodes.map((code) => code.trim().toUpperCase()))];
  const cityTargets = body.pageType === "city_service"
    ? GLW_CITIES.filter((city) => stateCodes.includes(city.stateCode)).map((city) => ({ stateCode: city.stateCode, citySlug: city.slug, cityName: city.name }))
    : undefined;
  if (body.pageType === "city_service" && (!cityTargets?.length || new Set(cityTargets.map((city) => city.stateCode)).size !== stateCodes.length)) return NextResponse.json({ error: "Every selected state requires canonical city targets." }, { status: 400 });
  const result = createGlwCampaign({
    organizationId: scope.organizationId!, siteId: site.siteId, productId: product.productId,
    name: body.name, pageType: body.pageType, stateCodes, cityTargets,
    pagesPerDay: Number(body.pagesPerDay ?? 10), publicationPolicy: body.publicationPolicy === "publish_after_gates" ? "publish_after_gates" : "draft_only",
    imageRequired: body.imageRequired === true, parentCampaignId: body.parentCampaignId ?? null, originReason: body.originReason ?? null,
  });
  if (!result.campaign) return NextResponse.json({ error: result.errors[0] ?? "Campaign draft could not be created." }, { status: 409 });
  return NextResponse.json({ campaign: result.campaign, activationPerformed: false, targetsCreated: 0, publicationPerformed: false }, { status: 201 });
}