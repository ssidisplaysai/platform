import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, resolveRequestScope } from "@/modules/foundation/api-auth";
import { adaptApprovedLegacyProductMedia } from "@/modules/foundation/legacy-product-media-assignment-adapter";
import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import { listAllGlwCampaignTargets } from "@/modules/glw/campaign-target-repository";
import { glwPageExecutionRepository } from "@/modules/glw/page-execution-repository";

export const dynamic = "force-dynamic";
export async function POST(request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  const auth = authorizeRequest(request, "sites:update"); if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!auth.roles.includes("platform_admin")) return NextResponse.json({ error: "platform_admin is required." }, { status: 403 });
  const scope = resolveRequestScope(request); const { jobId } = await context.params; const body = await request.json().catch(() => null) as { operation?: string } | null;
  if (!scope.organizationId || !scope.siteId || body?.operation !== "ADAPT_APPROVED_PRODUCT_AUTHORITY" || Object.keys(body).some((key) => key !== "operation")) return NextResponse.json({ error: "Exact product-authority adapter request required." }, { status: 400 });
  const job = await glwPageExecutionRepository.getById(jobId); const target = listAllGlwCampaignTargets().find((item) => item.jobId === jobId && item.organizationId === scope.organizationId && item.siteId === scope.siteId); const campaign = target ? listGlwCampaigns().find((item) => item.campaignId === target.campaignId && item.organizationId === scope.organizationId && item.siteId === scope.siteId) : null;
  if (!job || !target || !campaign || job.organizationId !== scope.organizationId || job.siteId !== scope.siteId || job.productId !== campaign.productId || target.productId !== campaign.productId || target.status !== "draft_ready" || job.wordpressStatus !== "draft") return NextResponse.json({ error: "Exact draft-ready page authority not found." }, { status: 404 });
  try { const pageRevisionId = `job:${job.jobId}:${job.updatedAt}`; const result = await adaptApprovedLegacyProductMedia({ organizationId: job.organizationId, siteId: job.siteId, productId: job.productId, buildSessionId: `glw-job:${job.jobId}`, pageId: target.targetId, pageRevisionId, slotId: "product-authority", actor: "OWNER_APPROVED_CANONICAL_PRODUCT" }); return NextResponse.json({ ...result, pageRevisionId, currentWordPressRendered: false, wordpressMutationPerformed: false, campaignMutationPerformed: false, publicationPerformed: false, dispatchPerformed: false }, { status: result.reused ? 200 : 201 }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message.split(":")[0] : "PRODUCT_AUTHORITY_ADAPTER_FAILED", wordpressMutationPerformed: false, campaignMutationPerformed: false, publicationPerformed: false }, { status: 409 }); }
}