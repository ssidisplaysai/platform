import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { createAuthenticatedWordPressReadAuthority } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { deepClone, loadPersistedState, savePersistedState } from "@/modules/foundation/foundation-persistence";
import { getSiteById } from "@/modules/foundation/site-repository";
import { resolveWordPressCredentialReference } from "@/modules/foundation/wordpress-credential-resolver";
import { writeGenesisWordPressDraft } from "@/modules/foundation/wordpress-draft-writer";
import { load as loadHtml } from "cheerio";
import { evaluateGlwReferenceClaimAuthority } from "./reference-claim-authority";
import { evaluateGlwReferenceOwnerReviewReadiness } from "./reference-owner-review-readiness";
import { evaluateGlwStateLocalizationContamination } from "./state-localization-contamination";
import type { GlwTrustedOperatorPrincipal } from "./trusted-operator-principal";
import { getIndianaRichReferenceCandidate, renderIndianaRichReferenceWordPressContent } from "./indiana-rich-reference-candidate";

export const INDIANA_RICH_PERSISTENCE_VERSION = "GENESIS_INDIANA_EXACT_CANDIDATE_DRAFT_PERSISTENCE_V1" as const;
const NAMESPACE = "genesis-indiana-exact-candidate-persistence-v1";
const ORGANIZATION_ID = "led-display-warehouse";
const SITE_ID = "site-led-display-warehouse-production";
const WORDPRESS_OBJECT_ID = "20115";
const PARENT_ID = 20114;
const CANDIDATE_ID = "indiana-rich-reference-candidate-85ab1787c55ef4f97c8f2956";
const CANDIDATE_SHA = "85ab1787c55ef4f97c8f29561493e6e67da60b7bd2d3062a4b8ea713e4efc62c";
const CERTIFICATION_ID = "visual-certification-b8447ac7-6878-48ec-8dea-feae2b1cf219";

export type IndianaWordPressIdentity = { objectId: string; status: string; slug: string; parent: number; title: string; modified: string; link: string; raw: string; rendered: string; contentSha: string; template: string; featuredMediaId: number };
type AuthorityContext = { principalId: string; principalSessionId: string; candidateId: string; candidateSha: string; certificationId: string; wordpressObjectId: string; productId: string; stateCode: "IN"; canonicalPath: "/outdoor-digital-sphere/indiana/"; runtimeSha: string; beforeContentSha: string; beforeModified: string; wordpressIdentityFingerprint: string };
type Preflight = AuthorityContext & { preflightId: string; issuedAt: string; expiresAt: string; authorizedGrantId: string | null };
type Grant = AuthorityContext & { grantId: string; preflightId: string; issuedAt: string; expiresAt: string; status: "ACTIVE" | "CONSUMED"; consumedAt: string | null };
type Receipt = { receiptId: string; candidateId: string; candidateSha: string; certificationId: string; wordpressObjectId: string; before: IndianaWordPressIdentity; after: IndianaWordPressIdentity; storedPresentationEquivalent: boolean; unexpectedStoredMutation: false; principalId: string; persistedAt: string; publicationMutation: false; wordpressObjectCreated: false };
type State = { preflights: Preflight[]; grants: Grant[]; receipts: Receipt[] };
const seed = (): State => ({ preflights: [], grants: [], receipts: [] });
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const load = () => loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed });

async function wordpress() {
  const site = getSiteById(SITE_ID); if (!site?.integrations.wordpressApiBaseUrl) throw new Error("INDIANA_WORDPRESS_SITE_AUTHORITY_REQUIRED");
  const credential = resolveWordPressCredentialReference(site.integrations.wordpressCredentialReference); if (!credential) throw new Error("INDIANA_WORDPRESS_CREDENTIAL_REQUIRED");
  return { site, reader: createAuthenticatedWordPressReadAuthority({ configuration: { apiBaseUrl: site.integrations.wordpressApiBaseUrl, username: credential.username, applicationPassword: credential.applicationPassword, timeoutMs: 30_000 } }) };
}

