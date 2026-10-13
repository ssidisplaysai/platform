jest.mock("server-only", () => ({}));

const mockGetSiteGenerationReadiness = jest.fn();
const mockGetSiteBuildRecords = jest.fn();
const mockSaveBuildPlanProposal = jest.fn((proposal) => proposal);
const mockGetSiteIntelligenceWorkspace = jest.fn();
const mockSynthesizeSiteBuildPlan = jest.fn();
const mockSummarizeSitePageReview = jest.fn(() => ({ complete: false, generatedPageCount: 0 }));

jest.mock("../site-generation-readiness-service", () => ({
  getSiteGenerationReadiness: (...args: unknown[]) => mockGetSiteGenerationReadiness(...args),
}));

jest.mock("../site-generation-readiness-repository", () => ({
  getSiteBuildRecords: (...args: unknown[]) => mockGetSiteBuildRecords(...args),
  saveBuildPlanProposal: (...args: unknown[]) => mockSaveBuildPlanProposal(...args),
  saveRevisedBuildPlan: jest.fn(),
  approveSiteBuildDrafts: jest.fn(),
  approveAllReadySiteAssemblyPages: jest.fn(),
  decideBuildPlan: jest.fn(),
  decideSiteAssemblyPage: jest.fn(),
  generateSiteBuildDrafts: jest.fn(),
  recordSiteBuildWordPressContentUpdate: jest.fn(),
  recordSiteBuildWordPressDraft: jest.fn(),
  replaceSiteAssemblyPageRevision: jest.fn(),
  saveSiteAssemblyProposal: jest.fn(),
}));

jest.mock("../site-intelligence-repository", () => ({
  getSiteIntelligenceWorkspace: (...args: unknown[]) => mockGetSiteIntelligenceWorkspace(...args),
}));

jest.mock("../site-build-plan", () => ({
  synthesizeSiteBuildPlan: (...args: unknown[]) => mockSynthesizeSiteBuildPlan(...args),
}));

jest.mock("../site-page-image-candidate-repository", () => ({
  listSitePageImageCandidates: jest.fn(() => []),
  decideSitePageImageCandidate: jest.fn(),
  saveSitePageImageCandidate: jest.fn(),
  readSitePageImageCandidateBytes: jest.fn(),
}));

jest.mock("../site-visual-assembly-repository", () => ({
  listSiteVisualAssemblies: jest.fn(() => []),
  approveAllReadySiteVisualAssemblies: jest.fn(),
  decideSiteVisualAssembly: jest.fn(),
  saveSiteVisualAssembly: jest.fn(),
}));

jest.mock("../site-navigation-review-repository", () => ({
  listSiteNavigationReviews: jest.fn(() => []),
  advanceSiteNavigationPublicationGate: jest.fn(),
  decideSiteNavigationReview: jest.fn(),
  saveSiteNavigationReview: jest.fn(),
}));

jest.mock("../site-publication-execution-repository", () => ({
  listSitePublicationExecutionPlans: jest.fn(() => []),
}));

jest.mock("../site-page-image-review", () => ({
  summarizeSitePageReview: (...args: unknown[]) => mockSummarizeSitePageReview(...args),
  areRequiredPageImagesApproved: jest.fn(() => true),
}));

jest.mock("../site-repository", () => ({ updateSite: jest.fn() }));
jest.mock("../site-build-stage", () => jest.requireActual("../site-build-stage"));

import { generateBuildPlan, getSiteBuildWorkspace } from "../site-build-service";
import type { SiteConfiguration } from "../types";

const site: SiteConfiguration = {
  siteId: "site-rj",
  organizationId: "rj-metal",
  displayName: "Commercial Stainless Counters",
  enabled: false,
  publishingStatus: "disabled",
  lifecycleState: "configuring",
  integrations: { wordpressCredentialReference: "cred", wordpressApiBaseUrl: "https://example.com", workflowReference: null },
};

const currentSnapshot = {
  strategyRevision: 2,
  creativeRevision: 2,
  marketFingerprint: "m2",
  capabilityFingerprint: "c2",
  productServiceFingerprint: "p2",
  sourcesFingerprint: "s2",
  generationPolicyVersion: "site-draft-generation-v1",
};

