import { NextRequest, NextResponse } from "next/server";

import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import {
  createAuthenticatedWordPressReadAuthority,
  type AuthenticatedWordPressReadAuthority,
} from "@/modules/foundation/authenticated-wordpress-read-authority";
import { resolvePermissions } from "@/modules/foundation/permissions";
import { getProductById } from "@/modules/foundation/product-repository";
import { evaluateProductPublishingGuard } from "@/modules/foundation/product-publishing-guard";
import {
  contentVerification,
  proposedExactJobSeo,
  verifyExactJobPage,
  type ExactJobWordPressPage,
} from "@/modules/foundation/site-studio-exact-job-publication";
import { getSiteById } from "@/modules/foundation/site-repository";
import { evaluatePublishingGuard } from "@/modules/foundation/site-publishing-guard";
import { resolveWordPressCredentialReference } from "@/modules/foundation/wordpress-credential-resolver";
import { writeGenesisWordPressDraft } from "@/modules/foundation/wordpress-draft-writer";
import { publishGenesisWordPressDraft } from "@/modules/foundation/wordpress-publish-writer";
import {
  glwPageExecutionRepository,
  reconcileGlwPageExecutionPublished,
} from "@/modules/glw/page-execution-repository";

type Context = { params: Promise<{ siteId: string; jobId: string }> };

async function readPages(
  authority: AuthenticatedWordPressReadAuthority,
  query: URLSearchParams,
): Promise<ExactJobWordPressPage[]> {
  const read = await authority.getJson({ path: "/pages", query });
  return read.ok && Array.isArray(read.body)
    ? read.body as ExactJobWordPressPage[]
    : [];
}

