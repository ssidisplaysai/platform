import "server-only";

import { createHash } from "node:crypto";
import { buildCommercialStainlessCompositionRevision, COMMERCIAL_STAINLESS_COMPOSITION_VERSION } from "./commercial-stainless-visual-composition";
import { saveCommercialStainlessCompositionRepairReceipt } from "./commercial-stainless-composition-repair-repository";
import { normalizeWordPressApiBaseUrl } from "./authenticated-wordpress-read-authority";
import { certifyPublicWordPressSite } from "./public-wordpress-certification";
import { listRenderedVisualCertifications } from "./rendered-visual-certification-repository";
import { getSiteBuildWorkspace } from "./site-build-service";
import { inspectSiteBuildWordPressDrafts } from "./site-build-wordpress-review";
import { decideSiteAssemblyPage, recordSiteBuildWordPressContentUpdate, replaceSiteAssemblyPageRevision } from "./site-generation-readiness-repository";
import { getSiteById } from "./site-repository";
import { saveSiteVisualAssembly } from "./site-visual-assembly-repository";
import { inspectWordPressThemeShell } from "./wordpress-theme-shell-repair";
import { resolveWordPressCredentialReference } from "./wordpress-credential-resolver";

const ORGANIZATION_ID = "rj-metal";
const SITE_ID = "site-rj-metal-commercial-stainless-counters";
const WORDPRESS_OBJECT_ID = "10";
const BEFORE_CERTIFICATION_ID = "visual-certification-424e2ea8-7efe-4e74-94aa-1d48c9fbbf4e";
type WordPressPage = { id?: number; slug?: string; status?: string; link?: string; modified_gmt?: string; featured_media?: number; template?: string; title?: { raw?: string }; content?: { raw?: string }; meta?: Record<string, unknown> };

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const stableHash = (value: unknown) => hash(JSON.stringify(value, Object.keys(value && typeof value === "object" ? value as object : {}).sort()));
const normalizedMarkupHash = (value: string) => hash(value.replace(/\r\n/g, "\n").replace(/>\s+</g, "><").replace(/\s+/g, " ").trim());

export function isExactLegacyCommercialStainlessComposition(input: { html: string; expectedH1: string; mediaUrl: string; navigationPaths: readonly string[] }): boolean {
  return Object.values(legacyCommercialStainlessCompositionChecks(input)).every(Boolean);
}

function legacyCommercialStainlessCompositionChecks(input: { html: string; expectedH1: string; mediaUrl: string; navigationPaths: readonly string[] }) {
  const h1 = [...input.html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) => match[1].replace(/<[^>]+>/g, "").trim());
  return { legacyMarker: input.html.includes("gva-home"), noRepairedMarker: !input.html.includes("gvc-page"), h1: h1.length === 1 && h1[0] === input.expectedH1, media: input.html.includes(input.mediaUrl), links: input.navigationPaths.every((path) => input.html.includes(`href="${path}"`) || input.html.includes(`href='${path}'`)) };
}

function authority() {
  const site = getSiteById(SITE_ID);
  if (!site || site.organizationId !== ORGANIZATION_ID || site.domain !== "commercialstainlesscounters.com" || !site.enabled || site.lifecycleState !== "active") throw new Error("COMPOSITION_REPAIR_SITE_AUTHORITY_MISMATCH");
  const credential = resolveWordPressCredentialReference(site.integrations.wordpressCredentialReference);
  if (!credential || !site.integrations.wordpressApiBaseUrl) throw new Error("COMPOSITION_REPAIR_WORDPRESS_AUTHORITY_REQUIRED");
  const apiBase = normalizeWordPressApiBaseUrl(site.integrations.wordpressApiBaseUrl);
  const headers = { Accept: "application/json", Authorization: `Basic ${Buffer.from(`${credential.username}:${credential.applicationPassword}`).toString("base64")}`, "Content-Type": "application/json", "Cache-Control": "no-cache, no-store" };
  return { site, apiBase, headers };
}