const staleSnapshot = { ...currentSnapshot, productServiceFingerprint: "p1" };

describe("site build stale plan continuation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSiteGenerationReadiness.mockReturnValue({
      certification: { status: "CURRENT", certification: { certificationId: "cert-2" } },
      buildSession: { buildSessionId: "build-1" },
      readiness: { snapshot: currentSnapshot },
      authority: { candidates: [{ authorityId: "a1" }], sources: [] },
    });
    mockGetSiteIntelligenceWorkspace.mockReturnValue({
      strategyRevisions: [{ revision: 2, status: "APPROVED" }],
      creativeRevisions: [{ revision: 2, status: "APPROVED" }],
    });
    mockGetSiteBuildRecords.mockReturnValue({
      plans: [],
      changeRequests: [],
      currentPlan: null,
      draftSet: null,
      wordpressDrafts: [],
      assemblies: [],
      currentAssembly: null,
      wordpressContentUpdates: [],
    });
  });

  test("routes CURRENT certification plus stale plan snapshot to explicit regeneration", () => {
    mockGetSiteBuildRecords.mockReturnValue({
      plans: [{ revision: 1, status: "PROPOSED", authoritySnapshot: staleSnapshot }],
      changeRequests: [],
      currentPlan: { revision: 1, status: "PROPOSED", authoritySnapshot: staleSnapshot },
      draftSet: null,
      wordpressDrafts: [],
      assemblies: [],
      currentAssembly: null,
      wordpressContentUpdates: [],
    });

    const workspace = getSiteBuildWorkspace(site);
    expect(workspace.stage).toBe("BUILD_PLAN_STALE");
    expect(workspace.next).toMatchObject({ action: "GENERATE_BUILD_PLAN", label: "REGENERATE BUILD PLAN" });
    expect(workspace.staleDetails).toMatchObject({ certificationCurrent: true, planSnapshotCurrent: false });
  });

  test("generateBuildPlan creates a new revision when proposed plan snapshot is stale", () => {
    const staleProposed = { revision: 1, status: "PROPOSED", authoritySnapshot: staleSnapshot };
    mockGetSiteBuildRecords.mockReturnValue({
      plans: [staleProposed],
      changeRequests: [],
      currentPlan: staleProposed,
      draftSet: null,
      wordpressDrafts: [],
      assemblies: [],
      currentAssembly: null,
      wordpressContentUpdates: [],
    });
    const revisedProposal = { revision: 2, status: "PROPOSED", authoritySnapshot: currentSnapshot };
    mockSynthesizeSiteBuildPlan.mockReturnValue(revisedProposal);

    const result = generateBuildPlan(site, "owner");
    expect(result).toBe(revisedProposal);
    expect(mockSynthesizeSiteBuildPlan).toHaveBeenCalledWith(expect.objectContaining({ revision: 2, authoritySnapshot: currentSnapshot }));
    expect(mockSaveBuildPlanProposal).toHaveBeenCalledWith(revisedProposal);
  });

  test("generateBuildPlan stays idempotent when proposed plan snapshot already matches", () => {
    const currentProposed = { revision: 1, status: "PROPOSED", authoritySnapshot: currentSnapshot };
    mockGetSiteBuildRecords.mockReturnValue({
      plans: [currentProposed],
      changeRequests: [],
      currentPlan: currentProposed,
      draftSet: null,
      wordpressDrafts: [],
      assemblies: [],
      currentAssembly: null,
      wordpressContentUpdates: [],
    });

    const result = generateBuildPlan(site, "owner");
    expect(result).toBe(currentProposed);
    expect(mockSynthesizeSiteBuildPlan).not.toHaveBeenCalled();
    expect(mockSaveBuildPlanProposal).not.toHaveBeenCalled();
  });

  test("blocks planning when certification is stale", () => {
    mockGetSiteGenerationReadiness.mockReturnValue({
      certification: { status: "STALE", certification: { certificationId: "cert-1" } },
      buildSession: { buildSessionId: "build-1" },
      readiness: { snapshot: currentSnapshot },
      authority: { candidates: [], sources: [] },
    });

    expect(() => generateBuildPlan(site, "owner")).toThrow("CURRENT_BUILD_AUTHORITY_REQUIRED");
  });
});
