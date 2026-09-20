import type { GlwCampaign } from "../campaign-types";
import type { ProductMediaAuthorityRecord } from "../product-media-authority";
import { evaluateCampaignProductMediaReadiness, resolveCampaignPresentationHero, resolveEffectiveCampaignMediaRecords, resolveGlwCampaignMediaPolicy } from "../campaign-media-policy";

function campaign(overrides?: Partial<GlwCampaign>): GlwCampaign {
  return {
    campaignId: "campaign-a",
    organizationId: "led-display-warehouse",
    siteId: "site-led-display-warehouse-production",
    productId: "prod-outdoor-digital-sphere",
    name: "Campaign A",
    pageType: "state_service",
    stateCodes: ["IN"],
    pagesPerDay: 1,
    publicationPolicy: "publish_after_gates",
    imageRequired: true,
    status: "draft",
    completedTargetCount: 0,
    failedTargetCount: 0,
    createdAt: "2030-01-01T00:00:00.000Z",
    updatedAt: "2030-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function mediaRecord(input: {
  mediaAuthorityId: string;
  ownerApproval?: "PENDING_OWNER_APPROVAL" | "APPROVED" | "REJECTED";
  heroSelected?: boolean;
  heroEligible?: boolean;
  sourceType?: ProductMediaAuthorityRecord["sourceType"];
  generatedCandidateRole?: ProductMediaAuthorityRecord["generatedCandidateRole"];
  authorityClass?: ProductMediaAuthorityRecord["authorityClass"];
  depictsActualProduct?: boolean;
  productRepresentationAllowed?: boolean;
  contextualUseAllowed?: boolean;
  applicationUseAllowed?: boolean;
  approvedUsageScopes?: Array<"PRODUCT_AUTHORITY" | "CONTEXTUAL_IN_USE" | "APPLICATION_EXPERIENCE" | "LOCAL_CONTEXTUAL_ATMOSPHERE">;
}): ProductMediaAuthorityRecord {
  const approved = input.ownerApproval === "APPROVED";
  return {
    mediaAuthorityId: input.mediaAuthorityId,
    organizationId: "led-display-warehouse",
    siteId: "site-led-display-warehouse-production",
    productId: "prod-outdoor-digital-sphere",
    originalFilename: `${input.mediaAuthorityId}.jpg`,
    storedFilename: `${input.mediaAuthorityId}.jpg`,
    mimeType: "image/jpeg",
    dimensions: { width: 1200, height: 800 },
    sourceType: input.sourceType ?? "OWNER_SUPPLIED",
    generatedCandidateRole: input.generatedCandidateRole ?? null,
    campaignId: null,
    generationPrompt: null,
    generationModel: null,
    generationProvider: null,
    generationReferenceMetadata: {},
    sourceDescription: "operator upload",
    ownerApproval: input.ownerApproval ?? "APPROVED",
    ownerApprovalTimestamp: approved ? "2030-01-01T00:00:00.000Z" : null,
    ownerPrincipalId: approved ? "owner" : null,
    ownerSessionId: approved ? "session" : null,
    provenance: "owner upload",
    authorityClass: input.authorityClass ?? "PRODUCT_AUTHORITY",
    usageScopes: ["PRODUCT_AUTHORITY", "CONTEXTUAL_IN_USE", "APPLICATION_EXPERIENCE"],
    proposedUsageScopes: ["PRODUCT_AUTHORITY", "CONTEXTUAL_IN_USE", "APPLICATION_EXPERIENCE"],
    approvedUsageScopes: input.approvedUsageScopes ?? ["PRODUCT_AUTHORITY", "CONTEXTUAL_IN_USE", "APPLICATION_EXPERIENCE"],
    depictsActualProduct: input.depictsActualProduct ?? true,
    productRepresentationAllowed: input.productRepresentationAllowed ?? true,
    contextualUseAllowed: input.contextualUseAllowed ?? true,
    applicationUseAllowed: input.applicationUseAllowed ?? true,
    localAtmosphereUseAllowed: false,
    localAtmosphereStateCodes: [],
    heroEligible: input.heroEligible ?? false,
    heroSelected: input.heroSelected ?? false,
    heroSelectedBy: input.heroSelected ? "owner" : null,
    heroSelectedAt: input.heroSelected ? "2030-01-01T00:00:00.000Z" : null,
    altTextAuthority: "outdoor digital sphere",
    captionAuthority: "caption",
    approvalLifecycleVersion: "EXPLICIT_OWNER_CONFIRMATION_V1",
    hash: "a".repeat(64),
    contentBase64: "Zm9v",
    createdAt: "2030-01-01T00:00:00.000Z",
    updatedAt: "2030-01-01T00:00:00.000Z",
  } as ProductMediaAuthorityRecord;
}