async function buildPreflight(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:read");
  if (!auth.ok) return { error: auth.error, status: auth.status } as const;
  const scope = resolveRequestScope(request);
  const { siteId, jobId } = await context.params;
  if (!hasOrganizationScope(scope) || (scope.siteId && scope.siteId !== siteId)) {
    return { error: "Site scope is required.", status: 403 } as const;
  }

  const job = await glwPageExecutionRepository.getById(jobId);
  const site = getSiteById(siteId);
  const product = job ? getProductById(job.productId) : null;
  if (!job || !site || !product || job.siteId !== siteId || job.organizationId !== scope.organizationId || site.organizationId !== scope.organizationId || product.organizationId !== scope.organizationId) {
    return { error: "Exact Site Studio job was not found in scope.", status: 404 } as const;
  }

  const permissions = resolvePermissions(auth.roles);
  const siteGuard = evaluatePublishingGuard({
    site,
    permissions,
    organizationActive: true,
  });
  const productGuard = evaluateProductPublishingGuard({ product, permissions });
  const jobGateReasons: string[] = [];
  if (job.status !== "COMPLETE") jobGateReasons.push("Generation job is not complete.");
  if (job.qaStatus !== "COMPLETE") jobGateReasons.push("Generation QA is not complete.");
  if (!job.wordpressObjectId || job.wordpressStatus !== "draft") jobGateReasons.push("Job does not own an exact WordPress draft.");
  if (job.featuredImagePresent !== true) jobGateReasons.push("Featured media is not verified.");
  const failedQa = Object.entries(job.qaChecks ?? {}).filter(([, value]) => {
    if (value && typeof value === "object" && "ok" in value) return (value as { ok?: unknown }).ok !== true;
    return value === false || value === "FAIL";
  });
  if (failedQa.length > 0) jobGateReasons.push("One or more persisted generation QA checks failed.");

  const credential = resolveWordPressCredentialReference(site.integrations.wordpressCredentialReference);
  const apiBaseUrl = site.integrations.wordpressApiBaseUrl;
  if (!credential || !apiBaseUrl) {
    return { error: "Authenticated site WordPress authority is unavailable.", status: 409 } as const;
  }
  const authority = createAuthenticatedWordPressReadAuthority({
    configuration: { apiBaseUrl, username: credential.username, applicationPassword: credential.applicationPassword, timeoutMs: 30_000 },
  });

  const segments = job.slug.split("/").filter(Boolean);
  const [productSlug, stateSlug, expectedSlug] = segments;
  if (!productSlug || !stateSlug || !expectedSlug || segments.length !== 3) {
    return { error: "Job canonical path is not an exact product/state/city hierarchy.", status: 409 } as const;
  }
  const productPages = (await readPages(authority, new URLSearchParams({ slug: productSlug, parent: "0", context: "edit", status: "any", _fields: "id,slug,parent,status" })))
    .filter((page) => page.slug === productSlug && page.parent === 0);
  if (productPages.length !== 1 || !productPages[0].id) {
    return { error: "Canonical product parent is not uniquely verified.", status: 409 } as const;
  }
  const statePages = (await readPages(authority, new URLSearchParams({ slug: stateSlug, parent: String(productPages[0].id), context: "edit", status: "any", _fields: "id,slug,parent,status" })))
    .filter((page) => page.slug === stateSlug && page.parent === productPages[0].id);
  if (statePages.length !== 1 || !statePages[0].id) {
    return { error: "Canonical state parent is not uniquely verified.", status: 409 } as const;
  }
  const expectedParentId = String(statePages[0].id);
  const pageRead = await authority.getJson({
    path: `/pages/${job.wordpressObjectId}`,
    query: new URLSearchParams({ context: "edit", _fields: "id,slug,parent,status,link,title,excerpt,content,featured_media,meta" }),
  });
  if (!pageRead.ok || !pageRead.body || typeof pageRead.body !== "object" || Array.isArray(pageRead.body)) {
    return { error: "Exact WordPress draft could not be read.", status: 409 } as const;
  }
  const page = pageRead.body as ExactJobWordPressPage;
  const exactIdentity = verifyExactJobPage({ page, expectedObjectId: job.wordpressObjectId ?? "", expectedSlug, expectedParentId, expectedStatus: "draft" });
  const collisions = (await readPages(authority, new URLSearchParams({ slug: expectedSlug, parent: expectedParentId, context: "edit", status: "any", per_page: "100", _fields: "id,slug,parent,status" })))
    .filter((candidate) => candidate.slug === expectedSlug && String(candidate.parent ?? "") === expectedParentId);
  const collisionFree = collisions.length === 1 && String(collisions[0].id ?? "") === job.wordpressObjectId;
  const contentHtml = page.content?.raw ?? "";
  const content = contentVerification(contentHtml);
  const seo = proposedExactJobSeo(job);
  const featuredMediaId = Number(page.featured_media ?? 0);
  const seoReady = Boolean(seo.focusKeyphrase && seo.seoTitle && seo.metaDescription);
  const ready = siteGuard.allowed && productGuard.allowed && jobGateReasons.length === 0 && exactIdentity && collisionFree && content.ready && content.wordCount >= 1500 && featuredMediaId > 0 && seoReady;

  return {
    ready,
    site,
    product,
    job,
    page,
    authority,
    expectedSlug,
    expectedParentId,
    featuredMediaId,
    content,
    seo,
    gates: {
      site: { ready: siteGuard.allowed, reasons: siteGuard.reasons },
      product: { ready: productGuard.allowed, reasons: productGuard.reasons },
      job: { ready: jobGateReasons.length === 0, reasons: jobGateReasons },
      identity: { ready: exactIdentity, collisionFree },
      content: { ...content, minimumWordCount: 1500 },
      media: { ready: featuredMediaId > 0 && job.featuredImagePresent === true, featuredMediaId },
      seo: { ready: seoReady },
    },
  } as const;
}

function response(preflight: Exclude<Awaited<ReturnType<typeof buildPreflight>>, { error: string; status: number }>) {
  return {
    approvalReady: preflight.ready,
    site: { siteId: preflight.site.siteId, domain: preflight.site.domain, lifecycleState: preflight.site.lifecycleState, enabled: preflight.site.enabled, publishingStatus: preflight.site.publishingStatus },
    product: { productId: preflight.product.productId, productName: preflight.product.productName },
    jobId: preflight.job.jobId,
    wordpressObjectId: preflight.job.wordpressObjectId,
    canonicalPath: `/${preflight.job.slug}/`,
    expectedSlug: preflight.expectedSlug,
    expectedParentId: preflight.expectedParentId,
    collisionResult: preflight.gates.identity.collisionFree ? "EXACT_UNIQUE_DRAFT" : "COLLISION_OR_IDENTITY_MISMATCH",
    gates: preflight.gates,
    proposedYoast: preflight.seo,
    exactFirstMutation: "POST exact WordPress page ID with unchanged title/content/excerpt/slug/parent and proposed Yoast meta; featured_media omitted and therefore preserved.",
    exactPublicationMutation: "POST exact WordPress page ID with {status: publish} only after SEO readback succeeds.",
    publicationPerformed: false,
  };
}

