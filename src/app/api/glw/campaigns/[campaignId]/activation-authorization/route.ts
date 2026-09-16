import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, hasOrganizationScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { createGlwCampaignActivationGrant, createGlwCampaignTargetFingerprint, listGlwCampaignActivationGrants } from "@/modules/glw/campaign-activation-authorization";
import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import { listGlwCampaignTargets, previewGlwCampaignTargets } from "@/modules/glw/campaign-target-repository";
import { getGlwCampaignKnowledgePack } from "@/modules/glw/campaign-reference-repository";
import { getGovernedLocalCampaignReferenceApproval, listGlwCampaignReferenceApprovals } from "@/modules/glw/campaign-reference-approval-repository";
import { listGlwCertifiedStateCampaignTargets, resolveGlwCertifiedStateActivationReference } from "@/modules/glw/campaign-certified-state-targets";
import { selectDeterministicCityReference } from "@/modules/glw/projector-enclosure-texas-reference";
import { getGlwReferenceStateSelection } from "@/modules/glw/reference-state-selection-repository";
import { resolveGlwTrustedOperatorPrincipal } from "@/modules/glw/trusted-operator-principal";

type Context = { params: Promise<{ campaignId: string }> };
const EXACT_RELEASE_PATTERN = /^[0-9a-f]{40}$/;

function publicGrant(grant: ReturnType<typeof createGlwCampaignActivationGrant> | null) {
  return grant ? {
    grantId: grant.grantId,
    purpose: grant.purpose,
    expiresAt: grant.expiresAt,
    createdAt: grant.createdAt,
    createdBy: grant.createdBy,
    claimed: Boolean(grant.claimedAt),
    consumed: Boolean(grant.consumedAt),
    certifiedReleaseSha: grant.certifiedReleaseSha,
    targetFingerprint: grant.targetFingerprint,
    referenceApprovalReceiptSha256: grant.referenceApprovalReceiptSha256,
    referenceRevision: grant.referenceRevision,
    imageCandidateId: grant.imageCandidateId,
    imageRevision: grant.imageRevision,
    status: grant.consumedAt ? "CONSUMED" : grant.claimedAt ? "CLAIMED" : new Date(grant.expiresAt) <= new Date() ? "EXPIRED" : "AUTHORIZED",
  } : null;
}

function runningReleaseIdentity() {
  const gitCommit = process.env.GIT_COMMIT?.trim().toLowerCase() ?? "";
  const ready = EXACT_RELEASE_PATTERN.test(gitCommit);
  return { gitCommit: ready ? gitCommit : null, ready, reason: ready ? null : "Exact running release identity is required." };
}

function readiness(campaign: ReturnType<typeof listGlwCampaigns>[number]) {
  const pack = getGlwCampaignKnowledgePack(campaign.campaignId);
  const approvedReferenceCount = campaign.pageType === "state_service"
    ? listGlwCertifiedStateCampaignTargets(campaign).length
    : listGlwCampaignReferenceApprovals(campaign.campaignId).length;
  return { knowledgePackReady: Boolean(pack?.instructions.trim()), approvedReferenceCount };
}

async function scoped(request: NextRequest, context: Context) {
  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) return { error: NextResponse.json({ error: "Organization scope is required." }, { status: 403 }) };
  const { campaignId } = await context.params;
  const campaign = listGlwCampaigns().find((candidate) =>
    candidate.campaignId === campaignId
    && candidate.organizationId === scope.organizationId
    && (!scope.siteId || candidate.siteId === scope.siteId));
  if (!campaign) return { error: NextResponse.json({ error: "Campaign not found." }, { status: 404 }) };
  return { campaign, targets: listGlwCampaignTargets(campaign.campaignId), scope };
}

export async function GET(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "schedules:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const result = await scoped(request, context);
  if ("error" in result) return result.error;
  const grants = listGlwCampaignActivationGrants(result.campaign.campaignId);
  const releaseIdentity = runningReleaseIdentity();
  return NextResponse.json({
    readiness: readiness(result.campaign),
    grant: publicGrant(grants.at(-1) ?? null),
    releaseIdentity,
    mutationPerformed: false,
  });
}

