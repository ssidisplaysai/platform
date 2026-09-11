import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, hasOrganizationScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { createGlwCampaignActivationGrant, listGlwCampaignActivationGrants } from "@/modules/glw/campaign-activation-authorization";
import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import { listGlwCampaignTargets } from "@/modules/glw/campaign-target-repository";
import { getGlwCampaignKnowledgePack } from "@/modules/glw/campaign-reference-repository";
import { listGlwCampaignReferenceApprovals } from "@/modules/glw/campaign-reference-approval-repository";

type Context = { params: Promise<{ campaignId: string }> };
const EXACT_RELEASE_PATTERN = /^[0-9a-f]{40}$/;

function actor(roles: readonly string[]): string { return roles.includes("platform_admin") ? "platform_admin" : "unauthorized"; }

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
  } : null;
}

function readiness(campaignId: string) {
  const pack = getGlwCampaignKnowledgePack(campaignId);
  const approvals = listGlwCampaignReferenceApprovals(campaignId);
  return { knowledgePackReady: Boolean(pack?.instructions.trim()), approvedReferenceCount: approvals.length };
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
  return NextResponse.json({
    readiness: readiness(result.campaign.campaignId),
    grant: publicGrant(grants.at(-1) ?? null),
    mutationPerformed: false,
  });
}

export async function POST(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "schedules:create");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!auth.roles.includes("platform_admin")) return NextResponse.json({ error: "Owner authorization requires platform_admin." }, { status: 403 });
  const result = await scoped(request, context);
  if ("error" in result) return result.error;
  const body = await request.json().catch(() => null) as { operation?: string; expiresInMinutes?: number } | null;
  if (body?.operation !== "AUTHORIZE_ACTIVATION") return NextResponse.json({ error: "Explicit AUTHORIZE_ACTIVATION operation is required." }, { status: 400 });
  const prerequisites = readiness(result.campaign.campaignId);
  if (!prerequisites.knowledgePackReady || prerequisites.approvedReferenceCount < 1) {
    return NextResponse.json({ error: "Approved campaign reference and knowledge pack are required before authorization.", readiness: prerequisites }, { status: 409 });
  }
  if (result.campaign.status !== "draft" || result.targets.length < 1 || result.targets.some((target) => target.status !== "prepared")) {
    return NextResponse.json({ error: "Campaign must be a draft with exact prepared targets." }, { status: 409 });
  }
  const release = process.env.GIT_COMMIT?.trim().toLowerCase() ?? "";
  if (!EXACT_RELEASE_PATTERN.test(release)) return NextResponse.json({ error: "Exact running release identity is required." }, { status: 503 });
  const minutes = Math.min(Math.max(Number(body.expiresInMinutes ?? 15), 1), 60);
  try {
    const grant = createGlwCampaignActivationGrant({
      campaign: result.campaign,
      targets: result.targets,
      certifiedReleaseSha: release,
      expiresAt: new Date(Date.now() + minutes * 60_000).toISOString(),
      createdBy: actor(auth.roles),
    });
    return NextResponse.json({ grant: publicGrant(grant), readiness: prerequisites, activationPerformed: false, publicationPerformed: false }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Activation authorization failed." }, { status: 409 });
  }
}