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
import { publishGenesisWordPressDraft } from "@/modules/foundation/wordpress-publish-writer";
import { createWordPressSeoWriter } from "@/modules/foundation/wordpress-seo-writer";
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
  if (segments.length !== 1 && segments.length !== 3) {
    return { error: "Job canonical path is not a supported flat or product/state/city hierarchy.", status: 409 } as const;
  }
  const expectedSlug = segments[segments.length - 1];
  let expectedParentId = "0";
  if (segments.length === 3) {
    const [productSlug, stateSlug] = segments;
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
    expectedParentId = String(statePages[0].id);
  }
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
  const seoWriter = createWordPressSeoWriter(site);
  const seoCapability = seoWriter && job.wordpressObjectId
    ? await seoWriter.inspect(Number(job.wordpressObjectId))
    : null;
  const yoastWriteSupported = seoCapability?.ready === true;
  const seoReady = Boolean(
    seo.focusKeyphrase
    && seo.seoTitle
    && seo.metaDescription
    && yoastWriteSupported
  );
  const ready = siteGuard.allowed && productGuard.allowed && jobGateReasons.length === 0 && exactIdentity && collisionFree && content.ready && content.wordCount >= 1500 && featuredMediaId > 0 && seoReady;

  return {
    ready,
    site,
    product,
    job,
    page,
    authority,
    seoWriter,
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
      seo: {
        ready: seoReady,
        yoastWriteSupported,
        reason: yoastWriteSupported
          ? null
          : "The configured site SEO endpoint does not provide authenticated GET and POST verification.",
      },
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
    exactFirstMutation: "POST only post_id, focuskw, title, and metadesc to the configured authenticated site SEO endpoint; no page fields are sent.",
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
  if (!preflight.seoWriter) {
    return NextResponse.json({ error: "Configured site SEO writer is unavailable." }, { status: 409 });
  }
  const seoWrite = await preflight.seoWriter.write(
    Number(preflight.job.wordpressObjectId),
    preflight.seo,
  );
  const seoRead = await preflight.seoWriter.read(Number(preflight.job.wordpressObjectId));
  const seoVerified = Boolean(
    seoWrite.ok
    && seoRead.ok
    && preflight.seoWriter.exact(
      seoRead.stored,
      Number(preflight.job.wordpressObjectId),
      preflight.seo,
    )
  );
  if (!seoVerified) {
    return NextResponse.json({ error: "Exact draft, content, media, or Yoast readback verification failed. Publication was not attempted." }, { status: 409 });
  }

  const published = await publishGenesisWordPressDraft({ site: preflight.site, wordpressObjectId: preflight.job.wordpressObjectId });
  if (!published.ok) return NextResponse.json({ error: published.message, state: published.state }, { status: 409 });

  const finalRead = await preflight.authority.getJson({
    path: `/pages/${preflight.job.wordpressObjectId}`,
    query: new URLSearchParams({ context: "edit", _fields: "id,slug,parent,status,link,content,featured_media,meta" }),
  });
  const finalPage = finalRead.ok && finalRead.body && typeof finalRead.body === "object" && !Array.isArray(finalRead.body)
    ? finalRead.body as ExactJobWordPressPage
    : null;
  const finalSeoRead = await preflight.seoWriter.read(Number(preflight.job.wordpressObjectId));
  const finalVerified = Boolean(
    finalPage
    && verifyExactJobPage({ page: finalPage, expectedObjectId: preflight.job.wordpressObjectId, expectedSlug: preflight.expectedSlug, expectedParentId: preflight.expectedParentId, expectedStatus: "publish" })
    && finalPage.content?.raw === originalContent
    && finalPage.featured_media === originalFeaturedMedia
    && finalSeoRead.ok
    && preflight.seoWriter.exact(finalSeoRead.stored, Number(preflight.job.wordpressObjectId), preflight.seo)
  );
  if (!finalVerified) {
    return NextResponse.json({ error: "Published WordPress identity, content, media, or Yoast verification failed. Execution state was not transitioned." }, { status: 409 });
  }

  const canonicalUrl = new URL(`/${preflight.job.slug}/`, preflight.site.canonicalUrl ?? `https://${preflight.site.domain}`).toString();
  let publicResponse: Response;
  try {
    publicResponse = await fetch(canonicalUrl, {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return NextResponse.json({ error: "Canonical public URL verification failed. Execution state was not transitioned." }, { status: 409 });
  }
  if (!publicResponse.ok || new URL(publicResponse.url).pathname !== new URL(canonicalUrl).pathname) {
    return NextResponse.json({ error: "Canonical public URL did not resolve to the expected published path. Execution state was not transitioned." }, { status: 409 });
  }

  const verifiedAt = new Date().toISOString();
  await reconcileGlwPageExecutionPublished({
    jobId: preflight.job.jobId,
    wordpressObjectId: preflight.job.wordpressObjectId,
    wordpressUrl: canonicalUrl,
    publicationVerification: {
      verifiedAt,
      wordpressObjectId: preflight.job.wordpressObjectId,
      slug: preflight.expectedSlug,
      parentId: preflight.expectedParentId,
      status: "publish",
      featuredMediaId: originalFeaturedMedia,
      contentPreserved: true,
      yoastMetadataRetained: true,
      canonicalUrl,
      publicHttpStatus: publicResponse.status,
    },
  });
  return NextResponse.json({
    ok: true,
    jobId: preflight.job.jobId,
    seoMutation: { accepted: true, verified: true },
    prePublicationVerification: { id: preflight.job.wordpressObjectId, slug: preflight.expectedSlug, parent: preflight.expectedParentId, status: "draft", contentPreserved: true, featuredMediaId: originalFeaturedMedia },
    publicationResponse: { wordpressObjectId: published.wordpressObjectId, wordpressStatus: published.wordpressStatus, publicationPerformed: published.publicationPerformed },
    authoritativePostPublicationVerification: { id: finalPage.id, slug: finalPage.slug, parent: finalPage.parent, status: finalPage.status, featuredMediaId: finalPage.featured_media, contentPreserved: true, yoastMetadataRetained: true },
    publicCanonicalUrl: { url: canonicalUrl, httpStatus: publicResponse.status, resolvedUrl: publicResponse.url },
    persistedExecution: { wordpressStatus: "publish", wordpressUrl: canonicalUrl, publicationVerifiedAt: verifiedAt },
  });
}