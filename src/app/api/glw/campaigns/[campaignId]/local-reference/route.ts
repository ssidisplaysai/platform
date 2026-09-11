import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, hasOrganizationScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import {
  approveGlwLocalReferenceForMaterialization,
  getGlwLocalReferenceDraft,
  requestGlwLocalReferenceChanges,
  saveGlwLocalReferenceDraft,
} from "@/modules/glw/campaign-local-reference-repository";
import { getGlwCampaignKnowledgePack, updateGlwCampaignInstructions } from "@/modules/glw/campaign-reference-repository";
import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import {
  buildProjectorEnclosureAustinReference,
  buildProjectorEnclosureTexasKnowledgePack,
  selectDeterministicCityReference,
} from "@/modules/glw/projector-enclosure-texas-reference";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ campaignId: string }> };

async function scoped(request: NextRequest, context: Context) {
  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) return { error: NextResponse.json({ error: "Organization scope is required." }, { status: 403 }) };
  const { campaignId } = await context.params;
  const campaign = listGlwCampaigns().find((candidate) =>
    candidate.campaignId === campaignId
    && candidate.organizationId === scope.organizationId
    && (!scope.siteId || candidate.siteId === scope.siteId));
  if (!campaign) return { error: NextResponse.json({ error: "Campaign not found." }, { status: 404 }) };
  return { campaign };
}

export async function GET(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const result = await scoped(request, context);
  if ("error" in result) return result.error;
  const target = selectDeterministicCityReference(result.campaign);
  return NextResponse.json({
    knowledgePack: getGlwCampaignKnowledgePack(result.campaign.campaignId),
    reference: getGlwLocalReferenceDraft(result.campaign.campaignId, target.stateCode, target.citySlug),
    canonicalApprovalPerformed: false,
    wordpressMutationPerformed: false,
    mutationPerformed: false,
  });
}

export async function POST(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:update");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const result = await scoped(request, context);
  if ("error" in result) return result.error;
  if (result.campaign.status !== "draft") return NextResponse.json({ error: "Local reference preparation requires a draft campaign." }, { status: 409 });
  const body = await request.json().catch(() => null) as { operation?: string; instructions?: string } | null;
  if (!new Set(["PREPARE_REFERENCE", "REGENERATE", "REGENERATE_WITH_INSTRUCTIONS"]).has(body?.operation ?? "")) {
    return NextResponse.json({ error: "Explicit local reference operation is required." }, { status: 400 });
  }
  const parentId = result.campaign.parentCampaignId ?? "";
  const parentPack = getGlwCampaignKnowledgePack(parentId);
  if (!parentPack) return NextResponse.json({ error: "Parent campaign knowledge is required." }, { status: 409 });
  const synthesized = buildProjectorEnclosureTexasKnowledgePack({ campaign: result.campaign, parentPack });
  const pack = updateGlwCampaignInstructions({
    campaignId: result.campaign.campaignId,
    organizationId: result.campaign.organizationId,
    siteId: result.campaign.siteId,
    instructions: synthesized.instructions,
    parentCampaignId: parentId,
    authorityReferences: synthesized.authorityReferences,
    ownerApprovalRequired: false,
  });
  const draft = saveGlwLocalReferenceDraft(buildProjectorEnclosureAustinReference({ campaign: result.campaign, knowledgePack: pack }));
  if (body?.operation === "REGENERATE_WITH_INSTRUCTIONS" && body.instructions?.trim()) {
    requestGlwLocalReferenceChanges({
      campaignId: draft.campaignId,
      stateCode: draft.stateCode,
      citySlug: draft.citySlug,
      instructions: body.instructions,
    });
  }
  return NextResponse.json({
    knowledgePack: pack,
    reference: getGlwLocalReferenceDraft(draft.campaignId, draft.stateCode, draft.citySlug),
    canonicalApprovalPerformed: false,
    wordpressMutationPerformed: false,
    publicationPerformed: false,
  }, { status: 201 });
}

export async function PATCH(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:update");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const result = await scoped(request, context);
  if ("error" in result) return result.error;
  const target = selectDeterministicCityReference(result.campaign);
  const body = await request.json().catch(() => null) as { operation?: string; instructions?: string } | null;
  try {
    const reference = body?.operation === "REQUEST_CHANGES"
      ? requestGlwLocalReferenceChanges({ campaignId: result.campaign.campaignId, stateCode: target.stateCode, citySlug: target.citySlug, instructions: body.instructions ?? "" })
      : body?.operation === "APPROVE_LOCAL_REFERENCE"
        ? approveGlwLocalReferenceForMaterialization({ campaignId: result.campaign.campaignId, stateCode: target.stateCode, citySlug: target.citySlug })
        : null;
    if (!reference) return NextResponse.json({ error: "Explicit review operation is required." }, { status: 400 });
    return NextResponse.json({ reference, canonicalApprovalPerformed: false, wordpressMutationPerformed: false });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Reference review failed." }, { status: 409 });
  }
}
