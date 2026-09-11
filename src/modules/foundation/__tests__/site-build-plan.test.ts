import { synthesizeSiteBuildPlan } from "../site-build-plan";
import { isSiteBuildSnapshotCurrent } from "../site-build-service";
import type { SiteIntelligenceWorkspace } from "../site-intelligence";
import type { SiteProductServiceAuthority } from "../site-product-authority-repository";
import type { SiteConfiguration } from "../types";

const snapshot = { strategyRevision: 8, creativeRevision: 1, marketFingerprint: "market", capabilityFingerprint: "capability", productServiceFingerprint: "product", sourcesFingerprint: "sources", generationPolicyVersion: "site-draft-generation-v1" };
const opportunity = { opportunityId: "o1", name: "Worktables", ownerDecision: "APPROVED", capabilityState: "VERIFIED", capabilityEvidenceIds: [], capabilityAuthorityRevisions: [{ decision: "VERIFIED", attestation: "Owner confirms.", evidenceIds: [], evidenceRelevance: [], authorityBasis: "OWNER_ATTESTATION", revision: 1 }] };
const strategy = { revision: 8, status: "APPROVED", primaryAudience: "Commercial buyers", majorVerticals: ["Foodservice", "Unsupported"], informationArchitecture: ["Home", "Capabilities", "About", "Request a Quote", "Projects"], homepageGoals: ["Explain the approved offer"], conversionPaths: ["Quote intake"], synthesisContext: { semanticClassifications: [{ opportunityId: "o1", marketVerticals: ["Foodservice"] }, { opportunityId: "pending", marketVerticals: ["Unsupported"] }] } };
const creative = { revision: 1, status: "APPROVED" };
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