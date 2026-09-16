import { NextRequest, NextResponse } from "next/server";

import { authorizeRequest, hasOrganizationScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { createAuthenticatedWordPressReadAuthority } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { repairEligibleRichPageNativeTitle } from "@/modules/foundation/eligible-rich-page-host-title-repair";
import { runGovernedRenderCapture, signGovernedSnapshotPath } from "@/modules/foundation/governed-render-capture-orchestrator";
import { getProductById } from "@/modules/foundation/product-repository";
import { resolveSharedRichPageProductionProfile } from "@/modules/foundation/shared-rich-page-production-authority";
import { getSiteById } from "@/modules/foundation/site-repository";
import { resolveWordPressCredentialReference } from "@/modules/foundation/wordpress-credential-resolver";
import { writeGenesisWordPressDraft } from "@/modules/foundation/wordpress-draft-writer";
import { resolveApprovedRichReferenceSource } from "@/modules/glw/approved-rich-reference-source";
import { glwPageExecutionRepository } from "@/modules/glw/page-execution-repository";
import { resolveGlwTrustedOperatorPrincipal } from "@/modules/glw/trusted-operator-principal";
import { resolveTargetParameterizedRichReferenceProduction } from "@/modules/glw/target-parameterized-rich-reference-production";
import { runTargetRichReferenceProductionOperation } from "@/modules/glw/target-rich-reference-production-operation";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ campaignId: string }> };

export async function GET(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope) || !scope.siteId) return NextResponse.json({ error: "Organization and site scope are required." }, { status: 403 });

  try {
    const { campaignId } = await context.params;
    const readiness = await resolveTargetParameterizedRichReferenceProduction({ campaignId, targetId: request.nextUrl.searchParams.get("targetId") });
    if (readiness.identity.organizationId !== scope.organizationId || readiness.identity.siteId !== scope.siteId) return NextResponse.json({ error: "Target scope is forbidden." }, { status: 403 });
    return NextResponse.json({ readiness, generationAttempted: false, n8nExecutionCreated: false, mcpExecuteWorkflowInvoked: false, imageGenerationAttempted: false, wordpressMutation: false, campaignContinuation: false, publicationMutation: false });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "RICH_REFERENCE_PRODUCTION_PREFLIGHT_FAILED", generationAttempted: false, n8nExecutionCreated: false, mcpExecuteWorkflowInvoked: false, imageGenerationAttempted: false, wordpressMutation: false, campaignContinuation: false, publicationMutation: false }, { status: 409 });
  }
}

