import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, hasOrganizationScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { runGovernedRenderCapture, signGovernedSnapshotPath, type CaptureAuthority } from "@/modules/foundation/governed-render-capture-orchestrator";
import { listRenderedVisualCertifications } from "@/modules/foundation/rendered-visual-certification-repository";
import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import { candidateMediaDataUrls, candidateVisualSummary, buildIndianaRichReferenceCandidate, getIndianaRichReferenceCandidate, INDIANA_RICH_REFERENCE_CANDIDATE_ARTIFACT_PATH } from "@/modules/glw/indiana-rich-reference-candidate";
import { assertIndianaRichReferenceAuthorizedInputs } from "@/modules/glw/indiana-rich-reference-composition-plan";
import { glwPageExecutionRepository } from "@/modules/glw/page-execution-repository";
import { listProductMediaAuthority, OUTDOOR_DIGITAL_SPHERE_PRODUCT_ID } from "@/modules/glw/product-media-authority";
import { GLW_REFERENCE_CLAIM_AUTHORITY_FINGERPRINT } from "@/modules/glw/reference-generation-claim-contract";
import { resolveGlwTrustedOperatorPrincipal } from "@/modules/glw/trusted-operator-principal";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ campaignId: string }> };
const PAGE_ID = "outdoor-digital-sphere-indiana-candidate";

async function context(request: NextRequest, route: Context) {
  const principal = resolveGlwTrustedOperatorPrincipal(request);
  const auth = authorizeRequest(request, "sites:update");
  const scope = resolveRequestScope(request);
  if (!principal.ok || !auth.ok || !hasOrganizationScope(scope) || !scope.siteId) throw new Error("INDIANA_RICH_CANDIDATE_UNAUTHORIZED");
  const { campaignId } = await route.params;
  const campaign = listGlwCampaigns().find((item) => item.campaignId === campaignId && item.organizationId === scope.organizationId && item.siteId === scope.siteId && item.productId === OUTDOOR_DIGITAL_SPHERE_PRODUCT_ID);
  if (!campaign) throw new Error("INDIANA_RICH_CANDIDATE_CAMPAIGN_NOT_FOUND");
  return { principal: principal.principal, campaign };
}

export async function GET(request: NextRequest, route: Context) {
  try {
    await context(request, route);
    const candidate = getIndianaRichReferenceCandidate(request.nextUrl.searchParams.get("candidateId"));
    if (!candidate) return NextResponse.json({ error: "INDIANA_RICH_CANDIDATE_NOT_FOUND" }, { status: 404 });
    const certification = listRenderedVisualCertifications({ organizationId: "led-display-warehouse", siteId: "site-led-display-warehouse-production", pageId: PAGE_ID }).filter((item) => item.identity.pageRevisionIdentity === candidate.candidateId && item.identity.contentHash === candidate.candidateSha).at(-1) ?? null;
    return NextResponse.json({ candidate, candidateArtifactPath: INDIANA_RICH_REFERENCE_CANDIDATE_ARTIFACT_PATH, certification, visualSummary: certification ? candidateVisualSummary(certification) : null, wordpressMutation: false, generationAttempted: false, n8nExecutionCreated: false });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "INDIANA_RICH_CANDIDATE_FAILED" }, { status: 401 });
  }
}

export async function POST(request: NextRequest, route: Context) {
  try {
    const resolved = await context(request, route);
    const body = await request.json().catch(() => null) as { action?: "BUILD" | "CERTIFY"; expectedPlanFingerprint?: string; semanticJobId?: string; semanticInputFingerprint?: string; candidateId?: string } | null;
    if (!body?.action) throw new Error("INDIANA_RICH_CANDIDATE_ACTION_REQUIRED");
    if (body.action === "BUILD") {
      if (!body.expectedPlanFingerprint || !body.semanticJobId || !body.semanticInputFingerprint) throw new Error("INDIANA_RICH_CANDIDATE_BUILD_INPUT_REQUIRED");
      const job = await glwPageExecutionRepository.getById(body.semanticJobId);
      if (!job?.generatedDraft || job.productId !== resolved.campaign.productId || job.state !== "Indiana" || createHash("sha256").update(job.generatedDraft.contentHtml).digest("hex") !== body.semanticInputFingerprint) throw new Error("INDIANA_RICH_CANDIDATE_SEMANTIC_SOURCE_MISMATCH");
      const records = listProductMediaAuthority({ organizationId: resolved.campaign.organizationId, siteId: resolved.campaign.siteId, productId: resolved.campaign.productId });
      assertIndianaRichReferenceAuthorizedInputs(records, body.semanticInputFingerprint);
      const candidate = buildIndianaRichReferenceCandidate({ records, semanticSource: { jobId: job.jobId, artifactSha256: body.semanticInputFingerprint }, expectedPlanFingerprint: body.expectedPlanFingerprint, claimAuthorityFingerprint: GLW_REFERENCE_CLAIM_AUTHORITY_FINGERPRINT });
      return NextResponse.json({ candidate, candidateArtifactPath: INDIANA_RICH_REFERENCE_CANDIDATE_ARTIFACT_PATH, wordpressMutation: false, generationAttempted: false, n8nExecutionCreated: false }, { status: 201 });
    }
    if (!body.candidateId) throw new Error("INDIANA_RICH_CANDIDATE_ID_REQUIRED");
    const candidate = getIndianaRichReferenceCandidate(body.candidateId);
    if (!candidate) throw new Error("INDIANA_RICH_CANDIDATE_NOT_FOUND");
    const media = candidateMediaDataUrls(candidate);
    const query = new URLSearchParams({ candidateId: candidate.candidateId, organizationId: resolved.campaign.organizationId, siteId: resolved.campaign.siteId });
    const pathname = `/api/glw/campaigns/${encodeURIComponent(resolved.campaign.campaignId)}/rich-reference-candidate/snapshot`;
    const signedPath = `${pathname}?${query.toString()}`;
    const origin = request.nextUrl.origin;
    const authority: CaptureAuthority = {
      identity: { organizationId: resolved.campaign.organizationId, siteId: resolved.campaign.siteId, pageId: PAGE_ID, pageRevisionIdentity: candidate.candidateId, canonicalPath: candidate.artifact.slug, contentHash: candidate.candidateSha, renderedContentHash: null, campaignId: resolved.campaign.campaignId, targetId: null, jobId: candidate.plan.semanticSource.jobId, externalExecutionId: null, wordpressObjectId: null, wordpressStatus: null },
      targetUrl: `${origin}${signedPath}`,
      allowedOrigins: [origin],
      internalGenesisOrigin: origin,
      internalAuthorization: { header: "x-genesis-render-capture", value: signGovernedSnapshotPath(signedPath) },
      layoutClass: "FULL_WIDTH_MARKETING_PAGE",
      mediaAssignments: media.map((item) => ({ assignmentId: item.assignmentId, semanticRole: item.semanticRole, mediaId: item.mediaId, sourceUrl: item.dataUrl, contextId: candidate.compositionPlanFingerprint })),
    };
    const capture = await runGovernedRenderCapture({ authority, mode: "CURRENT", actor: resolved.principal.principalId });
    return NextResponse.json({ candidateId: candidate.candidateId, certification: capture.certification, visualSummary: candidateVisualSummary(capture.certification), reused: capture.reused, wordpressMutation: capture.wordpressMutationPerformed, generationAttempted: false, n8nExecutionCreated: false });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "INDIANA_RICH_CANDIDATE_FAILED", wordpressMutation: false, generationAttempted: false, n8nExecutionCreated: false }, { status: 409 });
  }
}
