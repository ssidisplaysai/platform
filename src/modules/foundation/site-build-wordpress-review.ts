import "server-only";

import { createHash } from "node:crypto";
import { createAuthenticatedWordPressReadAuthority, normalizeWordPressApiBaseUrl, type AuthenticatedWordPressReadAuthority } from "./authenticated-wordpress-read-authority";
import { getSiteBuildWorkspace } from "./site-build-service";
import { resolveWordPressCredentialReference } from "./wordpress-credential-resolver";
import type { SiteConfiguration } from "./types";

type WordPressDraft = {
  id?: number; slug?: string; status?: string; link?: string; modified_gmt?: string; featured_media?: number;
  title?: { raw?: string; rendered?: string }; content?: { raw?: string; rendered?: string }; meta?: Record<string, unknown>;
};

export type SiteBuildWordPressDraftReviewItem = {
  pageId: string; pageRevisionId: string; pageName: string; canonicalPath: string; expectedSlug: string; wordpressObjectId: string;
  wordpressStatus: string | null; wordpressTitle: string | null; wordpressModifiedAt: string | null; synchronizedAt: string | null;
  updateResult: "SUCCESS" | "MISSING_RECEIPT"; identityMatch: boolean; slugMatch: boolean; titleMatch: boolean; contentMatch: boolean;
  duplicateCanonicalCount: number; featuredMediaId: number; imageAttached: boolean; seoReadback: "VERIFIED" | "MISMATCH" | "NOT_EXPOSED";
  syncStatus: "VERIFIED" | "ATTENTION_REQUIRED"; wordpressReviewUrl: string | null; genesisReviewUrl: string;
};

export type SiteBuildWordPressDraftReview = {
  generatedAt: string; readOnly: true; items: SiteBuildWordPressDraftReviewItem[];
  summary: { expectedCount: number; verifiedDraftCount: number; publishedCount: number; successfulUpdateCount: number; failedUpdateCount: number; duplicateObjectCount: number; missingDraftCount: number; allObjectIdsMatchReceipts: boolean; allStatusesDraft: boolean; allCanonicalSlugsCorrect: boolean };
  media: { approvedImageCount: number; wordpressMediaObjectCount: number; imagesAttachedToPages: number; mediaSyncStillRequired: boolean };
  qa: { architectureComplete: boolean; navigationStatus: "REVIEW_ONLY"; invalidInternalLinkCount: number; orphanPageCount: number; duplicateSlugCount: number; missingDraftCount: number; seoMismatchCount: number; contentMismatchCount: number; readyForSiteQa: boolean; publicationEnabled: false };
};

