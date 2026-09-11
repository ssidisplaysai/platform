import { createHash } from "node:crypto";

import { isCapabilityReviewComplete, selectDistinctCapabilityOpportunities } from "./site-capability-transition";
import type { SiteIntelligenceWorkspace } from "./site-intelligence";
import type { SiteProductServiceAuthority, SiteSource } from "./site-product-authority-repository";
import type { SiteConfiguration } from "./types";

export const GENERATION_POLICY_VERSION = "site-draft-generation-v1";

export type GenerationReadinessCheck = {
  key: string;
  group: "FOUNDATION" | "DIRECTION" | "CONTENT_AUTHORITY" | "BUILD_SAFETY";
  label: string;
  passed: boolean;
  detail: string;
  actionHref: string | null;
};

export type GenerationAuthoritySnapshot = {
  strategyRevision: number | null;
  creativeRevision: number | null;
  marketFingerprint: string;
  capabilityFingerprint: string;
  productServiceFingerprint: string;
  sourcesFingerprint: string;
  generationPolicyVersion: string;
};

export type GenerationReadinessResult = {
  readyToCertify: boolean;
  checks: GenerationReadinessCheck[];
  blockers: string[];
  snapshot: GenerationAuthoritySnapshot;
  counts: {
    marketDecisions: number;
    capabilityReviews: number;
    productAuthorityProposed: number;
    productAuthorityDecisions: number;
    productAuthorityRemaining: number;
    generationEligibleProducts: number;
    approvedFactualSources: number;
    ownerAttestedAuthority: number;
    evidenceVerifiedAuthority: number;
    referenceOnlySources: number;
    publishableAssets: number;
    nonPublishableReferences: number;
  };
  publication: {
    state: SiteConfiguration["publishingStatus"];
    requiredForGenerationReadiness: false;
  };
};

