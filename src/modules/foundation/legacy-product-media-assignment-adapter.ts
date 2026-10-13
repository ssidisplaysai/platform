import "server-only";

import { createHash } from "node:crypto";
import { createAuthenticatedWordPressReadAuthority } from "./authenticated-wordpress-read-authority";
import { getProductById } from "./product-repository";
import { listSitePageMediaAssignments, saveSitePageMediaAssignment, type SitePageMediaAssignment } from "./site-page-media-assignment";
import { getSiteById } from "./site-repository";
import { resolveWordPressCredentialReference } from "./wordpress-credential-resolver";

type WordPressMedia = { id?: number; source_url?: string; mime_type?: string; alt_text?: string; title?: { rendered?: string }; description?: { rendered?: string }; media_details?: { width?: number; height?: number } };
const text = (value: unknown) => typeof value === "string" ? value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";

export async function adaptApprovedLegacyProductMedia(input: { organizationId: string; siteId: string; productId: string; buildSessionId: string; pageId: string; pageRevisionId: string; slotId: string; actor: string; fetcher?: typeof fetch }): Promise<{ assignment: SitePageMediaAssignment; reused: boolean; media: { mediaId: number; url: string; mimeType: string; width: number; height: number; sha256: string }; authority: { productId: string; sourceType: string; authorityReference: string } }> {
  const product = getProductById(input.productId); const site = getSiteById(input.siteId);
  if (!product || !site || product.organizationId !== input.organizationId || site.organizationId !== input.organizationId || !product.assignedSiteIds.includes(site.siteId) || !product.enabled || product.catalogStatus !== "ready") throw new Error("LEGACY_PRODUCT_MEDIA_SCOPE_MISMATCH");
  if (product.authorityProvenance?.sourceType !== "OWNER_APPROVED_CANONICAL_PRODUCT" || !product.authorityProvenance.authorityReference) throw new Error("LEGACY_PRODUCT_MEDIA_NOT_APPROVED");
  const reference = product.media.primaryImageReference?.trim() ?? ""; const match = /^wordpress-media:(\d+)$/.exec(reference); if (!match) throw new Error("LEGACY_PRODUCT_MEDIA_REFERENCE_INVALID");
  const mediaId = Number(match[1]); const credential = resolveWordPressCredentialReference(site.integrations.wordpressCredentialReference);
  if (!credential || !site.integrations.wordpressApiBaseUrl) throw new Error("LEGACY_PRODUCT_MEDIA_WORDPRESS_AUTHORITY_REQUIRED");
  const authority = createAuthenticatedWordPressReadAuthority({ configuration: { apiBaseUrl: site.integrations.wordpressApiBaseUrl, username: credential.username, applicationPassword: credential.applicationPassword, timeoutMs: 30_000 } });
  const read = await authority.getJson({ path: `/media/${mediaId}`, query: new URLSearchParams({ context: "edit", _fields: "id,source_url,mime_type,alt_text,title,description,media_details" }) });
  if (!read.ok || !read.body || typeof read.body !== "object" || Array.isArray(read.body)) throw new Error("LEGACY_PRODUCT_MEDIA_READ_FAILED");
  const media = read.body as WordPressMedia; const url = new URL(text(media.source_url)); const expectedHost = site.domain?.replace(/^www\./, "");
  if (media.id !== mediaId || url.protocol !== "https:" || url.hostname.replace(/^www\./, "") !== expectedHost || !/^image\/(?:jpeg|png|webp)$/.test(text(media.mime_type)) || !Number.isSafeInteger(media.media_details?.width) || !Number.isSafeInteger(media.media_details?.height) || Number(media.media_details?.width) < 1 || Number(media.media_details?.height) < 1) throw new Error("LEGACY_PRODUCT_MEDIA_IDENTITY_MISMATCH");
  const altText = text(media.alt_text); const title = text(media.title?.rendered); const description = text(media.description?.rendered);
  if (!altText || !title || !description) throw new Error("LEGACY_PRODUCT_MEDIA_ACCESSIBILITY_METADATA_REQUIRED");
  const response = await (input.fetcher ?? fetch)(url.toString(), { method: "GET", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30_000) });
  if (!response.ok || response.url && new URL(response.url).origin !== url.origin) throw new Error("LEGACY_PRODUCT_MEDIA_BINARY_READ_FAILED");
  const bytes = Buffer.from(await response.arrayBuffer()); if (bytes.length < 1 || bytes.length > 20_000_000) throw new Error("LEGACY_PRODUCT_MEDIA_BINARY_INVALID"); const sha256 = createHash("sha256").update(bytes).digest("hex");
  const existing = listSitePageMediaAssignments({ organizationId: input.organizationId, siteId: input.siteId, buildSessionId: input.buildSessionId, pageRevisionId: input.pageRevisionId }).find((item) => item.slotId === input.slotId) ?? null;
  if (existing) { if (existing.role !== "PRODUCT_AUTHORITY" || existing.asset.type !== "APPROVED_EXISTING" || existing.asset.authorityReference !== reference || existing.asset.productId !== product.productId || existing.asset.wordpressMediaId !== mediaId || existing.asset.sha256 !== sha256) throw new Error("LEGACY_PRODUCT_MEDIA_ASSIGNMENT_COLLISION"); return { assignment: existing, reused: true, media: { mediaId, url: url.toString(), mimeType: text(media.mime_type), width: Number(media.media_details?.width), height: Number(media.media_details?.height), sha256 }, authority: { productId: product.productId, sourceType: product.authorityProvenance.sourceType, authorityReference: product.authorityProvenance.authorityReference } }; }
  const assignment = saveSitePageMediaAssignment({ organizationId: input.organizationId, siteId: input.siteId, buildSessionId: input.buildSessionId, pageId: input.pageId, pageRevisionId: input.pageRevisionId, slotId: input.slotId, role: "PRODUCT_AUTHORITY", asset: { type: "APPROVED_EXISTING", authorityReference: reference, productId: product.productId, wordpressMediaId: mediaId, url: url.toString(), sha256 }, metadata: { altText, caption: null, title, description }, approval: { candidateId: `${product.productId}:${reference}`, approvedBy: input.actor, approvedAt: product.authorityProvenance.normalizedAt }, wordpressReceipt: null });
  return { assignment, reused: false, media: { mediaId, url: url.toString(), mimeType: text(media.mime_type), width: Number(media.media_details?.width), height: Number(media.media_details?.height), sha256 }, authority: { productId: product.productId, sourceType: product.authorityProvenance.sourceType, authorityReference: product.authorityProvenance.authorityReference } };
}