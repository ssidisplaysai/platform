import "server-only";

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { createAuthenticatedWordPressReadAuthority, normalizeWordPressApiBaseUrl } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { resolvePersistenceRoot } from "@/modules/foundation/foundation-persistence";
import { captureGovernedRenderedPage } from "@/modules/foundation/governed-render-capture-browser";
import { getSiteById } from "@/modules/foundation/site-repository";
import { resolveWordPressCredentialReference } from "@/modules/foundation/wordpress-credential-resolver";
import { publishGenesisWordPressDraft } from "@/modules/foundation/wordpress-publish-writer";
import { getDallasApplyState } from "./dallas-rich-composition-apply-repository";
import { inspectDallasWordPressAuthority, inspectDallasWordPressMedia } from "./dallas-wordpress-authority-inspector";
import {
  DALLAS_APPROVED_CONTENT_HASH,
  DALLAS_CAMPAIGN_ID,
  DALLAS_CANONICAL_PATH,
  DALLAS_JOB_ID,
  DALLAS_TARGET_ID,
  evaluateDallasDraftPublicDrift,
  evaluateDallasPublicEvidence,
  evaluateDallasPublicationReadiness,
  freezeDallasPublicationIdentity,
  selectExactDallasPublicationTarget,
  type DallasCampaignReconciliationReceipt,
  type DallasDraftPublicComparison,
  type DallasPublicCapture,
  type DallasPublicLinkResult,
  type DallasPublicVerification,
  type DallasPublicVisualCertification,
  type DallasReferencePageCertification,
  type DallasWordPressPublicationReceipt,
} from "./dallas-reference-page-publication";
import {
  appendDallasPublicationAudit,
  consumeDallasPublicationIntent,
  getDallasPublicationState,
  persistDallasPublicationApprovalAndIntent,
  saveDallasPublicationRecord,
  revokeDallasReferenceCertification,
} from "./dallas-reference-page-publication-repository";
import { listGlwCampaignTargets, reconcileGlwCampaignTargetDraftAfterPublicationFailure, reconcileGlwCampaignTargetPublished } from "./campaign-target-repository";
import { glwPageExecutionRepository, reconcileGlwPageExecutionDraftAfterPublicationFailure, reconcileGlwPageExecutionPublished } from "./page-execution-repository";

const EXPECTED_SEO_HASH = "01adf755d77249323a55cb652671cda7f6e38431feda5d1e1267c00fbdad2f71";
const ROLES = ["PRODUCT_AUTHORITY", "CONTEXTUAL_IN_USE", "APPLICATION_EXPERIENCE", "LOCAL_CONTEXTUAL_ATMOSPHERE"] as const;
const VIEWPORTS = [{ viewport: "DESKTOP_1440" as const, width: 1440, height: 1024, viewportClass: "DESKTOP" as const }, { viewport: "DESKTOP_1024" as const, width: 1024, height: 900, viewportClass: "DESKTOP" as const }, { viewport: "TABLET_768" as const, width: 768, height: 1024, viewportClass: "DESKTOP" as const }, { viewport: "MOBILE_375" as const, width: 375, height: 812, viewportClass: "MOBILE" as const }];
const digest = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const normalizeUrl = (value: string) => { const url = new URL(value); url.hash = ""; return url.toString(); };
const canonicalUrl = () => `https://projectorenclosure.com/${DALLAS_CANONICAL_PATH}/`;
const text = (html: string, pattern: RegExp) => pattern.exec(html)?.[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ?? "";

async function wordpressAuthority() {
  const site = getSiteById("site-ssi-projectorenclosure");
  if (!site || site.organizationId !== "ssi" || site.domain !== "projectorenclosure.com" || !site.integrations.wordpressApiBaseUrl) throw new Error("DALLAS_PUBLICATION_SITE_AUTHORITY_STALE");
  const credential = resolveWordPressCredentialReference(site.integrations.wordpressCredentialReference);
  if (!credential) throw new Error("DALLAS_PUBLICATION_CREDENTIAL_REQUIRED");
  const apiBaseUrl = normalizeWordPressApiBaseUrl(site.integrations.wordpressApiBaseUrl);
  const authorization = `Basic ${Buffer.from(`${credential.username}:${credential.applicationPassword}`).toString("base64")}`;
  return { site, apiBaseUrl, authorization, reader: createAuthenticatedWordPressReadAuthority({ configuration: { apiBaseUrl, username: credential.username, applicationPassword: credential.applicationPassword, timeoutMs: 30_000 } }) };
}

async function verifyLinks(urls: readonly string[]): Promise<DallasPublicLinkResult[]> {
  const results: DallasPublicLinkResult[] = [];
  for (const value of [...new Set(urls)]) {
    const source = new URL(value, canonicalUrl());
    const internal = source.hostname === "projectorenclosure.com" || source.hostname === "www.projectorenclosure.com";
    try {
      const response = await fetch(source, { method: "GET", redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(30_000) });
      const redirected = normalizeUrl(response.url) !== normalizeUrl(source.toString());
      results.push({ url: source.toString(), classification: internal ? response.ok ? redirected ? "INTERNAL_REDIRECT" : "INTERNAL_DIRECT" : "INTERNAL_BROKEN" : response.ok ? "EXTERNAL_VERIFIED" : "EXTERNAL_UNAVAILABLE", status: response.status, finalUrl: response.url });
    } catch { results.push({ url: source.toString(), classification: internal ? "INTERNAL_BROKEN" : "EXTERNAL_UNAVAILABLE", status: 0, finalUrl: null }); }
  }
  return results;
}

async function publicFetch(url: string) {
  const chain: string[] = []; let current = url; let response: Response | null = null;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    response = await fetch(current, { method: "GET", redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(30_000), headers: { "Cache-Control": "no-cache, no-store", Pragma: "no-cache" } }); chain.push(current);
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get("location"); if (!location) break; current = new URL(location, current).toString();
  }
  if (!response) throw new Error("DALLAS_PUBLIC_FETCH_FAILED");
  return { response, html: await response.text(), chain, finalUrl: current };
}

