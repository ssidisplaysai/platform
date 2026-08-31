import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, hasOrganizationScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import {
  addGlwCampaignReference,
  getGlwCampaignKnowledgePack,
  updateGlwCampaignInstructions,
} from "@/modules/glw/campaign-reference-repository";
import type { GlwCampaignReferenceRole, GlwCampaignReferenceScope } from "@/modules/glw/campaign-reference-types";

type Context = { params: Promise<{ campaignId: string }> };

function resolveCampaign(campaignId: string, organizationId: string, siteId: string | null) {
  return listGlwCampaigns().find((campaign) =>
    campaign.campaignId === campaignId &&
    campaign.organizationId === organizationId &&
    (!siteId || campaign.siteId === siteId)
  ) ?? null;
}

export async function GET(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "products:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { campaignId } = await context.params;
  const campaign = resolveCampaign(campaignId, scope.organizationId!, scope.siteId);
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  return NextResponse.json({ knowledgePack: getGlwCampaignKnowledgePack(campaignId) });
}

export async function PATCH(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "products:update");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { campaignId } = await context.params;
  const campaign = resolveCampaign(campaignId, scope.organizationId!, scope.siteId);
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  const body = await request.json() as { instructions?: string };
  const knowledgePack = updateGlwCampaignInstructions({
    campaignId,
    organizationId: campaign.organizationId,
    siteId: campaign.siteId,
    instructions: body.instructions ?? "",
  });
  return NextResponse.json({ knowledgePack });
}

export async function POST(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "products:update");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { campaignId } = await context.params;
  const campaign = resolveCampaign(campaignId, scope.organizationId!, scope.siteId);
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Reference file is required." }, { status: 400 });
  const scopeValue = String(form.get("scope") ?? "campaign") as GlwCampaignReferenceScope;
  const role = String(form.get("role") ?? "content_reference") as GlwCampaignReferenceRole;
  const validScopes = new Set(["campaign", "reference_only"]);
  const validRoles = new Set(["authoritative_fact", "content_reference", "product_image", "image_style"]);
  if (!validScopes.has(scopeValue) || !validRoles.has(role)) {
    return NextResponse.json({ error: "Invalid reference classification." }, { status: 400 });
  }

  const added = addGlwCampaignReference({
    campaignId,
    organizationId: campaign.organizationId,
    siteId: campaign.siteId,
    fileName: file.name,
    mediaType: file.type,
    bytes: new Uint8Array(await file.arrayBuffer()),
    scope: scopeValue,
    role,
  });
  if (!added.reference) return NextResponse.json({ error: added.error }, { status: 400 });
  return NextResponse.json({ reference: added.reference }, { status: 201 });
}
