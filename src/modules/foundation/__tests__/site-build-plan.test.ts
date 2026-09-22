import { synthesizeSiteBuildPlan } from "../site-build-plan";
import { isSiteBuildSnapshotCurrent } from "../site-build-service";
import type { SiteIntelligenceWorkspace } from "../site-intelligence";
import type { SiteProductServiceAuthority } from "../site-product-authority-repository";
import type { SiteConfiguration } from "../types";

const snapshot = { strategyRevision: 8, creativeRevision: 1, marketFingerprint: "market", capabilityFingerprint: "capability", productServiceFingerprint: "product", sourcesFingerprint: "sources", generationPolicyVersion: "site-draft-generation-v1" };
const opportunity = { opportunityId: "o1", name: "Worktables", ownerDecision: "APPROVED", capabilityState: "VERIFIED", capabilityEvidenceIds: [], capabilityAuthorityRevisions: [{ decision: "VERIFIED", attestation: "Owner confirms.", evidenceIds: [], evidenceRelevance: [], authorityBasis: "OWNER_ATTESTATION", revision: 1 }] };
const strategy = { revision: 8, status: "APPROVED", primaryAudience: "Commercial buyers", secondaryAudiences: ["Facilities teams"], majorVerticals: ["Foodservice", "Unsupported"], informationArchitecture: ["Home", "Capabilities", "About", "Request a Quote", "Projects"], proposedSitemap: ["/", "/capabilities", "/request-a-quote"], homepageGoals: ["Explain the approved offer"], conversionPaths: ["Qualified quote intake"], ctaHierarchy: ["Request a Quote"], trustProofRequirements: ["Use approved factual grounding only"], valueProposition: "Guide buyers to qualified quote conversations.", synthesisContext: { semanticClassifications: [{ opportunityId: "o1", marketVerticals: ["Foodservice"] }, { opportunityId: "pending", marketVerticals: ["Unsupported"] }] } };
const creative = { revision: 1, status: "APPROVED", ctaTreatment: "Guide qualified buyers to request a quote and discuss project scope.", trustProofPresentation: "Use approved factual grounding in conversion guidance.", homepageBlueprint: ["Hero", "Capabilities", "Quote CTA"] };
const approved = { authorityId: "a1", displayName: "Commercial Worktables", slug: "commercial-worktables", description: "Owner-confirmed worktable offering.", decision: "APPROVED", authorityBasis: "OWNER_ATTESTED", protectedClaimBlockers: [], sourceIds: [] } as SiteProductServiceAuthority;