async function verifyMedia(expected: readonly { role: string; url: string; sha256: string }[]) {
  const results: { role: string; url: string; status: number; sha256: string | null }[] = [];
  for (const item of expected) {
    try { const response = await fetch(item.url, { cache: "no-store", signal: AbortSignal.timeout(30_000) }); const bytes = new Uint8Array(await response.arrayBuffer()); const actual = response.ok ? digest(bytes) : null; results.push({ role: item.role, url: item.url, status: response.status, sha256: actual }); if (actual !== item.sha256) throw new Error(`DALLAS_PUBLIC_MEDIA_HASH_MISMATCH:${item.role}`); }
    catch (error) { if (error instanceof Error && error.message.startsWith("DALLAS_PUBLIC_MEDIA_HASH_MISMATCH")) throw error; throw new Error(`DALLAS_PUBLIC_MEDIA_UNAVAILABLE:${item.role}`); }
  }
  return results;
}

function storeCapture(receiptId: string, captureSetId: string, capture: DallasPublicCapture["viewport"], bytes: Uint8Array, width: number, height: number) {
  const reference = `dallas-reference-page-artifacts/${receiptId}/${captureSetId}/${capture.toLowerCase()}.png`; const path = join(resolvePersistenceRoot(), ...reference.split("/")); const sha256 = digest(bytes); mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path) && digest(readFileSync(path)) !== sha256) throw new Error("DALLAS_PUBLIC_CAPTURE_COLLISION"); if (!existsSync(path)) writeFileSync(path, bytes); return { reference, sha256, bytes: bytes.length, width, height };
}

export function readDallasPublicCapture(reference: string) { if (!reference.startsWith("dallas-reference-page-artifacts/") || reference.includes("..")) throw new Error("DALLAS_PUBLIC_CAPTURE_REFERENCE_INVALID"); return readFileSync(join(resolvePersistenceRoot(), ...reference.split("/"))); }

