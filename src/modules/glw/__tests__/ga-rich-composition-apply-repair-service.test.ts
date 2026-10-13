import { executeGaRichCompositionApplyRepair, GA_RICH_COMPOSITION_REPAIR_IDENTITY } from "../ga-rich-composition-apply-repair-service";

function makeModel(overrides?: Record<string, unknown>) {
  return {
    identity: {
      campaignId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.campaignId,
      targetId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.targetId,
      title: "Outdoor Digital Sphere in Georgia",
    },
    trace: {
      jobId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.jobId,
      externalExecutionId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.externalExecutionId,
    },
    wordpress: {
      objectId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.wordpressObjectId,
      status: GA_RICH_COMPOSITION_REPAIR_IDENTITY.wordpressStatus,
      contentMatchesSource: false,
    },
    images: {
      contextualInUse: {
        imageUrl: "https://leddisplaywarehouse.com/wp-content/uploads/contextual-generated.jpg",
      },
    },
    source: {
      rawHtml: "<h1>Outdoor Digital Sphere in Georgia</h1><p>Guide source.</p>",
      excerpt: "Guide source excerpt.",
      internalLinks: [{ label: "Request project planning", url: "https://leddisplaywarehouse.com/contact-us/" }],
    },
    visualQa: {
      certificationState: "CURRENT",
    },
    ...overrides,
  } as never;
}

function baseJob(overrides?: Record<string, unknown>) {
  return {
    jobId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.jobId,
    organizationId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.organizationId,
    siteId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.siteId,
    productId: "prod-outdoor-digital-sphere",
    productTopic: "Outdoor Digital Sphere",
    state: "Georgia",
    externalExecutionId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.externalExecutionId,
    wordpressObjectId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.wordpressObjectId,
    wordpressStatus: GA_RICH_COMPOSITION_REPAIR_IDENTITY.wordpressStatus,
    slug: "outdoor-digital-sphere/georgia",
    title: "Outdoor Digital Sphere in Georgia",
    generatedDraft: {
      title: "Outdoor Digital Sphere in Georgia",
      contentHtml: "<h1>Outdoor Digital Sphere in Georgia</h1><p>Guide source.</p>",
      slug: "outdoor-digital-sphere/georgia",
      excerpt: "Guide source excerpt.",
    },
    updatedAt: "2026-09-18T00:00:00.000Z",
    ...overrides,
  } as never;
}

