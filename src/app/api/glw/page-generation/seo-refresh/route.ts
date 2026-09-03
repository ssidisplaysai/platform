import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { getProductById } from "@/modules/foundation/product-repository";
import { getSiteById } from "@/modules/foundation/site-repository";
import { writeGenesisWordPressDraft } from "@/modules/foundation/wordpress-draft-writer";
import { evaluateGlwGeneratedContentQa } from "@/modules/glw/generated-content-qa";
import { buildLocalGlwGenerationPreview } from "@/modules/glw/page-generation";
import { glwPageExecutionRepository } from "@/modules/glw/page-execution-repository";
import { enrichGlwGeneratedContentForSeo } from "@/modules/glw/seo-enrichment";
import { resolveGlwWordPressTargetHierarchy } from "@/modules/glw/wordpress-target-hierarchy";

export async function POST(request: NextRequest) {
  const auth = authorizeRequest(request, "sites:update");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as {
    jobId?: string;
    confirm?: string;
  } | null;

  if (body?.confirm !== "REFRESH_EXISTING_DRAFT_SEO") {
    return NextResponse.json(
      { error: "Explicit REFRESH_EXISTING_DRAFT_SEO confirmation is required." },
      { status: 400 },
    );
  }

  const jobId = body.jobId?.trim() ?? "";
  if (!jobId) {
    return NextResponse.json({ error: "Exact GLW jobId is required." }, { status: 400 });
  }

  const job = await glwPageExecutionRepository.getById(jobId);
  if (!job) {
    return NextResponse.json({ error: "GLW execution was not found." }, { status: 404 });
  }

  if (job.organizationId !== scope.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (job.status !== "COMPLETE" || job.wordpressStatus !== "draft" || !job.wordpressObjectId) {
    return NextResponse.json(
      { error: "SEO refresh requires an exact COMPLETE WordPress draft execution." },
      { status: 409 },
    );
  }

  if (!job.generatedDraft) {
    return NextResponse.json({ error: "Generated draft artifact is unavailable." }, { status: 409 });
  }

  const siteRecord = getSiteById(job.siteId);
  const productRecord = getProductById(job.productId);
  if (!siteRecord || !productRecord) {
    return NextResponse.json({ error: "Configured site and product are required." }, { status: 400 });
  }

  const preview = buildLocalGlwGenerationPreview({
    form: job.request,
    sites: [{
      siteId: siteRecord.siteId,
      organizationId: siteRecord.organizationId,
      name: siteRecord.displayName,
      slug: siteRecord.slug,
      domain: siteRecord.domain,
      canonicalUrl: siteRecord.canonicalUrl,
      wordpressApiBaseUrl: siteRecord.integrations.wordpressApiBaseUrl,
      environment: siteRecord.environment,
      enabled: siteRecord.enabled,
      profileCount: 0,
    }],
    products: [{
      siteId: siteRecord.siteId,
      productId: productRecord.productId,
      organizationId: productRecord.organizationId,
      name: productRecord.displayName,
      slug: productRecord.slug,
      topic: productRecord.productName,
      assignedSiteIds: productRecord.assignedSiteIds,
    }],
  });

  if (!preview.validation.valid || !preview.request) {
    return NextResponse.json({ error: "Persisted generation request is no longer valid." }, { status: 409 });
  }

  const enrichment = enrichGlwGeneratedContentForSeo({
    artifact: job.generatedDraft,
    request: preview.request,
  });

  const qa = evaluateGlwGeneratedContentQa({
    artifact: enrichment.artifact,
    request: preview.request,
    siteDomain: siteRecord.domain,
    minimumWordCount: 1500,
  });

  if (!qa.ok) {
    return NextResponse.json(
      {
        error: "SEO-enriched artifact failed GLW content QA.",
        qa,
      },
      { status: 409 },
    );
  }

  const hierarchy = await resolveGlwWordPressTargetHierarchy({
    request: preview.request,
    site: siteRecord,
  });

  if (!hierarchy.ok) {
    return NextResponse.json(
      { error: hierarchy.errorMessage, code: hierarchy.errorCode },
      { status: 409 },
    );
  }

  if (
    preview.request.pageType === "state_service"
    && hierarchy.wordpressObjectId
    && hierarchy.wordpressObjectId !== job.wordpressObjectId
  ) {
    return NextResponse.json(
      { error: "Exact WordPress hierarchy target no longer matches the completed GLW job." },
      { status: 409 },
    );
  }

  const writeResult = await writeGenesisWordPressDraft({
    operation: "UPDATE",
    site: siteRecord,
    wordpressObjectId: job.wordpressObjectId,
    artifact: {
      title: enrichment.artifact.title,
      contentHtml: enrichment.artifact.contentHtml,
      slug: enrichment.artifact.slug,
      excerpt: enrichment.artifact.excerpt,
      parentId: hierarchy.parentId,
      seo: enrichment.metadata,
    },
  });

  if (!writeResult.ok) {
    return NextResponse.json(
      { error: writeResult.message, state: writeResult.state },
      { status: 409 },
    );
  }

  await glwPageExecutionRepository.update(job.jobId, {
    generatedDraft: enrichment.artifact,
    qaStatus: "COMPLETE",
    qaChecks: qa.checks,
    qaFailureReasons: {},
    wordCount: qa.wordCount,
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.json({
    ok: true,
    jobId: job.jobId,
    wordpressObjectId: writeResult.wordpressObjectId,
    wordpressStatus: writeResult.wordpressStatus,
    seoMetadataAttempted: writeResult.seoMetadataAttempted,
    seoMetadataAccepted: writeResult.seoMetadataAccepted,
    inserted: enrichment.inserted,
    qaStatus: "COMPLETE",
    featuredImagePreserved: job.featuredImagePresent,
    imageGenerationPerformed: false,
    publicationPerformed: false,
  });
}
