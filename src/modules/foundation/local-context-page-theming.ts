export const LOCAL_CONTEXT_CONTRACT = "site-page-local-context-v1" as const;
export const LOCAL_LINK_GRAPH_CONTRACT = "site-page-local-link-graph-v1" as const;
export const APPLICATION_AUTHORITY_CONTRACT = "site-page-application-authority-v1" as const;
export const LOCAL_THEME_PROFILE_CONTRACT = "site-page-local-theme-profile-v1" as const;
export const LOCALIZED_COMPOSITION_PLAN_CONTRACT = "site-page-localized-composition-plan-v2" as const;

export type LocalEvidenceSourceClass = "GOVERNMENT" | "OFFICIAL_INSTITUTION" | "OWNER_AUTHORITY" | "OFFICIAL_BRAND" | "OFFICIAL_VENUE";
export type LocalFactKind = "CLIMATE_ENVIRONMENT" | "BUILT_ENVIRONMENT" | "MARKET_CHARACTERISTIC" | "INDUSTRY" | "VENUE_ENVIRONMENT" | "REGIONAL_TERMINOLOGY" | "REGULATORY_AUTHORITY" | "VISUAL_CONTEXT" | "APPLICATION_OPPORTUNITY";
export type LocalLinkRole = "INTERNAL_PRODUCT" | "INTERNAL_APPLICATION" | "INTERNAL_CAPABILITY" | "INTERNAL_SUPPORT" | "INTERNAL_CONVERSION" | "LOCAL_AUTHORITY" | "LOCAL_INSTITUTION" | "REGIONAL_REFERENCE";
export type ApplicationDomain = "PROJECTION_MAPPING" | "OUTDOOR_PROJECTION" | "IMMERSIVE_MEDIA" | "EXPERIENTIAL_AV" | "MUSEUM_ATTRACTION" | "SPORTS_STADIUM" | "EDUCATION_CAMPUS" | "EVENT_VENUE" | "COMMERCIAL_AV" | (string & {});
export type LocalizationLevel = 0 | 1 | 2 | 3;
export type LocalMediaRole = "PRODUCT_AUTHORITY" | "CONTEXTUAL_IN_USE" | "APPLICATION_EXPERIENCE" | "LOCAL_CONTEXTUAL_ATMOSPHERE";
export type MediaClaimClass = "DOCUMENTARY" | "CONCEPTUAL_CONTEXTUAL" | "ATMOSPHERIC" | "APPLICATION_VISUALIZATION";

export type PageAuthorityIdentity = { organizationId: string; siteId: string; pageId: string; jobId: string | null; pageRevisionIdentity: string };
export type LocalResearchEvidence = { evidenceId: string; url: string; title: string; publisher: string; sourceClass: LocalEvidenceSourceClass; retrievedAt: string; verifiedAt: string; httpStatus: number; observedClaim: string };
export type SitePageLocalContext = { contract: typeof LOCAL_CONTEXT_CONTRACT; schemaVersion: 1; contextId: string; identity: PageAuthorityIdentity; geography: { city: string; state: string; region: string; countryCode: string }; researchRevision: number; evidence: readonly LocalResearchEvidence[]; facts: readonly { factId: string; kind: LocalFactKind; statement: string; evidenceIds: readonly string[] }[]; prohibitedInferences: readonly string[]; createdAt: string };
export type SitePageLocalLinkGraph = { contract: typeof LOCAL_LINK_GRAPH_CONTRACT; schemaVersion: 1; graphId: string; identity: PageAuthorityIdentity; researchRevision: number; links: readonly { linkId: string; url: string; destinationIdentity: string | null; role: LocalLinkRole; anchorIntent: string; reason: string; evidenceIds: readonly string[]; validation: { state: "VERIFIED" | "BLOCKED"; httpStatus: number | null; checkedAt: string } }[]; createdAt: string };
export type SitePageApplicationAuthority = { contract: typeof APPLICATION_AUTHORITY_CONTRACT; schemaVersion: 1; authorityId: string; identity: PageAuthorityIdentity; productId: string; researchRevision: number; applications: readonly { applicationId: ApplicationDomain; label: string; compatibility: "SUPPORTED" | "REVIEW_REQUIRED" | "UNSUPPORTED"; relationship: string; evidenceIds: readonly string[]; internalDestinationUrl: string | null }[]; createdAt: string };
export type SitePageLocalThemeProfile = { contract: typeof LOCAL_THEME_PROFILE_CONTRACT; schemaVersion: 1; profileId: string; identity: PageAuthorityIdentity; researchRevision: number; brandAuthorityReference: string; localContextId: string; applicationAuthorityId: string; localizationLevel: LocalizationLevel; expression: { heroAtmosphere: string; environmentalCharacter: readonly string[]; materialCues: readonly string[]; accentGuidance: string; visualDensity: string; terminology: readonly string[]; compositionEmphasis: readonly string[] }; safeguards: { brandAuthorityPrecedence: true; antiClicheTerms: readonly string[]; prohibitedProximityClaims: readonly string[]; landmarkUseRequiresSpecificEvidence: true }; createdAt: string };
export type LocalizedMediaPlanItem = { mediaId: string; role: LocalMediaRole; claimClass: MediaClaimClass; source: "APPROVED_EXISTING" | "GENERATED_CANDIDATE"; productTruthReference: string | null; applicationId: ApplicationDomain | null; localContextId: string | null; generationPrompt: string | null; sha256: string; url: string; mimeType: "image/jpeg" | "image/png" | "image/webp"; altText: string; ownerReviewState: "PENDING" | "APPROVED" | "REJECTED" };
export type LocalizedCompositionPlanV2 = { contract: typeof LOCALIZED_COMPOSITION_PLAN_CONTRACT; schemaVersion: 2; planId: string; identity: PageAuthorityIdentity; priorPlanId: string; profile: "LOCATION_SERVICE"; localContextId: string; localLinkGraphId: string; applicationAuthorityId: string; localThemeProfileId: string; mediaIds: readonly string[]; validationState: "READY_FOR_OWNER_REVIEW" | "BLOCKED"; blockers: readonly string[]; wordpressMutationAuthorized: false; createdAt: string };

