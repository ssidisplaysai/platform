import type { SiteIntelligenceWorkspace, SiteOpportunity } from "../site-intelligence";
import type { ProductAuthorityProgress } from "../site-workflow-resume";
import { resolveSiteWorkflowResume } from "../site-workflow-resume";
import type { SiteConfiguration } from "../types";

function site(overrides: Partial<SiteConfiguration> = {}): SiteConfiguration {
  return {
    siteId: "site-rj",
    organizationId: "rj-metal",
    siteName: "Commercial Stainless Counters",
    displayName: "Commercial Stainless Counters",
    slug: "commercial-stainless-counters",
    domain: "commercialstainlesscounters.com",
    primaryAddress: null,
    onboarding: { status: "connected", wordpressConnectionVerifiedAt: "2026-09-11T00:00:00.000Z", certificationStatus: "not_started", certificationPageId: null, certificationUrl: null, certifiedAt: null },
    canonicalUrl: "https://commercialstainlesscounters.com",
    environment: "production",
    lifecycleState: "configuring",
    enabled: false,
    healthStatus: "healthy",
    publishingStatus: "disabled",
    publicationPolicy: "draft_only",
    defaultContentType: "landing_page",
    defaultPublicationStatus: "draft",
    defaultAuthorReference: null,
    defaultCategoryReferences: [],
    integrations: { wordpressApiBaseUrl: null, wordpressCredentialReference: null, workflowReference: "workflow" },
    profiles: { promptProfileReference: null, imageProfileReference: null, seoProfileReference: null, brandProfileReference: null, analyticsProfileReference: null },
    lastConnectionTest: null,
    lastSuccessfulPublication: null,
    lastHealthCheck: null,
    createdAt: "2026-09-11T00:00:00.000Z",
    updatedAt: "2026-09-11T00:00:00.000Z",
    ...overrides,
  };
}

function opportunity(state: SiteOpportunity["capabilityState"] = "VERIFIED"): SiteOpportunity {
  return {
    opportunityId: "o1", name: "Worktables", category: "fabrication", buyer: "buyer", problemUseCase: "use", commercialValue: "HIGH", demandSignal: "signal", competitionLevel: "UNKNOWN", organizationFit: "HIGH", evidenceStrength: "MODERATE", confidence: 0.8, geographicScope: "regional", nationalRolloutPotential: false, recurringReplacementPotential: false, seoContentOpportunity: "candidate", rationale: "reason", competitorEntities: [], evidenceIds: [], capabilityState: state, capabilityEvidenceIds: [], capabilityNotes: null,
    capabilityAuthorityRevisions: state === "OWNER_VALIDATION_REQUIRED" ? [] : [{ organizationId: "rj-metal", siteId: "site-rj", opportunityId: "o1", decision: state, evidenceIds: [], evidenceRelevance: [], attestation: state === "REJECTED" ? "" : "Owner confirms.", authorityBasis: state === "VERIFIED" ? "OWNER_ATTESTATION" : undefined, qualificationNotes: null, decidedBy: "owner", decidedAt: "2026-09-11T00:00:00.000Z", revision: 1 }],
    recommendation: "review", ownerDecision: "APPROVED", decidedBy: "owner", decidedAt: "2026-09-11T00:00:00.000Z",
  };
}

function intelligence(overrides: Partial<SiteIntelligenceWorkspace> = {}): SiteIntelligenceWorkspace {
  return {
    workspaceId: "workspace", organizationId: "rj-metal", siteId: "site-rj", internalOrganizationIdentity: "rj-metal", publicBrandIdentity: "Commercial Stainless Counters", revision: 1,
    intelligenceState: "INTELLIGENCE_APPROVED", strategyState: "STRATEGY_APPROVED", creativeState: "CREATIVE_APPROVED", providerReference: null, researchStartedAt: null, researchExecutions: [], evidence: [], opportunities: [opportunity()],
    strategyRevisions: [{ revision: 8, positioning: "position", primaryAudience: "buyers", secondaryAudiences: [], valueProposition: "value", majorVerticals: [], productServiceFamilies: ["Worktables"], informationArchitecture: [], proposedSitemap: [], homepageGoals: [], conversionPaths: [], ctaHierarchy: [], trustProofRequirements: [], geographicStrategy: "regional", proposedProductAuthority: [], status: "APPROVED", reason: "approved", createdBy: "owner", createdAt: "2026-09-11T00:00:00.000Z", decidedBy: "owner", decidedAt: "2026-09-11T00:00:00.000Z" }],
    creativeInputs: [], creativeRevisions: [{ revision: 1, strategyRevision: 8, overallDirection: "direction", brandInterpretation: "brand", colorDirection: "color", typographyDirection: "type", spacingLayoutDirection: "layout", photographyStyle: "photo", generatedImageStyle: "generated", heroTreatment: "hero", ctaTreatment: "cta", trustProofPresentation: "proof", productPresentation: "products", verticalPresentation: "markets", mobileConsiderations: "mobile", visualDos: [], visualDonts: [], homepageBlueprint: [], imagePlan: [], status: "APPROVED", reason: "approved", createdBy: "owner", createdAt: "2026-09-11T00:00:00.000Z", decidedBy: "owner", decidedAt: "2026-09-11T00:00:00.000Z" }],
    audit: [], createdAt: "2026-09-11T00:00:00.000Z", updatedAt: "2026-09-11T00:00:00.000Z", ...overrides,
  };
}

