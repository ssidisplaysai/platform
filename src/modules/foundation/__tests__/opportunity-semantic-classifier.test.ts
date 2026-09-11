import type { SiteOpportunity } from "../site-intelligence";
import { classifyOpportunitySemantics } from "../opportunity-semantic-classifier";

function opportunity(overrides: Partial<SiteOpportunity>): SiteOpportunity {
  return { opportunityId: "o1", name: "Custom stainless countertops", category: "Custom stainless countertop fabrication", buyer: "Restaurant operators and designers", problemUseCase: "Need exact-fit fabricated counters", commercialValue: "HIGH", demandSignal: "Observed demand", competitionLevel: "MODERATE", organizationFit: "UNKNOWN", evidenceStrength: "MODERATE", confidence: 0.8, geographicScope: "National", nationalRolloutPotential: true, recurringReplacementPotential: false, seoContentOpportunity: "custom stainless countertop quote", rationale: "Market research", competitorEntities: [], evidenceIds: ["e1"], capabilityState: "VERIFIED", capabilityEvidenceIds: ["creative:proof"], capabilityNotes: "Owner confirmed.", recommendation: "Review", ownerDecision: "APPROVED", decidedBy: "owner", decidedAt: "2026-09-10T00:00:00.000Z", ...overrides };
}

describe("opportunity semantic classifier", () => {
  test("verified product capability becomes capability and product/service semantics", () => {
    const result = classifyOpportunitySemantics(opportunity({}));
    expect(result.roles).toEqual(expect.arrayContaining(["CAPABILITY", "PRODUCT_SERVICE", "MARKET_VERTICAL", "AUDIENCE", "GEOGRAPHY", "SEO_OPPORTUNITY", "PROOF_REQUIREMENT"]));
    expect(result.capabilityAuthority).toBe("CURRENT");
    expect(result.productServiceCandidates).toContain("Stainless Countertops");
  });

  test("dealer/specifier opportunity is audience and channel, never a product family", () => {
    const result = classifyOpportunitySemantics(opportunity({ name: "Consultant and dealer spec-channel sales", category: "Quote-ready specification support", buyer: "Foodservice consultants, dealers, and contractors", problemUseCase: "Need drawings, specifications, submittals, and quote intake", capabilityState: "VERIFIED" }));
    expect(result.roles).toEqual(expect.arrayContaining(["AUDIENCE", "SALES_CHANNEL", "SEO_OPPORTUNITY"]));
    expect(result.roles).not.toContain("PRODUCT_SERVICE");
    expect(result.productServiceCandidates).toEqual([]);
    expect(result.salesChannels.join(" ")).toMatch(/Dealer|Consultant|Specifier/);
  });

  test("geographic delivery opportunity does not become a product family without capability authority", () => {
    const result = classifyOpportunitySemantics(opportunity({ name: "Regional design-build fabrication", category: "Regional project fabrication and installation", buyer: "Restaurant operators, contractors, and designers in regional metro markets", geographicScope: "Dallas-Fort Worth and Mid-Atlantic regional project markets", capabilityState: "OWNER_VALIDATION_REQUIRED", capabilityEvidenceIds: [] }));
    expect(result.roles).toEqual(expect.arrayContaining(["CAPABILITY", "PRODUCT_SERVICE", "GEOGRAPHY", "DELIVERY_MODEL", "FUTURE_EXPANSION"]));
    expect(result.capabilityAuthority).toBe("UNVALIDATED");
  });

  test("future or unvalidated GMP opportunity cannot become current capability authority", () => {
    for (const capabilityState of ["FUTURE_CAPABILITY", "OWNER_VALIDATION_REQUIRED"] as const) {
      const result = classifyOpportunitySemantics(opportunity({ name: "Sanitary and regulated stainless fabrication", category: "Hygienic / GMP stainless fabrication", buyer: "Food processors, pharma, medical, chemical, cosmetics, and OEM facilities", capabilityState, capabilityEvidenceIds: [] }));
      expect(result.roles).toContain("PRODUCT_SERVICE");
      expect(result.capabilityAuthority).not.toBe("CURRENT");
    }
  });

  test("direct-to-ship geography is delivery and researched expansion, not current service geography", () => {
    const result = classifyOpportunitySemantics(opportunity({ name: "Direct-to-ship custom stainless countertop niche", category: "Exact-size shipped countertop surfaces", buyer: "Contractors and owner-operators", geographicScope: "US and Canada", capabilityState: "OWNER_VALIDATION_REQUIRED", capabilityEvidenceIds: [] }));
    expect(result.roles).toEqual(expect.arrayContaining(["PRODUCT_SERVICE", "DELIVERY_MODEL", "GEOGRAPHY", "FUTURE_EXPANSION"]));
    expect(result.researchedGeographies).toEqual(["United States", "Canada"]);
    expect(result.capabilityAuthority).toBe("UNVALIDATED");
  });
});