describe("bounded Site Build plan synthesis", () => {
  test("derives structural, approved offering, and approved market pages with traceable authority", () => {
    const plan = synthesizeSiteBuildPlan({ buildSessionId: "build-1", site: { siteId: "site-1", organizationId: "org-1", displayName: "Site" } as SiteConfiguration, intelligence: { opportunities: [opportunity, { ...opportunity, opportunityId: "pending", ownerDecision: "PENDING" }], strategyRevisions: [strategy], creativeRevisions: [creative] } as SiteIntelligenceWorkspace, strategy: strategy as never, creative: creative as never, candidates: [approved], sources: [], authoritySnapshot: snapshot, revision: 1, actor: "owner", now: "2026-09-11T00:00:00.000Z" });
    expect(plan.status).toBe("PROPOSED");
    expect(plan.pages.map((item) => item.pageType)).toEqual(expect.arrayContaining(["HOME", "CAPABILITIES", "OFFERING", "MARKET", "ABOUT", "CONTACT"]));
    expect(plan.pages.find((item) => item.pageType === "OFFERING")?.authority).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "PRODUCT_SERVICE", referenceId: "a1" })]));
    expect(plan.pages.filter((item) => item.pageType === "MARKET").map((item) => item.name)).toEqual(["Foodservice Solutions"]);
    expect(plan.pages.some((item) => /Unsupported|Projects/i.test(item.name))).toBe(false);
  });

  test("fails closed without approved direction or eligible product/service authority", () => {
    const base = { buildSessionId: "build-1", site: { siteId: "site-1", organizationId: "org-1", displayName: "Site" } as SiteConfiguration, intelligence: { opportunities: [opportunity] } as SiteIntelligenceWorkspace, strategy: strategy as never, creative: creative as never, candidates: [approved], sources: [], authoritySnapshot: snapshot, revision: 1, actor: "owner" };
    expect(() => synthesizeSiteBuildPlan({ ...base, strategy: { ...strategy, status: "PROPOSED" } as never })).toThrow("APPROVED_DIRECTION_REQUIRED");
    expect(() => synthesizeSiteBuildPlan({ ...base, candidates: [{ ...approved, decision: "REJECTED" }] })).toThrow("APPROVED_PRODUCT_SERVICE_AUTHORITY_REQUIRED");
    expect(() => synthesizeSiteBuildPlan({ ...base, candidates: [{ ...approved, protectedClaimBlockers: ["Proof required"] }] })).toThrow("APPROVED_PRODUCT_SERVICE_AUTHORITY_REQUIRED");
  });

  test("still consumes approved Product / Service Authority only when canonical candidates are pending", () => {
    const pendingCanonical = {
      ...approved,
      authorityId: "site-authority-canonical-site-1-prod-1",
      displayName: "Fan Cooled Projector Enclosures",
      decision: "PENDING",
      provenance: { kind: "CANONICAL_PRODUCT_REGISTRY", referenceId: "prod-1" },
    } as SiteProductServiceAuthority;
    const sourceApproved = {
      ...approved,
      authorityId: "source-approved-1",
      displayName: "Projector Enclosure",
      slug: "projector-enclosure",
      description: "Commercial buyers approved projector enclosure offering.",
      decision: "APPROVED",
      provenance: { kind: "SOURCE", referenceId: "source-1" },
    } as SiteProductServiceAuthority;
    const plan = synthesizeSiteBuildPlan({
      buildSessionId: "build-approved-only",
      site: { siteId: "site-1", organizationId: "org-1", displayName: "Site" } as SiteConfiguration,
      intelligence: { opportunities: [opportunity], strategyRevisions: [strategy], creativeRevisions: [creative] } as SiteIntelligenceWorkspace,
      strategy: strategy as never,
      creative: creative as never,
      candidates: [pendingCanonical, sourceApproved],
      sources: [],
      authoritySnapshot: snapshot,
      revision: 1,
      actor: "owner",
    });
    const offeringNames = plan.pages.filter((item) => item.pageType === "OFFERING").map((item) => item.name);
    expect(offeringNames).toEqual(["Projector Enclosure"]);
  });

  test("fails closed when strategy-derived positioning is unsupported by approved product/capability authority", () => {
    const unsupportedStrategy = {
      ...strategy,
      homepageGoals: ["Present marine welding authority for naval fleet retrofits"],
      primaryAudience: "Marine procurement directors",
    };
    const workspace = {
      opportunities: [{
        opportunityId: "o-food",
        name: "Bakery prep systems",
        category: "Foodservice equipment",
        buyer: "Bakery operators",
        problemUseCase: "Organizing bakery prep areas",
        ownerDecision: "APPROVED",
        capabilityState: "VERIFIED",
        capabilityEvidenceIds: [],
        capabilityAuthorityRevisions: [{ decision: "VERIFIED", attestation: "Owner confirms.", evidenceIds: [], evidenceRelevance: [], authorityBasis: "OWNER_ATTESTATION", revision: 1 }],
      }],
      strategyRevisions: [unsupportedStrategy],
      creativeRevisions: [creative],
    } as SiteIntelligenceWorkspace;
    const candidate = {
      ...approved,
      displayName: "Bakery Prep Systems",
      slug: "bakery-prep-systems",
      description: "Owner-confirmed bakery prep systems.",
    } as SiteProductServiceAuthority;

    expect(() => synthesizeSiteBuildPlan({
      buildSessionId: "build-unsupported",
      site: { siteId: "site-1", organizationId: "org-1", displayName: "Site" } as SiteConfiguration,
      intelligence: workspace,
      strategy: unsupportedStrategy as never,
      creative: creative as never,
      candidates: [candidate],
      sources: [],
      authoritySnapshot: snapshot,
      revision: 1,
      actor: "owner",
    })).toThrow(/BUILD_PLAN_AUTHORITY_COMPATIBILITY_FAILED/);
  });

  test("accepts approved product-family, capability, and conversion intent material when mapped to relevant authority classes", () => {
    const compatibleStrategy = {
      ...strategy,
      primaryAudience: "Facilities/project teams evaluating projector-enclosure solutions for indoor and outdoor installations",
      homepageGoals: [
        "Explain the currently approved projector-enclosure product families and their intended use contexts.",
        "Present approved protection, cooling, noise-control, security, specialty-format, and application capabilities only where current authority supports them.",
        "Guide buyers from product and application evaluation into a qualified quote or project discussion using approved factual grounding.",
      ],
    };
    const compatibleCreative = {
      ...creative,
      ctaTreatment: "Guide visitors to evaluate approved options and request a qualified quote conversation.",
      trustProofPresentation: "Use approved factual grounding in quote and project discussions.",
    };
    const compatibleOpportunity = {
      opportunityId: "o-projector",
      name: "Projector enclosure protection and noise control",
      category: "Projection enclosure systems",
      buyer: "Facilities and project teams",
      problemUseCase: "Protect projectors with cooling, security, weather resistance, and noise control in indoor and outdoor environments.",
      demandSignal: "Integrator and venue demand for protected projection systems",
      ownerDecision: "APPROVED",
      capabilityState: "VERIFIED",
      capabilityEvidenceIds: [],
      capabilityAuthorityRevisions: [{ decision: "VERIFIED", attestation: "Owner confirms projector enclosure protection, cooling, noise control, and security capabilities.", evidenceIds: [], evidenceRelevance: [], authorityBasis: "OWNER_ATTESTATION", revision: 1 }],
    };
    const compatibleOffering = {
      ...approved,
      authorityId: "offer-projector-enclosure",
      displayName: "Projector Enclosure Families",
      slug: "projector-enclosure-families",
      description: "Approved product families covering weather protection, cooling, security, noise control, and specialty application formats.",
    } as SiteProductServiceAuthority;

    const plan = synthesizeSiteBuildPlan({
      buildSessionId: "build-compatible-authority",
      site: { siteId: "site-1", organizationId: "org-1", displayName: "Site" } as SiteConfiguration,
      intelligence: { opportunities: [compatibleOpportunity], strategyRevisions: [compatibleStrategy], creativeRevisions: [compatibleCreative] } as SiteIntelligenceWorkspace,
      strategy: compatibleStrategy as never,
      creative: compatibleCreative as never,
      candidates: [compatibleOffering],
      sources: [],
      authoritySnapshot: snapshot,
      revision: 1,
      actor: "owner",
    });

    expect(plan.status).toBe("PROPOSED");
    expect(plan.pages.some((item) => item.pageType === "OFFERING" && item.name === "Projector Enclosure Families")).toBe(true);
  });

  test("fails closed for unsupported net-new product claims", () => {
    const unsupportedProductStrategy = {
      ...strategy,
      homepageGoals: ["Explain our approved marine welding fleet retrofit product families."],
      primaryAudience: "Marine retrofit procurement teams",
    };
    const workspace = {
      opportunities: [opportunity],
      strategyRevisions: [unsupportedProductStrategy],
      creativeRevisions: [creative],
    } as SiteIntelligenceWorkspace;

    expect(() => synthesizeSiteBuildPlan({
      buildSessionId: "build-unsupported-product",
      site: { siteId: "site-1", organizationId: "org-1", displayName: "Site" } as SiteConfiguration,
      intelligence: workspace,
      strategy: unsupportedProductStrategy as never,
      creative: creative as never,
      candidates: [approved],
      sources: [],
      authoritySnapshot: snapshot,
      revision: 1,
      actor: "owner",
    })).toThrow(/BUILD_PLAN_AUTHORITY_COMPATIBILITY_FAILED/);
  });

  test("fails closed for unsupported net-new capability and geography expansion", () => {
    const unsupportedCapabilityStrategy = {
      ...strategy,
      homepageGoals: ["Present approved cryogenic pipeline welding and offshore platform certification capabilities across Europe."],
      primaryAudience: "European offshore energy operators",
    };
    const workspace = {
      opportunities: [{
        ...opportunity,
        name: "Commercial stainless worktables",
        category: "Foodservice equipment",
        buyer: "Foodservice buyers",
        problemUseCase: "Organize prep areas",
      }],
      strategyRevisions: [unsupportedCapabilityStrategy],
      creativeRevisions: [creative],
    } as SiteIntelligenceWorkspace;

    expect(() => synthesizeSiteBuildPlan({
      buildSessionId: "build-unsupported-capability-geo",
      site: { siteId: "site-1", organizationId: "org-1", displayName: "Site" } as SiteConfiguration,
      intelligence: workspace,
      strategy: unsupportedCapabilityStrategy as never,
      creative: creative as never,
      candidates: [approved],
      sources: [],
      authoritySnapshot: snapshot,
      revision: 1,
      actor: "owner",
    })).toThrow(/BUILD_PLAN_AUTHORITY_COMPATIBILITY_FAILED/);
  });

  test("fails closed for unsupported strategy audience and succeeds when capability authority supports it", () => {
    const compatibleCandidate = {
      ...approved,
      displayName: "Audio Display Pods",
      slug: "audio-display-pods",
      description: "Owner-confirmed audio display pods.",
    } as SiteProductServiceAuthority;

    const unsupportedAudienceStrategy = {
      ...strategy,
      homepageGoals: ["Present approved audio display offerings"],
      primaryAudience: "Airport operations managers",
    };
    const unsupportedAudienceWorkspace = {
      opportunities: [{
        opportunityId: "o-av",
        name: "Retail audio pods",
        category: "Retail display systems",
        buyer: "Retail managers",
        problemUseCase: "Improve in-store media displays",
        ownerDecision: "APPROVED",
        capabilityState: "VERIFIED",
        capabilityEvidenceIds: [],
        capabilityAuthorityRevisions: [{ decision: "VERIFIED", attestation: "Owner confirms.", evidenceIds: [], evidenceRelevance: [], authorityBasis: "OWNER_ATTESTATION", revision: 1 }],
      }],
      strategyRevisions: [unsupportedAudienceStrategy],
      creativeRevisions: [creative],
    } as SiteIntelligenceWorkspace;

    expect(() => synthesizeSiteBuildPlan({
      buildSessionId: "build-audience-unsupported",
      site: { siteId: "site-1", organizationId: "org-1", displayName: "Site" } as SiteConfiguration,
      intelligence: unsupportedAudienceWorkspace,
      strategy: unsupportedAudienceStrategy as never,
      creative: creative as never,
      candidates: [compatibleCandidate],
      sources: [],
      authoritySnapshot: snapshot,
      revision: 1,
      actor: "owner",
    })).toThrow(/BUILD_PLAN_AUTHORITY_COMPATIBILITY_FAILED/);

    const supportedAudienceWorkspace = {
      ...unsupportedAudienceWorkspace,
      opportunities: [{
        ...unsupportedAudienceWorkspace.opportunities[0],
        buyer: "Airport operations managers",
      }],
    } as SiteIntelligenceWorkspace;

    const supportedPlan = synthesizeSiteBuildPlan({
      buildSessionId: "build-audience-supported",
      site: { siteId: "site-1", organizationId: "org-1", displayName: "Site" } as SiteConfiguration,
      intelligence: supportedAudienceWorkspace,
      strategy: unsupportedAudienceStrategy as never,
      creative: creative as never,
      candidates: [compatibleCandidate],
      sources: [],
      authoritySnapshot: snapshot,
      revision: 1,
      actor: "owner",
    });
    expect(supportedPlan.pages.find((item) => item.pageType === "OFFERING")?.name).toBe("Audio Display Pods");
  });

  test("detects every material upstream authority change", () => {
    expect(isSiteBuildSnapshotCurrent(snapshot, snapshot)).toBe(true);
    for (const changed of [{ strategyRevision: 9 }, { creativeRevision: 2 }, { marketFingerprint: "changed" }, { capabilityFingerprint: "changed" }, { productServiceFingerprint: "changed" }, { sourcesFingerprint: "changed" }, { generationPolicyVersion: "changed" }]) expect(isSiteBuildSnapshotCurrent(snapshot, { ...snapshot, ...changed })).toBe(false);
  });

  test("applies owner-directed category addition and market consolidation to the prior plan", () => {
    const base = { buildSessionId: "build-1", site: { siteId: "site-1", organizationId: "org-1", displayName: "Commercial Stainless Counters" } as SiteConfiguration, intelligence: { opportunities: [opportunity], strategyRevisions: [strategy], creativeRevisions: [creative] } as SiteIntelligenceWorkspace, strategy: { ...strategy, majorVerticals: ["Foodservice", "Restaurant"], synthesisContext: { semanticClassifications: [{ opportunityId: "o1", marketVerticals: ["Foodservice", "Restaurant"] }] } } as never, creative: creative as never, candidates: [approved, { ...approved, authorityId: "a2", displayName: "Stainless Countertops", slug: "stainless-countertops" }], sources: [], authoritySnapshot: snapshot, actor: "owner", now: "2026-09-11T00:00:00.000Z" };
    const prior = synthesizeSiteBuildPlan({ ...base, revision: 1 });
    const instructions = "Add a first-class Commercial Stainless Counters page as the primary category page. Otherwise consolidate Restaurants into the broader Foodservice architecture. Preserve the approved offering pages.";
    const changeRequest = { changeRequestId: "change-1", buildSessionId: "build-1", organizationId: "org-1", siteId: "site-1", fromRevision: 1, requestedBy: "owner", requestedAt: "2026-09-11T00:01:00.000Z", instructions, authoritySnapshot: snapshot };
    const revised = synthesizeSiteBuildPlan({ ...base, revision: 2, ownerInstructions: instructions, priorPlan: prior, changeRequest });
    expect(revised.pages.some((item) => item.name === "Commercial Stainless Counters" && item.pageType === "CATEGORY")).toBe(true);
    expect(revised.pages.some((item) => item.name === "Restaurant Solutions")).toBe(false);
    expect(revised.pages.find((item) => item.name === "Foodservice Solutions")).toMatchObject({ primaryAudience: expect.stringContaining("restaurant buyers"), authority: expect.arrayContaining([expect.objectContaining({ kind: "MARKET" })]) });
    expect(revised.pages.filter((item) => item.pageType === "OFFERING")).toHaveLength(2);
    expect(revised.lineage).toEqual({ previousRevision: 1, changeRequestId: "change-1" });
    expect(revised.changeSummary).toMatchObject({ added: ["Commercial Stainless Counters"], removed: ["Restaurant Solutions"], changed: ["Foodservice Solutions"] });
  });

  test("rejects revised synthesis that lacks prior lineage or requests unsupported authority", () => {
    const base = { buildSessionId: "build-1", site: { siteId: "site-1", organizationId: "org-1", displayName: "Site" } as SiteConfiguration, intelligence: { opportunities: [opportunity] } as SiteIntelligenceWorkspace, strategy: strategy as never, creative: creative as never, candidates: [approved], sources: [], authoritySnapshot: snapshot, revision: 2, actor: "owner" };
    expect(() => synthesizeSiteBuildPlan({ ...base, ownerInstructions: "Add a Rockets page." })).toThrow("PRIOR_PLAN_AND_CHANGE_REQUEST_REQUIRED");
    const prior = synthesizeSiteBuildPlan({ ...base, revision: 1 });
    const changeRequest = { changeRequestId: "change-1", buildSessionId: "build-1", organizationId: "org-1", siteId: "site-1", fromRevision: 1, requestedBy: "owner", requestedAt: "now", instructions: "Add a Rockets page.", authoritySnapshot: snapshot };
    expect(() => synthesizeSiteBuildPlan({ ...base, ownerInstructions: changeRequest.instructions, priorPlan: prior, changeRequest })).toThrow("OWNER_DIRECTION_OUTSIDE_APPROVED_AUTHORITY");
  });
});