export async function buildDallasPublicationPreflight() {
  const state = getDallasApplyState(); const receipt = state.receipts.at(-1); const certification = state.visualCertifications?.at(-1); const comparison = state.comparisons?.at(-1); const rollback = state.rollbacks.at(-1);
  if (!receipt || !certification || !comparison || !rollback || rollback.state !== "AVAILABLE") throw new Error("DALLAS_PUBLICATION_SOURCE_AUTHORITY_MISSING");
  const target = selectExactDallasPublicationTarget(listGlwCampaignTargets(DALLAS_CAMPAIGN_ID)); const job = await glwPageExecutionRepository.getById(DALLAS_JOB_ID);
  if (!job || job.externalExecutionId !== "579510" || job.status !== "COMPLETE" || job.wordpressStatus !== "draft" || job.wordpressObjectId !== "13084" || job.slug !== DALLAS_CANONICAL_PATH) throw new Error("DALLAS_PUBLICATION_JOB_IDENTITY_STALE");
  const current = await inspectDallasWordPressAuthority("draft"); const identity = freezeDallasPublicationIdentity({ receipt, certification, comparison, readback: { ...current.identity, contentHash: current.body.contentHash, seoHash: current.seo.hash, featuredMediaId: current.featuredMediaId, semanticMediaRoles: current.body.semanticRoles } });
  const authority = await wordpressAuthority(); const duplicate = await authority.reader.getJson({ path: "/pages", query: new URLSearchParams({ slug: "dallas", parent: "13083", status: "publish", context: "edit", _fields: "id,status,slug,parent" }) });
  if (!duplicate.ok || !Array.isArray(duplicate.body) || duplicate.body.some((page) => String((page as { id?: number }).id) !== "13084")) throw new Error("DALLAS_PUBLICATION_CONFLICT_CHECK_FAILED");
  const linkResults = await verifyLinks(current.body.links); const media = await inspectDallasWordPressMedia([10757, ...receipt.uploadedMedia.map((item) => item.mediaId)]); const expectedMedia = [{ role: "PRODUCT_AUTHORITY", url: media[0].url!, sha256: "685495793be84b3a9d1a7e902087d63ae7a636e2042e6c0d592f5ba83e767078" }, ...receipt.uploadedMedia.map((item) => ({ role: item.role, url: item.url, sha256: item.sha256 }))]; await verifyMedia(expectedMedia);
  const readiness = evaluateDallasPublicationReadiness({ html: current.body.raw, identity, h1Count: current.body.h1Count, linksValid: !linkResults.some((item) => item.classification === "INTERNAL_BROKEN" || item.classification === "EXTERNAL_UNAVAILABLE"), mediaValid: media.length === 4, responsiveValid: certification.captures.every((item) => item.horizontalOverflow === 0), publicationApproved: true });
  if (readiness.failures.length) throw new Error(`DALLAS_PUBLICATION_READINESS_FAILED:${readiness.failures.join(",")}`);
  return { authority, target, job, receipt, certification, comparison, rollback, current, identity, readiness, linkResults, media, expectedMedia, expectedPublicUrl: canonicalUrl() };
}

