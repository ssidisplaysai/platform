import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, hasOrganizationScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { resolvePermissions } from "@/modules/foundation/permissions";
import { getProductById } from "@/modules/foundation/product-repository";
import { evaluateProductReadiness } from "@/modules/foundation/product-readiness";
import { getSiteById } from "@/modules/foundation/site-repository";
import { evaluateSiteReadiness } from "@/modules/foundation/site-readiness";
import { createGlwCampaign, createGlwCampaignId, deleteUnactivatedGlwCampaign, listGlwCampaigns } from "@/modules/glw/campaign-repository";
import { listAllGlwCampaignTargets, prepareGlwCityCampaignTargets } from "@/modules/glw/campaign-target-repository";
import { adaptProductForGeneration, adaptSiteForGeneration, buildLocalGlwGenerationPreview, createDefaultGlwGenerationInput, GLW_CITIES } from "@/modules/glw/page-generation";
import { glwPageExecutionRepository } from "@/modules/glw/page-execution-repository";
import { classifyGlwTargetPreflight, readGlwTargetPreflight } from "@/modules/glw/target-preflight";
import { createGlwWordPressPreflightAuthority } from "@/modules/glw/wordpress-preflight-authority";
import type { NewGlwCampaignInput } from "@/modules/glw/campaign-types";

