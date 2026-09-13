import "server-only";

import { createHash } from "node:crypto";

import { createAuthenticatedWordPressReadAuthority, normalizeWordPressApiBaseUrl } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { getLocalPageThemingBundle, readLocalPageThemingMedia } from "@/modules/foundation/local-context-page-theming-repository";
import { getLocalThemeVisualCertification } from "@/modules/foundation/local-theme-visual-certification-repository";
import { getMarketProductMatchBundle } from "@/modules/foundation/local-market-product-match-repository";
import { getProductById } from "@/modules/foundation/product-repository";
import { getSiteById } from "@/modules/foundation/site-repository";
import { writeGenesisWordPressDraft } from "@/modules/foundation/wordpress-draft-writer";
import { createWordPressSeoWriter } from "@/modules/foundation/wordpress-seo-writer";
import { resolveWordPressCredentialReference } from "@/modules/foundation/wordpress-credential-resolver";
import { listAllGlwCampaignTargets } from "./campaign-target-repository";
import { HOUSTON_APPROVED_PREVIEW_COMMIT, HOUSTON_SEO, HOUSTON_THEME_TEMPLATE, HOUSTON_TITLE, freezeHoustonApprovedPreviewIdentity, type HoustonDraftReceipt } from "./houston-approved-preview-draft";
import { appendHoustonDraftAudit, getHoustonDraftState, persistHoustonOwnerDraftApproval, saveHoustonDraftReceipt } from "./houston-approved-preview-draft-repository";
import { hashHoustonDraftContent, renderApprovedHoustonWordPress } from "./houston-approved-preview-render";
import { HOUSTON_BUNDLE_ID, HOUSTON_CANONICAL_PATH, HOUSTON_MARKET_BUNDLE_ID, HOUSTON_PRODUCT_ID, HOUSTON_PRODUCT_MEDIA_HASH, HOUSTON_PRODUCT_MEDIA_ID, HOUSTON_PRODUCT_MEDIA_URL, HOUSTON_RENDERER_VERSION, HOUSTON_TARGET_ID } from "./houston-reference-preview";

