import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, hasOrganizationScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { listIntegrationProfiles } from "@/modules/foundation/integration-profile-repository";
import { getProductById } from "@/modules/foundation/product-repository";
import { getSiteById } from "@/modules/foundation/site-repository";
import { getGlwCampaignKnowledgePack } from "@/modules/glw/campaign-reference-repository";
import { resolveGlwCampaignGenerationContext } from "@/modules/glw/campaign-generation-context";
import { GLW_CAMPAIGN_US_STATES } from "@/modules/glw/campaign-geography";
import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import { adaptProductForGeneration, adaptSiteForGeneration, createDefaultGlwGenerationInput } from "@/modules/glw/page-generation";

type Context = { params: Promise<{ campaignId: string }> };

export async function POST(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:update");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });
  const { campaignId } = await context.params;
  const campaign = listGlwCampaigns().find((candidate) => candidate.campaignId === campaignId && candidate.organizationId === scope.organizationId) ?? null;
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  if (campaign.status !== "draft") return NextResponse.json({ error: "Reference pages can only be generated while the campaign is draft." }, { status: 409 });
  if (scope.siteId && scope.siteId !== campaign.siteId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null) as { stateCode?: string } | null;
  const stateCode = body?.stateCode?.trim().toUpperCase() ?? "";
  if (!campaign.stateCodes.includes(stateCode)) return NextResponse.json({ error: "Select a state included in this campaign." }, { status: 400 });
  const state = GLW_CAMPAIGN_US_STATES.find((candidate) => candidate.code === stateCode) ?? null;
  if (!state) return NextResponse.json({ error: "Campaign state is not recognized." }, { status: 400 });

  const pack = getGlwCampaignKnowledgePack(campaignId);
  if (!pack?.instructions.trim()) return NextResponse.json({ error: "Approve campaign instructions before generating a reference page." }, { status: 409 });

  const siteRecord = getSiteById(campaign.siteId);
  const productRecord = getProductById(campaign.productId);
  if (!siteRecord || !productRecord) return NextResponse.json({ error: "Campaign site and product must still exist." }, { status: 409 });
  const profileCount = listIntegrationProfiles({ organizationId: siteRecord.organizationId }).filter((profile) => profile.assignedSiteIds.includes(siteRecord.siteId)).length;
  const site = adaptSiteForGeneration(siteRecord, profileCount);
  const product = adaptProductForGeneration(productRecord, site.siteId);

  // Reference generation deliberately uses the existing draft-only page-generation authority.
  // California is the first reference target because it is already part of the certified page
  // geography authority; the 50-state campaign geography remains additive until dispatch wiring.
  const form = createDefaultGlwGenerationInput(site, product, "state_service", stateCode, "");
  const title = `${product.topic} in ${state.name}`;
  form.title = title;
  form.seoTitle = `${title} | ${site.name}`;
  form.metaDescription = `Explore ${product.topic} solutions for commercial projects in ${state.name} from ${site.name}.`;
  form.publicationIntent = "draft";
  form.plannedOperation = "CREATE_STATE";

  const generationContext = resolveGlwCampaignGenerationContext({
    campaignId: campaign.campaignId,
    referencePage: true,
  });

  if (!generationContext) {
    return NextResponse.json(
      { error: "Approved campaign generation guidance could not be resolved." },
      { status: 409 },
    );
  }

  form.additionalInstructions = generationContext.additionalInstructions;
  form.imageDirection = generationContext.imageDirection;

  const generationResponse = await fetch(`${request.nextUrl.origin}/api/glw/page-generation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-gcp-roles": "platform_admin",
      "x-gcp-organization-id": campaign.organizationId,
      "x-gcp-site-id": campaign.siteId,
    },
    body: JSON.stringify({ form }),
    cache: "no-store",
  });
  const payload = await generationResponse.json().catch(() => ({ error: "Reference generation returned malformed JSON." }));
  return NextResponse.json({ state, ...payload }, { status: generationResponse.status });
}
