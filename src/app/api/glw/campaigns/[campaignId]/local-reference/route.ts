import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, hasOrganizationScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import {
  approveGlwLocalReferenceForMaterialization,
  getGlwLocalReferenceDraft,
  requestGlwLocalReferenceChanges,
  saveGlwLocalReferenceDraft,
  updateGlwLocalReferenceImage,
} from "@/modules/glw/campaign-local-reference-repository";
import {
  decideGlwReferenceImageCandidate,
  getLatestGlwReferenceImageCandidate,
  listGlwReferenceImageCandidates,
  saveGlwReferenceImageCandidate,
} from "@/modules/glw/campaign-reference-image-candidate-repository";
import { getGlwCampaignKnowledgePack, updateGlwCampaignInstructions } from "@/modules/glw/campaign-reference-repository";
import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import {
  buildProjectorEnclosureAustinReference,
  buildProjectorEnclosureTexasKnowledgePack,
  selectDeterministicCityReference,
} from "@/modules/glw/projector-enclosure-texas-reference";
import { generateProjectorEnclosureReferenceVisual } from "@/modules/glw/projector-enclosure-reference-image-service";

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

function actor(roles: readonly string[]): string {
  return roles.includes("platform_admin") ? "platform_admin" : "authorized_operator";
}

function imageScope(campaign: { organizationId: string; siteId: string; campaignId: string }, referenceDraftId: string) {
  return { organizationId: campaign.organizationId, siteId: campaign.siteId, campaignId: campaign.campaignId, referenceDraftId };
}

function readiness(reference: ReturnType<typeof getGlwLocalReferenceDraft>, candidate: ReturnType<typeof getLatestGlwReferenceImageCandidate>) {
  const imageApproved = !reference?.image.required || candidate?.status === "APPROVED";
  return {
    contentReady: Boolean(reference && reference.status !== "CHANGES_REQUESTED"),
    imageRequired: reference?.image.required ?? false,
    imageApproved,
    imageReviewRequired: Boolean(reference?.image.required && !imageApproved),
    referenceReadyForApproval: Boolean(reference && reference.status === "READY_FOR_OWNER_REVIEW" && imageApproved),
  };
}