const EXPECTED_ROLES = ["PRODUCT_AUTHORITY", "CONTEXTUAL_IN_USE", "APPLICATION_EXPERIENCE", "LOCAL_CONTEXTUAL_ATMOSPHERE"] as const;
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const auth = (username: string, password: string) => `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

async function authority() {
  const site = getSiteById("site-ssi-projectorenclosure");
  if (!site?.integrations.wordpressApiBaseUrl) throw new Error("HOUSTON_SITE_AUTHORITY_REQUIRED");
  const credential = resolveWordPressCredentialReference(site.integrations.wordpressCredentialReference);
  if (!credential) throw new Error("HOUSTON_WORDPRESS_CREDENTIAL_REQUIRED");
  const apiBaseUrl = normalizeWordPressApiBaseUrl(site.integrations.wordpressApiBaseUrl);
  return { site, apiBaseUrl, authorization: auth(credential.username, credential.applicationPassword), reader: createAuthenticatedWordPressReadAuthority({ configuration: { apiBaseUrl, username: credential.username, applicationPassword: credential.applicationPassword, timeoutMs: 30_000 } }) };
}

async function uploadMedia(input: { apiBaseUrl: string; authorization: string; bytes: Buffer; fileName: string; mimeType: string; title: string; altText: string; claimClass: string }) {
  const response = await fetch(`${input.apiBaseUrl}/media`, { method: "POST", headers: { Accept: "application/json", Authorization: input.authorization, "Content-Disposition": `attachment; filename="${input.fileName}"`, "Content-Type": input.mimeType }, body: new Uint8Array(input.bytes), cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`HOUSTON_MEDIA_UPLOAD_FAILED:${response.status}`);
  const media = await response.json() as { id?: number; source_url?: string };
  if (!media.id || !media.source_url) throw new Error("HOUSTON_MEDIA_UPLOAD_IDENTITY_INVALID");
  const metadata = await fetch(`${input.apiBaseUrl}/media/${media.id}`, { method: "POST", headers: { Accept: "application/json", Authorization: input.authorization, "Content-Type": "application/json" }, body: JSON.stringify({ title: input.title, alt_text: input.altText, description: `${input.claimClass.replaceAll("_", " ")} for the owner-approved Houston composition. Not documentary evidence of a Houston installation, customer, office, or venue relationship.`, caption: "Conceptual Genesis visualization; owner review required." }), cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!metadata.ok) throw new Error(`HOUSTON_MEDIA_METADATA_FAILED:${metadata.status}`);
  const verified = await metadata.json() as { id?: number; source_url?: string; alt_text?: string };
  if (verified.id !== media.id || verified.source_url !== media.source_url || verified.alt_text !== input.altText) throw new Error("HOUSTON_MEDIA_METADATA_MISMATCH");
  return { mediaId: media.id, url: media.source_url };
}

async function removeWordPressObject(apiBaseUrl: string, authorization: string, kind: "pages" | "media", id: number) {
  try { await fetch(`${apiBaseUrl}/${kind}/${id}?force=true`, { method: "DELETE", headers: { Accept: "application/json", Authorization: authorization }, cache: "no-store", signal: AbortSignal.timeout(30_000) }); } catch {}
}

async function verifyLinks(urls: readonly string[]) {
  const results: { url: string; status: number; ok: boolean }[] = [];
  for (const url of [...new Set(urls)]) {
    try { const response = await fetch(url, { method: "GET", redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(30_000) }); results.push({ url, status: response.status, ok: response.ok }); }
    catch { results.push({ url, status: 0, ok: false }); }
  }
  return results;
}

export async function inspectHoustonWordPressAuthority(wordpressObjectId: string, expectedStatus: "draft" = "draft") {
  if (!/^\d+$/.test(wordpressObjectId)) throw new Error("HOUSTON_WORDPRESS_OBJECT_INVALID");
  const wp = await authority();
  const response = await wp.reader.getJson({ path: `/pages/${wordpressObjectId}`, query: new URLSearchParams({ context: "edit", _fields: "id,status,slug,parent,template,link,title,excerpt,content,featured_media,meta" }) });
  if (!response.ok || !response.body || typeof response.body !== "object" || Array.isArray(response.body)) throw new Error("HOUSTON_WORDPRESS_READBACK_FAILED");
  const page = response.body as { id?: number; status?: string; slug?: string; parent?: number; template?: string; link?: string; title?: { raw?: string }; excerpt?: { raw?: string }; content?: { raw?: string; rendered?: string }; featured_media?: number; meta?: Record<string, unknown> };
  if (String(page.id) !== wordpressObjectId || page.status !== expectedStatus || page.slug !== "houston" || page.parent !== 13083) throw new Error("HOUSTON_WORDPRESS_READBACK_IDENTITY_MISMATCH");
  const raw = page.content?.raw?.trim() ?? ""; const rendered = page.content?.rendered?.trim() ?? ""; const seoWriter = createWordPressSeoWriter(wp.site); const seo = seoWriter ? await seoWriter.read(Number(wordpressObjectId)) : { ok: false, stored: null };
  return { identity: { wordpressObjectId, status: page.status, slug: page.slug, parent: page.parent, template: page.template ?? "default", link: page.link ?? "", title: page.title?.raw?.trim() ?? "" }, meta: page.meta ?? {}, body: { raw, rendered, hash: hashHoustonDraftContent(raw), h1Count: (raw.match(/<h1\b/gi) ?? []).length, links: [...raw.matchAll(/href=["']([^"']+)/gi)].map((match) => match[1]), roles: [...raw.matchAll(/data-media-role=["']([^"']+)/gi)].map((match) => match[1]) }, excerpt: page.excerpt?.raw?.trim() ?? "", featuredMediaId: Number(page.featured_media ?? 0), seo: { verified: seo.ok, stored: seo.stored, hash: hash(JSON.stringify(seo.stored)) } };
}

export async function buildHoustonDraftPreflight() {
  const local = getLocalPageThemingBundle({ organizationId: "ssi", siteId: "site-ssi-projectorenclosure", jobId: null, bundleId: HOUSTON_BUNDLE_ID });
  const market = getMarketProductMatchBundle({ organizationId: "ssi", bundleId: HOUSTON_MARKET_BUNDLE_ID });
  const visual = getLocalThemeVisualCertification(HOUSTON_BUNDLE_ID, HOUSTON_RENDERER_VERSION);
  if (!local || !market || !visual) throw new Error("HOUSTON_APPROVED_PREVIEW_AUTHORITY_MISSING");
  const identity = freezeHoustonApprovedPreviewIdentity({ local, market, visual, previewCommit: HOUSTON_APPROVED_PREVIEW_COMMIT });
  const target = listAllGlwCampaignTargets().find((item) => item.targetId === HOUSTON_TARGET_ID);
  if (!target || target.status !== "queued" || target.jobId || target.wordpressObjectId || target.canonicalPath !== HOUSTON_CANONICAL_PATH || target.productId !== HOUSTON_PRODUCT_ID || target.leaseId) throw new Error("HOUSTON_TARGET_STATE_STALE");
  const product = getProductById(HOUSTON_PRODUCT_ID); if (!product || product.media.primaryImageReference !== `wordpress-media:${HOUSTON_PRODUCT_MEDIA_ID}` || product.authorityProvenance?.authorityReference !== "wordpress-page:10541") throw new Error("HOUSTON_PRODUCT_AUTHORITY_STALE");
  const productResponse = await fetch(HOUSTON_PRODUCT_MEDIA_URL, { cache: "no-store", signal: AbortSignal.timeout(30_000) }); const productBytes = new Uint8Array(await productResponse.arrayBuffer()); if (!productResponse.ok || hash(productBytes) !== HOUSTON_PRODUCT_MEDIA_HASH) throw new Error("HOUSTON_PRODUCT_MEDIA_STALE");
  const wp = await authority();
  const parent = await wp.reader.getJson({ path: "/pages/13083", query: new URLSearchParams({ context: "edit", _fields: "id,status,slug,parent" }) });
  if (!parent.ok || !parent.body || typeof parent.body !== "object" || Array.isArray(parent.body) || (parent.body as { id?: number }).id !== 13083 || (parent.body as { slug?: string }).slug !== "texas" || (parent.body as { parent?: number }).parent !== 10541 || (parent.body as { status?: string }).status !== "draft") throw new Error("HOUSTON_TEXAS_PARENT_STALE");
  const duplicate = await wp.reader.getJson({ path: "/pages", query: new URLSearchParams({ slug: "houston", parent: "13083", status: "publish,draft,pending,private,future", context: "edit", per_page: "100", _fields: "id,status,slug,parent" }) });
  if (!duplicate.ok || !Array.isArray(duplicate.body)) throw new Error("HOUSTON_DUPLICATE_CHECK_FAILED");
  if (duplicate.body.length !== 0) throw new Error("HOUSTON_WORDPRESS_COLLISION");
  const links = await verifyLinks(local.links.links.map((item) => item.url)); if (links.some((item) => !item.ok)) throw new Error("HOUSTON_LINK_REVALIDATION_FAILED");
  for (const item of local.media.filter((media) => media.source === "GENERATED_CANDIDATE")) { const stored = readLocalPageThemingMedia({ organizationId: "ssi", siteId: "site-ssi-projectorenclosure", jobId: null, mediaId: item.mediaId }); if (!stored || hash(stored.bytes) !== item.sha256) throw new Error(`HOUSTON_APPROVED_MEDIA_STALE:${item.role}`); }
  return { local, market, visual, identity, target, product, wp, links, parentId: 13083 as const };
}

export async function applyApprovedHoustonPreviewToDraft() {
  const existing = getHoustonDraftState().receipts.at(-1); if (existing) return { receipt: existing, approval: getHoustonDraftState().approvals.find((item) => item.decisionId === existing.decisionId)!, reused: true };
  const preflight = await buildHoustonDraftPreflight(); const now = new Date().toISOString(); const approval = persistHoustonOwnerDraftApproval(preflight.identity, now).approval;
  const uploaded: HoustonDraftReceipt["uploadedMedia"] extends readonly (infer T)[] ? T[] : never[] = []; let pageId: number | null = null;
  appendHoustonDraftAudit("APPLY_STARTED", { decisionId: approval.decisionId, targetId: HOUSTON_TARGET_ID }, now);
  try {
    for (const role of ["CONTEXTUAL_IN_USE", "APPLICATION_EXPERIENCE", "LOCAL_CONTEXTUAL_ATMOSPHERE"] as const) {
      const expected = preflight.local.media.find((item) => item.role === role)!; const stored = readLocalPageThemingMedia({ organizationId: "ssi", siteId: "site-ssi-projectorenclosure", jobId: null, mediaId: expected.mediaId }); if (!stored || hash(stored.bytes) !== expected.sha256) throw new Error(`HOUSTON_APPROVED_MEDIA_STALE:${role}`);
      const created = await uploadMedia({ apiBaseUrl: preflight.wp.apiBaseUrl, authorization: preflight.wp.authorization, bytes: stored.bytes, fileName: `houston-${role.toLowerCase().replaceAll("_", "-")}-${expected.sha256.slice(0, 12)}.jpg`, mimeType: expected.mimeType, title: expected.altText, altText: expected.altText, claimClass: expected.claimClass });
      uploaded.push({ role, mediaId: created.mediaId, url: created.url, sha256: expected.sha256, claimClass: expected.claimClass }); appendHoustonDraftAudit("MEDIA_UPLOADED", { role, mediaId: created.mediaId, sha256: expected.sha256 }, new Date().toISOString());
    }
    const mediaUrls = { PRODUCT_AUTHORITY: HOUSTON_PRODUCT_MEDIA_URL, CONTEXTUAL_IN_USE: uploaded.find((item) => item.role === "CONTEXTUAL_IN_USE")!.url, APPLICATION_EXPERIENCE: uploaded.find((item) => item.role === "APPLICATION_EXPERIENCE")!.url, LOCAL_CONTEXTUAL_ATMOSPHERE: uploaded.find((item) => item.role === "LOCAL_CONTEXTUAL_ATMOSPHERE")!.url };
    const html = renderApprovedHoustonWordPress({ local: preflight.local, market: preflight.market, mediaUrls });
    if ((html.match(/<h1\b/gi) ?? []).length !== 1 || /(?:localhost|127\.0\.0\.1|:3003|\/glw\/)/i.test(html)) throw new Error("HOUSTON_DRAFT_CONTENT_SAFETY_FAILED");
    const result = await writeGenesisWordPressDraft({ operation: "CREATE", site: preflight.wp.site, artifact: { title: HOUSTON_TITLE, slug: HOUSTON_CANONICAL_PATH, excerpt: "Fan-cooled projector enclosure planning for Houston indoor, covered, and mild-environment commercial AV applications.", contentHtml: html, parentId: 13083, seo: HOUSTON_SEO } });
    if (!result.ok) throw new Error(`HOUSTON_WORDPRESS_CREATE_FAILED:${result.state}`); pageId = Number(result.wordpressObjectId);
    const integrate = await fetch(`${preflight.wp.apiBaseUrl}/pages/${pageId}`, { method: "POST", headers: { Accept: "application/json", Authorization: preflight.wp.authorization, "Content-Type": "application/json" }, body: JSON.stringify({ status: "draft", template: HOUSTON_THEME_TEMPLATE, featured_media: HOUSTON_PRODUCT_MEDIA_ID, meta: { _elementor_page_settings: { hide_title: "yes" } } }), cache: "no-store", signal: AbortSignal.timeout(30_000) });
    if (!integrate.ok) throw new Error(`HOUSTON_THEME_INTEGRATION_WRITE_FAILED:${integrate.status}`);
    const seoWriter = createWordPressSeoWriter(preflight.wp.site); if (!seoWriter) throw new Error("HOUSTON_SEO_WRITER_UNAVAILABLE"); const seoWrite = await seoWriter.write(pageId, HOUSTON_SEO); if (!seoWrite.ok) throw new Error("HOUSTON_SEO_WRITE_FAILED");
    const after = await inspectHoustonWordPressAuthority(String(pageId)); const settings = after.meta._elementor_page_settings as { hide_title?: string } | undefined;
    const expectedLinks = preflight.local.links.links.map((item) => item.url); const roles = [...new Set(after.body.roles)].sort();
    if (after.identity.status !== "draft" || after.identity.title !== HOUSTON_TITLE || after.identity.slug !== "houston" || after.identity.parent !== 13083 || after.identity.template !== HOUSTON_THEME_TEMPLATE || settings?.hide_title !== "yes" || after.featuredMediaId !== HOUSTON_PRODUCT_MEDIA_ID || after.body.hash !== hashHoustonDraftContent(html) || after.body.h1Count !== 1 || JSON.stringify(roles) !== JSON.stringify([...EXPECTED_ROLES].sort()) || !expectedLinks.every((item) => after.body.links.includes(item)) || !after.seo.verified || !seoWriter.exact(after.seo.stored, pageId, HOUSTON_SEO)) throw new Error("HOUSTON_DRAFT_READBACK_MISMATCH");
    const receipt: HoustonDraftReceipt = { receiptId: `houston-draft-${approval.decisionId}`, decisionId: approval.decisionId, contract: "houston-approved-preview-to-wordpress-draft-v1", wordpressObjectId: String(pageId), wordpressStatus: "draft", title: HOUSTON_TITLE, slug: "houston", parentId: 13083, canonicalPath: HOUSTON_CANONICAL_PATH, bodyHash: after.body.hash, seoHash: after.seo.hash, featuredMediaId: HOUSTON_PRODUCT_MEDIA_ID, template: HOUSTON_THEME_TEMPLATE, hideTitle: "yes", uploadedMedia: uploaded.map((item) => ({ ...item })), createdAt: new Date().toISOString(), schedulerInvoked: false, dispatchPerformed: false, leaseCreated: false, jobCreated: false, executionCreated: false, publicationPerformed: false, campaignMutationPerformed: false };
    appendHoustonDraftAudit("READBACK_VERIFIED", { wordpressObjectId: String(pageId), bodyHash: after.body.hash, seoHash: after.seo.hash, duplicateCount: 1 }, receipt.createdAt); return { receipt: saveHoustonDraftReceipt(receipt), approval, reused: false };
  } catch (error) {
    if (pageId) await removeWordPressObject(preflight.wp.apiBaseUrl, preflight.wp.authorization, "pages", pageId); for (const item of uploaded) await removeWordPressObject(preflight.wp.apiBaseUrl, preflight.wp.authorization, "media", item.mediaId); appendHoustonDraftAudit("APPLY_FAILED_ROLLED_BACK", { reason: error instanceof Error ? error.message.split(":")[0] : "UNKNOWN", pageDeleted: Boolean(pageId), mediaDeleted: uploaded.length }, new Date().toISOString()); throw error;
  }
}
