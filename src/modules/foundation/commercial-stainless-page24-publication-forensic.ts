import "server-only";

import { createHash } from "node:crypto";

import { normalizeWordPressApiBaseUrl } from "./authenticated-wordpress-read-authority";
import { COMMERCIAL_STAINLESS_ORIGIN, COMMERCIAL_STAINLESS_SITE_ID } from "./commercial-stainless-rich-composition";
import { listCommercialStainlessWordPressPublicationReceipts } from "./commercial-stainless-wordpress-publication";
import { listCommercialStainlessWordPressStageRecords } from "./commercial-stainless-wordpress-staging";
import type { SiteConfiguration } from "./types";
import { resolveWordPressCredentialReference } from "./wordpress-credential-resolver";

type WordPressDocument = {
  id?: number;
  parent?: number;
  status?: string;
  slug?: string;
  link?: string;
  template?: string;
  featured_media?: number;
  date_gmt?: string;
  modified_gmt?: string;
  title?: { raw?: string; rendered?: string };
  content?: { raw?: string; rendered?: string };
  meta?: Record<string, unknown>;
  yoast_head_json?: { title?: string; description?: string; canonical?: string; robots?: Record<string, string> };
};

const PAGE_ID = 24;
const AUTOSAVE_ID = 88;
const PUBLIC_URL = `${COMMERCIAL_STAINLESS_ORIGIN}/request-a-quote/`;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function authorization(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

function authority(site: SiteConfiguration) {
  if (site.siteId !== COMMERCIAL_STAINLESS_SITE_ID || site.organizationId !== "rj-metal" || site.domain !== "commercialstainlesscounters.com") throw new Error("COMMERCIAL_STAINLESS_FORENSIC_SCOPE_MISMATCH");
  const credential = resolveWordPressCredentialReference(site.integrations.wordpressCredentialReference);
  if (!credential || !site.integrations.wordpressApiBaseUrl) throw new Error("COMMERCIAL_STAINLESS_FORENSIC_AUTHORITY_REQUIRED");
  return {
    apiBase: normalizeWordPressApiBaseUrl(site.integrations.wordpressApiBaseUrl),
    headers: { Accept: "application/json", Authorization: authorization(credential.username, credential.applicationPassword), "Cache-Control": "no-cache, no-store", Pragma: "no-cache" },
  };
}

async function getJson<T>(url: string, headers: Record<string, string>): Promise<{ status: number; body: T | null }> {
  const response = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(30_000) });
  return { status: response.status, body: response.ok ? await response.json() as T : null };
}

function mainHtml(html: string): string {
  return html.match(/<main\b[^>]*>[\s\S]*?<\/main>/i)?.[0] ?? "";
}

function shellHtml(html: string): string {
  const header = html.match(/<header\b[^>]*>[\s\S]*?<\/header>/i)?.[0] ?? "";
  const footer = html.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/i)?.[0] ?? "";
  return `${header}\n${footer}`;
}

