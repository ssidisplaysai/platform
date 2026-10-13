import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, hasOrganizationScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { getProductById } from "@/modules/foundation/product-repository";
import { getSiteById } from "@/modules/foundation/site-repository";
import { generateGlwCampaignInstructions } from "@/modules/glw/campaign-instruction-generator";
import { getGlwCampaignKnowledgePack } from "@/modules/glw/campaign-reference-repository";
import { listGlwCampaigns } from "@/modules/glw/campaign-repository";

type Context = { params: Promise<{ campaignId: string }> };

export async function POST(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "products:update");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { campaignId } = await context.params;
  const campaign = listGlwCampaigns().find((entry) =>
    entry.campaignId === campaignId &&
    entry.organizationId === scope.organizationId &&
    (!scope.siteId || entry.siteId === scope.siteId)
  ) ?? null;

  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  const knowledgePack = getGlwCampaignKnowledgePack(campaignId);
  if (!knowledgePack || knowledgePack.references.length === 0) {
    return NextResponse.json({ error: "Upload at least one campaign reference before generating instructions." }, { status: 400 });
  }

  const site = getSiteById(campaign.siteId);
  const product = getProductById(campaign.productId);
  if (!site || !product) return NextResponse.json({ error: "Campaign site or product could not be resolved." }, { status: 409 });

  const result = await generateGlwCampaignInstructions({
    campaign,
    knowledgePack,
    siteName: site.displayName,
    productName: product.displayName,
  });

  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 502 });
  return NextResponse.json(result.result);
}
