import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { createAuthenticatedWordPressReadAuthority } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { getProductById } from "@/modules/foundation/product-repository";
import { getSiteById } from "@/modules/foundation/site-repository";
import { resolveWordPressCredentialReference } from "@/modules/foundation/wordpress-credential-resolver";
import { writeGenesisWordPressDraft } from "@/modules/foundation/wordpress-draft-writer";
import { evaluateGlwGeneratedContentQa } from "@/modules/glw/generated-content-qa";
import { GLW_CAMPAIGN_US_STATES } from "@/modules/glw/campaign-geography";
import {
  buildLocalGlwGenerationPreview,
  type GlwGenerationRequestInput,
} from "@/modules/glw/page-generation";
import { glwPageExecutionRepository } from "@/modules/glw/page-execution-repository";
import { enrichGlwGeneratedContentForSeo } from "@/modules/glw/seo-enrichment";
import { resolveGlwWordPressTargetHierarchy } from "@/modules/glw/wordpress-target-hierarchy";

function resolveStateCode(value: string | null): string {
  const normalized = (value ?? "").trim();
  if (!normalized) return "";
  const upper = normalized.toUpperCase();
  const byCode = GLW_CAMPAIGN_US_STATES.find((state) => state.code === upper);
  if (byCode) return byCode.code;
  const lower = normalized.toLowerCase();
  return GLW_CAMPAIGN_US_STATES.find((state) =>
    state.name.toLowerCase() === lower || state.slug === lower,
  )?.code ?? "";
}