function compositionEvidence(raw: string, rendered: string) {
  const combined = `${raw}\n${rendered}`;
  return {
    h1Count: (rendered.match(/<h1\b/gi) ?? []).length,
    markers: ["wr-page", "wr-hero", "wr-related", "wp:html"].filter((marker) => combined.includes(marker)),
    legacyMarkerPresent: /class=["']gvs-page\b/i.test(combined),
    bodyNavigationCount: (rendered.match(/<nav\b/gi) ?? []).length,
    largeMinHeightPixels: [...combined.matchAll(/min-height:\s*(\d+)px/gi)].map((match) => Number(match[1])).filter((value) => value >= 500),
    mediaReferences: [...new Set([...combined.matchAll(/<img\b[^>]+src=["']([^"']+)/gi)].map((match) => match[1]))],
    contentLength: raw.length,
  };
}

function summarizeDocument(document: WordPressDocument | null) {
  const raw = text(document?.content?.raw);
  const rendered = text(document?.content?.rendered);
  return {
    id: Number(document?.id ?? 0),
    parent: Number(document?.parent ?? 0),
    status: text(document?.status),
    slug: text(document?.slug),
    link: text(document?.link),
    template: text(document?.template),
    featuredMediaId: Number(document?.featured_media ?? 0),
    dateGmt: text(document?.date_gmt),
    modifiedGmt: text(document?.modified_gmt),
    rawHash: sha256(raw),
    renderedHash: sha256(rendered),
    ...compositionEvidence(raw, rendered),
    metaKeys: Object.keys(document?.meta ?? {}).sort(),
    elementorMetaKeys: Object.keys(document?.meta ?? {}).filter((key) => /elementor/i.test(key)).sort(),
  };
}

async function publicRead() {
  const response = await fetch(`${PUBLIC_URL}?_forensic=${crypto.randomUUID()}`, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache, no-store", Pragma: "no-cache" },
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  const html = response.ok ? await response.text() : "";
  const main = mainHtml(html);
  return {
    status: response.status,
    mainHash: sha256(main),
    documentHash: sha256(html),
    shellHash: sha256(shellHtml(html)),
    h1Count: (html.match(/<h1\b/gi) ?? []).length,
    globalHeaderCount: (html.match(/<header\b/gi) ?? []).length,
    bodyNavigationCount: (main.match(/<nav\b/gi) ?? []).length,
    duplicateBodyHeader: /<header\b/i.test(main),
    expectedPageIdentityPresent: /class=["']wr-page\b/i.test(main),
    legacyNarrowComposition: /class=["']gvs-page\b/i.test(main),
    globalFooterPresent: /<footer\b/i.test(html),
    canonical: text(html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1]),
    cacheHeaders: {
      age: response.headers.get("age"),
      cacheControl: response.headers.get("cache-control"),
      cfCacheStatus: response.headers.get("cf-cache-status"),
      xCache: response.headers.get("x-cache"),
      xCacheStatus: response.headers.get("x-cache-status"),
      server: response.headers.get("server"),
      date: response.headers.get("date"),
    },
  };
}

export async function inspectCommercialStainlessPage24PublicationFailure(site: SiteConfiguration) {
  const resolved = authority(site);
  const stage = listCommercialStainlessWordPressStageRecords().find((record) => record.wordpressObjectId === PAGE_ID);
  const receipt = listCommercialStainlessWordPressPublicationReceipts().find((record) => record.wordpressObjectId === PAGE_ID);
  if (!stage || !receipt) throw new Error("COMMERCIAL_STAINLESS_PAGE24_FORENSIC_EVIDENCE_MISSING");
  const [autosave, page, revisions, ...publicReads] = await Promise.all([
    getJson<WordPressDocument>(`${resolved.apiBase}/pages/${PAGE_ID}/autosaves/${AUTOSAVE_ID}?context=edit&_fields=id,parent,status,date_gmt,modified_gmt,title,content,featured_media&_forensic=${crypto.randomUUID()}`, resolved.headers),
    getJson<WordPressDocument>(`${resolved.apiBase}/pages/${PAGE_ID}?context=edit&_fields=id,status,slug,link,template,featured_media,title,content,meta,yoast_head_json&_forensic=${crypto.randomUUID()}`, resolved.headers),
    getJson<WordPressDocument[]>(`${resolved.apiBase}/pages/${PAGE_ID}/revisions?context=edit&per_page=100&_fields=id,parent,status,date_gmt,modified_gmt,title,content,featured_media&_forensic=${crypto.randomUUID()}`, resolved.headers),
    publicRead(),
    publicRead(),
    publicRead(),
  ]);
  const autosaveSummary = summarizeDocument(autosave.body);
  const pageSummary = summarizeDocument(page.body);
  const revisionSummaries = (Array.isArray(revisions.body) ? revisions.body : []).map(summarizeDocument);
  const promotedRevisionCandidates = revisionSummaries.filter((revision) => revision.rawHash === stage.stagedContentHash);
  const rollbackRevisionCandidates = revisionSummaries.filter((revision) => revision.rawHash === receipt.rollbackAuthority.contentHash);
  const currentRobots = Object.values(page.body?.yoast_head_json?.robots ?? {}).join(",");
  const currentPublic = publicReads[0];
  const currentSafe = page.status === 200 && pageSummary.id === PAGE_ID && pageSummary.status === "publish" && pageSummary.slug === "request-a-quote" && pageSummary.link === PUBLIC_URL && pageSummary.rawHash === receipt.rollbackAuthority.contentHash && currentPublic.status === 200 && currentPublic.mainHash === receipt.prePublication.publicDocumentHash && currentPublic.canonical === receipt.prePublication.canonical && text(page.body?.yoast_head_json?.title) === receipt.prePublication.seoTitle && text(page.body?.yoast_head_json?.description) === receipt.prePublication.metaDescription && currentRobots === receipt.prePublication.indexability && pageSummary.featuredMediaId === receipt.prePublication.featuredMediaId;
  return {
    readOnly: true,
    mutationPerformed: false,
    wordpressObjectId: PAGE_ID,
    reviewedAutosaveId: AUTOSAVE_ID,
    receipt: {
      receiptId: receipt.receiptId,
      status: receipt.status,
      blockerLabels: receipt.blockers,
      authorizedAt: receipt.authorizedAt,
      rolledBackAt: receipt.updatedAt,
      prePublicationContentHash: receipt.prePublication.contentHash,
      prePublicationPublicHash: receipt.prePublication.publicDocumentHash,
      expectedReviewedAutosaveHash: stage.stagedContentHash,
      expectedReviewedRenderedHash: stage.stagedRenderedHash,
      failedPublicRenderHash: receipt.postPublicationHash,
      failedAssertionDetailPersisted: false,
    },
    autosave: { httpStatus: autosave.status, ...autosaveSummary, matchesOwnerReviewedRaw: autosaveSummary.rawHash === stage.stagedContentHash, matchesOwnerReviewedRendered: autosaveSummary.renderedHash === stage.stagedRenderedHash },
    currentPage: { httpStatus: page.status, ...pageSummary, seoTitle: text(page.body?.yoast_head_json?.title), metaDescription: text(page.body?.yoast_head_json?.description), canonical: currentPublic.canonical, indexability: currentRobots },
    revisions: { httpStatus: revisions.status, count: revisionSummaries.length, items: revisionSummaries, promotedRevisionCandidates, rollbackRevisionCandidates },
    publicReads,
    currentSafe,
    cacheReadsStable: new Set(publicReads.map((read) => read.mainHash)).size === 1,
    authorityMap: {
      stagedAuthority: `wp_posts autosave revision ${AUTOSAVE_ID} content.raw/content.rendered`,
      promotionAuthority: `POST ${resolved.apiBase}/pages/${PAGE_ID} with JSON content only`,
      storedPublishedAuthority: `wp_posts post ${PAGE_ID} post_content`,
      publicRenderAuthority: "WordPress block rendering of post 24 post_content inside Twenty Twenty-Five page template plus site-scoped render filters",
      pageTemplate: pageSummary.template || "default",
      featuredMediaId: pageSummary.featuredMediaId,
      elementorEvidence: pageSummary.elementorMetaKeys.length > 0 || autosaveSummary.elementorMetaKeys.length > 0,
      reusableBlockReferences: [...new Set([...text(autosave.body?.content?.raw).matchAll(/<!--\s*wp:block\s+\{[^}]*"ref"\s*:\s*(\d+)/gi)].map((match) => Number(match[1])))],
    },
    promotionPath: {
      exactRevisionEndpointUsed: false,
      source: `autosave ${AUTOSAVE_ID} content.raw`,
      destination: `page ${PAGE_ID} content field`,
      requestPayloadContentHash: sha256(text(autosave.body?.content?.raw)),
      fieldsCopied: ["content"],
      fieldsOmitted: ["status", "slug", "title", "excerpt", "featured_media", "meta", "template"],
      contentReconstructed: false,
      clientTransformation: "trim leading and trailing whitespace via text() before hashing and POST",
      wordpressTransformationDetected: promotedRevisionCandidates.length === 0,
    },
  };
}