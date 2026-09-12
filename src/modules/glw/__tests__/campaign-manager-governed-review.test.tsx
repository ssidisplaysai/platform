import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GlwCampaignManager } from "../GlwCampaignManager";
import { CampaignLocalReferenceReview } from "../CampaignLocalReferenceReview";
import { CampaignActivationAuthorityPanel } from "../CampaignActivationAuthorityPanel";

jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: jest.fn() }) }));

describe("Agent 2 Campaign Manager governed review integration", () => {
  test("shows a non-automatic detail continuation for an active queued campaign", () => {
    const campaign = {
      campaignId: "campaign-texas",
      organizationId: "ssi",
      siteId: "site-ssi-projectorenclosure",
      productId: "prod-projector",
      name: "Texas Cities",
      pageType: "city_service" as const,
      stateCodes: ["TX"],
      cityTargets: [
        { stateCode: "TX", citySlug: "austin", cityName: "Austin" },
        { stateCode: "TX", citySlug: "dallas", cityName: "Dallas" },
        { stateCode: "TX", citySlug: "houston", cityName: "Houston" },
        { stateCode: "TX", citySlug: "san-antonio", cityName: "San Antonio" },
      ],
      pagesPerDay: 10,
      publicationPolicy: "draft_only" as const,
      imageRequired: true,
      status: "active" as const,
      completedTargetCount: 1,
      failedTargetCount: 0,
      createdAt: "2030-01-01T00:00:00.000Z",
      updatedAt: "2030-01-01T00:00:00.000Z",
    };
    const html = renderToStaticMarkup(<GlwCampaignManager organizationId="ssi" siteId={campaign.siteId} sites={[{ siteId: campaign.siteId, organizationId: "ssi", displayName: "ProjectorEnclosure.com" }]} products={[]} initialCampaigns={[campaign]} initialOperatorSummaries={[{
      campaignId: campaign.campaignId, name: campaign.name, organizationId: "ssi", siteId: campaign.siteId, siteName: "ProjectorEnclosure.com", domain: "projectorenclosure.com", productName: "Projector Enclosure", scope: "4 city targets", lifecycle: "Dispatch", attention: "ACTION_REQUIRED", attentionPriority: 1, nextAction: "Run Next Draft Batch", nextActionEnabled: true, nextTarget: "Houston, TX", blocker: null,
      counts: { referenceComplete: 1, queued: 3, running: 0, contentReady: 0, draftReady: 0, published: 0, failed: 0 }, executionReadiness: "READY", capabilityDetails: ["Release READY", "MCP READY", "Scheduler READY"], policy: "DRAFT ONLY", imagePackage: "PARTIAL", productAuthorityImage: "NOT_WIRED", contextualInUseImage: "APPROVED", updatedAt: campaign.updatedAt,
      href: `/glw/campaigns/${campaign.campaignId}?organizationId=ssi&siteId=${campaign.siteId}`,
    }]} />);
    expect(html).toContain("Campaign Control Surface");
    expect(html).toContain("ACTION REQUIRED");
    expect(html).toContain("Run Next Draft Batch");
    expect(html).toContain("Next target: Houston, TX");
    expect(html).toContain(`/glw/campaigns/${campaign.campaignId}`);
    expect(html).not.toContain("Run Next Draft Batch</button>");
  });

  test("enables authorization after reference approval while keeping activation disabled without a grant", () => {
    const html = renderToStaticMarkup(<CampaignActivationAuthorityPanel organizationId="ssi" siteId="site-ssi-projectorenclosure" campaignId="campaign-1" requestRoles={["platform_admin"]} readiness={{ knowledgePackReady: true, approvedReferenceCount: 1, preparedTargetCount: 4, grantActive: false, grantStatus: "NONE", grantExpiresAt: null, targetFingerprint: "fingerprint", certifiedReleaseSha: null, referenceStateCode: "TX", referenceCitySlug: "austin", releaseIdentityReady: true, releaseIdentityReason: null, releaseCapabilityStatus: "READY", releaseCapabilityReleaseSha: "a".repeat(40) }} globalPromotionAvailable={true} globalPromotionReason="" />);
    expect(html).toMatch(/<button[^>]*(?!disabled)[^>]*>Authorize This Campaign for Activation<\/button>/);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Activate Campaign<\/button>/);
    expect(html).not.toContain("Approved campaign reference</li>");
    expect(html).toContain("Scoped activation authorization");
    expect(html).toContain("Step: Activation Authorization");
    expect(html).toContain("REQUIRED");
    expect(html).toContain("Release capability");
    expect(html).toContain("READY");
  });

  test("shows the exact release blocker and disables authorization when runtime identity is absent", () => {
    const html = renderToStaticMarkup(<CampaignActivationAuthorityPanel organizationId="ssi" siteId="site-ssi-projectorenclosure" campaignId="campaign-1" requestRoles={["platform_admin"]} readiness={{ knowledgePackReady: true, approvedReferenceCount: 1, preparedTargetCount: 4, grantActive: false, grantStatus: "NONE", grantExpiresAt: null, targetFingerprint: "fingerprint", certifiedReleaseSha: null, referenceStateCode: "TX", referenceCitySlug: "austin", releaseIdentityReady: false, releaseIdentityReason: "Exact running release identity is required.", releaseCapabilityStatus: "MISSING", releaseCapabilityReleaseSha: null }} globalPromotionAvailable={false} globalPromotionReason="Campaign launch is disabled." />);
    expect(html).toContain("Authorization unavailable: Exact running release identity is required.");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Authorize This Campaign for Activation<\/button>/);
  });

  test("enables canonical reference approval after the exact required image is approved", () => {
    const reference = {
      referenceDraftId: "local-reference-1", campaignId: "campaign-1", organizationId: "ssi", siteId: "site-ssi-projectorenclosure", productId: "product-1",
      stateCode: "TX", citySlug: "austin", cityName: "Austin", canonicalPath: "fan-cooled-projector-enclosures/texas/austin", revision: 1,
      status: "OWNER_APPROVED_LOCAL" as const, title: "Fan Cooled Projector Enclosures in Austin, Texas", seoTitle: "Austin SEO", metaDescription: "Austin meta",
      h1: "Austin", excerpt: "Austin", sections: [], internalLinks: [],
      image: { required: true, requirementPurpose: "PROJECTOR_ENCLOSURE_APPLICATION_VISUAL" as const, candidateId: "candidate-1", candidateRevision: 1, status: "APPROVED" as const, assetReference: "candidate-1", classification: "GENERATED_VISUAL" as const, altText: "Illustrative enclosure", ownerApproved: true },
      provenance: { parentCampaignId: "parent", knowledgePackRevision: 1, authorityReferences: ["product:product-1"] }, reviewInstructions: null, createdAt: "2030-01-01", updatedAt: "2030-01-01",
    };
    const candidate = {
      candidateId: "candidate-1", organizationId: "ssi", siteId: reference.siteId, campaignId: reference.campaignId, referenceDraftId: reference.referenceDraftId,
      requirementPurpose: "PROJECTOR_ENCLOSURE_APPLICATION_VISUAL" as const, revision: 1, sourceType: "GENERATED_VISUAL" as const, status: "APPROVED" as const,
      mimeType: "image/jpeg" as const, byteSize: 10, sha256: "a".repeat(64), storageKey: "candidate.jpg", generationPrompt: "prompt", visualBrief: "brief",
      sourceAssetReference: "wordpress-media:10757", generationBasis: { provider: "LOCAL_GOVERNED_COMPOSITOR" as const, imageProfileReference: "profile-image", knowledgePackRevision: 1, authorityReferences: [], referenceOnlyInputsUsed: false as const, competitorInputsUsed: false as const },
      altText: "Illustrative enclosure", ownerInstructions: null, priorCandidateId: null, createdAt: "2030-01-01", createdBy: "platform_admin", decidedAt: "2030-01-02", decidedBy: "platform_admin",
    };
    const html = renderToStaticMarkup(<CampaignLocalReferenceReview organizationId="ssi" siteId={reference.siteId} campaignId={reference.campaignId} requestRoles={["platform_admin"]} reference={reference} canonicalReferenceApproved={false} imageCandidate={candidate} imageHistory={[candidate]} imagePreviewDataUrl="data:image/jpeg;base64,/9j/" />);
    expect(html).toContain("Step: Reference Approval");
    expect(html).toContain("Ready for owner approval");
    expect(html).toMatch(/<button[^>]*(?!disabled)[^>]*>Approve Reference<\/button>/);
    expect(html).toContain("does not publish, mutate WordPress, authorize activation, activate the campaign, or dispatch targets");
  });

  test("keeps the existing Texas/Austin governed controls available as detail-level components", () => {
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
    const html = renderToStaticMarkup(<><CampaignLocalReferenceReview organizationId="ssi" siteId={campaign.siteId} campaignId={campaign.campaignId} requestRoles={["platform_admin"]} reference={reference} canonicalReferenceApproved={false} imageCandidate={candidate} imageHistory={[candidate]} imagePreviewDataUrl="data:image/jpeg;base64,/9j/" /><CampaignActivationAuthorityPanel organizationId="ssi" siteId={campaign.siteId} campaignId={campaign.campaignId} requestRoles={["platform_admin"]} readiness={{ knowledgePackReady: true, approvedReferenceCount: 0, preparedTargetCount: 4, grantActive: false, grantStatus: "NONE", grantExpiresAt: null, targetFingerprint: "fingerprint", certifiedReleaseSha: null, referenceStateCode: null, referenceCitySlug: null, releaseIdentityReady: true, releaseIdentityReason: null, releaseCapabilityStatus: "READY", releaseCapabilityReleaseSha: "a".repeat(40) }} globalPromotionAvailable={true} globalPromotionReason="" /></>);

    expect(html).toContain("Fan Cooled Projector Enclosures in Austin, Texas");
    expect(html).toContain("Approve Image");
    expect(html).toContain("Replace With Owner Asset");
    expect(html).toMatch(/Approve Reference[\s\S]*disabled|disabled[\s\S]*Approve Reference/);
    expect(html).toContain("Authorize This Campaign for Activation");
    expect(html).not.toContain("Generate California Reference Page");
  });
});