const required = (value: string, code: string) => { if (!value.trim()) throw new Error(code); return value.trim(); };
const evidenceIds = (context: SitePageLocalContext) => new Set(context.evidence.map((item) => item.evidenceId));
const sameIdentity = (left: PageAuthorityIdentity, right: PageAuthorityIdentity) => left.organizationId === right.organizationId && left.siteId === right.siteId && left.pageId === right.pageId && left.jobId === right.jobId && left.pageRevisionIdentity === right.pageRevisionIdentity;

export function validateLocalContext(context: SitePageLocalContext, currentPageRevision?: string): SitePageLocalContext {
  required(context.contextId, "LOCAL_CONTEXT_ID_REQUIRED"); required(context.geography.city, "LOCAL_CONTEXT_CITY_REQUIRED"); required(context.geography.state, "LOCAL_CONTEXT_STATE_REQUIRED"); required(context.geography.region, "LOCAL_CONTEXT_REGION_REQUIRED");
  if (currentPageRevision && context.identity.pageRevisionIdentity !== currentPageRevision) throw new Error("LOCAL_CONTEXT_PAGE_REVISION_STALE");
  if (context.researchRevision < 1 || context.evidence.length < 1 || context.facts.length < 1) throw new Error("LOCAL_CONTEXT_RESEARCH_REQUIRED");
  const ids = evidenceIds(context); for (const source of context.evidence) { new URL(source.url); if (source.httpStatus < 200 || source.httpStatus >= 400 || !Number.isFinite(Date.parse(source.verifiedAt)) || !required(source.observedClaim, "LOCAL_EVIDENCE_CLAIM_REQUIRED")) throw new Error("LOCAL_EVIDENCE_UNVERIFIED"); }
  for (const fact of context.facts) if (!fact.evidenceIds.length || fact.evidenceIds.some((id) => !ids.has(id))) throw new Error("LOCAL_FACT_PROVENANCE_REQUIRED");
  return structuredClone(context);
}

export function validateLocalLinkGraph(graph: SitePageLocalLinkGraph, context: SitePageLocalContext): SitePageLocalLinkGraph {
  validateLocalContext(context); if (!sameIdentity(graph.identity, context.identity) || graph.researchRevision !== context.researchRevision) throw new Error("LOCAL_LINK_GRAPH_AUTHORITY_STALE");
  const ids = evidenceIds(context); for (const link of graph.links) { const url = new URL(link.url); if (url.protocol !== "https:" || !required(link.anchorIntent, "LOCAL_LINK_ANCHOR_REQUIRED") || !required(link.reason, "LOCAL_LINK_REASON_REQUIRED") || link.validation.state !== "VERIFIED" || !link.validation.httpStatus || link.validation.httpStatus >= 400 || !link.evidenceIds.length || link.evidenceIds.some((id) => !ids.has(id))) throw new Error("LOCAL_LINK_UNVERIFIED_OR_UNJUSTIFIED"); }
  return structuredClone(graph);
}

export function validateApplicationAuthority(authority: SitePageApplicationAuthority, context: SitePageLocalContext): SitePageApplicationAuthority {
  if (!sameIdentity(authority.identity, context.identity) || authority.researchRevision !== context.researchRevision || !required(authority.productId, "APPLICATION_PRODUCT_REQUIRED")) throw new Error("APPLICATION_AUTHORITY_STALE");
  const ids = evidenceIds(context); for (const application of authority.applications) if (application.compatibility === "SUPPORTED" && (!application.evidenceIds.length || application.evidenceIds.some((id) => !ids.has(id)) || !required(application.relationship, "APPLICATION_RELATIONSHIP_REQUIRED"))) throw new Error("APPLICATION_COMPATIBILITY_EVIDENCE_REQUIRED");
  return structuredClone(authority);
}