describe("GA rich composition apply repair service", () => {
  test("writes renderer output through UPDATE only with zero generation/dispatch and readback verification", async () => {
    const richHtml = "<article><style>body.page-id-20169 .page-title.the-title{display:none!important}</style><section data-genesis-hero=\"true\"><h1>Outdoor Digital Sphere in Georgia</h1></section><section class=\"glw-sphere-product\"><p>No legacy product figure image</p></section></article>";
    const beforeHtml = "<article><h1>Outdoor Digital Sphere in Georgia</h1><img src=\"https://legacy.example/product.jpg\"></article>";

    const buildReviewModel = jest.fn()
      .mockResolvedValueOnce(makeModel())
      .mockResolvedValueOnce(makeModel({ wordpress: { objectId: "20169", status: "draft", contentMatchesSource: true }, visualQa: { certificationState: "STALE" } }));

    const readWordPressDraft = jest.fn()
      .mockResolvedValueOnce({
        id: 20169,
        status: "draft",
        slug: "georgia",
        parent: 124,
        featured_media: 9988,
        title: { raw: "Outdoor Digital Sphere in Georgia" },
        content: { raw: beforeHtml },
      })
      .mockResolvedValueOnce({
        id: 20169,
        status: "draft",
        slug: "georgia",
        parent: 124,
        featured_media: 9988,
        title: { raw: "Outdoor Digital Sphere in Georgia" },
        content: { raw: richHtml },
      });

    const writeDraft = jest.fn().mockResolvedValue({
      ok: true,
      operation: "UPDATE",
      wordpressObjectId: "20169",
      wordpressUrl: "https://leddisplaywarehouse.com/?page_id=20169",
      wordpressStatus: "draft",
      seoMetadataAttempted: false,
      seoMetadataAccepted: false,
    });

    const renderRich = jest.fn().mockReturnValue({ ok: true, html: richHtml, sanitizedGuideHtml: "<p>Guide source.</p>" });
    const applyTitleSuppression = jest.fn().mockReturnValue({ contentHtml: richHtml, scopedRule: "body.page-id-20169 .page-title.the-title{display:none!important}", mutated: false, alreadySuppressed: true });

    const result = await executeGaRichCompositionApplyRepair({ actor: "operator-1", expectedStoredSha256: "6f2864631e086dcc670deeb71b7ca82192a45341390a61aae8d7c832bf8eea1d" }, {
      buildReviewModel,
      getJobById: jest.fn().mockResolvedValue(baseJob()),
      updateJob: jest.fn().mockResolvedValue(baseJob({ generatedDraft: { title: "Outdoor Digital Sphere in Georgia", contentHtml: richHtml, slug: "outdoor-digital-sphere/georgia", excerpt: "Guide source excerpt." } })),
      getSiteById: jest.fn().mockReturnValue({
        siteId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.siteId,
        domain: "leddisplaywarehouse.com",
        canonicalUrl: "https://leddisplaywarehouse.com",
        integrations: { wordpressApiBaseUrl: "https://leddisplaywarehouse.com/wp-json/wp/v2" },
      }),
      getProductById: jest.fn().mockReturnValue({
        productId: "prod-outdoor-digital-sphere",
        media: { primaryImageReference: "wordpress-media:10757" },
      }),
      resolveApprovedProductAuthorityMedia: jest.fn().mockReturnValue({
        metadata: { altText: "Outdoor Digital Sphere product authority" },
        asset: {
          type: "APPROVED_EXISTING",
          url: "https://leddisplaywarehouse.com/wp-content/uploads/product-authority.jpg",
          wordpressMediaId: 10757,
          authorityReference: "wordpress-media:10757",
          productId: "prod-outdoor-digital-sphere",
          sha256: "a".repeat(64),
        },
        wordpressReceipt: { url: "https://leddisplaywarehouse.com/wp-content/uploads/product-authority.jpg", mediaId: 10757, attachedToObjectId: "20169", altTextVerified: true, placementVerified: true, verifiedAt: "2026-09-18T00:00:00.000Z" },
      }),
      listAllTargets: jest.fn().mockReturnValue([{
        targetId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.targetId,
        campaignId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.campaignId,
        organizationId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.organizationId,
        siteId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.siteId,
        canonicalPath: "outdoor-digital-sphere/georgia",
        canonicalParentId: "124",
      }]),
      readWordPressDraft,
      writeDraft,
      renderRich,
      applyTitleSuppression,
      now: () => "2026-09-18T12:00:00.000Z",
    });

    expect(writeDraft).toHaveBeenCalledTimes(1);
    expect(writeDraft).toHaveBeenCalledWith(expect.objectContaining({
      operation: "UPDATE",
      wordpressObjectId: "20169",
      artifact: expect.objectContaining({ contentHtml: richHtml }),
    }));
    expect(writeDraft).not.toHaveBeenCalledWith(expect.objectContaining({ operation: "CREATE" }));
    expect(result.accounting).toMatchObject({
      wordpressUpdates: 1,
      wordpressCreates: 0,
      imageGenerationRequests: 0,
      n8nDispatchRequests: 0,
      publicationRequests: 0,
    });
    expect(result.verification).toMatchObject({
      readbackHashMatchesWrittenRichHtml: true,
      legacyProductImageAbsent: true,
      contextualHeroPresent: true,
      singleH1: true,
      contentMatch: true,
    });
    expect(renderRich).toHaveBeenCalledTimes(1);
  });

  test("fails closed when the wordpress object is not draft", async () => {
    const buildReviewModel = jest.fn().mockResolvedValue(makeModel());
    await expect(executeGaRichCompositionApplyRepair({ actor: "operator-1", expectedStoredSha256: "a".repeat(64) }, {
      buildReviewModel,
      getJobById: jest.fn().mockResolvedValue(baseJob()),
      updateJob: jest.fn(),
      getSiteById: jest.fn().mockReturnValue({ siteId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.siteId, domain: "leddisplaywarehouse.com", canonicalUrl: "https://leddisplaywarehouse.com", integrations: { wordpressApiBaseUrl: "https://leddisplaywarehouse.com/wp-json/wp/v2" } }),
      getProductById: jest.fn().mockReturnValue({ productId: "prod-outdoor-digital-sphere", media: { primaryImageReference: "wordpress-media:10757" } }),
      resolveApprovedProductAuthorityMedia: jest.fn().mockReturnValue({ metadata: { altText: "x" }, asset: { type: "APPROVED_EXISTING", url: "https://leddisplaywarehouse.com/wp-content/uploads/product-authority.jpg", wordpressMediaId: 10757, authorityReference: "wordpress-media:10757", productId: "prod-outdoor-digital-sphere", sha256: "a".repeat(64) }, wordpressReceipt: { url: "https://leddisplaywarehouse.com/wp-content/uploads/product-authority.jpg", mediaId: 10757, attachedToObjectId: "20169", altTextVerified: true, placementVerified: true, verifiedAt: "2026-09-18T00:00:00.000Z" } }),
      listAllTargets: jest.fn().mockReturnValue([{ targetId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.targetId, campaignId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.campaignId, organizationId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.organizationId, siteId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.siteId, canonicalPath: "outdoor-digital-sphere/georgia", canonicalParentId: "124" }]),
      readWordPressDraft: jest.fn().mockResolvedValue({ id: 20169, status: "publish", slug: "georgia", parent: 124, title: { raw: "Outdoor Digital Sphere in Georgia" }, content: { raw: "<h1>Outdoor Digital Sphere in Georgia</h1>" } }),
      writeDraft: jest.fn(),
      renderRich: jest.fn(),
      applyTitleSuppression: jest.fn(),
      now: () => "2026-09-18T12:00:00.000Z",
    })).rejects.toThrow("GA_RICH_REPAIR_PREFLIGHT_FAILED");
  });
});