describe("campaign media policy", () => {
  test("defaults to inherit when policy is missing", () => {
    const policy = resolveGlwCampaignMediaPolicy(campaign({ campaignMediaPolicy: undefined }));
    expect(policy).toEqual({ mode: "INHERIT_PRODUCT_MEDIA", allowlistMediaAuthorityIds: [], campaignHeroMediaAuthorityId: null });
  });

  test("dedupes allowlist ids", () => {
    const policy = resolveGlwCampaignMediaPolicy(campaign({ campaignMediaPolicy: { mode: "EXPLICIT_ALLOWLIST", allowlistMediaAuthorityIds: ["hero", "hero", "supporting"] } }));
    expect(policy).toEqual({ mode: "EXPLICIT_ALLOWLIST", allowlistMediaAuthorityIds: ["hero", "supporting"], campaignHeroMediaAuthorityId: null });
  });

  test("explicit allowlist empty yields zero effective media", () => {
    const records = [mediaRecord({ mediaAuthorityId: "hero" })];
    const effective = resolveEffectiveCampaignMediaRecords({
      campaign: campaign({ campaignMediaPolicy: { mode: "EXPLICIT_ALLOWLIST", allowlistMediaAuthorityIds: [] } }),
      productMediaRecords: records,
    });
    expect(effective).toHaveLength(0);
  });

  test("explicit allowlist cannot elevate rejected media", () => {
    const records = [
      mediaRecord({ mediaAuthorityId: "hero", ownerApproval: "APPROVED", heroSelected: true, heroEligible: true, applicationUseAllowed: false, approvedUsageScopes: ["PRODUCT_AUTHORITY"] }),
      mediaRecord({ mediaAuthorityId: "support", ownerApproval: "APPROVED", contextualUseAllowed: true, applicationUseAllowed: false, approvedUsageScopes: ["CONTEXTUAL_IN_USE"] }),
      mediaRecord({ mediaAuthorityId: "app", ownerApproval: "REJECTED", applicationUseAllowed: true, approvedUsageScopes: ["APPLICATION_EXPERIENCE"] }),
    ];
    const readiness = evaluateCampaignProductMediaReadiness({
      campaign: campaign({ campaignMediaPolicy: { mode: "EXPLICIT_ALLOWLIST", allowlistMediaAuthorityIds: ["hero", "support", "app"] } }),
      productMediaRecords: records,
      stateCode: "IN",
    });
    expect(readiness.ready).toBe(false);
    expect(readiness.blockers).toContain("APPLICATION_EXPERIENCE_MEDIA_REQUIRED");
  });

  test("campaign isolation keeps different allowlists independent", () => {
    const records = [
      mediaRecord({ mediaAuthorityId: "hero", ownerApproval: "APPROVED", heroSelected: true, heroEligible: true }),
      mediaRecord({ mediaAuthorityId: "support", ownerApproval: "APPROVED", contextualUseAllowed: true, approvedUsageScopes: ["CONTEXTUAL_IN_USE"] }),
      mediaRecord({ mediaAuthorityId: "app", ownerApproval: "APPROVED", applicationUseAllowed: true, approvedUsageScopes: ["APPLICATION_EXPERIENCE"] }),
    ];

    const campaignA = campaign({
      campaignId: "campaign-a",
      campaignMediaPolicy: { mode: "EXPLICIT_ALLOWLIST", allowlistMediaAuthorityIds: ["hero", "support", "app"] },
    });
    const campaignB = campaign({
      campaignId: "campaign-b",
      campaignMediaPolicy: { mode: "EXPLICIT_ALLOWLIST", allowlistMediaAuthorityIds: ["support", "app"] },
    });

    const readinessA = evaluateCampaignProductMediaReadiness({ campaign: campaignA, productMediaRecords: records, stateCode: "IN" });
    const readinessB = evaluateCampaignProductMediaReadiness({ campaign: campaignB, productMediaRecords: records, stateCode: "IN" });

    expect(readinessA.heroAuthorityReady).toBe(true);
    expect(readinessA.ready).toBe(true);
    expect(readinessB.heroAuthorityReady).toBe(false);
    expect(readinessB.ready).toBe(false);
    expect(readinessB.blockers).toContain("CAMPAIGN_HERO_REQUIRED");
    expect(readinessB.blockers).toContain("PRODUCT_MEDIA_AUTHORITY_REQUIRED");
  });

  test("campaign hero override is isolated and does not require product authority semantics", () => {
    const generatedHero = mediaRecord({
      mediaAuthorityId: "generated-hero",
      sourceType: "GENESIS_GENERATED_VISUAL_CANDIDATE",
      generatedCandidateRole: "HERO",
      authorityClass: "CONTEXTUAL_IN_USE",
      approvedUsageScopes: ["CONTEXTUAL_IN_USE"],
      productRepresentationAllowed: false,
      contextualUseAllowed: true,
      applicationUseAllowed: false,
      depictsActualProduct: false,
      heroEligible: true,
      heroSelected: false,
    });
    const records = [generatedHero];

    const campaignA = campaign({
      campaignId: "campaign-a",
      campaignMediaPolicy: {
        mode: "EXPLICIT_ALLOWLIST",
        allowlistMediaAuthorityIds: ["generated-hero"],
        campaignHeroMediaAuthorityId: "generated-hero",
      },
    });
    const campaignB = campaign({
      campaignId: "campaign-b",
      campaignMediaPolicy: {
        mode: "EXPLICIT_ALLOWLIST",
        allowlistMediaAuthorityIds: ["generated-hero"],
      },
    });

    const readinessA = evaluateCampaignProductMediaReadiness({ campaign: campaignA, productMediaRecords: records, stateCode: "IN" });
    const readinessB = evaluateCampaignProductMediaReadiness({ campaign: campaignB, productMediaRecords: records, stateCode: "IN" });

    expect(readinessA.campaignHeroReady).toBe(true);
    expect(readinessA.heroAuthorityReady).toBe(true);
    expect(readinessA.productAuthorityReady).toBe(false);
    expect(readinessA.blockers).toContain("PRODUCT_MEDIA_AUTHORITY_REQUIRED");
    expect(readinessA.blockers).toContain("APPLICATION_EXPERIENCE_MEDIA_REQUIRED");
    expect(readinessB.campaignHeroReady).toBe(false);
    expect(readinessB.blockers).toContain("CAMPAIGN_HERO_REQUIRED");
  });

  test("invalid campaign hero override falls back to effective global hero only", () => {
    const globalHero = mediaRecord({
      mediaAuthorityId: "global-hero",
      heroSelected: true,
      heroEligible: true,
      approvedUsageScopes: ["PRODUCT_AUTHORITY"],
      productRepresentationAllowed: true,
    });
    const generated = mediaRecord({
      mediaAuthorityId: "generated-hero",
      sourceType: "GENESIS_GENERATED_VISUAL_CANDIDATE",
      generatedCandidateRole: "HERO",
      authorityClass: "CONTEXTUAL_IN_USE",
      approvedUsageScopes: ["CONTEXTUAL_IN_USE"],
      productRepresentationAllowed: false,
      contextualUseAllowed: true,
      heroEligible: true,
      heroSelected: false,
      depictsActualProduct: false,
    });

    const scopedCampaign = campaign({
      campaignMediaPolicy: {
        mode: "EXPLICIT_ALLOWLIST",
        allowlistMediaAuthorityIds: ["generated-hero"],
        campaignHeroMediaAuthorityId: "missing",
      },
    });

    const effective = resolveEffectiveCampaignMediaRecords({ campaign: scopedCampaign, productMediaRecords: [globalHero, generated] });
    const selection = resolveCampaignPresentationHero({ campaign: scopedCampaign, effectiveMediaRecords: effective });

    expect(selection.hero).toBeNull();
  });
});