export function deriveLocalThemeProfile(input: { profileId: string; context: SitePageLocalContext; applications: SitePageApplicationAuthority; brandAuthorityReference: string; localizationLevel: LocalizationLevel; expression: SitePageLocalThemeProfile["expression"]; antiClicheTerms: readonly string[]; createdAt: string }): SitePageLocalThemeProfile {
  const context = validateLocalContext(input.context); validateApplicationAuthority(input.applications, context); required(input.brandAuthorityReference, "BRAND_AUTHORITY_REQUIRED");
  if (input.localizationLevel === 3 && !context.facts.some((fact) => fact.kind === "VISUAL_CONTEXT" && /specific|recognizable|landmark/i.test(fact.statement))) throw new Error("LOCALIZATION_LEVEL_3_EVIDENCE_REQUIRED");
  const expressionText = JSON.stringify(input.expression).toLowerCase(); const prohibitedProximityClaims = ["local office", `${context.geography.city} office`, `${context.geography.city} installation`, `${context.geography.city} customer`, "performed this project", `headquartered in ${context.geography.state}`];
  if (input.antiClicheTerms.some((term) => expressionText.includes(term.toLowerCase()))) throw new Error("LOCAL_THEME_CLICHE_PROHIBITED");
  if (prohibitedProximityClaims.some((claim) => expressionText.includes(claim.toLowerCase()))) throw new Error("LOCAL_THEME_FALSE_PROXIMITY_PROHIBITED");
  return { contract: LOCAL_THEME_PROFILE_CONTRACT, schemaVersion: 1, profileId: required(input.profileId, "LOCAL_THEME_PROFILE_ID_REQUIRED"), identity: structuredClone(context.identity), researchRevision: context.researchRevision, brandAuthorityReference: input.brandAuthorityReference, localContextId: context.contextId, applicationAuthorityId: input.applications.authorityId, localizationLevel: input.localizationLevel, expression: structuredClone(input.expression), safeguards: { brandAuthorityPrecedence: true, antiClicheTerms: [...input.antiClicheTerms], prohibitedProximityClaims, landmarkUseRequiresSpecificEvidence: true }, createdAt: input.createdAt };
}

export function validateLocalThemeProfile(profile: SitePageLocalThemeProfile, input: { context: SitePageLocalContext; applications: SitePageApplicationAuthority }): SitePageLocalThemeProfile {
  if (!sameIdentity(profile.identity, input.context.identity) || profile.researchRevision !== input.context.researchRevision || profile.localContextId !== input.context.contextId || profile.applicationAuthorityId !== input.applications.authorityId) throw new Error("LOCAL_THEME_PROFILE_STALE");
  if (!profile.brandAuthorityReference.trim() || profile.safeguards.brandAuthorityPrecedence !== true) throw new Error("LOCAL_THEME_BRAND_AUTHORITY_REQUIRED");
  return structuredClone(profile);
}

export function validateLocalizedMedia(item: LocalizedMediaPlanItem, input: { context: SitePageLocalContext; applications: SitePageApplicationAuthority }): LocalizedMediaPlanItem {
  if (!/^[a-f0-9]{64}$/.test(item.sha256) || !item.altText.trim()) throw new Error("LOCAL_MEDIA_IDENTITY_INVALID");
  if (/\b(installed|installation|customer|client|our dallas|dallas office|headquartered)\b/i.test(item.altText) && item.claimClass !== "DOCUMENTARY") throw new Error("LOCAL_MEDIA_FALSE_PROXIMITY_CLAIM");
  if (item.source === "GENERATED_CANDIDATE" && (!item.generationPrompt?.trim() || !item.localContextId || item.localContextId !== input.context.contextId)) throw new Error("LOCAL_GENERATED_MEDIA_PROVENANCE_REQUIRED");
  if (item.role === "PRODUCT_AUTHORITY" && (item.source !== "APPROVED_EXISTING" || !item.productTruthReference)) throw new Error("LOCAL_PRODUCT_AUTHORITY_MUST_REMAIN_APPROVED");
  if (item.role === "CONTEXTUAL_IN_USE" && item.source === "GENERATED_CANDIDATE" && !item.productTruthReference) throw new Error("LOCAL_IN_USE_PRODUCT_GROUNDING_REQUIRED");
  if (item.role === "APPLICATION_EXPERIENCE" && (!item.applicationId || !input.applications.applications.some((application) => application.applicationId === item.applicationId && application.compatibility === "SUPPORTED"))) throw new Error("LOCAL_APPLICATION_MEDIA_AUTHORITY_REQUIRED");
  if (item.role === "LOCAL_CONTEXTUAL_ATMOSPHERE" && item.claimClass !== "ATMOSPHERIC") throw new Error("LOCAL_ATMOSPHERE_CLAIM_CLASS_INVALID");
  return structuredClone(item);
}