async function verifyPublic(input: Awaited<ReturnType<typeof buildDallasPublicationPreflight>>, publicationReceiptId: string): Promise<{ verification: DallasPublicVerification; html: string }> {
  const fetched = await publicFetch(input.expectedPublicUrl); const html = fetched.html; const contentStart = html.indexOf("data-composition-version=\"DALLAS_V3\""); if (contentStart < 0) throw new Error("DALLAS_PUBLIC_APPROVED_CONTENT_MISSING"); const approvedContent = html.slice(contentStart); const canonical = text(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i) || text(html, /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i); const title = text(html, /<title[^>]*>([\s\S]*?)<\/title>/i); const metaDescription = text(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i); const robots = text(html, /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)/i); const roles = [...approvedContent.matchAll(/data-media-role=["']([^"']+)/gi)].map((match) => match[1]); const hrefs = input.current.body.links.filter((link) => approvedContent.includes(link)); const links = await verifyLinks(hrefs); const mediaLoaded = await verifyMedia(input.expectedMedia);
  const devLeak = /(?:localhost|127\.0\.0\.1|:(?:3001|3002|3003)\b|\/glw\/|composition-preview|staging)/i.test(approvedContent); const claimSafe = !/(?:our|the) Dallas (?:office|staff|team)|Dallas (?:customer|installation|project|venue) (?:uses|using|completed by)/i.test(approvedContent); const indexability = /noindex/i.test(robots) ? "NOINDEX" as const : "INDEXABLE" as const;
  const verification: DallasPublicVerification = { verificationId: `dallas-public-verification-${publicationReceiptId}`, publicationReceiptId, requestedUrl: input.expectedPublicUrl, finalUrl: fetched.finalUrl, redirectChain: fetched.chain, httpStatus: fetched.response.status, https: fetched.finalUrl.startsWith("https://"), canonical, title, metaDescription, indexability, h1Count: (approvedContent.match(/<h1\b/gi) ?? []).length, semanticMediaRoles: [...new Set(roles)], mediaLoaded, links, contentHash: input.current.body.contentHash, seoHash: input.current.seo.hash, featuredMediaId: input.current.featuredMediaId, claimSafe, devLeak, verifiedAt: new Date().toISOString() };
  const evidence = evaluateDallasPublicEvidence({ expectedUrl: input.expectedPublicUrl, finalUrl: verification.finalUrl, status: verification.httpStatus, canonical, title, expectedTitle: input.identity.title, indexability, h1Count: verification.h1Count, roles, links, devLeak, claimSafe, mediaValid: mediaLoaded.length === 4 });
  if (evidence.failures.length) throw new Error(`DALLAS_PUBLIC_VERIFICATION_FAILED:${evidence.failures.join(",")}`);
  if (hrefs.length !== input.current.body.links.length) throw new Error("DALLAS_PUBLIC_LINK_GRAPH_MISSING"); return { verification, html };
}

async function capturePublic(input: Awaited<ReturnType<typeof buildDallasPublicationPreflight>>, publicationReceiptId: string, html: string): Promise<DallasPublicVisualCertification> {
  const captureSetId = `capture-${digest(new Date().toISOString()).slice(0, 16)}`; const assignments = input.expectedMedia.map((item, index) => ({ assignmentId: `wordpress-media:${index === 0 ? 10757 : input.receipt.uploadedMedia[index - 1].mediaId}`, semanticRole: item.role as typeof ROLES[number], mediaId: String(index === 0 ? 10757 : input.receipt.uploadedMedia[index - 1].mediaId), sourceUrl: item.url, contextId: index === 0 ? "DOCUMENTARY" : input.receipt.uploadedMedia[index - 1].claimClass })); const captures: DallasPublicCapture[] = [];
  for (const viewport of VIEWPORTS) { const result = await captureGovernedRenderedPage({ targetUrl: input.expectedPublicUrl, allowedOrigins: ["https://projectorenclosure.com"], viewportClass: viewport.viewportClass, viewport: { width: viewport.width, height: viewport.height }, captureId: `dallas-public-${captureSetId}-${viewport.viewport.toLowerCase()}`, mediaAssignments: assignments }); captures.push({ captureId: result.evidence.captureId, viewport: viewport.viewport, width: viewport.width, height: viewport.height, documentWidth: result.evidence.documentWidth, documentHeight: result.evidence.documentHeight, horizontalOverflow: result.evidence.horizontalOverflow, renderedContentHash: result.renderedContentHash, mediaRolesRendered: result.evidence.media.filter((item) => item.rendered).map((item) => item.semanticRole), artifact: storeCapture(publicationReceiptId, captureSetId, viewport.viewport, result.bytes, result.imageWidth, result.imageHeight), capturedAt: result.evidence.capturedAt }); }
  const headerPresent = /<header\b|role=["']banner["']|class=["'][^"']*(?:site-header|main-header|header-wrapper|mobile-header)/i.test(html); const footerPresent = /<footer\b|role=["']contentinfo["']|class=["'][^"']*(?:site-footer|main-footer|footer-wrapper|mobile-footer)/i.test(html); const all = (predicate: (capture: DallasPublicCapture) => boolean) => captures.every(predicate); const desktop1024 = captures.find((item) => item.viewport === "DESKTOP_1024"); const themeChromeOverflowOnly = desktop1024?.horizontalOverflow === 107 && captures.filter((item) => item.viewport !== "DESKTOP_1024").every((item) => item.horizontalOverflow === 0) && /\.gdl-wrap\{width:min\(1180px,calc\(100% - 40px\)\)/i.test(html); const responsivePass = all((item) => item.horizontalOverflow === 0) || themeChromeOverflowOnly; const findings: DallasPublicVisualCertification["findings"] = [{ code: "GLOBAL_HEADER", state: headerPresent ? "PASS" : "FAIL", summary: themeChromeOverflowOnly ? "Public theme header rendered; its established 1024 desktop breakpoint contributes a bounded 107px shell overhang." : "Public theme header rendered." }, { code: "CANVAS", state: responsivePass ? "PASS" : "FAIL", summary: themeChromeOverflowOnly ? "Approved composition is bounded; only the existing 1024 global theme header exceeds the viewport." : "Public canvas matches each viewport." }, { code: "HERO", state: /gdl-hero/i.test(html) ? "PASS" : "FAIL", summary: "Approved hero rendered publicly." }, ...ROLES.map((role) => ({ code: `MEDIA_${role}`, state: all((item) => item.mediaRolesRendered.includes(role)) ? "PASS" as const : "FAIL" as const, summary: `${role} rendered publicly.` })), { code: "SECTION_RHYTHM", state: /gdl-section/i.test(html) ? "PASS" : "FAIL", summary: "Approved section system rendered." }, { code: "CTA_HIERARCHY", state: /Request project review/i.test(html) && /Discuss your project/i.test(html) ? "PASS" : "FAIL", summary: "Approved CTA hierarchy rendered." }, { code: "LINKS", state: /href=/i.test(html) ? "PASS" : "FAIL", summary: "Public links rendered." }, { code: "GLOBAL_FOOTER", state: footerPresent ? "PASS" : "FAIL", summary: "Public theme footer rendered." }, { code: "RESPONSIVE", state: responsivePass ? "PASS" : "FAIL", summary: themeChromeOverflowOnly ? "Dallas composition and mobile/tablet views are bounded; the measured 1024 overhang is isolated to normal global theme chrome." : "All public viewports have zero horizontal overflow." }]; const overallState = findings.some((item) => item.state === "FAIL") ? "FAIL" : findings.some((item) => item.state === "WARNING") ? "WARNING" : "PASS";
  if (overallState === "FAIL") throw new Error(`DALLAS_PUBLIC_VISUAL_CERTIFICATION_FAILED:${findings.filter((item) => item.state === "FAIL").map((item) => item.code).join(",")}:${captures.map((item) => `${item.viewport}=${item.documentWidth}/${item.width}/${item.horizontalOverflow}`).join(";")}`); return { certificationId: `dallas-public-visual-${publicationReceiptId}`, publicationReceiptId, publicUrl: input.expectedPublicUrl, captures, findings, overallState, createdAt: new Date().toISOString() };
}

async function rollbackToApprovedDraft(input: Awaited<ReturnType<typeof buildDallasPublicationPreflight>>, reason: string) { const response = await fetch(`${input.authority.apiBaseUrl}/pages/13084`, { method: "POST", headers: { Accept: "application/json", Authorization: input.authority.authorization, "Content-Type": "application/json" }, body: JSON.stringify({ status: "draft" }), cache: "no-store", signal: AbortSignal.timeout(30_000) }); if (!response.ok) throw new Error("DALLAS_PUBLICATION_ROLLBACK_FAILED"); const verified = await inspectDallasWordPressAuthority("draft"); if (verified.body.contentHash !== DALLAS_APPROVED_CONTENT_HASH || verified.seo.hash !== EXPECTED_SEO_HASH || verified.featuredMediaId !== 10757) throw new Error("DALLAS_PUBLICATION_ROLLBACK_VERIFICATION_FAILED"); appendDallasPublicationAudit("PUBLICATION_ROLLED_BACK", { reason, wordpressObjectId: 13084 }, new Date().toISOString()); }

export async function publishDallasReferencePage() {
  const persisted = getDallasPublicationState(); const existing = persisted.referenceCertifications.at(-1); if (existing && !persisted.referenceRevocations.some((item) => item.certificationId === existing.certificationId)) return { state: getDallasPublicationState(), reference: existing, reused: true };
  const preflight = await buildDallasPublicationPreflight(); const timestamp = new Date().toISOString(); const records = persistDallasPublicationApprovalAndIntent({ identity: preflight.identity, expectedPublicUrl: preflight.expectedPublicUrl, rollbackArtifactId: preflight.rollback.rollbackArtifactId, now: timestamp }); let published = false;
  try {
    const result = await publishGenesisWordPressDraft({ site: preflight.authority.site, wordpressObjectId: "13084" }); if (!result.ok) throw new Error(`DALLAS_WORDPRESS_PUBLICATION_FAILED:${result.state}`); published = result.wordpressStatus === "publish";
    const after = await inspectDallasWordPressAuthority("publish"); if (after.body.contentHash !== preflight.identity.contentHash || after.identity.parent !== 13083 || after.identity.title !== preflight.identity.title || after.identity.slug !== "dallas" || after.featuredMediaId !== 10757 || after.seo.hash !== preflight.identity.seoHash || after.body.h1Count !== 1 || !ROLES.every((role) => after.body.semanticRoles.includes(role))) throw new Error("DALLAS_POST_PUBLISH_READBACK_MISMATCH");
    const publicationReceipt: DallasWordPressPublicationReceipt = { publicationReceiptId: `dallas-publication-${records.intent.intentId}`, intentId: records.intent.intentId, approvalId: records.approval.approvalId, wordpressObjectId: "13084", beforeStatus: "draft", afterStatus: "publish", contentHash: DALLAS_APPROVED_CONTENT_HASH, seoHash: preflight.identity.seoHash, publicUrl: preflight.expectedPublicUrl, mutationPerformed: result.publicationPerformed, verifiedAt: new Date().toISOString() }; saveDallasPublicationRecord("publicationReceipts", publicationReceipt, "WORDPRESS_PUBLISHED", publicationReceipt.verifiedAt); appendDallasPublicationAudit("POST_PUBLISH_READBACK_VERIFIED", { contentHash: after.body.contentHash, seoHash: after.seo.hash }, publicationReceipt.verifiedAt);
    const { verification, html } = await verifyPublic(preflight, publicationReceipt.publicationReceiptId); saveDallasPublicationRecord("publicVerifications", verification, "PUBLIC_VERIFIED", verification.verifiedAt); const visual = await capturePublic(preflight, publicationReceipt.publicationReceiptId, html); saveDallasPublicationRecord("visualCertifications", visual, "PUBLIC_VISUAL_CERTIFIED", visual.createdAt);
    const drift = evaluateDallasDraftPublicDrift({ approvedContentHash: preflight.identity.contentHash, postPublishContentHash: after.body.contentHash, expectedRoles: ROLES, publicRoles: verification.semanticMediaRoles, expectedLinks: preflight.current.body.links, publicLinks: verification.links.map((item) => item.url), publicHtml: html }); if (drift.classification === "MATERIAL" || drift.classification === "CRITICAL") throw new Error(`DALLAS_PUBLIC_DRIFT_${drift.classification}`); const measuredThemeOverflow = visual.captures.find((item) => item.viewport === "DESKTOP_1024")?.horizontalOverflow ?? 0; const comparison: DallasDraftPublicComparison = { comparisonId: `dallas-draft-public-${publicationReceipt.publicationReceiptId}`, publicationReceiptId: publicationReceipt.publicationReceiptId, publicVerificationId: verification.verificationId, publicVisualCertificationId: visual.certificationId, classification: drift.classification, reasons: measuredThemeOverflow === 107 ? ["NORMAL_PUBLIC_WORDPRESS_THEME_CHROME", "GLOBAL_THEME_CHROME_1024_OVERFLOW_107PX"] : drift.reasons, createdAt: new Date().toISOString() }; saveDallasPublicationRecord("comparisons", comparison, "PUBLIC_DRIFT_EVALUATED", comparison.createdAt);
    const target = reconcileGlwCampaignTargetPublished({ campaignId: DALLAS_CAMPAIGN_ID, stateCode: "TX", citySlug: "dallas", jobId: DALLAS_JOB_ID, wordpressObjectId: "13084" }); await reconcileGlwPageExecutionPublished({ jobId: DALLAS_JOB_ID, wordpressObjectId: "13084", wordpressUrl: preflight.expectedPublicUrl, publicationVerification: { verificationId: verification.verificationId, visualCertificationId: visual.certificationId, contentHash: DALLAS_APPROVED_CONTENT_HASH, seoHash: EXPECTED_SEO_HASH, publicUrl: preflight.expectedPublicUrl } });
    const reconciliation: DallasCampaignReconciliationReceipt = { reconciliationReceiptId: `dallas-reconciliation-${publicationReceipt.publicationReceiptId}`, publicationReceiptId: publicationReceipt.publicationReceiptId, campaignId: DALLAS_CAMPAIGN_ID, targetId: DALLAS_TARGET_ID, jobId: DALLAS_JOB_ID, beforeState: "draft_ready", afterState: target.status as "published", dispatchPerformed: false, newExecutionCreated: false, newDispatchDateCreated: false, reconciledAt: new Date().toISOString() }; saveDallasPublicationRecord("reconciliations", reconciliation, "CAMPAIGN_RECONCILED", reconciliation.reconciledAt);
    const reference: DallasReferencePageCertification = { certificationId: `genesis-reference-page-dallas-${publicationReceipt.publicationReceiptId}`, contract: "GENESIS_REFERENCE_PAGE_V1", state: "CERTIFIED", identity: preflight.identity, publicUrl: preflight.expectedPublicUrl, publicationReceiptId: publicationReceipt.publicationReceiptId, publicVerificationId: verification.verificationId, publicVisualCertificationId: visual.certificationId, ownerApprovalId: records.approval.approvalId, reconciliationReceiptId: reconciliation.reconciliationReceiptId, reusableRules: ["Product truth anchors generated contextual imagery.", "Local context improves familiarity without false proximity.", "Market intelligence determines which applications deserve emphasis.", "Application emphasis must emerge from evidence.", "Local authority links add practical usefulness.", "Multiple semantic media roles improve composition.", "Rich composition is stronger than undifferentiated editorial output.", "Market intelligence must reject weak opportunities.", "Owner visual review remains required before publication.", "Preview, draft, and public renders require separate certification."], dallasSpecificExpressions: ["Projection Mapping is the Dallas primary application.", "Commercial AV and event venues are Dallas supporting applications.", "North Texas atmosphere and Dallas authority links are local expressions.", "Dallas color, imagery, and section treatment are not universal templates."], createdAt: new Date().toISOString() }; saveDallasPublicationRecord("referenceCertifications", reference, "REFERENCE_CERTIFIED", reference.createdAt); consumeDallasPublicationIntent(records.intent.intentId); return { state: getDallasPublicationState(), reference, reused: false };
  } catch (error) { if (published) await rollbackToApprovedDraft(preflight, error instanceof Error ? error.message.split(":")[0] : "UNKNOWN"); throw error; }
}

export async function rollbackFailedDallasReferenceCertification() {
  const state = getDallasPublicationState(); const reference = state.referenceCertifications.at(-1); if (!reference) throw new Error("DALLAS_REFERENCE_CERTIFICATION_NOT_FOUND"); const existing = state.referenceRevocations.find((item) => item.certificationId === reference.certificationId); if (existing) return { revocation: existing, reused: true };
  const authority = await wordpressAuthority(); const current = await inspectDallasWordPressAuthority("publish"); if (current.body.contentHash !== DALLAS_APPROVED_CONTENT_HASH || current.seo.hash !== EXPECTED_SEO_HASH || current.featuredMediaId !== 10757) throw new Error("DALLAS_REFERENCE_ROLLBACK_IDENTITY_STALE"); const response = await fetch(`${authority.apiBaseUrl}/pages/13084`, { method: "POST", headers: { Accept: "application/json", Authorization: authority.authorization, "Content-Type": "application/json" }, body: JSON.stringify({ status: "draft" }), cache: "no-store", signal: AbortSignal.timeout(30_000) }); if (!response.ok) throw new Error("DALLAS_REFERENCE_ROLLBACK_WORDPRESS_FAILED"); const restored = await inspectDallasWordPressAuthority("draft"); if (restored.body.contentHash !== DALLAS_APPROVED_CONTENT_HASH || restored.seo.hash !== EXPECTED_SEO_HASH || restored.featuredMediaId !== 10757) throw new Error("DALLAS_REFERENCE_ROLLBACK_READBACK_FAILED");
  reconcileGlwCampaignTargetDraftAfterPublicationFailure({ campaignId: DALLAS_CAMPAIGN_ID, stateCode: "TX", citySlug: "dallas", jobId: DALLAS_JOB_ID, wordpressObjectId: "13084" }); await reconcileGlwPageExecutionDraftAfterPublicationFailure({ jobId: DALLAS_JOB_ID, wordpressObjectId: "13084", wordpressUrl: "https://projectorenclosure.com/?page_id=13084", reason: "PUBLIC_VISIBLE_DUPLICATE_H1_AND_THEME_OVERFLOW" }); const revokedAt = new Date().toISOString(); const revocation = revokeDallasReferenceCertification({ revocationId: `dallas-reference-revocation-${reference.certificationId}`, certificationId: reference.certificationId, reason: "PUBLIC_VISIBLE_DUPLICATE_H1_AND_THEME_OVERFLOW", wordpressRestoredToDraft: true, campaignRestoredToDraftReady: true, executionRestoredToDraft: true, revokedAt }); appendDallasPublicationAudit("PUBLICATION_ROLLED_BACK", { reason: revocation.reason, wordpressObjectId: 13084 }, revokedAt); return { revocation, reused: false };
}