function field(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
export async function inspectIndianaWordPressDraft(): Promise<IndianaWordPressIdentity> {
  const wp = await wordpress();
  const response = await wp.reader.getJson({ path: `/pages/${WORDPRESS_OBJECT_ID}`, query: new URLSearchParams({ context: "edit", _fields: "id,status,slug,parent,title,modified,link,content,template,featured_media" }) });
  if (!response.ok || !response.body || typeof response.body !== "object" || Array.isArray(response.body)) throw new Error("INDIANA_WORDPRESS_READBACK_FAILED");
  const page = response.body as Record<string, unknown>; const title = page.title as Record<string, unknown> | undefined; const content = page.content as Record<string, unknown> | undefined;
  const raw = field(content?.raw); const rendered = field(content?.rendered);
  return { objectId: String(page.id ?? ""), status: field(page.status), slug: field(page.slug), parent: Number(page.parent), title: field(title?.raw) || field(title?.rendered), modified: field(page.modified), link: field(page.link), raw, rendered, contentSha: hash(raw), template: field(page.template), featuredMediaId: Number(page.featured_media ?? 0) };
}

export function evaluateIndianaStoredDraft(input: { candidateId: string; candidateSha: string; html: string }) {
  const $ = loadHtml(input.html, null, false); const links = $("a[href]").map((_, item) => $(item).attr("href") ?? "").get(); const media = $("img[src]").map((_, item) => $(item).attr("src") ?? "").get();
  const artifact = { title: "Outdoor Digital Sphere in Indiana", contentHtml: input.html, slug: "/outdoor-digital-sphere/indiana/", excerpt: null, seoTitle: "Outdoor Digital Sphere in Indiana | Project Planning", metaDescription: "Explore Outdoor Digital Sphere concepts and plan an Indiana project around your location, audience, content goals, placement, and timeline.", focusKeyphrase: "outdoor digital sphere Indiana" };
  const claims = evaluateGlwReferenceClaimAuthority({ artifact, authority: { references: [], authoritativeFactReferenceIds: [], supportedClaimMappings: [] } });
  const review = evaluateGlwReferenceOwnerReviewReadiness({ artifact, media: { productAuthorityMediaAvailable: true, productAuthorityMediaCount: 1, contextualMediaCount: 1, applicationMediaCount: 1, localContextualMediaCount: 0, featuredMediaId: null }, actualHostVisualCertified: false, authority: { references: [], authoritativeFactReferenceIds: [], supportedClaimMappings: [] } });
  const contamination = evaluateGlwStateLocalizationContamination({ contentHtml: input.html, expectedStateCode: "IN" }); const unsupported = claims.findings.filter((item) => item.authorityStatus === "UNSUPPORTED");
  const roles = ["HERO", "PRODUCT_IDENTITY", "APPLICATIONS", "PLANNING_GUIDANCE", "CTA"] as const;
  const publicText = $("main").text().replace(/\s+/g, " ").trim();
  const governancePatterns = [/owner-approved/i, /authority mapping/i, /PRODUCT_AUTHORITY/i, /CONTEXTUAL_IN_USE/i, /APPLICATION_EXPERIENCE/i, /approved dataset/i, /unsupported factual claim/i, /unknown fact/i, /canonicalization/i, /claim governance/i, /semantic input/i, /candidate SHA/i, /fingerprint/i, /proper authority/i, /visual authority/i];
  return { storedCandidateIdentityVerified: $("main").attr("data-candidate-id") === input.candidateId && $("main").attr("data-candidate-sha") === input.candidateSha, h1Count: $("h1").length, sections: Object.fromEntries(roles.map((role) => [role, $(`[data-reference-section="${role}"]`).length === 1])), productAuthorityLinkPresent: links.includes("/outdoor-digital-sphere/"), brokenMediaReferences: media.filter((url) => !url.startsWith("data:image/")).length, internalGovernanceLanguageExposed: governancePatterns.filter((pattern) => pattern.test(publicText)).length, devLinks: links.filter((url) => /(?:localhost|127\.0\.0\.1|\.test)(?:[/:]|$)/i.test(url)).length, localhostLinks: links.filter((url) => /localhost|127\.0\.0\.1/i.test(url)).length, previewLinks: links.filter((url) => /preview|visual-certification|rich-reference-candidate/i.test(url)).length, unsupportedFactualClaims: unsupported.length, protectedFactsWithoutAuthorityMapping: unsupported.length, sourceToClaimMappingFailures: unsupported.length, genericProductKnowledgeViolations: unsupported.filter((item) => ["PRODUCT_CAPABILITY", "PRODUCT_SPECIFICATION", "PERFORMANCE", "INTERACTIVITY"].includes(item.claimClass)).length, unsupportedTrendClaims: unsupported.filter((item) => item.claimClass === "MARKET_ADOPTION").length, unsupportedProductCapabilityClaims: unsupported.filter((item) => ["PRODUCT_CAPABILITY", "PRODUCT_SPECIFICATION", "PERFORMANCE", "INTERACTIVITY"].includes(item.claimClass)).length, unsupportedClimateOrLocationFacts: unsupported.filter((item) => item.claimClass === "CLIMATE" || item.claimClass === "LOCATION_FACT").length, unexpectedStateContamination: contamination.contaminations.length, buyerQuestionPremiseRule: review.semantic.buyerQuestionPremiseEscapes === 0 ? "PASS" : "FAIL", comparisonAuthorityRule: review.composition.AUTHORIZED_COMPARISON_OR_EVALUATION ? "PASS" : "FAIL", canonicalizationCopyQualityRule: review.copyQuality.ok ? "PASS" : "FAIL", longFormArticleAppearance: publicText.split(/\s+/).length > 900, richCommercialComposition: $(".saw-hero,.saw-product,.saw-applications,.saw-planning,.saw-cta").length === 5 };
}

async function exactContext(principal: GlwTrustedOperatorPrincipal, runtimeSha: string) {
  const candidate = getIndianaRichReferenceCandidate(CANDIDATE_ID); if (!candidate || candidate.candidateSha !== CANDIDATE_SHA) throw new Error("INDIANA_CANDIDATE_AUTHORITY_STALE");
  if (!/^[0-9a-f]{40}$/.test(runtimeSha)) throw new Error("INDIANA_PERSISTENCE_RUNTIME_INVALID");
  const before = await inspectIndianaWordPressDraft();
  if (before.objectId !== WORDPRESS_OBJECT_ID || before.status !== "draft" || before.slug !== "indiana" || before.parent !== PARENT_ID || before.title !== "Outdoor Digital Sphere in Indiana") throw new Error("INDIANA_WORDPRESS_PREFLIGHT_IDENTITY_MISMATCH");
  const parent = await (await wordpress()).reader.getJson({ path: `/pages/${PARENT_ID}`, query: new URLSearchParams({ context: "edit", _fields: "id,status,slug,parent,link" }) });
  const parentBody = parent.body as Record<string, unknown> | null; if (!parent.ok || String(parentBody?.id) !== String(PARENT_ID) || field(parentBody?.slug) !== "outdoor-digital-sphere" || Number(parentBody?.parent) !== 0) throw new Error("INDIANA_WORDPRESS_PARENT_IDENTITY_MISMATCH");
  const context: AuthorityContext = { principalId: principal.principalId, principalSessionId: principal.sessionId, candidateId: candidate.candidateId, candidateSha: candidate.candidateSha, certificationId: CERTIFICATION_ID, wordpressObjectId: WORDPRESS_OBJECT_ID, productId: candidate.productId, stateCode: "IN", canonicalPath: "/outdoor-digital-sphere/indiana/", runtimeSha, beforeContentSha: before.contentSha, beforeModified: before.modified, wordpressIdentityFingerprint: hash(JSON.stringify({ objectId: before.objectId, status: before.status, slug: before.slug, parent: before.parent, title: before.title, modified: before.modified, contentSha: before.contentSha })) };
  return { candidate, before, context };
}
const AUTHORITY_FIELDS: ReadonlyArray<keyof AuthorityContext> = ["principalId", "principalSessionId", "candidateId", "candidateSha", "certificationId", "wordpressObjectId", "productId", "stateCode", "canonicalPath", "runtimeSha", "beforeContentSha", "beforeModified", "wordpressIdentityFingerprint"];
function match(left: AuthorityContext, right: AuthorityContext) { return AUTHORITY_FIELDS.every((fieldName) => left[fieldName] === right[fieldName]); }

export async function createIndianaPersistencePreflight(input: { principal: GlwTrustedOperatorPrincipal; runtimeSha: string; now?: Date }) {
  const resolved = await exactContext(input.principal, input.runtimeSha); const now = input.now ?? new Date(); const loaded = load();
  const preflight: Preflight = { ...resolved.context, preflightId: `indiana-persist-preflight-${randomUUID()}`, issuedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 120_000).toISOString(), authorizedGrantId: null };
  loaded.state.preflights.push(preflight); savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision }); return { ...resolved, preflight: deepClone(preflight) };
}
export async function authorizeIndianaPersistence(input: { principal: GlwTrustedOperatorPrincipal; runtimeSha: string; preflightId: string; now?: Date }) {
  const resolved = await exactContext(input.principal, input.runtimeSha); const now = input.now ?? new Date(); const loaded = load(); const preflight = loaded.state.preflights.find((item) => item.preflightId === input.preflightId);
  if (!preflight || preflight.authorizedGrantId || new Date(preflight.expiresAt) <= now || !match(preflight, resolved.context)) throw new Error("INDIANA_PERSISTENCE_PREFLIGHT_INVALID");
  const grant: Grant = { ...resolved.context, grantId: `indiana-persist-grant-${randomUUID()}`, preflightId: preflight.preflightId, issuedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 300_000).toISOString(), status: "ACTIVE", consumedAt: null };
  preflight.authorizedGrantId = grant.grantId; loaded.state.grants.push(grant); savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision }); return { ...resolved, grant: deepClone(grant) };
}
export async function persistIndianaCandidate(input: { principal: GlwTrustedOperatorPrincipal; runtimeSha: string; preflightId: string; grantId: string; now?: Date }) {
  const resolved = await exactContext(input.principal, input.runtimeSha); const now = input.now ?? new Date(); const loaded = load(); const grant = loaded.state.grants.find((item) => item.grantId === input.grantId);
  if (!grant || grant.preflightId !== input.preflightId || grant.status !== "ACTIVE" || new Date(grant.expiresAt) <= now || !match(grant, resolved.context)) throw new Error("INDIANA_PERSISTENCE_GRANT_INVALID");
  grant.status = "CONSUMED"; grant.consumedAt = now.toISOString(); savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  const wp = await wordpress(); const contentHtml = renderIndianaRichReferenceWordPressContent(resolved.candidate);
  const write = await writeGenesisWordPressDraft({ operation: "UPDATE", site: wp.site, wordpressObjectId: WORDPRESS_OBJECT_ID, artifact: { title: resolved.candidate.artifact.title, slug: resolved.candidate.artifact.slug, excerpt: resolved.candidate.artifact.excerpt, parentId: PARENT_ID, contentHtml, seo: { focusKeyphrase: resolved.candidate.artifact.focusKeyphrase!, seoTitle: resolved.candidate.artifact.seoTitle!, metaDescription: resolved.candidate.artifact.metaDescription! } } });
  if (!write.ok || write.wordpressObjectId !== WORDPRESS_OBJECT_ID || write.wordpressStatus !== "draft") throw new Error(`INDIANA_WORDPRESS_UPDATE_FAILED:${write.ok ? "IDENTITY" : write.state}`);
  const after = await inspectIndianaWordPressDraft();
  const qa = evaluateIndianaStoredDraft({ candidateId: resolved.candidate.candidateId, candidateSha: resolved.candidate.candidateSha, html: after.raw || after.rendered });
  const equivalent = qa.storedCandidateIdentityVerified && qa.h1Count === 1 && Object.values(qa.sections).every(Boolean) && qa.productAuthorityLinkPresent && qa.brokenMediaReferences === 0 && qa.internalGovernanceLanguageExposed === 0 && qa.devLinks === 0 && qa.previewLinks === 0 && qa.unsupportedFactualClaims === 0 && qa.unexpectedStateContamination === 0 && qa.buyerQuestionPremiseRule === "PASS" && qa.comparisonAuthorityRule === "PASS" && qa.canonicalizationCopyQualityRule === "PASS";
  if (after.objectId !== WORDPRESS_OBJECT_ID || after.status !== "draft" || after.slug !== "indiana" || after.parent !== PARENT_ID || after.title !== resolved.candidate.artifact.title || !equivalent) throw new Error("INDIANA_WORDPRESS_STORED_PRESENTATION_MISMATCH");
  const receipt: Receipt = { receiptId: `indiana-persist-receipt-${randomUUID()}`, candidateId: resolved.candidate.candidateId, candidateSha: resolved.candidate.candidateSha, certificationId: CERTIFICATION_ID, wordpressObjectId: WORDPRESS_OBJECT_ID, before: resolved.before, after, storedPresentationEquivalent: true, unexpectedStoredMutation: false, principalId: input.principal.principalId, persistedAt: now.toISOString(), publicationMutation: false, wordpressObjectCreated: false };
  const finalState = load(); finalState.state.receipts.push(receipt); savePersistedState({ namespace: NAMESPACE, state: finalState.state, expectedRevision: finalState.revision }); return { candidate: resolved.candidate, receipt: deepClone(receipt), contentHtml };
}
export function getIndianaPersistenceState() { return deepClone(load().state); }
