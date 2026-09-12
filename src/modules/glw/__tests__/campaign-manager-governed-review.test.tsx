import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GlwCampaignManager } from "../GlwCampaignManager";

jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: jest.fn() }) }));

describe("Agent 2 Campaign Manager governed review integration", () => {
  test("renders the existing Texas/Austin review and bypasses the California legacy workflow", () => {
    const campaign = {
      campaignId: "campaign-ssi-site-ssi-projectorenclosure-fan-cooled-projector-enclosures-texas-cities",
      organizationId: "ssi",
      siteId: "site-ssi-projectorenclosure",
      productId: "prod-ssi-fan-cooled-projector-enclosures",
      name: "Fan Cooled Projector Enclosures Texas Cities",
      pageType: "city_service" as const,
      stateCodes: ["TX"],
      cityTargets: ["Austin", "Dallas", "Houston", "San Antonio"].map((cityName) => ({ stateCode: "TX", cityName, citySlug: cityName.toLowerCase().replace(" ", "-") })),
      pagesPerDay: 10,
      publicationPolicy: "draft_only" as const,
      imageRequired: true,
      status: "draft" as const,
      completedTargetCount: 0,
      failedTargetCount: 0,
      parentCampaignId: "parent",
      createdAt: "2030-01-01T00:00:00.000Z",
      updatedAt: "2030-01-01T00:00:00.000Z",
    };
    const reference = {
      referenceDraftId: "local-reference-1", campaignId: campaign.campaignId, organizationId: "ssi", siteId: campaign.siteId, productId: campaign.productId,
      stateCode: "TX", citySlug: "austin", cityName: "Austin", canonicalPath: "fan-cooled-projector-enclosures/texas/austin", revision: 1,
      status: "READY_FOR_OWNER_REVIEW" as const, title: "Fan Cooled Projector Enclosures in Austin, Texas", seoTitle: "Austin SEO", metaDescription: "Austin meta",
      h1: "Fan Cooled Projector Enclosures in Austin, Texas", excerpt: "Austin", sections: [], internalLinks: [],
      image: { required: true, requirementPurpose: "PROJECTOR_ENCLOSURE_APPLICATION_VISUAL" as const, candidateId: "candidate-1", candidateRevision: 1, status: "READY_FOR_OWNER_REVIEW" as const, assetReference: "candidate-1", classification: "GENERATED_VISUAL" as const, altText: "Illustrative enclosure", ownerApproved: false },
      provenance: { parentCampaignId: "parent", knowledgePackRevision: 1, authorityReferences: [] }, reviewInstructions: null, createdAt: "2030-01-01", updatedAt: "2030-01-01",
    };
    const candidate = {
      candidateId: "candidate-1", organizationId: "ssi", siteId: campaign.siteId, campaignId: campaign.campaignId, referenceDraftId: reference.referenceDraftId,
      requirementPurpose: "PROJECTOR_ENCLOSURE_APPLICATION_VISUAL" as const, revision: 1, sourceType: "GENERATED_VISUAL" as const, status: "READY_FOR_OWNER_REVIEW" as const,
      mimeType: "image/jpeg" as const, byteSize: 10, sha256: "a".repeat(64), storageKey: "candidate.jpg", generationPrompt: "prompt", visualBrief: "brief",
      sourceAssetReference: "wordpress-media:10757", generationBasis: { provider: "LOCAL_GOVERNED_COMPOSITOR" as const, imageProfileReference: "profile-image", knowledgePackRevision: 1, authorityReferences: [], referenceOnlyInputsUsed: false as const, competitorInputsUsed: false as const },
      altText: "Illustrative enclosure", ownerInstructions: null, priorCandidateId: null, createdAt: "2030-01-01", createdBy: "platform_admin", decidedAt: null, decidedBy: null,
    };
    const html = renderToStaticMarkup(<GlwCampaignManager organizationId="ssi" siteId={campaign.siteId} sites={[{ siteId: campaign.siteId, organizationId: "ssi", displayName: "ProjectorEnclosure.com" }]} products={[{ productId: campaign.productId, organizationId: "ssi", displayName: "Fan Cooled Projector Enclosures", assignedSiteIds: [campaign.siteId] }]} initialCampaigns={[campaign]} governedReviewByCampaign={{ [campaign.campaignId]: {
      knowledgePack: { campaignId: campaign.campaignId, organizationId: "ssi", siteId: campaign.siteId, instructions: "Governed Texas instructions", references: [], revision: 1, status: "ready", ownerApprovalRequired: false, updatedAt: "2030-01-01" },
      reference, imageCandidate: candidate, imageHistory: [candidate], imagePreviewDataUrl: "data:image/jpeg;base64,/9j/",
      activationReadiness: { knowledgePackReady: true, approvedReferenceCount: 0, preparedTargetCount: 4, grantActive: false, grantStatus: "NONE", grantExpiresAt: null, targetFingerprint: "fingerprint", certifiedReleaseSha: null, referenceStateCode: null, referenceCitySlug: null },
    } }} />);

    expect(html).toContain("0/4 complete");
    expect(html).toContain("Uploaded references");
    expect(html).toContain("READY · revision 1");
    expect(html).toContain("GOVERNED · NO ADDITIONAL APPROVAL REQUIRED");
    expect(html).toContain("Fan Cooled Projector Enclosures in Austin, Texas");
    expect(html).toContain("Approve Image");
    expect(html).toContain("Replace With Owner Asset");
    expect(html).toMatch(/Approve Reference[\s\S]*disabled|disabled[\s\S]*Approve Reference/);
    expect(html).toContain("Authorize This Campaign for Activation");
    expect(html).not.toContain("Generate California Reference Page");
  });
});