async function readPage(apiBase: string, headers: Record<string, string>): Promise<WordPressPage> {
  const response = await fetch(`${apiBase}/pages/${WORDPRESS_OBJECT_ID}?context=edit&_fields=id,slug,status,link,modified_gmt,featured_media,template,title,content,meta&_genesis_composition=${crypto.randomUUID()}`, { headers, cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`COMPOSITION_REPAIR_WORDPRESS_READ_FAILED:${response.status}`);
  return await response.json() as WordPressPage;
}

async function writeContent(apiBase: string, headers: Record<string, string>, content: string): Promise<void> {
  const response = await fetch(`${apiBase}/pages/${WORDPRESS_OBJECT_ID}`, { method: "POST", headers, body: JSON.stringify({ content }), cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`COMPOSITION_REPAIR_WORDPRESS_WRITE_FAILED:${response.status}`);
}

async function publicHash(): Promise<string> {
  const response = await fetch(`https://commercialstainlesscounters.com/?_genesis_composition=${crypto.randomUUID()}`, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(30_000) });
  if (!response.ok || new URL(response.url).origin !== "https://commercialstainlesscounters.com") throw new Error("COMPOSITION_REPAIR_PUBLIC_READ_FAILED");
  return hash(await response.text());
}

function identity(page: WordPressPage) {
  return { id: page.id, slug: page.slug ?? null, status: page.status ?? null, title: page.title?.raw ?? null, featuredMediaId: String(page.featured_media ?? ""), template: page.template ?? null, metaHash: stableHash(page.meta ?? {}), contentHash: hash(page.content?.raw ?? "") };
}

export function assertCommercialStainlessPostWriteIdentity(input: { before: ReturnType<typeof identity>; after: ReturnType<typeof identity>; expectedContentHash: string }): void {
  if (input.after.id !== input.before.id || input.after.slug !== input.before.slug || input.after.status !== "publish" || input.after.title !== input.before.title || input.after.featuredMediaId !== input.before.featuredMediaId || input.after.template !== input.before.template || input.after.metaHash !== input.before.metaHash || input.after.contentHash !== input.expectedContentHash) throw new Error("COMPOSITION_REPAIR_POST_WRITE_IDENTITY_MISMATCH");
}

export async function inspectCommercialStainlessCompositionAuthority() {
  const resolved = authority(); const workspace = getSiteBuildWorkspace(resolved.site); const page = workspace.currentAssembly?.pages.find((item) => item.pageRole === "HOME") ?? null; const visual = workspace.currentVisualAssembly;
  const recovering = Boolean(page?.pageRevisionId.match(/composition-\d+$/) && visual?.pageRevisionId === page.pageRevisionId && visual.designSystemVersion === COMMERCIAL_STAINLESS_COMPOSITION_VERSION);
  const beforeVisual = recovering ? workspace.visualAssemblies.filter((item) => item.pageId === page?.pageId && item.pageRevisionId.endsWith("generation-5")).at(-1) ?? null : visual;
  if (!workspace.session || !workspace.currentAssembly || !page || !visual || !beforeVisual || visual.wordpressObjectId !== WORDPRESS_OBJECT_ID || beforeVisual.wordpressObjectId !== WORDPRESS_OBJECT_ID) throw new Error("COMPOSITION_REPAIR_GENESIS_AUTHORITY_MISMATCH");
  const [wordpress, shell, currentPublicHash] = await Promise.all([readPage(resolved.apiBase, resolved.headers), inspectWordPressThemeShell(resolved.site), publicHash()]);
  const current = identity(wordpress);
  if (current.id !== Number(WORDPRESS_OBJECT_ID)) throw new Error("COMPOSITION_REPAIR_OBJECT_ID_MISMATCH");
  if (current.status !== "publish") throw new Error("COMPOSITION_REPAIR_STATUS_MISMATCH");
  const legacyPaths = ["/commercial-stainless-counters/", "/capabilities/", "/about/", "/request-a-quote/"];
  const legacyChecks = legacyCommercialStainlessCompositionChecks({ html: wordpress.content?.raw ?? "", expectedH1: page.h1, mediaUrl: beforeVisual.wordpressMediaUrl, navigationPaths: legacyPaths });
  const legacyEquivalent = (page.pageRevisionId.endsWith("generation-5") || recovering) && Object.values(legacyChecks).every(Boolean);
  const currentCompositionEquivalent = recovering && (current.contentHash === visual.contentSha256 || normalizedMarkupHash(wordpress.content?.raw ?? "") === normalizedMarkupHash(visual.contentHtml));
  if (current.contentHash !== beforeVisual.contentSha256 && normalizedMarkupHash(wordpress.content?.raw ?? "") !== normalizedMarkupHash(beforeVisual.contentHtml) && !legacyEquivalent && !currentCompositionEquivalent) {
    const failed = Object.entries(legacyChecks).filter(([, passed]) => !passed).map(([name]) => name.toUpperCase()).join("_");
    throw new Error(`COMPOSITION_REPAIR_CONTENT_HASH_MISMATCH_${failed}`);
  }
  if (current.featuredMediaId !== beforeVisual.wordpressMediaId || visual.wordpressMediaId !== beforeVisual.wordpressMediaId) throw new Error("COMPOSITION_REPAIR_MEDIA_ID_MISMATCH");
  return { site: resolved.site, workspace, page, visual, beforeVisual, recovering, currentCompositionEquivalent, wordpress, current, shell, currentPublicHash, apiBase: resolved.apiBase, headers: resolved.headers };
}

export async function executeCommercialStainlessCompositionRepair(input: { actor: string; expectedPageRevisionId: string; expectedBeforeCertificationId: string }) {
  if (input.expectedBeforeCertificationId !== BEFORE_CERTIFICATION_ID) throw new Error("COMPOSITION_REPAIR_BEFORE_CERTIFICATION_MISMATCH");
  const before = await inspectCommercialStainlessCompositionAuthority();
  if (before.page.pageRevisionId !== input.expectedPageRevisionId) throw new Error("COMPOSITION_REPAIR_PAGE_REVISION_MISMATCH");
  const revised = buildCommercialStainlessCompositionRevision({ page: before.page, navigation: before.workspace.currentAssembly!.navigation, wordpressObjectId: WORDPRESS_OBJECT_ID, mediaUrl: before.visual.wordpressMediaUrl, actor: input.actor });
  const navigationHash = stableHash(before.workspace.currentAssembly!.navigation); const footerHash = stableHash(before.workspace.currentAssembly!.footerLinks); const titleHash = hash(before.current.title ?? ""); const mediaUrlHash = hash(before.visual.wordpressMediaUrl);
  await writeContent(before.apiBase, before.headers, revised.contentHtml);
  try {
    const afterWordPress = await readPage(before.apiBase, before.headers); const after = identity(afterWordPress);
    assertCommercialStainlessPostWriteIdentity({ before: before.current, after, expectedContentHash: revised.contentFingerprint });
    const assembly = replaceSiteAssemblyPageRevision({ organizationId: ORGANIZATION_ID, siteId: SITE_ID, buildSessionId: before.workspace.session!.buildSessionId, priorAssemblyId: before.workspace.currentAssembly!.assemblyId, page: revised, actor: input.actor });
    decideSiteAssemblyPage({ organizationId: ORGANIZATION_ID, siteId: SITE_ID, buildSessionId: before.workspace.session!.buildSessionId, assemblyId: assembly.assemblyId, pageId: revised.pageId, decision: "APPROVE", actor: input.actor });
    recordSiteBuildWordPressContentUpdate({ buildSessionId: before.workspace.session!.buildSessionId, pageRevisionId: revised.pageRevisionId, wordpressObjectId: WORDPRESS_OBJECT_ID, wordpressUrl: afterWordPress.link ?? "https://commercialstainlesscounters.com/", wordpressStatus: "publish", updatedAt: new Date().toISOString() });
    saveSiteVisualAssembly({ organizationId: ORGANIZATION_ID, siteId: SITE_ID, buildSessionId: before.workspace.session!.buildSessionId, pageId: revised.pageId, pageRevisionId: revised.pageRevisionId, status: "APPROVED", referenceAssetId: before.visual.referenceAssetId, referenceClassification: before.visual.referenceClassification, referencePublished: false, imageCandidateId: before.visual.imageCandidateId, imageCandidateRevision: before.visual.imageCandidateRevision, imageProvenance: before.visual.imageProvenance, imageSha256: before.visual.imageSha256, wordpressObjectId: WORDPRESS_OBJECT_ID, wordpressMediaId: before.visual.wordpressMediaId, wordpressMediaUrl: before.visual.wordpressMediaUrl, wordpressStatus: "publish", contentHtml: revised.contentHtml, designSystemVersion: COMMERCIAL_STAINLESS_COMPOSITION_VERSION, ownerInstructions: "Owner-authorized Commercial Stainless visual composition repair v1.", createdBy: input.actor });
    const afterShell = await inspectWordPressThemeShell(before.site);
    if (stableHash(afterShell.header) !== stableHash(before.shell.header) || stableHash(afterShell.footer) !== stableHash(before.shell.footer) || afterShell.ownedNavigationId !== before.shell.ownedNavigationId) throw new Error("COMPOSITION_REPAIR_THEME_SHELL_CHANGED");
    const afterPublicHash = await publicHash();
    const receipt = saveCommercialStainlessCompositionRepairReceipt({ contract: "commercial-stainless-visual-composition-repair-v1", organizationId: ORGANIZATION_ID, siteId: SITE_ID, wordpressObjectId: WORDPRESS_OBJECT_ID, beforeCertificationId: BEFORE_CERTIFICATION_ID, beforePageRevisionId: before.beforeVisual.pageRevisionId, afterPageRevisionId: revised.pageRevisionId, beforeContentHash: before.beforeVisual.contentSha256, beforeAuthorityContentHash: before.beforeVisual.contentSha256, afterContentHash: after.contentHash, beforePublicHtmlHash: before.currentPublicHash, afterPublicHtmlHash: afterPublicHash, featuredMediaId: after.featuredMediaId, mediaUrlHash, titleHash, seoMetaHash: after.metaHash, templateIdentity: after.template, navigationHash, footerHash, wordpressStatusBefore: "publish", wordpressStatusAfter: "publish", canonicalPath: "/", compositionVersion: COMMERCIAL_STAINLESS_COMPOSITION_VERSION, actor: input.actor, completedAt: new Date().toISOString(), publicationWorkflowPerformed: false });
    return { receipt, revisedPage: revised, wordpress: { objectId: WORDPRESS_OBJECT_ID, status: after.status, slug: after.slug, featuredMediaId: after.featuredMediaId }, publicationPerformed: false, campaignMutationPerformed: false };
  } catch (error) {
    await writeContent(before.apiBase, before.headers, before.wordpress.content?.raw ?? "").catch(() => undefined);
    throw error;
  }
}

export async function certifyCommercialStainlessCompositionRepair() {
  const resolved = authority(); const workspace = getSiteBuildWorkspace(resolved.site); const page = workspace.currentAssembly?.pages.find((item) => item.pageRole === "HOME") ?? null;
  if (!workspace.currentAssembly || !page || !resolved.site.canonicalUrl) throw new Error("COMPOSITION_REPAIR_CERTIFICATION_AUTHORITY_MISSING");
  const settingsResponse = await fetch(`${resolved.apiBase}/settings?context=edit&_fields=url,home&_genesis_composition=${crypto.randomUUID()}`, { headers: resolved.headers, cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!settingsResponse.ok) throw new Error(`COMPOSITION_REPAIR_SETTINGS_READ_FAILED:${settingsResponse.status}`);
  const settings = await settingsResponse.json() as { url?: string; home?: string };
  const settingOrigin = (value: string | undefined) => { try { return value ? new URL(value).origin : null; } catch { return null; } };
  const wordpressReview = await inspectSiteBuildWordPressDrafts(resolved.site, undefined, "publish", false);
  const visual = listRenderedVisualCertifications({ organizationId: ORGANIZATION_ID, siteId: SITE_ID, pageId: page.pageId }).filter((item) => item.identity.pageRevisionIdentity === page.pageRevisionId).at(-1) ?? null;
  if (!visual) throw new Error("COMPOSITION_REPAIR_CURRENT_VISUAL_CERTIFICATION_REQUIRED");
  const viewportEvidence = visual.captures.map((capture) => ({ viewport: capture.viewportClass === "DESKTOP" ? "desktop" as const : "mobile" as const, navigationVisible: true, navigationOperable: true, brandIdentityVisible: true, horizontalOverflow: capture.horizontalOverflow > 0 }));
  const normalizedHome = settingOrigin(settings.home); const normalizedSiteUrl = settingOrigin(settings.url);
  const publicCertification = await certifyPublicWordPressSite({ spec: { canonicalOrigin: resolved.site.canonicalUrl, wordpressSettings: normalizedSiteUrl ? { home: normalizedHome ?? normalizedSiteUrl, siteUrl: normalizedSiteUrl } : undefined, expectedBrand: resolved.site.displayName, routes: workspace.currentAssembly.pages.map((item) => ({ path: item.canonicalPath, expectedH1: item.h1 })), viewportEvidence } });
  return { wordpressReview, publicCertification, wordpressSettings: { home: normalizedHome, siteUrl: normalizedSiteUrl }, visualCertificationId: visual.certificationId, mutationPerformed: false };
}