function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function scoped(site: SiteConfiguration, path: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}organizationId=${encodeURIComponent(site.organizationId)}&siteId=${encodeURIComponent(site.siteId)}`;
}

export function evaluateGenerationReadiness(input: {
  site: SiteConfiguration;
  intelligence: SiteIntelligenceWorkspace | null;
  sources: SiteSource[];
  candidates: SiteProductServiceAuthority[];
}): GenerationReadinessResult {
  const { site, intelligence } = input;
  const opportunities = intelligence ? selectDistinctCapabilityOpportunities(intelligence.opportunities) : [];
  const distinctCapabilities = opportunities;
  const marketReady = opportunities.length > 0 && opportunities.every((item) => item.ownerDecision !== "PENDING");
  const capabilityReady = distinctCapabilities.length > 0 && distinctCapabilities.every(isCapabilityReviewComplete);
  const strategy = intelligence?.strategyRevisions.at(-1) ?? null;
  const creative = intelligence?.creativeRevisions.at(-1) ?? null;
  const strategyReady = intelligence?.strategyState === "STRATEGY_APPROVED" && strategy?.status === "APPROVED";
  const creativeReady = intelligence?.creativeState === "CREATIVE_APPROVED" && creative?.status === "APPROVED";
  const approvedCandidates = input.candidates.filter((item) => item.decision === "APPROVED" || item.decision === "QUALIFIED");
  const decidedCandidates = input.candidates.filter((item) => item.decision !== "PENDING");
  const generationEligible = approvedCandidates.filter((item) => item.protectedClaimBlockers.length === 0 || item.authorityBasis === "OWNER_ATTESTED_AND_EVIDENCE");
  const productReady = input.candidates.length > 0 && decidedCandidates.length === input.candidates.length && approvedCandidates.length > 0;
  const protectedClaimsBounded = generationEligible.length === approvedCandidates.length;
  const eligibleAuthoritySources = input.sources.filter((item) => item.approvalState === "OWNER_APPROVED" && item.authority !== "REFERENCE_ONLY");
  const approvedFactualSources = eligibleAuthoritySources.filter((item) => item.authority === "EVIDENCE_SOURCE" && item.retrievalState === "AVAILABLE" && Boolean(item.contentFingerprint || item.sha256));
  const referenceOnlySources = input.sources.filter((item) => item.authority === "REFERENCE_ONLY");
  const publishableAssets = input.sources.filter((item) => item.authority !== "REFERENCE_ONLY" && item.publishable === true);
  const sourcesSufficient = productReady && protectedClaimsBounded;
  const connectionReady = Boolean(site.domain && site.canonicalUrl && site.integrations.wordpressApiBaseUrl && site.integrations.wordpressCredentialReference && site.onboarding?.wordpressConnectionVerifiedAt && (site.onboarding.status === "connected" || site.onboarding.status === "certified"));
  const draftTargetReady = Boolean(site.integrations.wordpressApiBaseUrl && site.integrations.wordpressCredentialReference && site.defaultPublicationStatus === "draft");
  const lifecycleAllowsDraft = site.lifecycleState === "configuring" || site.lifecycleState === "draft" || site.lifecycleState === "active";

  const checks: GenerationReadinessCheck[] = [
    { key: "site_connection", group: "FOUNDATION", label: "Site connection", passed: connectionReady, detail: connectionReady ? "The canonical site and previously verified WordPress connection are available." : "Complete the domain, WordPress endpoint, credential reference, and connection verification.", actionHref: scoped(site, `/sites/${site.siteId}/onboarding`) },
    { key: "site_intelligence", group: "FOUNDATION", label: "Site intelligence", passed: intelligence?.intelligenceState === "INTELLIGENCE_APPROVED", detail: intelligence?.intelligenceState === "INTELLIGENCE_APPROVED" ? "Site Intelligence is approved." : "Site Intelligence requires explicit approval.", actionHref: scoped(site, `/sites/${site.siteId}/intelligence`) },
    { key: "market_authority", group: "FOUNDATION", label: "Market authority", passed: marketReady, detail: marketReady ? `${opportunities.length} market decisions are complete.` : "Complete every required market opportunity decision.", actionHref: `${scoped(site, `/sites/${site.siteId}/intelligence`)}#market-review` },
    { key: "capability_authority", group: "FOUNDATION", label: "Capability authority", passed: capabilityReady, detail: capabilityReady ? `${distinctCapabilities.length} distinct capability reviews are complete.` : "Complete capability review, including legacy review-required records.", actionHref: `${scoped(site, `/sites/${site.siteId}/intelligence`)}#capability-review` },
    { key: "strategy", group: "DIRECTION", label: "Strategy approved", passed: strategyReady, detail: strategyReady ? `Strategy revision ${strategy.revision} is approved.` : "Approve the current effective strategy revision.", actionHref: `${scoped(site, `/sites/${site.siteId}/intelligence`)}#strategy-review` },
    { key: "creative_direction", group: "DIRECTION", label: "Creative Direction approved", passed: creativeReady, detail: creativeReady ? `Creative Direction revision ${creative.revision} is approved.` : "Approve the current effective Creative Direction revision.", actionHref: `${scoped(site, `/sites/${site.siteId}/intelligence`)}#creative-direction` },
    { key: "product_service_authority", group: "CONTENT_AUTHORITY", label: "Product / Service Authority", passed: productReady, detail: productReady ? `${decidedCandidates.length} of ${input.candidates.length} decisions are complete; ${approvedCandidates.length} are approved for generation.` : "Finish owner decisions and approve at least one offering.", actionHref: scoped(site, "/products/new?source=manual") },
    { key: "sources_of_truth", group: "CONTENT_AUTHORITY", label: "Sources of Truth sufficient", passed: sourcesSufficient, detail: sourcesSufficient ? "Owner-attested authority and bounded approved sources are sufficient; shared sources need not be duplicated." : "Resolve evidence required by approved protected claims before generation.", actionHref: scoped(site, "/products/new?source=manual") },
    { key: "generation_policy", group: "BUILD_SAFETY", label: "Draft generation bounded", passed: protectedClaimsBounded, detail: protectedClaimsBounded ? "Generation is limited to approved authority; discovery and reference-only material remain non-factual." : "One or more approved protected claims require evidence or exclusion.", actionHref: scoped(site, "/products/new?source=manual") },
    { key: "site_activation", group: "BUILD_SAFETY", label: "Site activation not required", passed: true, detail: site.enabled ? "The site is enabled, but Generation Readiness still permits draft output only." : "The site remains disabled; activation is not required for bounded draft generation.", actionHref: null },
    { key: "draft_lifecycle", group: "BUILD_SAFETY", label: "Pre-build lifecycle allowed", passed: lifecycleAllowsDraft, detail: lifecycleAllowsDraft ? `Lifecycle ${site.lifecycleState} is valid for draft generation.` : `Lifecycle ${site.lifecycleState} prevents draft generation.`, actionHref: scoped(site, `/sites/${site.siteId}/settings`) },
    { key: "wordpress_target", group: "BUILD_SAFETY", label: "WordPress draft target configured", passed: draftTargetReady, detail: draftTargetReady ? "The configured target supports draft-only creation while the site remains pre-live." : "Configure the WordPress endpoint, credential reference, and draft default.", actionHref: scoped(site, `/sites/${site.siteId}/settings`) },
    { key: "publication_safety", group: "BUILD_SAFETY", label: "Publication remains disabled", passed: true, detail: "Publication is not required for Generation Readiness and remains a later certification boundary.", actionHref: null },
  ];
  const blockers = checks.filter((item) => !item.passed).map((item) => item.detail);

  return {
    readyToCertify: blockers.length === 0,
    checks,
    blockers,
    snapshot: {
      strategyRevision: strategyReady ? strategy.revision : null,
      creativeRevision: creativeReady ? creative.revision : null,
      marketFingerprint: fingerprint(opportunities.map((item) => ({ opportunityId: item.opportunityId, ownerDecision: item.ownerDecision, decidedBy: item.decidedBy, decidedAt: item.decidedAt })).sort((left, right) => left.opportunityId.localeCompare(right.opportunityId))),
      capabilityFingerprint: fingerprint(distinctCapabilities.map((item) => ({ opportunityId: item.opportunityId, capabilityAuthorityRevisions: item.capabilityAuthorityRevisions, capabilityState: item.capabilityState })).sort((left, right) => left.opportunityId.localeCompare(right.opportunityId))),
      productServiceFingerprint: fingerprint(approvedCandidates.map((item) => ({ authorityId: item.authorityId, revision: item.revision, decision: item.decision, authorityBasis: item.authorityBasis, sourceIds: [...item.sourceIds].sort(), protectedClaimBlockers: [...item.protectedClaimBlockers].sort() })).sort((left, right) => left.authorityId.localeCompare(right.authorityId))),
      sourcesFingerprint: fingerprint(eligibleAuthoritySources.map((item) => ({ sourceId: item.sourceId, authority: item.authority, sourceRole: item.sourceRole, contentFingerprint: item.contentFingerprint, sha256: item.sha256, publishable: item.publishable })).sort((left, right) => left.sourceId.localeCompare(right.sourceId))),
      generationPolicyVersion: GENERATION_POLICY_VERSION,
    },
    counts: {
      marketDecisions: opportunities.filter((item) => item.ownerDecision !== "PENDING").length,
      capabilityReviews: distinctCapabilities.filter(isCapabilityReviewComplete).length,
      productAuthorityProposed: input.candidates.length,
      productAuthorityDecisions: decidedCandidates.length,
      productAuthorityRemaining: input.candidates.length - decidedCandidates.length,
      generationEligibleProducts: generationEligible.length,
      approvedFactualSources: approvedFactualSources.length,
      ownerAttestedAuthority: approvedCandidates.filter((item) => item.authorityBasis === "OWNER_ATTESTED").length,
      evidenceVerifiedAuthority: approvedCandidates.filter((item) => item.authorityBasis === "OWNER_ATTESTED_AND_EVIDENCE").length,
      referenceOnlySources: referenceOnlySources.length,
      publishableAssets: publishableAssets.length,
      nonPublishableReferences: referenceOnlySources.filter((item) => !item.publishable).length,
    },
    publication: { state: site.publishingStatus, requiredForGenerationReadiness: false },
  };
}