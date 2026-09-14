import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, resolveRequestScope } from "@/modules/foundation/api-auth";
import { hashRenderedVisualContent } from "@/modules/foundation/rendered-visual-certification";
import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import { listAllGlwCampaignTargets } from "@/modules/glw/campaign-target-repository";
import { createDallasLocalizedPreviewV2 } from "@/modules/glw/dallas-localized-preview-v2-service";
import { buildGeneratedPageReviewModel } from "@/modules/glw/generated-page-review-read-model";
import { createSanAntonioLocalizedComposition, SAN_ANTONIO_LOCALIZED_JOB_ID } from "@/modules/glw/san-antonio-localized-composition-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  const auth = authorizeRequest(request, "sites:read"); if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status }); const scope = resolveRequestScope(request); const { jobId } = await context.params;
  if (scope.organizationId !== "ssi" || scope.siteId !== "site-ssi-projectorenclosure" || jobId !== "2ca74016-252b-4587-bf3c-ec9b7eb839c9") return NextResponse.json({ error: "Exact Dallas scope required." }, { status: 403 });
  const model = await buildGeneratedPageReviewModel({ jobId, organizationId: scope.organizationId, siteId: scope.siteId }); if (!model || !model.wordpress.previewHtml) return NextResponse.json({ error: "Authenticated Dallas draft unavailable." }, { status: 409 });
  const targets = listAllGlwCampaignTargets().filter((item) => item.campaignId === model.identity.campaignId).map((item) => ({ city: item.cityName, status: item.status, jobId: item.jobId })); const campaign = listGlwCampaigns().find((item) => item.campaignId === model.identity.campaignId);
  return NextResponse.json({ wordpress: { objectId: model.wordpress.objectId, status: model.wordpress.status, verified: model.wordpress.verified, title: model.wordpress.title, titleMatchesSource: model.wordpress.titleMatchesSource, contentMatchesSource: model.wordpress.contentMatchesSource, contentHash: hashRenderedVisualContent(model.wordpress.previewHtml), seoHash: hashRenderedVisualContent(JSON.stringify({ title: model.seo.title, metaDescription: model.seo.metaDescription, canonicalPath: model.identity.canonicalPath })), featuredMediaId: model.images.contextualInUse.wordpressMediaId }, campaign: { campaignId: model.identity.campaignId, status: campaign?.status ?? null, pagesPerDay: campaign?.pagesPerDay ?? null, targets }, mutationPerformed: false, wordpressMutationPerformed: false, campaignMutationPerformed: false, publicationPerformed: false, dispatchPerformed: false });
}

export async function POST(request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  const auth = authorizeRequest(request, "sites:update"); if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!auth.roles.includes("platform_admin")) return NextResponse.json({ error: "platform_admin is required." }, { status: 403 });
  const scope = resolveRequestScope(request); const { jobId } = await context.params; const body = await request.json().catch(() => null) as { operation?: string } | null;
  const exactDallas = jobId === "2ca74016-252b-4587-bf3c-ec9b7eb839c9" && body?.operation === "CREATE_LOCALIZED_PREVIEW_V2";
  const exactSanAntonio = jobId === SAN_ANTONIO_LOCALIZED_JOB_ID && body?.operation === "CREATE_SAN_ANTONIO_LOCALIZED_COMPOSITION_EVIDENCE_V1";
  if (scope.organizationId !== "ssi" || scope.siteId !== "site-ssi-projectorenclosure" || (!exactDallas && !exactSanAntonio) || Object.keys(body ?? {}).some((key) => key !== "operation")) return NextResponse.json({ error: "Exact localized-preview operation required." }, { status: 400 });
  try {
    const bundle = exactSanAntonio ? await createSanAntonioLocalizedComposition({ actor: "SAN_ANTONIO_LOCALIZED_COMPOSITION_EVIDENCE_V1" }) : await createDallasLocalizedPreviewV2({ actor: "GENESIS_LOCAL_CONTEXT_AND_PAGE_THEMING_V1" });
    return NextResponse.json({ bundle, artifactPreserved: true, regenerationPerformed: false, workflowExecuted: false, wordpressMutationPerformed: false, campaignMutationPerformed: false, publicationPerformed: false, dispatchPerformed: false }, { status: 201 });
  }
  catch (error) { const message = error instanceof Error ? error.message : "LOCALIZED_PREVIEW_V2_FAILED"; return NextResponse.json({ error: message.split(":")[0], states: /LOCALIZED_MEDIA_GENERATION_FAILED:/.test(message) ? message.split(":")[1]?.split(",").filter(Boolean) ?? [] : [], artifactPreserved: true, regenerationPerformed: false, workflowExecuted: false, wordpressMutationPerformed: false, campaignMutationPerformed: false, publicationPerformed: false, dispatchPerformed: false }, { status: 409 }); }
}