function resolveCitySlug(value: string | null): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function rebuildGenerationForm(job: {
  siteId: string;
  productId: string;
  state: string | null;
  city: string | null;
  slug: string;
  title: string;
  seoTitle: string;
  metaDescription: string;
  wordpressObjectId: string | null;
}): GlwGenerationRequestInput {
  const stateCode = resolveStateCode(job.state);
  const citySlug = resolveCitySlug(job.city);
  const pageType = citySlug ? "city_service" : stateCode ? "state_service" : "general_service";
  const plannedOperation = pageType === "city_service"
    ? "UPDATE_CITY"
    : pageType === "state_service"
      ? "UPDATE_STATE"
      : "UPDATE_GENERAL";

  return {
    siteId: job.siteId,
    productId: job.productId,
    pageType,
    stateCode,
    citySlug,
    slug: job.slug,
    title: job.title,
    seoTitle: job.seoTitle,
    metaDescription: job.metaDescription,
    publicationIntent: "draft",
    plannedOperation,
    wordpressObjectId: job.wordpressObjectId,
    additionalInstructions: "",
    imageDirection: "",
  };
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function extractHeroFigure(html: string): string | null {
  const match = html.match(/<figure\b[^>]*class=["'][^"']*page-hero-image[^"']*["'][^>]*>[\s\S]*?<\/figure>/i);
  return match?.[0] ?? null;
}

function buildHeroFigure(input: { mediaUrl: string; altText: string }): string {
  return `<figure class="page-hero-image"><img src="${escapeHtmlAttribute(input.mediaUrl)}" alt="${escapeHtmlAttribute(input.altText)}" loading="eager" fetchpriority="high" /></figure>`;
}

function insertHeroFigure(baseHtml: string, hero: string): string {
  if (/<\/h1>/i.test(baseHtml)) {
    return baseHtml.replace(/<\/h1>/i, (match) => `${match}\n${hero}`);
  }
  return `${hero}\n${baseHtml}`;
}

export async function POST(request: NextRequest) {
  const auth = authorizeRequest(request, "sites:update");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { jobId?: string; confirm?: string } | null;
  if (body?.confirm !== "REFRESH_EXISTING_DRAFT_SEO") {
    return NextResponse.json({ error: "Explicit REFRESH_EXISTING_DRAFT_SEO confirmation is required." }, { status: 400 });
  }

  const jobId = body.jobId?.trim() ?? "";
  if (!jobId) return NextResponse.json({ error: "Exact GLW jobId is required." }, { status: 400 });

  const job = await glwPageExecutionRepository.getById(jobId);
  if (!job) return NextResponse.json({ error: "GLW execution was not found." }, { status: 404 });
  if (job.organizationId !== scope.organizationId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (job.status !== "COMPLETE" || job.wordpressStatus !== "draft" || !job.wordpressObjectId) {
    return NextResponse.json({ error: "SEO refresh requires an exact COMPLETE WordPress draft execution." }, { status: 409 });
  }
  if (!job.generatedDraft) {
    return NextResponse.json({ error: "Generated draft artifact is unavailable." }, { status: 409 });
  }

  const siteRecord = getSiteById(job.siteId);
  const productRecord = getProductById(job.productId);
  if (!siteRecord || !productRecord) {
    return NextResponse.json({ error: "Configured site and product are required." }, { status: 400 });
  }

  const form = rebuildGenerationForm(job);
  const preview = buildLocalGlwGenerationPreview({
    form,
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
    return NextResponse.json({
      error: "Persisted generation request could not be reconstructed for SEO refresh.",
      issues: preview.validation.issues,
      reconstructed: {
        pageType: form.pageType,
        stateCode: form.stateCode,
        citySlug: form.citySlug,
        slug: form.slug,
        wordpressObjectId: form.wordpressObjectId,
      },
    }, { status: 409 });
  }

  const apiBaseUrl = siteRecord.integrations.wordpressApiBaseUrl?.trim() ?? "";
  const credentialReference = siteRecord.integrations.wordpressCredentialReference?.trim() ?? "";
  const credential = resolveWordPressCredentialReference(credentialReference);
  if (!apiBaseUrl || !credential) {
    return NextResponse.json({ error: "Authenticated WordPress read authority is required for SEO refresh." }, { status: 503 });
  }

  let baseHtml = job.generatedDraft.contentHtml;
  let heroPreserved = /class=["'][^"']*page-hero-image/i.test(baseHtml);
  let heroRebuiltFromFeaturedMedia = false;

  try {
    const reader = createAuthenticatedWordPressReadAuthority({
      configuration: {
        apiBaseUrl,
        username: credential.username,
        applicationPassword: credential.applicationPassword,
        timeoutMs: 30_000,
      },
    });
    const pageRead = await reader.getJson({
      path: `/pages/${job.wordpressObjectId}`,
      query: new URLSearchParams({ context: "edit", _fields: "id,status,content,featured_media" }),
    });
    if (!pageRead.ok || !pageRead.body || typeof pageRead.body !== "object" || Array.isArray(pageRead.body)) {
      return NextResponse.json({ error: "Current WordPress draft content could not be read before SEO refresh." }, { status: 409 });
    }
    const page = pageRead.body as {
      id?: number;
      status?: string;
      featured_media?: number;
      content?: { raw?: string };
    };
    if (String(page.id ?? "") !== job.wordpressObjectId || page.status !== "draft") {
      return NextResponse.json({ error: "Current WordPress object is no longer the exact authorized draft." }, { status: 409 });
    }

    if (!heroPreserved) {
      const currentWordPressHtml = page.content?.raw ?? "";
      const existingHero = extractHeroFigure(currentWordPressHtml);
      if (existingHero) {
        baseHtml = insertHeroFigure(baseHtml, existingHero);
        heroPreserved = true;
      } else {
        const featuredMediaId = Number(page.featured_media ?? 0);
        if (Number.isSafeInteger(featuredMediaId) && featuredMediaId > 0) {
          const mediaRead = await reader.getJson({
            path: `/media/${featuredMediaId}`,
            query: new URLSearchParams({ context: "edit", _fields: "id,source_url,alt_text" }),
          });
          if (mediaRead.ok && mediaRead.body && typeof mediaRead.body === "object" && !Array.isArray(mediaRead.body)) {
            const media = mediaRead.body as { id?: number; source_url?: string; alt_text?: string };
            const mediaUrl = String(media.source_url ?? "").trim();
            if (media.id === featuredMediaId && mediaUrl) {
              const location = preview.request.cityName?.trim() || preview.request.stateName?.trim() || "";
              const fallbackAlt = `${preview.request.productTopic}${location ? ` in ${location}` : ""}`;
              const hero = buildHeroFigure({
                mediaUrl,
                altText: String(media.alt_text ?? "").trim() || fallbackAlt,
              });
              baseHtml = insertHeroFigure(baseHtml, hero);
              heroPreserved = true;
              heroRebuiltFromFeaturedMedia = true;
            }
          }
        }
      }
    }
  } catch {
    return NextResponse.json({ error: "Current WordPress draft content could not be read before SEO refresh." }, { status: 409 });
  }

  const enrichment = enrichGlwGeneratedContentForSeo({
    artifact: { ...job.generatedDraft, contentHtml: baseHtml },
    request: preview.request,
  });

  const qa = evaluateGlwGeneratedContentQa({
    artifact: enrichment.artifact,
    request: preview.request,
    siteDomain: siteRecord.domain,
    minimumWordCount: 1500,
    additionalAllowedDomains: enrichment.approvedExternalDomains,
  });

  if (!qa.ok) {
    return NextResponse.json({ error: "SEO-enriched artifact failed GLW content QA.", qa }, { status: 409 });
  }

  const hierarchy = await resolveGlwWordPressTargetHierarchy({ request: preview.request, site: siteRecord });
  if (!hierarchy.ok) {
    return NextResponse.json({ error: hierarchy.errorMessage, code: hierarchy.errorCode }, { status: 409 });
  }

  if (
    preview.request.pageType === "state_service"
    && hierarchy.wordpressObjectId
    && hierarchy.wordpressObjectId !== job.wordpressObjectId
  ) {
    return NextResponse.json({ error: "Exact WordPress hierarchy target no longer matches the completed GLW job." }, { status: 409 });
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
    return NextResponse.json({ error: writeResult.message, state: writeResult.state }, { status: 409 });
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
    approvedExternalDomains: enrichment.approvedExternalDomains,
    qaStatus: "COMPLETE",
    featuredImagePreserved: job.featuredImagePresent,
    heroImagePreservedInBody: heroPreserved,
    heroImageRebuiltFromFeaturedMedia: heroRebuiltFromFeaturedMedia,
    imageGenerationPerformed: false,
    publicationPerformed: false,
  });
}