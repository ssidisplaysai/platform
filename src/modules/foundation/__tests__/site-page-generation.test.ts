import { evaluateGeneratedPageQuality, synthesizeSiteAssembly } from "../site-page-generation";
import type { SiteBuildPlanProposal } from "../site-build-plan";

const page = (pageId: string, name: string, slug: string, pageType: string, authority: unknown[] = []) => ({ pageId, name, slug, pageType, purpose: "Seed", primaryAudience: "Commercial buyers", launchPhase: "INITIAL", authority });
const plan = { revision: 3, status: "APPROVED", pages: [page("home", "Home", "", "HOME"), page("core", "Core Category", "core-category", "CATEGORY"), page("offer", "Worktables", "worktables", "OFFERING", [{ kind: "PRODUCT_SERVICE", referenceId: "a1", label: "Worktables" }]), page("market", "Healthcare Solutions", "markets/healthcare", "MARKET", [{ kind: "MARKET", referenceId: "o1", label: "Healthcare" }]), page("cap", "Capabilities", "capabilities", "CAPABILITIES"), page("about", "About", "about", "ABOUT"), page("quote", "Request a Quote", "request-a-quote", "CONTACT")] } as SiteBuildPlanProposal;
const strategy = { revision: 8, status: "APPROVED", primaryAudience: "Commercial buyers", ctaHierarchy: ["Request a Quote"] };
const creative = { revision: 1, status: "APPROVED" };
const candidate = { authorityId: "a1", displayName: "Worktables", decision: "APPROVED", authorityBasis: "OWNER_ATTESTED", protectedClaimBlockers: [] };

describe("reusable fresh-site page generation", () => {
  test("generates differentiated review-ready pages, SEO, links, navigation, and image plans", () => {
    const result = synthesizeSiteAssembly({ site: { siteId: "site", organizationId: "org", displayName: "Example Stainless" } as never, buildSessionId: "build", plan, intelligence: { creativeInputs: [], opportunities: [{ opportunityId: "o1", ownerDecision: "APPROVED", capabilityState: "VERIFIED", capabilityAuthorityRevisions: [{ decision: "VERIFIED", attestation: "Owner confirms.", evidenceIds: [], evidenceRelevance: [], revision: 1 }] }] } as never, strategy: strategy as never, creative: creative as never, candidates: [candidate] as never, sources: [], revision: 1, actor: "owner", now: "2026-09-11T00:00:00.000Z" });
    expect(result.pages).toHaveLength(7); expect(result.status).toBe("READY_FOR_OWNER_REVIEW"); expect(result.pages.every((item) => item.quality.ready && item.seoTitle && item.metaDescription && item.sections.length >= 4)).toBe(true);
    expect(new Set(result.pages.map((item) => item.contentFingerprint)).size).toBe(7); expect(result.pages.every((item) => item.canonicalPath === "/" || item.internalLinks.length > 0)).toBe(true);
    const inbound = new Set(result.pages.flatMap((item) => item.internalLinks.map((link) => link.targetPageId)));
    expect(result.pages.filter((item) => item.canonicalPath !== "/").every((item) => inbound.has(item.pageId))).toBe(true);
    expect(result.navigation.map((item) => item.label)).toEqual(expect.arrayContaining(["Core Category", "Products & Solutions", "Industries", "Capabilities", "About", "Request a Quote"]));
    expect(result.pages.flatMap((item) => item.imageRequirements).every((item) => item.publishableAssetId === null && item.status !== "READY")).toBe(true);
  });

  test("quality gate fails seed copy, governance language, protected claims, bad links, and missing SEO", () => {
    const bad = { pageRevisionId: "r", pageId: "p", revision: 1, status: "READY_FOR_OWNER_REVIEW", requestedChanges: null, name: "Bad", slug: "bad", canonicalPath: "/Bad", pageRole: "OFFERING", seoTitle: "", metaDescription: "", openGraphTitle: "", openGraphDescription: "", h1: "Certified project", sections: [{ sectionId: "s", heading: "Approved authority", level: 2, body: ["Proposed from approved strategy revision 8."], presentation: "PROSE" }], contentHtml: "short", internalLinks: [{ linkId: "l", href: "/missing/", anchorText: "Missing", reason: "x", targetPageId: "x" }], imageRequirements: [{ slotId: "i", placement: "Hero", subject: "x", source: "REFERENCE_INSPIRATION_ONLY", publishableAssetId: "asset", status: "READY", altTextGuidance: "x" }], authority: [], contentFingerprint: "same", createdAt: "now", createdBy: "owner", decidedAt: null, decidedBy: null } as never;
    const quality = evaluateGeneratedPageQuality({ page: bad, validPaths: new Set(["/"]), duplicateFingerprints: new Set(["same"]) });
    expect(quality.ready).toBe(false); expect(quality.blockers).toEqual(expect.arrayContaining(["noSeedCopy", "noGovernanceLanguage", "noProtectedClaims", "seoComplete", "canonicalPathValid", "contentSubstantial", "linksValid", "uniqueContent", "imageProvenanceBounded"]));
  });

  test("blocks page authority references that are not currently approved", () => {
    const result = synthesizeSiteAssembly({ site: { siteId: "site", organizationId: "org", displayName: "Example" } as never, buildSessionId: "build", plan, intelligence: { creativeInputs: [], opportunities: [] } as never, strategy: strategy as never, creative: creative as never, candidates: [] as never, sources: [], revision: 1, actor: "owner" });
    expect(result.pages.filter((item) => ["OFFERING", "MARKET"].includes(item.pageRole)).every((item) => item.quality.blockers.includes("approvedAuthorityOnly"))).toBe(true);
  });

  test("regenerates a commercial homepage as the approved category and lead-generation hub", () => {
    const result = synthesizeSiteAssembly({ site: { siteId: "site", organizationId: "org", displayName: "Example Stainless" } as never, buildSessionId: "build", plan, intelligence: { creativeInputs: [], opportunities: [{ opportunityId: "o1", ownerDecision: "APPROVED", capabilityState: "VERIFIED", capabilityAuthorityRevisions: [{ decision: "VERIFIED", attestation: "Owner confirms.", evidenceIds: [], evidenceRelevance: [], revision: 1 }] }] } as never, strategy: strategy as never, creative: creative as never, candidates: [candidate, { ...candidate, authorityId: "a2", displayName: "Design-Build Fabrication" }] as never, sources: [], revision: 2, actor: "owner", instructions: "Rewrite only Home as a strong commercial lead-generation homepage with the core category as the primary focus and strong quote calls to action." });
    const home = result.pages.find((item) => item.pageRole === "HOME")!;
    expect(home.h1).toBe("Core Category and custom stainless fabrication"); expect(home.seoTitle).toBe("Core Category & Custom Stainless Fabrication"); expect(home.seoTitle).not.toMatch(/home/i);
    expect(home.sections.map((item) => item.heading)).toEqual(["Core Category and custom stainless fabrication", "Commercial stainless products and fabrication solutions", "Core Category: the central project pathway", "Solutions for commercial industries", "A fabrication approach built around the requirement", "Fabrication proof and project detail", "Why commercial buyers use this resource", "Request a Quote"]);
    expect(home.internalLinks.map((item) => item.anchorText)).toEqual(expect.arrayContaining(["Core Category", "Worktables", "Healthcare Solutions", "Capabilities", "About", "Request a Quote"]));
    expect(home.quality.ready).toBe(true); expect(home.imageRequirements.every((item) => item.publishableAssetId === null)).toBe(true);
  });
});