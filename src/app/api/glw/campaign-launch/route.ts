import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, hasOrganizationScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { resolvePermissions } from "@/modules/foundation/permissions";
import { evaluateProductReadiness } from "@/modules/foundation/product-readiness";
import { getProductById } from "@/modules/foundation/product-repository";
import { evaluateSiteReadiness } from "@/modules/foundation/site-readiness";
import { getSiteById } from "@/modules/foundation/site-repository";
import { createGlwCampaign, createGlwCampaignId, listGlwCampaigns } from "@/modules/glw/campaign-repository";
import { getGlwCity } from "@/modules/glw/page-generation";
import { listAllGlwCampaignTargets } from "@/modules/glw/campaign-target-repository";
import { launchGlwCityCampaign, listGlwCampaignLaunches, listGlwGlobalTargetOwnership, previewGlwGlobalOwnershipReconciliation } from "@/modules/glw/campaign-launch-authority";
import type { GlwCampaignPublicationPolicy } from "@/modules/glw/campaign-types";

export async function GET(request: NextRequest) {
  const auth = authorizeRequest(request, "schedules:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });
  const campaigns = listGlwCampaigns().filter((campaign) => campaign.organizationId === scope.organizationId && (!scope.siteId || campaign.siteId === scope.siteId));
  const campaignIds = new Set(campaigns.map((campaign) => campaign.campaignId));
  const targets = listAllGlwCampaignTargets().filter((target) => campaignIds.has(target.campaignId));
  const reconciliation = previewGlwGlobalOwnershipReconciliation({ campaigns, targets });
  return NextResponse.json({
    cityTargetCount: reconciliation.ownership.length,
    historicalConflicts: reconciliation.conflicts,
    launches: listGlwCampaignLaunches().filter((launch) => launch.organizationId === scope.organizationId && (!scope.siteId || launch.siteId === scope.siteId)),
    persistedOwnershipCount: listGlwGlobalTargetOwnership().filter((entry) => entry.identity.organizationId === scope.organizationId && (!scope.siteId || entry.identity.siteId === scope.siteId)).length,
    mutationPerformed: false,
  });
}

export async function POST(request: NextRequest) {
  const auth = authorizeRequest(request, "schedules:create");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });
  const body = await request.json().catch(() => null) as {
    operation?: string;
    siteId?: string;
    productId?: string;
    name?: string;
    pagesPerDay?: number;
    publicationPolicyAcknowledgement?: GlwCampaignPublicationPolicy;
    targets?: Array<{ stateCode?: string; citySlug?: string; cityName?: string }>;
  } | null;
  if (body?.operation !== "LAUNCH_CITY_CAMPAIGN") return NextResponse.json({ error: "Explicit LAUNCH_CITY_CAMPAIGN operation is required." }, { status: 400 });
  const site = getSiteById(body.siteId ?? "");
  const product = getProductById(body.productId ?? "");
  if (!site || !product || site.organizationId !== scope.organizationId || product.organizationId !== scope.organizationId || product.primarySiteId !== site.siteId || (scope.siteId && scope.siteId !== site.siteId)) return NextResponse.json({ error: "Configured site and product authority is required." }, { status: 409 });
  const permissions = resolvePermissions(auth.roles);
  const siteReadiness = evaluateSiteReadiness({ site, organizationActive: true, requiredPermission: "sites:update", permissions, intent: "configure", requireWorkflowReference: true });
  const productReadiness = evaluateProductReadiness({ product, requiredPermission: "products:evaluate_readiness", permissions });
  if (!siteReadiness.ready || !productReadiness.ready) return NextResponse.json({ error: "Site and product must be ready before campaign launch.", siteReadiness, productReadiness }, { status: 409 });
  const authorityCampaigns = listGlwCampaigns().filter((campaign) => campaign.organizationId === site.organizationId && campaign.siteId === site.siteId && campaign.productId === product.productId);
  const policies = [...new Set(authorityCampaigns.map((campaign) => campaign.publicationPolicy))];
  const imagePolicies = [...new Set(authorityCampaigns.map((campaign) => campaign.imageRequired))];
  if (policies.length !== 1 || imagePolicies.length !== 1) return NextResponse.json({ error: "Existing campaign policy authority is missing or conflicted.", code: "AUTHORITY_CHANGED" }, { status: 409 });
  const targets = (body.targets ?? []).map((target) => {
    const stateCode = target.stateCode?.trim().toUpperCase() ?? "";
    const citySlug = target.citySlug?.trim().toLowerCase() ?? "";
    const city = getGlwCity(stateCode, citySlug);
    if (!city || city.name !== target.cityName?.trim()) throw new Error(`Unrecognized exact city target ${stateCode}::${citySlug}.`);
    return { stateCode, citySlug, cityName: city.name };
  });
  const pagesPerDay = Number(body.pagesPerDay ?? 0);
  if (!body.name?.trim() || !Number.isInteger(pagesPerDay) || pagesPerDay < 1 || pagesPerDay > 100 || targets.length < 1) return NextResponse.json({ error: "Campaign name, bounded pagesPerDay, and exact targets are required." }, { status: 400 });
  try {
    const result = launchGlwCityCampaign({
      campaignInput: { organizationId: site.organizationId, siteId: site.siteId, productId: product.productId, name: body.name.trim(), pageType: "city_service", stateCodes: [...new Set(targets.map((target) => target.stateCode))], cityTargets: targets, pagesPerDay, publicationPolicy: policies[0], imageRequired: imagePolicies[0] },
      authoritativePublicationPolicy: policies[0],
      publicationPolicyAcknowledgement: body.publicationPolicyAcknowledgement,
    }, { listCampaigns: listGlwCampaigns, listTargets: listAllGlwCampaignTargets, createCampaign: createGlwCampaign, createCampaignId: createGlwCampaignId });
    const status = result.state === "TARGET_CONFLICT" || result.state === "HISTORICAL_OWNERSHIP_CONFLICT" ? 409 : result.state === "COMPENSATED" ? 500 : result.state === "REFERENCE_GENERATION_REQUIRED" ? 201 : 200;
    return NextResponse.json({ ...result, referenceBootstrap: result.launch ? { target: result.launch.referenceTarget, state: result.launch.state, approvalRequired: true } : null, publicationPerformed: false, dispatchPerformed: false }, { status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Campaign launch failed closed." }, { status: 409 });
  }
}