function hash(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function leafSlug(value: string): string { return value.trim().replace(/^\/+|\/+$/g, "").split("/").filter(Boolean).at(-1)?.toLowerCase() ?? "home"; }
function record(value: unknown): WordPressDraft | null { return value && typeof value === "object" && !Array.isArray(value) ? value as WordPressDraft : null; }
function text(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function safeReviewUrl(apiBaseUrl: string, objectId: string): string | null { try { const origin = new URL(normalizeWordPressApiBaseUrl(apiBaseUrl)).origin; return `${origin}/wp-admin/post.php?post=${encodeURIComponent(objectId)}&action=edit`; } catch { return null; } }
async function mapLimit<T, R>(items: readonly T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> { const output = new Array<R>(items.length); let cursor = 0; await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => { while (cursor < items.length) { const index = cursor++; output[index] = await work(items[index]); } })); return output; }

export async function inspectSiteBuildWordPressDrafts(site: SiteConfiguration, suppliedAuthority?: AuthenticatedWordPressReadAuthority): Promise<SiteBuildWordPressDraftReview> {
  const workspace = getSiteBuildWorkspace(site); const assembly = workspace.currentAssembly;
  if (!workspace.session || !assembly || !workspace.pageReview.complete) throw new Error("COMPLETED_PAGE_REVIEW_REQUIRED");
  const credential = suppliedAuthority ? null : resolveWordPressCredentialReference(site.integrations.wordpressCredentialReference);
  if (!suppliedAuthority && (!credential || !site.integrations.wordpressApiBaseUrl)) throw new Error("WORDPRESS_READ_AUTHORITY_REQUIRED");
  const authority = suppliedAuthority ?? createAuthenticatedWordPressReadAuthority({ configuration: { apiBaseUrl: site.integrations.wordpressApiBaseUrl!, username: credential!.username, applicationPassword: credential!.applicationPassword, timeoutMs: 30_000 } });
  const receiptsByRevision = new Map(workspace.wordpressContentUpdates.map((item) => [item.pageRevisionId, item])); const draftsByPage = new Map(workspace.wordpressDrafts.map((item) => [item.draftId, item]));
  const items = await mapLimit(assembly.pages, 5, async (page): Promise<SiteBuildWordPressDraftReviewItem> => {
    const receipt = receiptsByRevision.get(page.pageRevisionId); const draft = draftsByPage.get(`${page.pageId}-draft`); const objectId = receipt?.wordpressObjectId ?? draft?.wordpressObjectId ?? ""; const expectedSlug = leafSlug(page.slug || "home");
    const exactRead = objectId ? await authority.getJson({ path: `/pages/${objectId}`, query: new URLSearchParams({ context: "edit", _fields: "id,slug,status,link,modified_gmt,featured_media,title,content,meta" }) }) : null;
    const live = exactRead?.ok ? record(exactRead.body) : null;
    const duplicateRead = await authority.getJson({ path: "/pages", query: new URLSearchParams({ slug: expectedSlug, context: "edit", status: "any", per_page: "100", _fields: "id,slug,status" }) });
    const exactSlugObjects = duplicateRead.ok && Array.isArray(duplicateRead.body) ? duplicateRead.body.map(record).filter((item): item is WordPressDraft => Boolean(item && leafSlug(text(item.slug)) === expectedSlug)) : [];
    const liveTitle = text(live?.title?.raw ?? live?.title?.rendered); const liveContent = text(live?.content?.raw ?? live?.content?.rendered); const featuredMediaId = Number(live?.featured_media ?? 0); const imageAttached = featuredMediaId > 0 || /<img\b/i.test(liveContent);
    const expectedMeta = { _yoast_wpseo_focuskw: page.h1, _yoast_wpseo_title: page.seoTitle, _yoast_wpseo_metadesc: page.metaDescription }; const exposedMeta = live?.meta && Object.keys(expectedMeta).some((key) => key in live.meta); const seoReadback = !exposedMeta ? "NOT_EXPOSED" as const : Object.entries(expectedMeta).every(([key, value]) => live?.meta?.[key] === value) ? "VERIFIED" as const : "MISMATCH" as const;
    const identityMatch = Boolean(live && String(live.id ?? "") === objectId && receipt && draft && receipt.wordpressObjectId === draft.wordpressObjectId); const slugMatch = leafSlug(text(live?.slug)) === expectedSlug; const titleMatch = liveTitle === page.name; const contentMatch = Boolean(liveContent && hash(liveContent) === hash(page.contentHtml.trim())); const status = text(live?.status) || null; const syncStatus = receipt && identityMatch && slugMatch && titleMatch && contentMatch && status === "draft" && exactSlugObjects.length === 1 ? "VERIFIED" as const : "ATTENTION_REQUIRED" as const;
    return { pageId: page.pageId, pageRevisionId: page.pageRevisionId, pageName: page.name, canonicalPath: page.canonicalPath, expectedSlug, wordpressObjectId: objectId, wordpressStatus: status, wordpressTitle: liveTitle || null, wordpressModifiedAt: text(live?.modified_gmt) || null, synchronizedAt: receipt?.updatedAt ?? null, updateResult: receipt ? "SUCCESS" : "MISSING_RECEIPT", identityMatch, slugMatch, titleMatch, contentMatch, duplicateCanonicalCount: Math.max(0, exactSlugObjects.length - 1), featuredMediaId, imageAttached, seoReadback, syncStatus, wordpressReviewUrl: site.integrations.wordpressApiBaseUrl && objectId ? safeReviewUrl(site.integrations.wordpressApiBaseUrl, objectId) : null, genesisReviewUrl: `/sites/${encodeURIComponent(site.siteId)}/build/pages?organizationId=${encodeURIComponent(site.organizationId)}&siteId=${encodeURIComponent(site.siteId)}#${encodeURIComponent(page.pageId)}` };
  });
  const paths = new Set(assembly.pages.map((page) => page.canonicalPath)); const inbound = new Map(assembly.pages.map((page) => [page.pageId, 0])); for (const page of assembly.pages) for (const link of page.internalLinks) if (inbound.has(link.targetPageId)) inbound.set(link.targetPageId, (inbound.get(link.targetPageId) ?? 0) + 1);
  const invalidInternalLinkCount = assembly.pages.flatMap((page) => page.internalLinks).filter((link) => !paths.has(link.href)).length; const orphanPageCount = assembly.pages.filter((page) => page.canonicalPath !== "/" && (inbound.get(page.pageId) ?? 0) === 0).length; const localDuplicateSlugs = assembly.pages.length - new Set(assembly.pages.map((page) => leafSlug(page.slug || "home"))).size; const duplicateSlugCount = localDuplicateSlugs + items.reduce((total, item) => total + item.duplicateCanonicalCount, 0);
  const approvedImageCount = assembly.pages.reduce((count, page) => count + page.imageRequirements.length, 0); const wordpressMediaObjectCount = new Set(items.map((item) => item.featuredMediaId).filter((id) => id > 0)).size; const imagesAttachedToPages = items.filter((item) => item.imageAttached).length; const verifiedDraftCount = items.filter((item) => item.syncStatus === "VERIFIED").length; const publishedCount = items.filter((item) => item.wordpressStatus === "publish").length; const missingDraftCount = items.filter((item) => !item.wordpressStatus).length; const failedUpdateCount = items.filter((item) => item.updateResult !== "SUCCESS").length; const duplicateObjectCount = items.length - new Set(items.map((item) => item.wordpressObjectId).filter(Boolean)).size;
  const summary = { expectedCount: assembly.pages.length, verifiedDraftCount, publishedCount, successfulUpdateCount: items.length - failedUpdateCount, failedUpdateCount, duplicateObjectCount, missingDraftCount, allObjectIdsMatchReceipts: items.every((item) => item.identityMatch), allStatusesDraft: items.every((item) => item.wordpressStatus === "draft"), allCanonicalSlugsCorrect: items.every((item) => item.slugMatch) };
  const media = { approvedImageCount, wordpressMediaObjectCount, imagesAttachedToPages, mediaSyncStillRequired: approvedImageCount > 0 && imagesAttachedToPages < approvedImageCount };
  const seoMismatchCount = items.filter((item) => item.seoReadback === "MISMATCH").length; const contentMismatchCount = items.filter((item) => !item.contentMatch || !item.titleMatch).length; const architectureComplete = items.length === assembly.pages.length && missingDraftCount === 0;
  return { generatedAt: new Date().toISOString(), readOnly: true, items, summary, media, qa: { architectureComplete, navigationStatus: "REVIEW_ONLY", invalidInternalLinkCount, orphanPageCount, duplicateSlugCount, missingDraftCount, seoMismatchCount, contentMismatchCount, readyForSiteQa: architectureComplete && verifiedDraftCount === items.length && publishedCount === 0 && invalidInternalLinkCount === 0 && orphanPageCount === 0 && duplicateSlugCount === 0 && contentMismatchCount === 0, publicationEnabled: false } };
}