export async function GET(request: NextRequest, context: Context) {
  const preflight = await buildPreflight(request, context);
  if ("error" in preflight) return NextResponse.json({ error: preflight.error }, { status: preflight.status });
  return NextResponse.json(response(preflight));
}

export async function POST(request: NextRequest, context: Context) {
  const updateAuth = authorizeRequest(request, "sites:update");
  if (!updateAuth.ok) return NextResponse.json({ error: updateAuth.error }, { status: updateAuth.status });
  const body = await request.json().catch(() => null) as { confirm?: string } | null;
  if (body?.confirm !== "PUBLISH_EXACT_SITE_STUDIO_JOB") {
    return NextResponse.json({ error: "Explicit exact-job publication confirmation is required." }, { status: 400 });
  }
  const preflight = await buildPreflight(request, context);
  if ("error" in preflight) return NextResponse.json({ error: preflight.error }, { status: preflight.status });
  if (!preflight.ready || !preflight.job.wordpressObjectId) {
    return NextResponse.json({ error: "Exact-job publication preflight is not approval-ready.", preflight: response(preflight) }, { status: 409 });
  }

  const originalContent = preflight.page.content?.raw ?? "";
  const originalFeaturedMedia = preflight.featuredMediaId;
  const seoWrite = await writeGenesisWordPressDraft({
    operation: "UPDATE",
    site: preflight.site,
    wordpressObjectId: preflight.job.wordpressObjectId,
    artifact: {
      title: preflight.page.title?.raw ?? preflight.job.title,
      contentHtml: originalContent,
      slug: preflight.expectedSlug,
      excerpt: preflight.page.excerpt?.raw ?? preflight.job.generatedDraft?.excerpt,
      parentId: Number(preflight.expectedParentId),
      seo: preflight.seo,
    },
  });
  if (!seoWrite.ok || !seoWrite.seoMetadataAccepted) {
    return NextResponse.json({ error: seoWrite.ok ? "WordPress did not accept exact Yoast metadata." : seoWrite.message }, { status: 409 });
  }

  const seoRead = await preflight.authority.getJson({
    path: `/pages/${preflight.job.wordpressObjectId}`,
    query: new URLSearchParams({ context: "edit", _fields: "id,slug,parent,status,content,featured_media,meta" }),
  });
  const seoPage = seoRead.ok && seoRead.body && typeof seoRead.body === "object" && !Array.isArray(seoRead.body)
    ? seoRead.body as ExactJobWordPressPage
    : null;
  const meta = seoPage?.meta ?? {};
  const seoVerified = Boolean(
    seoPage
    && verifyExactJobPage({ page: seoPage, expectedObjectId: preflight.job.wordpressObjectId, expectedSlug: preflight.expectedSlug, expectedParentId: preflight.expectedParentId, expectedStatus: "draft" })
    && seoPage.content?.raw === originalContent
    && seoPage.featured_media === originalFeaturedMedia
    && meta._yoast_wpseo_focuskw === preflight.seo.focusKeyphrase
    && meta._yoast_wpseo_title === preflight.seo.seoTitle
    && meta._yoast_wpseo_metadesc === preflight.seo.metaDescription
  );
  if (!seoVerified) {
    return NextResponse.json({ error: "Exact draft, content, media, or Yoast readback verification failed. Publication was not attempted." }, { status: 409 });
  }

  const published = await publishGenesisWordPressDraft({ site: preflight.site, wordpressObjectId: preflight.job.wordpressObjectId });
  if (!published.ok) return NextResponse.json({ error: published.message, state: published.state }, { status: 409 });
  await reconcileGlwPageExecutionPublished({ jobId: preflight.job.jobId, wordpressObjectId: preflight.job.wordpressObjectId, wordpressUrl: published.wordpressUrl });
  return NextResponse.json({ ok: true, jobId: preflight.job.jobId, wordpressObjectId: published.wordpressObjectId, wordpressStatus: published.wordpressStatus, wordpressUrl: published.wordpressUrl, seoVerified: true, contentPreserved: true, featuredMediaPreserved: true, publicationPerformed: published.publicationPerformed });
}