export async function POST(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "schedules:create");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const principal = resolveGlwTrustedOperatorPrincipal(request);
  if (!principal.ok) return NextResponse.json({ error: principal.message, code: principal.code }, { status: 401 });
  if (!auth.roles.includes("platform_admin")) return NextResponse.json({ error: "Owner authorization requires platform_admin." }, { status: 403 });
  const result = await scoped(request, context);
  if ("error" in result) return result.error;
  const body = await request.json().catch(() => null) as { operation?: string; expiresInMinutes?: number } | null;
  if (body?.operation !== "AUTHORIZE_ACTIVATION") return NextResponse.json({ error: "Explicit AUTHORIZE_ACTIVATION operation is required." }, { status: 400 });
  const prerequisites = readiness(result.campaign);
  if (!prerequisites.knowledgePackReady || prerequisites.approvedReferenceCount < 1) {
    return NextResponse.json({ error: "Approved campaign reference and knowledge pack are required before authorization.", readiness: prerequisites }, { status: 409 });
  }
  if (result.campaign.status !== "draft" || (result.campaign.pageType === "city_service" && (result.targets.length < 1 || result.targets.some((target) => target.status !== "prepared")))) {
    return NextResponse.json({ error: "Campaign must be a draft with an exact activatable target set." }, { status: 409 });
  }
  const cityReference = result.campaign.pageType === "city_service" ? selectDeterministicCityReference(result.campaign) : null;
  const stateSelection = result.campaign.pageType === "state_service" ? getGlwReferenceStateSelection(result.campaign.campaignId) : null;
  const certifiedTargets = result.campaign.pageType === "state_service" ? listGlwCertifiedStateCampaignTargets(result.campaign) : [];
  const certifiedReference = stateSelection ? resolveGlwCertifiedStateActivationReference(result.campaign, stateSelection.stateCode) : null;
  const governedReference = cityReference ? getGovernedLocalCampaignReferenceApproval(result.campaign.campaignId, cityReference.stateCode, cityReference.citySlug) : null;
  const referenceApproval = governedReference ?? (certifiedReference ? {
    receiptSha256: certifiedReference.evidenceFingerprint,
    referenceRevision: 1,
    imageCandidateId: certifiedReference.certificationId,
    imageCandidateRevision: 1,
  } : null);
  if (!referenceApproval) return NextResponse.json({ error: "Exact governed reference approval receipt is required before authorization." }, { status: 409 });
  const releaseIdentity = runningReleaseIdentity();
  if (!releaseIdentity.ready || !releaseIdentity.gitCommit) {
    return NextResponse.json({ error: releaseIdentity.reason, code: "RUNNING_RELEASE_IDENTITY_REQUIRED", releaseIdentity }, { status: 503 });
  }
  const release = releaseIdentity.gitCommit;
  const targets = result.targets.length > 0 ? result.targets : previewGlwCampaignTargets({
    campaignId: result.campaign.campaignId,
    organizationId: result.campaign.organizationId,
    siteId: result.campaign.siteId,
    productId: result.campaign.productId,
    stateCodes: result.campaign.stateCodes,
    referenceStateCode: stateSelection?.stateCode ?? "",
    referenceWordpressObjectId: certifiedReference?.wordpressObjectId ?? null,
    certifiedTargets,
  });
  const targetFingerprint = createGlwCampaignTargetFingerprint(result.campaign, targets);
  const existing = [...listGlwCampaignActivationGrants(result.campaign.campaignId)].reverse().find((grant) =>
    !grant.claimedAt
    && !grant.consumedAt
    && new Date(grant.expiresAt) > new Date()
    && grant.targetFingerprint === targetFingerprint
    && grant.publicationPolicy === result.campaign.publicationPolicy
    && grant.certifiedReleaseSha === release
    && grant.referenceApprovalReceiptSha256 === referenceApproval.receiptSha256
    && grant.referenceRevision === referenceApproval.referenceRevision
    && grant.imageCandidateId === referenceApproval.imageCandidateId
    && grant.imageRevision === referenceApproval.imageCandidateRevision);
  if (existing) {
    return NextResponse.json({ grant: publicGrant(existing), readiness: prerequisites, duplicateCreated: false, activationPerformed: false, publicationPerformed: false });
  }
  const minutes = Math.min(Math.max(Number(body.expiresInMinutes ?? 15), 1), 60);
  try {
    const grant = createGlwCampaignActivationGrant({
      campaign: result.campaign,
      targets,
      certifiedReleaseSha: release,
      referenceApproval,
      expiresAt: new Date(Date.now() + minutes * 60_000).toISOString(),
      principal: principal.principal,
    });
    return NextResponse.json({ grant: publicGrant(grant), readiness: prerequisites, duplicateCreated: false, activationPerformed: false, publicationPerformed: false }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Activation authorization failed." }, { status: 409 });
  }
}