export async function POST(request: NextRequest) {
  const auth = authorizeRequest(request, "schedules:create");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });
  const body = await request.json().catch(() => null) as (Partial<NewGlwCampaignInput> & { prepareTargets?: boolean }) | null;
  if (!body || !body.siteId || !body.productId || !body.name || !body.pageType || !Array.isArray(body.stateCodes)) return NextResponse.json({ error: "A complete campaign draft is required." }, { status: 400 });
  const site = getSiteById(body.siteId);
  const product = getProductById(body.productId);
  if (!site || !product || site.organizationId !== scope.organizationId || product.organizationId !== scope.organizationId || !product.assignedSiteIds.includes(site.siteId) || (scope.siteId && scope.siteId !== site.siteId)) return NextResponse.json({ error: "Site and product authority are required." }, { status: 403 });
  const permissions = resolvePermissions(auth.roles);
  const siteReadiness = evaluateSiteReadiness({ site, organizationActive: true, requiredPermission: "sites:update", permissions, intent: "configure", requireWorkflowReference: true });
  const productReadiness = evaluateProductReadiness({ product, requiredPermission: "products:evaluate_readiness", permissions });
  if (!siteReadiness.ready || !productReadiness.ready) return NextResponse.json({ error: "Site and product must be ready before campaign preparation.", siteReadiness, productReadiness }, { status: 409 });
  if (body.parentCampaignId) {
    const parent = listGlwCampaigns().find((campaign) => campaign.campaignId === body.parentCampaignId);
    if (!parent || parent.organizationId !== scope.organizationId || parent.siteId !== site.siteId || parent.productId !== product.productId) return NextResponse.json({ error: "Parent campaign authority is required." }, { status: 403 });
  }
  const stateCodes = [...new Set(body.stateCodes.map((code) => code.trim().toUpperCase()))];
  const cityTargets = body.pageType === "city_service"
    ? GLW_CITIES.filter((city) => stateCodes.includes(city.stateCode)).map((city) => ({ stateCode: city.stateCode, citySlug: city.slug, cityName: city.name }))
    : undefined;
  if (body.pageType === "city_service" && (!cityTargets?.length || new Set(cityTargets.map((city) => city.stateCode)).size !== stateCodes.length)) return NextResponse.json({ error: "Every selected state requires canonical city targets." }, { status: 400 });
  const campaignInput: NewGlwCampaignInput = {
    organizationId: scope.organizationId!, siteId: site.siteId, productId: product.productId,
    name: body.name, pageType: body.pageType, stateCodes, cityTargets,
    pagesPerDay: Number(body.pagesPerDay ?? 10), publicationPolicy: body.publicationPolicy === "publish_after_gates" ? "publish_after_gates" : "draft_only",
    imageRequired: body.imageRequired === true, parentCampaignId: body.parentCampaignId ?? null, originReason: body.originReason ?? null,
  };
  const campaignId = createGlwCampaignId(campaignInput);
  const existing = listGlwCampaigns().find((campaign) => campaign.campaignId === campaignId) ?? null;
  if (existing && (
    existing.organizationId !== campaignInput.organizationId
    || existing.siteId !== campaignInput.siteId
    || existing.productId !== campaignInput.productId
    || existing.pageType !== campaignInput.pageType
    || existing.parentCampaignId !== campaignInput.parentCampaignId
    || existing.pagesPerDay !== campaignInput.pagesPerDay
    || existing.publicationPolicy !== campaignInput.publicationPolicy
  )) return NextResponse.json({ error: "Existing campaign identity does not match this draft preparation." }, { status: 409 });

  if (body.prepareTargets !== true) {
    const result = existing ? { campaign: existing, errors: [] } : createGlwCampaign(campaignInput);
    if (!result.campaign) return NextResponse.json({ error: result.errors[0] ?? "Campaign draft could not be created." }, { status: 409 });
    return NextResponse.json({ campaign: result.campaign, activationPerformed: false, targetsCreated: 0, publicationPerformed: false }, { status: existing ? 200 : 201 });
  }
  if (campaignInput.pageType !== "city_service" || !campaignInput.cityTargets?.length) {
    return NextResponse.json({ error: "Prepared campaign drafts require canonical city targets." }, { status: 400 });
  }
  const globalConflicts = listAllGlwCampaignTargets().filter((target) =>
    target.organizationId === campaignInput.organizationId
    && target.siteId === campaignInput.siteId
    && target.productId === campaignInput.productId
    && campaignInput.cityTargets!.some((city) => city.stateCode === target.stateCode && city.citySlug === target.citySlug)
    && target.campaignId !== campaignId);
  if (globalConflicts.length > 0) return NextResponse.json({ error: "One or more canonical targets are already owned.", code: "TARGET_CONFLICT" }, { status: 409 });

  const authority = createGlwWordPressPreflightAuthority({
    organizationId: site.organizationId,
    siteId: site.siteId,
    wordpressApiBaseUrl: site.integrations.wordpressApiBaseUrl,
    wordpressCredentialReference: site.integrations.wordpressCredentialReference,
  });
  if (!authority.authority) return NextResponse.json({ error: "Authenticated WordPress inventory is required for target preparation.", inventoryStatus: authority.status }, { status: 409 });
  const generationSite = adaptSiteForGeneration(site);
  const generationProduct = adaptProductForGeneration(product, site.siteId);
  const executions = await glwPageExecutionRepository.list();
  const preflights = [];
  for (const target of campaignInput.cityTargets) {
    const form = createDefaultGlwGenerationInput(generationSite, generationProduct, "city_service", target.stateCode, target.citySlug);
    const preview = buildLocalGlwGenerationPreview({ form, sites: [generationSite], products: [generationProduct] });
    if (!preview.request) return NextResponse.json({ error: "Canonical target generation identity is invalid." }, { status: 409 });
    const preflight = await readGlwTargetPreflight({ request: preview.request, wordpressReadAuthority: authority.authority, localExecutions: executions });
    preflights.push({ target, preflight, classification: classifyGlwTargetPreflight(preflight) });
  }
  if (preflights.some((entry) => entry.classification !== "NEW" || entry.preflight.hierarchy?.generationAvailable !== true)) {
    return NextResponse.json({ error: "Every prepared target must be authoritatively NEW.", preflights: preflights.map((entry) => ({ target: entry.target, classification: entry.classification })) }, { status: 409 });
  }

  const created = existing ? null : createGlwCampaign(campaignInput).campaign;
  const campaign = existing ?? created;
  if (!campaign) return NextResponse.json({ error: "Campaign draft could not be created." }, { status: 409 });
  try {
    const first = preflights[0].preflight;
    const targets = prepareGlwCityCampaignTargets({
      campaignId: campaign.campaignId,
      organizationId: campaign.organizationId,
      siteId: campaign.siteId,
      productId: campaign.productId,
      parentCampaignId: campaign.parentCampaignId ?? null,
      publicationPolicy: campaign.publicationPolicy,
      productSlug: first.canonicalProductSlug,
      stateSlug: "texas",
      canonicalParentId: first.canonicalParentId,
      cityTargets: campaign.cityTargets ?? [],
    });
    return NextResponse.json({ campaign, targets, campaignCreated: Boolean(created), activationPerformed: false, targetsCreated: targets.length, publicationPerformed: false, dispatchPerformed: false }, { status: created ? 201 : 200 });
  } catch (error) {
    if (created) deleteUnactivatedGlwCampaign(created.campaignId);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Campaign target preparation failed." }, { status: 409 });
  }
}