function authority(overrides: Partial<ProductAuthorityProgress> = {}): ProductAuthorityProgress {
  return { proposed: 4, approved: 0, remaining: 4, protectedBlockers: [], candidates: [], ...overrides };
}
const blockedReadiness = { readyToCertify: false, certified: false, stale: false, blockers: ["WordPress credential reference is missing."] };
const readyToCertify = { readyToCertify: true, certified: false, stale: false, blockers: [] };

describe("Site Detail workflow resume resolver", () => {
  test("completed creative with pending offerings resumes Product / Service Authority", () => {
    const result = resolveSiteWorkflowResume({ site: site(), intelligence: intelligence(), productAuthority: authority(), generationReadiness: blockedReadiness });
    expect(result.primaryAction).toMatchObject({ key: "CONTINUE_PRODUCT_SERVICE_AUTHORITY", label: "CONTINUE PRODUCT / SERVICE AUTHORITY" });
    expect(result.primaryAction.href).toContain("organizationId=rj-metal");
    expect(result.primaryAction.href).toContain("siteId=site-rj");
    expect(result.productAuthority).toMatchObject({ proposed: 4, approved: 0, remaining: 4 });
  });

  test("complete Product Authority advances to explicit Generation Readiness certification", () => {
    const result = resolveSiteWorkflowResume({ site: site(), intelligence: intelligence(), productAuthority: authority({ approved: 4, remaining: 0 }), generationReadiness: readyToCertify });
    expect(result.primaryAction).toMatchObject({ key: "CONTINUE_GENERATION_READINESS", label: "CONTINUE TO GENERATION READINESS" });
    expect(result.primaryAction.href).toContain("/generation-readiness?");
    expect(result.stages.find((stage) => stage.key === "product_authority")?.status).toBe("COMPLETE");
    expect(result.stages.find((stage) => stage.key === "generation_readiness")?.status).toBe("READY_FOR_REVIEW");
    expect(result.blockers).toEqual([]);
  });

  test("all-rejected Product Authority remains incomplete until one offering is approved", () => {
    const result = resolveSiteWorkflowResume({ site: site(), intelligence: intelligence(), productAuthority: authority({ approved: 0, remaining: 0 }), generationReadiness: blockedReadiness });
    expect(result.primaryAction.key).toBe("CONTINUE_PRODUCT_SERVICE_AUTHORITY");
    expect(result.blockers).toContain("At least one product or service must be approved for this site.");
  });

  test("incomplete onboarding resumes onboarding", () => {
    const result = resolveSiteWorkflowResume({ site: site({ onboarding: { status: "not_started", wordpressConnectionVerifiedAt: null, certificationStatus: "not_started", certificationPageId: null, certificationUrl: null, certifiedAt: null } }), intelligence: null, productAuthority: authority({ proposed: 0, remaining: 0 }), generationReadiness: blockedReadiness });
    expect(result.primaryAction.key).toBe("CONTINUE_SITE_ONBOARDING");
  });

  test("incomplete intelligence and capability review resume their exact sections", () => {
    expect(resolveSiteWorkflowResume({ site: site(), intelligence: intelligence({ intelligenceState: "INTELLIGENCE_READY_FOR_REVIEW" }), productAuthority: authority(), generationReadiness: blockedReadiness }).primaryAction.key).toBe("CONTINUE_SITE_INTELLIGENCE");
    expect(resolveSiteWorkflowResume({ site: site(), intelligence: intelligence({ opportunities: [opportunity("OWNER_VALIDATION_REQUIRED")] }), productAuthority: authority(), generationReadiness: blockedReadiness }).primaryAction).toMatchObject({ key: "CONTINUE_CAPABILITY_REVIEW", href: expect.stringContaining("#capability-review") });
  });

  test("proposed strategy and incomplete creative resume review surfaces", () => {
    const proposedStrategy = intelligence({ strategyState: "STRATEGY_READY_FOR_REVIEW", strategyRevisions: [{ ...intelligence().strategyRevisions[0], status: "PROPOSED", decidedBy: null, decidedAt: null }] });
    expect(resolveSiteWorkflowResume({ site: site(), intelligence: proposedStrategy, productAuthority: authority(), generationReadiness: blockedReadiness }).primaryAction).toMatchObject({ key: "REVIEW_STRATEGY", href: expect.stringContaining("#strategy-review") });
    const proposedCreative = intelligence({ creativeState: "CREATIVE_READY_FOR_REVIEW", creativeRevisions: [{ ...intelligence().creativeRevisions[0], status: "PROPOSED", decidedBy: null, decidedAt: null }] });
    expect(resolveSiteWorkflowResume({ site: site(), intelligence: proposedCreative, productAuthority: authority(), generationReadiness: blockedReadiness }).primaryAction).toMatchObject({ key: "CONTINUE_CREATIVE_DIRECTION", label: "REVIEW CREATIVE DIRECTION", href: expect.stringContaining("#creative-direction") });
  });

  test("workflow and technical status remain separate and resolution is read-only", () => {
    const inputSite = site(); const inputIntelligence = intelligence(); const inputAuthority = authority();
    const before = JSON.stringify({ inputSite, inputIntelligence, inputAuthority });
    const result = resolveSiteWorkflowResume({ site: inputSite, intelligence: inputIntelligence, productAuthority: inputAuthority, generationReadiness: blockedReadiness });
    expect(result.stages.map((stage) => stage.key)).toEqual(["connection", "intelligence", "capability", "strategy", "creative", "product_authority", "generation_readiness", "site_build", "publication"]);
    expect(result.stages.find((stage) => stage.key === "publication")?.status).toBe("DISABLED");
    expect(JSON.stringify({ inputSite, inputIntelligence, inputAuthority })).toBe(before);
  });

  test("only current explicit certification advances to Site Build without starting it", () => {
    const result = resolveSiteWorkflowResume({ site: site(), intelligence: intelligence(), productAuthority: authority({ approved: 4, remaining: 0 }), generationReadiness: { ...readyToCertify, certified: true } });
    expect(result.stages.find((stage) => stage.key === "generation_readiness")?.status).toBe("COMPLETE");
    expect(result.primaryAction.key).toBe("CONTINUE_SITE_BUILD");
    expect(result.primaryAction).toMatchObject({ label: "START SITE BUILD", href: expect.stringContaining("/build?") });
    expect(result.stages.find((stage) => stage.key === "site_build")?.status).toBe("NOT_STARTED");
  });

  test("an update-ready build resumes through CONTINUE SITE BUILD without publication", () => {
    const result = resolveSiteWorkflowResume({ site: site(), intelligence: intelligence(), productAuthority: authority({ approved: 4, remaining: 0 }), generationReadiness: { ...readyToCertify, certified: true }, siteBuildStarted: true, siteBuildStage: "WORDPRESS_CONTENT_UPDATE" });
    expect(result.primaryAction).toMatchObject({ key: "CONTINUE_SITE_BUILD", label: "CONTINUE SITE BUILD", href: expect.stringContaining("/build?") });
    expect(result.primaryAction.description).toContain("exact existing WordPress drafts");
    expect(result.stages.find((stage) => stage.key === "site_build")?.detail).toContain("Page review is complete");
    expect(result.stages.find((stage) => stage.key === "publication")?.status).toBe("DISABLED");
  });

  test("a synchronized build resumes into WordPress draft review and QA", () => {
    const result = resolveSiteWorkflowResume({ site: site(), intelligence: intelligence(), productAuthority: authority({ approved: 4, remaining: 0 }), generationReadiness: { ...readyToCertify, certified: true }, siteBuildStarted: true, siteBuildStage: "WORDPRESS_DRAFT_REVIEW" });
    expect(result.primaryAction).toMatchObject({ key: "CONTINUE_SITE_BUILD", label: "CONTINUE SITE BUILD" });
    expect(result.primaryAction.description).toContain("draft review and site QA");
    expect(result.stages.find((stage) => stage.key === "site_build")?.detail).toContain("content synchronization is complete");
  });

  test("a visual-review build resumes directly to the resolver-owned action route", () => {
    const next = { action: "REVIEW_REMAINING_DESIGNS", label: "REVIEW REMAINING 14 DESIGNS", detail: "Review 14 page-specific visual assemblies before site QA or publication.", route: "/sites/site-rj/build/designs?organizationId=rj-metal&siteId=site-rj" };
    const result = resolveSiteWorkflowResume({ site: site(), intelligence: intelligence(), productAuthority: authority({ approved: 4, remaining: 0 }), generationReadiness: { ...readyToCertify, certified: true }, siteBuildStarted: true, siteBuildStage: "SITE_VISUAL_REVIEW", siteBuildNext: next });
    expect(result.primaryAction).toEqual({ key: "REVIEW_REMAINING_DESIGNS", title: "Site Visual Review", description: next.detail, label: next.label, href: next.route });
  });

  test("an approved visual build resumes directly to the governed Site QA route", () => {
    const next = { action: "REVIEW_SITE_QA", label: "REVIEW SITE QA", detail: "Verify exact drafts and publication safeguards.", route: "/sites/site-rj/build/site-qa?organizationId=rj-metal&siteId=site-rj" };
    const result = resolveSiteWorkflowResume({ site: site(), intelligence: intelligence(), productAuthority: authority({ approved: 4, remaining: 0 }), generationReadiness: { ...readyToCertify, certified: true }, siteBuildStarted: true, siteBuildStage: "SITE_QA", siteBuildNext: next });
    expect(result.primaryAction).toEqual({ key: "REVIEW_SITE_QA", title: "Site QA", description: next.detail, label: next.label, href: next.route });
    expect(result.stages.find((stage) => stage.key === "publication")?.status).toBe("DISABLED");
  });

  test("remaining governed stages resume to their exact action routes", () => {
    const base = { site: site(), intelligence: intelligence(), productAuthority: authority({ approved: 4, remaining: 0 }), generationReadiness: { ...readyToCertify, certified: true }, siteBuildStarted: true };
    for (const next of [
      { stage: "NAVIGATION_REVIEW", action: "REVIEW_NAVIGATION", label: "REVIEW NAVIGATION", route: "/build/navigation", key: "REVIEW_NAVIGATION" },
      { stage: "PUBLICATION_READINESS", action: "REVIEW_PUBLICATION_READINESS", label: "REVIEW PUBLICATION READINESS", route: "/build/publication-readiness", key: "REVIEW_PUBLICATION_READINESS" },
      { stage: "PUBLICATION_AUTHORIZATION", action: "AUTHORIZE_PUBLICATION", label: "REVIEW PUBLICATION AUTHORIZATION", route: "/build/publication-authorization", key: "AUTHORIZE_PUBLICATION" },
      { stage: "PUBLICATION_EXECUTION_REVIEW", action: "REVIEW_PUBLICATION_EXECUTION", label: "REVIEW PUBLICATION EXECUTION", route: "/build/publication-execution", key: "REVIEW_PUBLICATION_EXECUTION" },
      { stage: "PUBLICATION_EXECUTING", action: "RESUME_PUBLICATION_EXECUTION", label: "RESUME PUBLICATION EXECUTION", route: "/build/publication-execution", key: "RESUME_PUBLICATION_EXECUTION" },
      { stage: "PUBLICATION_VERIFICATION", action: "VERIFY_PUBLICATION", label: "VERIFY PUBLICATION", route: "/build/publication-execution", key: "VERIFY_PUBLICATION" },
      { stage: "COMPLETE", action: "REVIEW_COMPLETED_SITE", label: "REVIEW COMPLETED SITE", route: "/build/publication-execution", key: "REVIEW_COMPLETED_SITE" },
    ]) {
      const result = resolveSiteWorkflowResume({ ...base, siteBuildStage: next.stage, siteBuildNext: { action: next.action, label: next.label, detail: "Governed continuation.", route: next.route } });
      expect(result.primaryAction).toMatchObject({ key: next.key, label: next.label, href: next.route });
      expect(result.stages.find((stage) => stage.key === "publication")?.status).toBe("DISABLED");
    }
  });
});