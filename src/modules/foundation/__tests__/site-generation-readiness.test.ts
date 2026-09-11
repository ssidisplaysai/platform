import { evaluateGenerationReadiness } from "../site-generation-readiness";
import type { SiteIntelligenceWorkspace, SiteOpportunity } from "../site-intelligence";
import type { SiteProductServiceAuthority, SiteSource } from "../site-product-authority-repository";
import type { SiteConfiguration } from "../types";

const site = {
  siteId: "site-rj", organizationId: "rj-metal", displayName: "Commercial Stainless Counters", domain: "example.com", canonicalUrl: "https://example.com", enabled: false, lifecycleState: "configuring", publishingStatus: "disabled", defaultPublicationStatus: "draft",
  integrations: { wordpressApiBaseUrl: "https://example.com/wp-json/wp/v2", wordpressCredentialReference: "credential-reference", workflowReference: null }, onboarding: { status: "connected", wordpressConnectionVerifiedAt: "2026-09-11T00:00:00.000Z" },
} as SiteConfiguration;
const opportunity = { opportunityId: "o1", ownerDecision: "APPROVED", capabilityState: "VERIFIED", capabilityEvidenceIds: [], capabilityAuthorityRevisions: [{ revision: 1, decision: "VERIFIED", attestation: "Owner confirms this current capability.", evidenceIds: [], evidenceRelevance: [], authorityBasis: "OWNER_ATTESTATION" }] } as SiteOpportunity;
const intelligence = { intelligenceState: "INTELLIGENCE_APPROVED", strategyState: "STRATEGY_APPROVED", creativeState: "CREATIVE_APPROVED", opportunities: [opportunity], strategyRevisions: [{ revision: 8, status: "APPROVED" }], creativeRevisions: [{ revision: 1, status: "APPROVED" }] } as SiteIntelligenceWorkspace;
const candidate = { authorityId: "a1", decision: "APPROVED", authorityBasis: "OWNER_ATTESTED", sourceIds: [], protectedClaimBlockers: [], revision: 1 } as SiteProductServiceAuthority;
const reference = { sourceId: "s1", approvalState: "REFERENCE_ONLY", authority: "REFERENCE_ONLY", sourceRole: "CREATIVE_REFERENCE", publishable: false } as SiteSource;

describe("site generation readiness", () => {
  test("allows disabled configuring sites with publication disabled when the draft target is configured", () => {
    const result = evaluateGenerationReadiness({ site, intelligence, candidates: [candidate], sources: [reference] });
    expect(result.readyToCertify).toBe(true);
    expect(result.publication).toEqual({ state: "disabled", requiredForGenerationReadiness: false });
    expect(result.counts).toMatchObject({ referenceOnlySources: 1, publishableAssets: 0, nonPublishableReferences: 1 });
  });

  test("is read-only and requires approved intelligence, capability, strategy, creative, and complete product authority", () => {
    const input = { site, intelligence, candidates: [candidate], sources: [reference] };
    const before = JSON.stringify(input);
    evaluateGenerationReadiness(input);
    expect(JSON.stringify(input)).toBe(before);
    for (const changed of [
      { intelligence: { ...intelligence, intelligenceState: "INTELLIGENCE_READY_FOR_REVIEW" } },
      { intelligence: { ...intelligence, opportunities: [{ ...opportunity, capabilityState: "OWNER_VALIDATION_REQUIRED", capabilityAuthorityRevisions: [] }] } },
      { intelligence: { ...intelligence, strategyState: "STRATEGY_READY_FOR_REVIEW" } },
      { intelligence: { ...intelligence, creativeState: "CREATIVE_READY_FOR_REVIEW" } },
      { candidates: [{ ...candidate, decision: "PENDING" }] },
    ]) expect(evaluateGenerationReadiness({ ...input, ...changed } as typeof input).readyToCertify).toBe(false);
  });

  test("requires a verified WordPress draft target but not publication authority", () => {
    const result = evaluateGenerationReadiness({ site: { ...site, integrations: { ...site.integrations, wordpressCredentialReference: null } }, intelligence, candidates: [candidate], sources: [] });
    expect(result.readyToCertify).toBe(false);
    expect(result.blockers.join(" ")).toContain("credential reference");
  });

  test("keeps reference-only sources non-factual and non-publishable", () => {
    const result = evaluateGenerationReadiness({ site, intelligence, candidates: [candidate], sources: [reference] });
    expect(result.counts.approvedFactualSources).toBe(0);
    expect(result.counts.publishableAssets).toBe(0);
    expect(result.snapshot.sourcesFingerprint).toBe(evaluateGenerationReadiness({ site, intelligence, candidates: [candidate], sources: [] }).snapshot.sourcesFingerprint);
  });

  test("evidence-gates protected claims and excludes them from generation", () => {
    const protectedCandidate = { ...candidate, protectedClaimBlockers: ["Certification proof required"] };
    const blocked = evaluateGenerationReadiness({ site, intelligence, candidates: [protectedCandidate], sources: [] });
    expect(blocked.readyToCertify).toBe(false);
    expect(blocked.counts.generationEligibleProducts).toBe(0);
    const verified = evaluateGenerationReadiness({ site, intelligence, candidates: [{ ...protectedCandidate, authorityBasis: "OWNER_ATTESTED_AND_EVIDENCE" }], sources: [] });
    expect(verified.readyToCertify).toBe(true);
  });

  test("only approved offerings are generation eligible and every market decision is required", () => {
    const rejected = { ...candidate, authorityId: "a2", decision: "REJECTED", authorityBasis: "NONE" } as SiteProductServiceAuthority;
    const result = evaluateGenerationReadiness({ site, intelligence, candidates: [candidate, rejected], sources: [] });
    expect(result.readyToCertify).toBe(true);
    expect(result.counts).toMatchObject({ productAuthorityProposed: 2, productAuthorityDecisions: 2, generationEligibleProducts: 1 });
    const pendingMarket = { ...intelligence, opportunities: [{ ...opportunity, ownerDecision: "PENDING" }] } as SiteIntelligenceWorkspace;
    expect(evaluateGenerationReadiness({ site, intelligence: pendingMarket, candidates: [candidate], sources: [] }).readyToCertify).toBe(false);
  });

  test("a reference-only source cannot become factual or publishable even if malformed input claims otherwise", () => {
    const malformedReference = { ...reference, approvalState: "OWNER_APPROVED", publishable: true } as unknown as SiteSource;
    const result = evaluateGenerationReadiness({ site, intelligence, candidates: [candidate], sources: [malformedReference] });
    expect(result.counts).toMatchObject({ approvedFactualSources: 0, publishableAssets: 0, referenceOnlySources: 1 });
  });
});