export async function GET(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const result = await scoped(request, context);
  if ("error" in result) return result.error;
  const target = selectDeterministicCityReference(result.campaign);
  const reference = getGlwLocalReferenceDraft(result.campaign.campaignId, target.stateCode, target.citySlug);
  const scope = reference ? imageScope(result.campaign, reference.referenceDraftId) : null;
  const candidate = scope ? getLatestGlwReferenceImageCandidate(scope) : null;
  return NextResponse.json({
    knowledgePack: getGlwCampaignKnowledgePack(result.campaign.campaignId),
    reference,
    imageCandidate: candidate,
    imageHistory: scope ? listGlwReferenceImageCandidates(scope) : [],
    readiness: readiness(reference, candidate),
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
  const target = selectDeterministicCityReference(result.campaign);
  const existingReference = getGlwLocalReferenceDraft(result.campaign.campaignId, target.stateCode, target.citySlug);
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    if (!existingReference) return NextResponse.json({ error: "Prepare the local reference before replacing its image." }, { status: 409 });
    const form = await request.formData();
    if (form.get("operation") !== "REPLACE_WITH_OWNER_ASSET") return NextResponse.json({ error: "Explicit owner-asset replacement is required." }, { status: 400 });
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Owner image file is required." }, { status: 400 });
    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type)) return NextResponse.json({ error: "Owner image must be JPEG, PNG, or WebP." }, { status: 400 });
    try {
      const pack = getGlwCampaignKnowledgePack(result.campaign.campaignId);
      if (!pack?.revision) throw new Error("Campaign knowledge pack is required.");
      const candidate = saveGlwReferenceImageCandidate({
        ...imageScope(result.campaign, existingReference.referenceDraftId),
        requirementPurpose: "PROJECTOR_ENCLOSURE_APPLICATION_VISUAL",
        sourceType: "OWNER_ASSET",
        mimeType: file.type as "image/jpeg" | "image/png" | "image/webp",
        bytes: Buffer.from(await file.arrayBuffer()),
        visualBrief: "Owner-supplied candidate for the Austin fan-cooled projector enclosure reference.",
        imageProfileReference: "profile-image-projectorenclosure-product",
        knowledgePackRevision: pack.revision,
        authorityReferences: (pack.authorityReferences ?? []).map((reference) => `${reference.sourceType}:${reference.sourceId}`),
        altText: "Fan-cooled projector enclosure owner asset for commercial AV reference review",
        ownerInstructions: String(form.get("instructions") ?? ""),
        actor: actor(auth.roles),
      });
      const reference = updateGlwLocalReferenceImage({ campaignId: result.campaign.campaignId, stateCode: target.stateCode, citySlug: target.citySlug, candidateId: candidate.candidateId, candidateRevision: candidate.revision, status: candidate.status, sourceType: candidate.sourceType, assetReference: candidate.candidateId, altText: candidate.altText });
      return NextResponse.json({ reference, imageCandidate: candidate, readiness: readiness(reference, candidate), wordpressMutationPerformed: false, publicationPerformed: false }, { status: 201 });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Owner image replacement failed." }, { status: 409 });
    }
  }
  const body = await request.json().catch(() => null) as { operation?: string; instructions?: string } | null;
  if (body?.operation === "GENERATE_IMAGE" || body?.operation === "REGENERATE_IMAGE" || body?.operation === "REGENERATE_IMAGE_WITH_INSTRUCTIONS") {
    if (!existingReference) return NextResponse.json({ error: "Prepare the local reference before generating its image." }, { status: 409 });
    try {
      const pack = getGlwCampaignKnowledgePack(result.campaign.campaignId);
      if (!pack?.revision) throw new Error("Campaign knowledge pack is required.");
      const generated = await generateProjectorEnclosureReferenceVisual({ reference: existingReference, ownerInstructions: body.instructions });
      const candidate = saveGlwReferenceImageCandidate({
        ...imageScope(result.campaign, existingReference.referenceDraftId),
        requirementPurpose: "PROJECTOR_ENCLOSURE_APPLICATION_VISUAL",
        sourceType: "GENERATED_VISUAL",
        mimeType: generated.mimeType,
        bytes: generated.bytes,
        generationPrompt: generated.generationPrompt,
        visualBrief: generated.visualBrief,
        sourceAssetReference: generated.sourceAssetReference,
        imageProfileReference: "profile-image-projectorenclosure-product",
        knowledgePackRevision: pack.revision,
        authorityReferences: (pack.authorityReferences ?? []).map((reference) => `${reference.sourceType}:${reference.sourceId}`),
        altText: generated.altText,
        ownerInstructions: body.instructions,
        actor: actor(auth.roles),
      });
      const reference = updateGlwLocalReferenceImage({ campaignId: result.campaign.campaignId, stateCode: target.stateCode, citySlug: target.citySlug, candidateId: candidate.candidateId, candidateRevision: candidate.revision, status: candidate.status, sourceType: candidate.sourceType, assetReference: candidate.candidateId, altText: candidate.altText });
      return NextResponse.json({ reference, imageCandidate: candidate, readiness: readiness(reference, candidate), wordpressMutationPerformed: false, publicationPerformed: false }, { status: 201 });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Reference image generation failed." }, { status: 409 });
    }
  }
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
  const body = await request.json().catch(() => null) as { operation?: string; instructions?: string; candidateId?: string } | null;
  try {
    if (body?.operation === "APPROVE_IMAGE" || body?.operation === "REJECT_IMAGE") {
      const existingReference = getGlwLocalReferenceDraft(result.campaign.campaignId, target.stateCode, target.citySlug);
      if (!existingReference || !body.candidateId) throw new Error("Exact image candidate is required.");
      const candidate = decideGlwReferenceImageCandidate({ organizationId: result.campaign.organizationId, siteId: result.campaign.siteId, campaignId: result.campaign.campaignId, candidateId: body.candidateId, decision: body.operation === "APPROVE_IMAGE" ? "APPROVE" : "REJECT", actor: actor(auth.roles) });
      const reference = updateGlwLocalReferenceImage({ campaignId: result.campaign.campaignId, stateCode: target.stateCode, citySlug: target.citySlug, candidateId: candidate.candidateId, candidateRevision: candidate.revision, status: candidate.status, sourceType: candidate.sourceType, assetReference: candidate.candidateId, altText: candidate.altText });
      return NextResponse.json({ reference, imageCandidate: candidate, readiness: readiness(reference, candidate), canonicalApprovalPerformed: false, wordpressMutationPerformed: false });
    }
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
