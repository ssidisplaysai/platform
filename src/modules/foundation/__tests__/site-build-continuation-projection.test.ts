import type { CreativeDirectionProposal } from "../site-intelligence";
import type { SiteConfiguration } from "../types";

function site(): SiteConfiguration {
  return {
    siteId: "site-ssi-projectorenclosure",
    organizationId: "ssi",
    siteName: "Projector Enclosure",
    displayName: "Projector Enclosure",
    slug: "projector-enclosure",
    domain: "projectorenclosure.com",
    primaryAddress: null,
    onboarding: {
      status: "connected",
      wordpressConnectionVerifiedAt: "2026-09-21T00:00:00.000Z",
      certificationStatus: "not_started",
      certificationPageId: null,
      certificationUrl: null,
      certifiedAt: null,
    },
    canonicalUrl: "https://projectorenclosure.com",
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
    integrations: {
      wordpressApiBaseUrl: "https://example.com/wp-json/wp/v2",
      wordpressCredentialReference: "cred",
      workflowReference: "workflow",
    },
    profiles: {
      promptProfileReference: "prompt",
      imageProfileReference: "image",
      seoProfileReference: "seo",
      brandProfileReference: "brand",
      analyticsProfileReference: null,
    },
    lastConnectionTest: null,
    lastSuccessfulPublication: null,
    lastHealthCheck: null,
    createdAt: "2026-09-21T00:00:00.000Z",
    updatedAt: "2026-09-21T00:00:00.000Z",
  };
}

function creativeApproved(): CreativeDirectionProposal {
  return {
    revision: 4,
    strategyRevision: 2,
    overallDirection: "Premium industrial clarity",
    brandInterpretation: "Use owner brand",
    colorDirection: "Neutral",
    typographyDirection: "Durable sans",
    spacingLayoutDirection: "Disciplined grid",
    photographyStyle: "Owner-approved technical imagery",
    generatedImageStyle: "Editorial candidate only",
    heroTreatment: "Lead with approved positioning",
    ctaTreatment: "Request a Quote -> Discuss",
    trustProofPresentation: "Separate verified and pending proof",
    productPresentation: "Present approved families",
    verticalPresentation: "Present approved markets",
    mobileConsiderations: "Thumb-accessible",
    visualDos: ["Use approved hierarchy"],
    visualDonts: ["Do not imply unsupported claims"],
    homepageBlueprint: ["Hero", "Capabilities"],
    imagePlan: [],
    status: "APPROVED",
    reason: "Approved",
    createdBy: "owner",
    createdAt: "2026-09-21T00:00:00.000Z",
    decidedBy: "owner",
    decidedAt: "2026-09-21T00:01:00.000Z",
  };
}

function mockGenerationReadiness(input: {
  readyToCertify: boolean;
  productAuthorityPassed?: boolean;
  strategyPassed?: boolean;
  blockers?: string[];
}) {
  return {
    readiness: {
      readyToCertify: input.readyToCertify,
      blockers: input.blockers ?? [],
      checks: [
        { key: "product_service_authority", passed: input.productAuthorityPassed ?? true, detail: "Product authority check" },
        { key: "strategy", passed: input.strategyPassed ?? true, detail: "Strategy check" },
      ],
      snapshot: {
        strategyRevision: 3,
        creativeRevision: null,
        marketFingerprint: "m",
        capabilityFingerprint: "c",
        productServiceFingerprint: "p",
        sourcesFingerprint: "s",
        generationPolicyVersion: "site-draft-generation-v1",
      },
    },
  };
}

