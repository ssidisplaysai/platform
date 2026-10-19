import { synthesizeSiteAssembly } from "../site-page-generation";
import type { SiteBuildPlanProposal } from "../site-build-plan";

const page = (pageId: string, name: string, slug: string, pageType: string, purpose: string, authority: unknown[] = []) => ({
  pageId,
  name,
  slug,
  pageType,
  purpose,
  primaryAudience: "Small and medium-sized businesses",
  launchPhase: "INITIAL",
  authority,
});

describe("site page generation visual quality guards", () => {
  test("keeps Home copy customer-facing, adds industry image slot, and de-duplicates navigation labels", () => {
    const plan = {
      revision: 1,
      status: "APPROVED",
      organizationId: "org",
      siteId: "site",
      pages: [
        page("home", "Home", "", "HOME", "Creative blueprint priorities: Lead with a visual-first conversion direction for approved authority."),
        page("solutions", "Solutions", "solutions", "CATEGORY", "Core customer pathways."),
        page("offering", "Local SEO", "local-seo", "OFFERING", "Local search support.", [{ kind: "PRODUCT_SERVICE", referenceId: "svc-1", label: "Local SEO" }]),
        page("market", "Healthcare Solutions", "industries/healthcare", "MARKET", "Healthcare segment.", [{ kind: "MARKET", referenceId: "mkt-1", label: "Healthcare" }]),
        page("about", "About", "about", "ABOUT", "About Example Growth, our service approach, and delivery standards."),
        page("contact", "Contact", "contact", "CONTACT", "Contact Example Growth for website and local search consultation."),
      ],
    } as SiteBuildPlanProposal;

    const assembly = synthesizeSiteAssembly({
      site: { organizationId: "org", siteId: "site", displayName: "Example Growth" } as never,
      buildSessionId: "build",
      plan,
      intelligence: {
        creativeInputs: [],
        opportunities: [{
          opportunityId: "mkt-1",
          ownerDecision: "APPROVED",
          capabilityState: "VERIFIED",
          capabilityAuthorityRevisions: [{ decision: "VERIFIED", attestation: "Owner confirms.", evidenceIds: [], evidenceRelevance: [], revision: 1 }],
        }],
      } as never,
      strategy: {
        revision: 3,
        status: "APPROVED",
        positioning: "Website development and search growth",
        primaryAudience: "Small and medium-sized businesses",
        secondaryAudiences: [],
        valueProposition: "Grow local visibility with professional website and search execution.",
        majorVerticals: ["Healthcare"],
        productServiceFamilies: ["Website Development", "Local SEO"],
        informationArchitecture: [],
        proposedSitemap: [],
        homepageGoals: ["Generate qualified consultations"],
        conversionPaths: ["Target Your Area", "Build Local Pages", "Optimize for Search", "Track and Grow"],
        ctaHierarchy: ["Get Started", "Book a Consultation", "Request SEO Growth Plan"],
        trustProofRequirements: [],
        geographicStrategy: "Prioritize approved service areas only.",
        proposedProductAuthority: [],
      } as never,
      creative: { revision: 2, strategyRevision: 3, status: "APPROVED" } as never,
      candidates: [{ authorityId: "svc-1", displayName: "Local SEO", decision: "APPROVED", authorityBasis: "OWNER_ATTESTED", protectedClaimBlockers: [] }] as never,
      sources: [],
      revision: 1,
      actor: "site-owner",
      instructions: "consult conversion cta",
      now: "2026-10-19T00:00:00.000Z",
    });

    const home = assembly.pages.find((item) => item.pageRole === "HOME");
    expect(home).toBeTruthy();
    expect(home?.sections[0]?.body.join(" ")).not.toMatch(/creative blueprint|lead with|approved authority|conversion direction/i);
    expect(home?.sections.flatMap((section) => section.body).join(" ")).not.toMatch(/never imply/i);
    expect(home?.sections.find((section) => section.presentation === "CTA")?.body.join(" ")).toContain("start a focused conversation");
    expect(home?.imageRequirements.some((item) => item.slotId.endsWith("-industry") && item.status === "GENERATED_CANDIDATE_NEEDED")).toBe(true);
    expect(assembly.navigation.filter((item) => item.label === "Solutions")).toHaveLength(1);
    expect(assembly.navigation.some((item) => item.label === "Services")).toBe(true);
  });
});
