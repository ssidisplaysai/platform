jest.mock("server-only", () => ({}));

import { deriveGeneratedPageReviewModel } from "../generated-page-review-read-model";
import type { GlwCampaign } from "../campaign-types";
import type { GlwCampaignTarget } from "../campaign-target-repository";
import type { GlwPageExecutionRecord } from "../page-execution";
import type { SitePageMediaAssignment } from "../../foundation/site-page-media-assignment";

describe("ProjectorEnclosure generated contextual review projection", () => {
  test("recognizes the completed four-slot generated visual set and retires the repair action", () => {
    const campaign = {
      campaignId: "campaign-ssi-site-ssi-projectorenclosure-fan-cooled-projector-enclosures-texas-expanded-cities",
      organizationId: "ssi",
      siteId: "site-ssi-projectorenclosure",
      productId: "prod-ssi-fan-cooled-projector-enclosures",
      name: "Fan Cooled Projector Enclosures Texas Expanded Cities",
      pageType: "city_service",
      stateCodes: ["TX"],
      cityTargets: [{ stateCode: "TX", citySlug: "el-paso", cityName: "El Paso" }],
      pagesPerDay: 10,
      publicationPolicy: "draft_only",
      imageRequired: true,
      status: "draft",
      completedTargetCount: 1,
      failedTargetCount: 0,
      createdAt: "2026-09-22T00:00:00.000Z",
      updatedAt: "2026-09-23T15:40:00.000Z",
    } as GlwCampaign;

    const target = {
      targetId: "target-el-paso",
      campaignId: campaign.campaignId,
      organizationId: campaign.organizationId,
      siteId: campaign.siteId,
      productId: campaign.productId,
      pageType: "city_service",
      stateCode: "TX",
      citySlug: "el-paso",
      cityName: "El Paso",
      canonicalPath: "fan-cooled-projector-enclosures/texas/el-paso",
      applicationPath: "fan-cooled-projector-enclosures/texas/el-paso",
      status: "draft_ready",
      jobId: "job-el-paso",
      wordpressObjectId: "13167",
      attemptCount: 0,
      lastError: null,
      createdAt: "2026-09-22T00:00:00.000Z",
      updatedAt: "2026-09-23T15:40:00.000Z",
    } as GlwCampaignTarget;

    const updatedAt = "2026-09-23T15:40:00.000Z";
    const pageRevisionId = `job:job-el-paso:${updatedAt}`;
    const contentHtml = `<main><h1>Fan Cooled Projector Enclosures in El Paso</h1><p>Plan a commercial projection project in El Paso.</p><h2>Outdoor projection mapping context</h2><p>Review field conditions.</p><a href="/fan-cooled-projector-enclosures/">Review Fan Cooled Projector Enclosures</a></main>`;
    const job = {
      jobId: "job-el-paso",
      correlationId: "corr-el-paso",
      executionTransport: "N8N_MCP",
      organizationId: campaign.organizationId,
      siteId: campaign.siteId,
      productId: campaign.productId,
      productTopic: "Fan Cooled Projector Enclosures",
      state: "Texas",
      city: "El Paso",
      slug: target.canonicalPath,
      title: "Fan Cooled Projector Enclosures in El Paso",
      seoTitle: "Fan Cooled Projector Enclosures in El Paso | ProjectorEnclosure.com",
      metaDescription: "Plan Fan Cooled Projector Enclosures for commercial projects in El Paso.",
      publicationIntent: "draft",
      status: "COMPLETE",
      externalExecutionId: "764956",
      wordpressObjectId: "13167",
      wordpressUrl: "https://projectorenclosure.com/?page_id=13167",
      wordpressStatus: "draft",
      generatedDraft: {
        title: "Fan Cooled Projector Enclosures in El Paso",
        contentHtml,
        slug: target.canonicalPath,
        excerpt: "Plan a Fan Cooled Projector Enclosures project in El Paso.",
        seoTitle: "Fan Cooled Projector Enclosures in El Paso | ProjectorEnclosure.com",
        metaDescription: "Plan Fan Cooled Projector Enclosures for commercial projects in El Paso.",
        focusKeyphrase: "fan cooled projector enclosures el paso",
      },
      errorCode: null,
      errorMessage: null,
      requestedPublicationMode: "draft",
      disposition: "DRAFT_READY",
      qaStatus: "COMPLETE",
      qaChecks: {
        contentPresent: { ok: true, message: "Generated content is present." },
        expectedCity: { ok: true, message: "Expected city is present." },
        productAuthority: { exactProductMatch: true },
        internalLinks: { linksRendered: 1 },
      },
      qaFailureReasons: {},
      focusKeyphrase: "fan cooled projector enclosures el paso",
      wordCount: 880,
      featuredImagePresent: true,
      createdAt: "2026-09-22T00:00:00.000Z",
      dispatchedAt: "2026-09-22T01:00:00.000Z",
      updatedAt,
      completedAt: updatedAt,
    } as GlwPageExecutionRecord;

    const approvedProductMedia = {
      assignmentId: "approved-product-media",
      organizationId: campaign.organizationId,
      siteId: campaign.siteId,
      buildSessionId: "product-authority",
      pageId: target.targetId,
      pageRevisionId,
      slotId: "product-authority",
      role: "PRODUCT_AUTHORITY",
      asset: {
        type: "APPROVED_EXISTING",
        authorityReference: "wordpress-media:1067",
        productId: campaign.productId,
        wordpressMediaId: 1067,
        url: "https://projectorenclosure.com/wp-content/uploads/fan-cooled.jpg",
        sha256: "a".repeat(64),
      },
      metadata: {
        altText: "Fan cooled projector enclosure",
        caption: null,
        title: "Fan Cooled Projector Enclosure",
        description: "Approved canonical product media",
      },
      approval: {
        candidateId: "product-candidate",
        approvedBy: "owner",
        approvedAt: "2026-09-22T00:00:00.000Z",
      },
      wordpressReceipt: null,
      createdAt: "2026-09-22T00:00:00.000Z",
    } as SitePageMediaAssignment;

    const makeGenerated = (
      slotId: "HERO_EXPERIENCE" | "POST_HERO_CONTEXTUAL" | "APPLICATION_STAGE" | "CTA_ATMOSPHERE",
      role: "CONTEXTUAL_IN_USE" | "APPLICATION_EXPERIENCE" | "LOCAL_CONTEXTUAL_ATMOSPHERE",
      mediaId: number,
      generationJobId: string,
    ): SitePageMediaAssignment => ({
      assignmentId: `assignment-${slotId}`,
      organizationId: campaign.organizationId,
      siteId: campaign.siteId,
      buildSessionId: `contextual-media:${target.targetId}`,
      pageId: target.targetId,
      pageRevisionId,
      slotId,
      role,
      asset: {
        type: "GENERATED",
        provider: "OPENAI_IMAGE",
        model: "gpt-image-2",
        generationJobId,
        effectivePrompt: "Conceptual generated application visualization.",
        referenceInputs: role === "LOCAL_CONTEXTUAL_ATMOSPHERE" ? [] : [{
          referenceId: approvedProductMedia.assignmentId,
          role: "PRODUCT_TRUTH",
          sha256: "a".repeat(64),
        }],
        outputSha256: String(mediaId).padStart(64, "b").slice(0, 64),
      },
      metadata: {
        altText: "Conceptual generated application visualization; not a real customer installation.",
        caption: null,
        title: slotId,
        description: "Generated contextual presentation media.",
      },
      approval: {
        candidateId: generationJobId,
        approvedBy: "owner",
        approvedAt: updatedAt,
      },
      wordpressReceipt: {
        mediaId,
        url: `https://projectorenclosure.com/wp-content/uploads/${mediaId}.jpg`,
        attachedToObjectId: "13167",
        altTextVerified: true,
        placementVerified: true,
        verifiedAt: updatedAt,
      },
      createdAt: updatedAt,
    });

    const generatedAssignments = [
      makeGenerated("HERO_EXPERIENCE", "CONTEXTUAL_IN_USE", 19170, "gen-hero"),
      makeGenerated("POST_HERO_CONTEXTUAL", "APPLICATION_EXPERIENCE", 19171, "gen-mapping"),
      makeGenerated("APPLICATION_STAGE", "APPLICATION_EXPERIENCE", 19172, "gen-hospitality"),
      makeGenerated("CTA_ATMOSPHERE", "LOCAL_CONTEXTUAL_ATMOSPHERE", 19173, "gen-event"),
    ];

    const result = deriveGeneratedPageReviewModel({
      campaign,
      target,
      job,
      siteName: "ProjectorEnclosure.com",
      domain: "projectorenclosure.com",
      productName: "Fan Cooled Projector Enclosures",
      productAuthorityReference: "wordpress-media:1067",
      productAuthoritySource: "OWNER_APPROVED_CANONICAL_PRODUCT",
      knowledgePack: {
        campaignId: campaign.campaignId,
        organizationId: campaign.organizationId,
        siteId: campaign.siteId,
        instructions: "Use approved authority.",
        references: [],
        revision: 2,
        status: "ready",
        authorityReferences: [{ sourceType: "product", sourceId: campaign.productId, scope: "stable_fact" }],
        updatedAt,
      } as never,
      wordpressDraft: {
        id: 13167,
        slug: "el-paso",
        status: "draft",
        link: "https://projectorenclosure.com/?page_id=13167",
        modified_gmt: updatedAt,
        featured_media: 19170,
        title: { raw: job.title },
        content: { raw: contentHtml },
      } as never,
      wordpressMedia: {
        id: 19170,
        source_url: "https://projectorenclosure.com/wp-content/uploads/19170.jpg",
        alt_text: "Conceptual projection mapping experience in El Paso, Texas.",
      } as never,
      wordpressReadState: "AUTHENTICATED_EXACT_DRAFT_READ",
      wordpressEditUrl: "https://projectorenclosure.com/wp-admin/post.php?post=13167&action=edit",
      mediaAssignments: [approvedProductMedia, ...generatedAssignments],
      approvedProductMedia,
      referenceLocations: [],
      authoritativeContextualMedia: [],
      authoritativePageRevisionIdentity: pageRevisionId,
      generatedContextualReceipts: generatedAssignments.map((assignment) => ({
        generationId: assignment.asset.type === "GENERATED" ? assignment.asset.generationJobId! : "",
        campaignId: campaign.campaignId,
        targetId: target.targetId,
        productId: campaign.productId,
        wordpressObjectId: "13167",
        pageRevisionId,
        mediaRole: assignment.role,
        wordpressMediaId: assignment.wordpressReceipt!.mediaId,
      })),
    });

    expect(result.images.contextualInUse.state).toBe("GENERATED_CONTEXTUAL");
    expect(result.images.contextualInUse.imageUrl).toBe("https://projectorenclosure.com/wp-content/uploads/19170.jpg");
    expect(result.images.contextualInUse.wordpressMediaId).toBe("19170");
    expect(result.images.contractState).toBe("MULTI_ROLE_IMAGE_STATE");
    expect(result.richComposition.preview.contextualImageUrl).toBe("https://projectorenclosure.com/wp-content/uploads/19170.jpg");
    expect(result.richComposition.plan.media).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: "CONTEXTUAL_IN_USE", readiness: "READY" }),
    ]));
    expect(result.actions.generatedContextualRepair).toBeNull();
  });
});
