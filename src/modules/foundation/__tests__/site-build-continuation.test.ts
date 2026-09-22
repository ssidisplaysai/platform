import { compareBuildPlanMateriality, compareCreativeDirectionMateriality } from "../site-build-continuation";
import type { SiteBuildPlanProposal } from "../site-build-plan";
import type { CreativeDirectionProposal } from "../site-intelligence";

function creative(overrides: Partial<CreativeDirectionProposal> = {}): CreativeDirectionProposal {
  return {
    revision: 4,
    strategyRevision: 2,
    overallDirection: "Premium industrial clarity",
    brandInterpretation: "Use owner brand identity consistently",
    colorDirection: "Neutral foundation",
    typographyDirection: "Durable sans",
    spacingLayoutDirection: "Disciplined grid",
    photographyStyle: "Owner-approved technical imagery",
    generatedImageStyle: "Editorial candidate only",
    heroTreatment: "Lead with approved positioning",
    ctaTreatment: "Request a Quote -> Discuss Your Project",
    trustProofPresentation: "Separate verified and pending proof",
    productPresentation: "Present approved families",
    verticalPresentation: "Present approved markets",
    mobileConsiderations: "Thumb-accessible pathways",
    visualDos: ["Use approved hierarchy", "Use approved CTA priorities"],
    visualDonts: ["Do not imply unsupported claims"],
    homepageBlueprint: ["Hero", "Capabilities", "Quote intake"],
    imagePlan: [],
    status: "APPROVED",
    reason: "Approved",
    createdBy: "owner",
    createdAt: "2026-09-21T00:00:00.000Z",
    decidedBy: "owner",
    decidedAt: "2026-09-21T00:01:00.000Z",
    ...overrides,
  };
}

function plan(overrides: Partial<SiteBuildPlanProposal> = {}): SiteBuildPlanProposal {
  return {
    buildSessionId: "site-build-1",
    organizationId: "org",
    siteId: "site",
    revision: 1,
    status: "APPROVED",
    ownerInstructions: null,
    lineage: { previousRevision: null, changeRequestId: null },
    changeSummary: { added: ["Home"], removed: [], changed: [], unchanged: [] },
    pages: [
      {
        pageId: "p-home",
        name: "Home",
        slug: "",
        pageType: "HOME",
        purpose: "Guide qualified buyers to approved offerings",
        primaryAudience: "Commercial buyers",
        launchPhase: "INITIAL",
        authority: [
          { kind: "SITE", referenceId: "site", label: "Site" },
          { kind: "STRATEGY", referenceId: "strategy-2", label: "Strategy" },
          { kind: "CREATIVE", referenceId: "creative-4", label: "Creative" },
          { kind: "PRODUCT_SERVICE", referenceId: "auth-1", label: "Projector Enclosure" },
        ],
      },
    ],
    authoritySnapshot: {
      strategyRevision: 2,
      creativeRevision: 4,
      marketFingerprint: "m",
      capabilityFingerprint: "c",
      productServiceFingerprint: "p",
      sourcesFingerprint: "s",
      generationPolicyVersion: "site-draft-generation-v1",
    },
    buildPolicyVersion: "bounded-fresh-site-build-v1",
    createdBy: "owner",
    createdAt: "2026-09-21T00:00:00.000Z",
    decidedBy: "owner",
    decidedAt: "2026-09-21T00:01:00.000Z",
    ...overrides,
  };
}

describe("site build continuation materiality comparators", () => {
  test("treats equivalent creative rebase as non-material", () => {
    const baseline = creative({ revision: 4, strategyRevision: 2 });
    const candidate = creative({ revision: 5, strategyRevision: 3, status: "PROPOSED", reason: "Rebased to strategy 3", decidedAt: null, decidedBy: null });
    const diff = compareCreativeDirectionMateriality(baseline, candidate);
    expect(diff.material).toBe(false);
    expect(diff.changedFields).toHaveLength(0);
  });

  test("flags changed creative direction field as material", () => {
    const baseline = creative();
    const candidate = creative({ overallDirection: "Completely new market positioning", status: "PROPOSED", decidedAt: null, decidedBy: null });
    const diff = compareCreativeDirectionMateriality(baseline, candidate);
    expect(diff.material).toBe(true);
    expect(diff.changedFields).toContain("overallDirection");
  });

  test("ignores strategy and creative authority id churn for equivalent build plan", () => {
    const baseline = plan();
    const candidate = plan({
      revision: 2,
      status: "PROPOSED",
      pages: [
        {
          ...baseline.pages[0],
          authority: [
            { kind: "SITE", referenceId: "site", label: "Site" },
            { kind: "STRATEGY", referenceId: "strategy-3", label: "Strategy" },
            { kind: "CREATIVE", referenceId: "creative-5", label: "Creative" },
            { kind: "PRODUCT_SERVICE", referenceId: "auth-1", label: "Projector Enclosure" },
          ],
        },
      ],
    });
    const diff = compareBuildPlanMateriality(baseline, candidate);
    expect(diff.material).toBe(false);
  });

  test("flags page inventory changes as material", () => {
    const baseline = plan();
    const candidate = plan({
      revision: 2,
      status: "PROPOSED",
      pages: [
        ...baseline.pages,
        {
          pageId: "p-market",
          name: "Markets",
          slug: "markets",
          pageType: "MARKET",
          purpose: "New market expansion objective",
          primaryAudience: "New audience",
          launchPhase: "INITIAL",
          authority: [{ kind: "SITE", referenceId: "site", label: "Site" }],
        },
      ],
    });
    const diff = compareBuildPlanMateriality(baseline, candidate);
    expect(diff.material).toBe(true);
  });
});