function field(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function numeric(value: unknown): number { const parsed = Number(value); return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : -1; }

export async function POST(request: NextRequest, context: Context) {
  const principal = resolveGlwTrustedOperatorPrincipal(request);
  const auth = authorizeRequest(request, "sites:update");
  const scope = resolveRequestScope(request);
  if (!principal.ok || !auth.ok || !hasOrganizationScope(scope) || !scope.siteId) return NextResponse.json({ error: "Unauthorized", callerSuppliedRoleHeadersAuthorize: false }, { status: 401 });
  const body = await request.json().catch(() => null) as { targetId?: string; jobId?: string; referenceCandidateId?: string } | null;
  if (!body?.targetId || !body.jobId || !body.referenceCandidateId || Object.keys(body).some((key) => !["targetId", "jobId", "referenceCandidateId"].includes(key))) return NextResponse.json({ error: "Exact rich-reference production identities are required." }, { status: 400 });

  try {
    const { campaignId } = await context.params;
    const readiness = await resolveTargetParameterizedRichReferenceProduction({ campaignId, targetId: body.targetId });
    if (readiness.identity.organizationId !== scope.organizationId || readiness.identity.siteId !== scope.siteId) return NextResponse.json({ error: "Target scope is forbidden." }, { status: 403 });
    const job = await glwPageExecutionRepository.getById(body.jobId);
    const site = getSiteById(readiness.identity.siteId);
    const product = getProductById(readiness.identity.productId);
    const profile = resolveSharedRichPageProductionProfile({ organizationId: readiness.identity.organizationId, siteId: readiness.identity.siteId, productId: readiness.identity.productId, pageType: "LOCATION_SERVICE" });
    const reference = resolveApprovedRichReferenceSource(body.referenceCandidateId);
    if (!job?.generatedDraft || !site?.domain || !product || !profile || !reference || reference.productId !== readiness.identity.productId || job.organizationId !== readiness.identity.organizationId || job.siteId !== readiness.identity.siteId || job.productId !== readiness.identity.productId || job.state !== readiness.target.stateName || `/${job.slug.replace(/^\/+|\/+$/g, "")}/` !== readiness.identity.canonicalPath) throw new Error("RICH_REFERENCE_OPERATION_AUTHORITY_MISMATCH");
    const siteOrigin = new URL(`https://${site.domain.replace(/^www\./, "")}`).origin;
    const mediaAssignments = reference.mediaAssignments.map((assignment) => {
      return { ...assignment, organizationId: readiness.identity.organizationId, siteId: readiness.identity.siteId, pageId: readiness.target.targetId, pageRevisionId: `job:${job.jobId}:${job.updatedAt}`, asset: { ...assignment.asset, productId: readiness.identity.productId } };
    });
    const credential = resolveWordPressCredentialReference(site.integrations.wordpressCredentialReference);
    if (!site.integrations.wordpressApiBaseUrl || !credential) throw new Error("RICH_REFERENCE_WORDPRESS_AUTHORITY_REQUIRED");
    const reader = createAuthenticatedWordPressReadAuthority({ configuration: { apiBaseUrl: site.integrations.wordpressApiBaseUrl, username: credential.username, applicationPassword: credential.applicationPassword, timeoutMs: 30_000 } });
    const readStoredDraft = async (wordpressObjectId: string) => {
      const readback = await reader.getJson({ path: `/pages/${wordpressObjectId}`, query: new URLSearchParams({ context: "edit", _fields: "id,status,slug,parent,title,content,featured_media,meta,link" }) });
      if (!readback.ok || !readback.body || typeof readback.body !== "object" || Array.isArray(readback.body)) throw new Error("TARGET_RICH_REFERENCE_DRAFT_READBACK_FAILED");
      const page = readback.body as Record<string, unknown>;
      const content = page.content && typeof page.content === "object" && !Array.isArray(page.content) ? page.content as Record<string, unknown> : {};
      const title = page.title && typeof page.title === "object" && !Array.isArray(page.title) ? page.title as Record<string, unknown> : {};
      const meta = page.meta && typeof page.meta === "object" && !Array.isArray(page.meta) ? page.meta as Record<string, unknown> : {};
      const settings = meta._elementor_page_settings && typeof meta._elementor_page_settings === "object" && !Array.isArray(meta._elementor_page_settings) ? meta._elementor_page_settings as Record<string, unknown> : {};
      return { wordpressObjectId: String(page.id ?? ""), wordpressUrl: field(page.link), status: field(page.status) as "draft", slug: field(page.slug), parentId: numeric(page.parent), title: field(title.raw) || field(title.rendered), contentHtml: field(content.raw) || field(content.rendered), featuredMediaId: numeric(page.featured_media), nativeTitleSuppressed: settings.hide_title === "yes" };
    };
    const result = await runTargetRichReferenceProductionOperation({
      target: { ...readiness.target, canonicalPath: readiness.identity.canonicalPath, wordpressObjectId: readiness.identity.wordpressObjectId, wordpressParentId: readiness.identity.wordpressParentId },
      product: { productId: readiness.identity.productId, productName: product.productName, canonicalPath: `/${product.slug}/` },
      semanticArtifact: job.generatedDraft,
      referenceArtifactHtml: reference.contentHtml,
      mediaAssignments,
      profile,
      actor: principal.principal.principalId,
      dependencies: {
        writeDraft: ({ operation, wordpressObjectId, artifact }) => operation === "UPDATE" && wordpressObjectId ? writeGenesisWordPressDraft({ operation, site, wordpressObjectId, artifact }) : writeGenesisWordPressDraft({ operation: "CREATE", site, artifact }),
        suppressNativeTitle: async (identity) => { await repairEligibleRichPageNativeTitle({ site, identity: { organizationId: readiness.identity.organizationId, siteId: readiness.identity.siteId, productId: readiness.identity.productId, pageType: "LOCATION_SERVICE", wordpressObjectId: identity.wordpressObjectId, parentObjectId: String(identity.expectedParentId), slug: identity.expectedSlug, title: identity.expectedTitle, featuredMediaId: identity.expectedFeaturedMediaId, storedPostContentSha: identity.expectedContentSha, expectedStatus: identity.expectedStatus } }); },
        readStoredDraft,
        certifyActualHost: async ({ wordpressObjectId, canonicalPath, contentSha, actor }) => {
          const originValue = process.env.GENESIS_RENDER_CAPTURE_INTERNAL_ORIGIN?.trim() ?? "";
          const origin = new URL(originValue);
          if (origin.protocol !== "http:" || !["localhost", "127.0.0.1", "::1"].includes(origin.hostname) || origin.pathname !== "/" || origin.search || origin.hash) throw new Error("CAPTURE_INTERNAL_ORIGIN_NOT_CONFIGURED");
          const pathname = `/api/glw/campaigns/${encodeURIComponent(campaignId)}/rich-reference-production/snapshot`;
          const query = new URLSearchParams({ targetId: readiness.target.targetId, wordpressObjectId, contentSha });
          const signedPath = `${pathname}?${query}`;
          const capture = await runGovernedRenderCapture({ authority: { identity: { organizationId: readiness.identity.organizationId, siteId: readiness.identity.siteId, pageId: readiness.target.targetId, pageRevisionIdentity: `rich-draft:${wordpressObjectId}:${contentSha}`, canonicalPath, contentHash: contentSha, renderedContentHash: null, campaignId, targetId: readiness.target.targetId, jobId: job.jobId, externalExecutionId: job.externalExecutionId, wordpressObjectId, wordpressStatus: "draft" }, targetUrl: `${origin.origin}${signedPath}`, allowedOrigins: [origin.origin, siteOrigin], internalGenesisOrigin: origin.origin, internalAuthorization: { header: "x-genesis-render-capture", value: signGovernedSnapshotPath(signedPath) }, layoutClass: "FULL_WIDTH_MARKETING_PAGE", mediaAssignments: mediaAssignments.map((assignment) => ({ assignmentId: assignment.assignmentId, semanticRole: assignment.role, mediaId: assignment.approval.candidateId, sourceUrl: assignment.asset.type === "APPROVED_EXISTING" ? assignment.asset.url : null, contextId: assignment.pageRevisionId })) }, mode: "CURRENT", actor });
          if (capture.certification.overallState !== "PASS") throw new Error(`TARGET_RICH_REFERENCE_VISUAL_BLOCKED:${capture.certification.overallState}`);
          return { certificationId: capture.certification.certificationId, overallState: "PASS", contentHash: capture.certification.identity.contentHash, wordpressObjectId: capture.certification.identity.wordpressObjectId! };
        },
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "RICH_REFERENCE_PRODUCTION_FAILED", generationAttempted: false, n8nExecutionCreated: false, imageGenerationAttempted: false, publicationMutation: false }, { status: 409 });
  }
}