describe("projectThreeGateOwnerAction", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test("stale creative lineage but equivalent creative projection => READY_TO_CONTINUE", async () => {
    const approved = creativeApproved();
    jest.doMock("../site-intelligence-repository", () => ({
      getSiteIntelligenceWorkspace: () => ({
        strategyRevisions: [{ revision: 3, status: "APPROVED" }],
        creativeRevisions: [approved],
      }),
    }));
    jest.doMock("../site-generation-readiness-service", () => ({
      getSiteGenerationReadiness: () => mockGenerationReadiness({
        readyToCertify: false,
        blockers: ["Creative stale"],
      }),
    }));
    jest.doMock("../site-build-service", () => ({
      getSiteBuildWorkspace: () => ({ stage: "AUTHORITY_REVIEW_REQUIRED", session: { buildSessionId: "b1" } }),
    }));
    jest.doMock("../site-creative-direction-synthesizer", () => ({
      synthesizeCreativeDirection: () => ({
        ...approved,
        strategyRevision: 3,
      }),
    }));

    const { projectThreeGateOwnerAction } = await import("../site-build-continuation");
    const projection = projectThreeGateOwnerAction(site());
    expect(projection.ownerActionState).toBe("READY_TO_CONTINUE");
    expect(projection.primaryActionLabel).toBe("CONTINUE BUILD");
  });

  test("material creative change => OWNER_ACTION_REQUIRED", async () => {
    const approved = creativeApproved();
    jest.doMock("../site-intelligence-repository", () => ({
      getSiteIntelligenceWorkspace: () => ({
        strategyRevisions: [{ revision: 3, status: "APPROVED" }],
        creativeRevisions: [approved],
      }),
    }));
    jest.doMock("../site-generation-readiness-service", () => ({
      getSiteGenerationReadiness: () => mockGenerationReadiness({ readyToCertify: false, blockers: ["Creative stale"] }),
    }));
    jest.doMock("../site-build-service", () => ({
      getSiteBuildWorkspace: () => ({ stage: "AUTHORITY_REVIEW_REQUIRED", session: { buildSessionId: "b1" } }),
    }));
    jest.doMock("../site-creative-direction-synthesizer", () => ({
      synthesizeCreativeDirection: () => ({
        ...approved,
        strategyRevision: 3,
        overallDirection: "Materially new direction",
      }),
    }));

    const { projectThreeGateOwnerAction } = await import("../site-build-continuation");
    const projection = projectThreeGateOwnerAction(site());
    expect(projection.ownerActionState).toBe("OWNER_ACTION_REQUIRED");
    expect(projection.routeHint).toBe("CREATIVE_REVIEW");
  });

  test("authority/readiness insufficiency => OWNER_ACTION_REQUIRED", async () => {
    jest.doMock("../site-intelligence-repository", () => ({
      getSiteIntelligenceWorkspace: () => ({ strategyRevisions: [{ revision: 3, status: "APPROVED" }], creativeRevisions: [creativeApproved()] }),
    }));
    jest.doMock("../site-generation-readiness-service", () => ({
      getSiteGenerationReadiness: () => mockGenerationReadiness({ readyToCertify: false, productAuthorityPassed: false, blockers: ["Authority incomplete"] }),
    }));
    jest.doMock("../site-build-service", () => ({
      getSiteBuildWorkspace: () => ({ stage: "AUTHORITY_REVIEW_REQUIRED", session: null }),
    }));
    const { projectThreeGateOwnerAction } = await import("../site-build-continuation");
    const projection = projectThreeGateOwnerAction(site());
    expect(projection.ownerActionState).toBe("OWNER_ACTION_REQUIRED");
  });

  test("page review stage => PAGE_REVIEW_REQUIRED", async () => {
    jest.doMock("../site-intelligence-repository", () => ({
      getSiteIntelligenceWorkspace: () => ({ strategyRevisions: [{ revision: 3, status: "APPROVED" }], creativeRevisions: [{ ...creativeApproved(), strategyRevision: 3 }] }),
    }));
    jest.doMock("../site-generation-readiness-service", () => ({
      getSiteGenerationReadiness: () => mockGenerationReadiness({ readyToCertify: true }),
    }));
    jest.doMock("../site-build-service", () => ({
      getSiteBuildWorkspace: () => ({ stage: "PAGE_REVIEW", session: { buildSessionId: "b1" } }),
    }));

    const { projectThreeGateOwnerAction } = await import("../site-build-continuation");
    const projection = projectThreeGateOwnerAction(site());
    expect(projection.ownerActionState).toBe("PAGE_REVIEW_REQUIRED");
    expect(projection.routeHint).toBe("PAGE_REVIEW");
  });
});
