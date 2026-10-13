import { inspectFreshWordPressSite, readWordPressOperatorCapabilities } from "../fresh-site-onboarding";
import { createSiteId, slugifySiteName } from "../site-identity";
import type { SiteConfiguration } from "../types";
import type { WordPressEstateObjectKind, WordPressEstateReader } from "../wordpress-estate-reader";

function collection(kind: WordPressEstateObjectKind, count: number) {
  return Promise.resolve({
    ok: true as const,
    collection: {
      kind,
      objects: Array.from({ length: count }, (_, index) => ({
        kind,
        id: String(index + 1),
        slug: `${kind}-${index + 1}`,
        status: "publish",
        parentId: null,
        link: `https://example-fresh-site.test/${kind}-${index + 1}`,
        title: `${kind} ${index + 1}`,
        modifiedGmt: null,
        authorId: null,
        raw: {},
      })),
      total: count,
      totalPages: 1,
    },
  });
}

function reader(volume = 0): WordPressEstateReader {
  return {
    readPages: () => collection("page", volume),
    readPosts: () => collection("post", volume),
    readMedia: () => collection("media", volume),
    readPostTypes: () => collection("post_type", 1),
    readTaxonomies: () => collection("taxonomy", 1),
    readCategories: () => collection("category", 0),
    readTags: () => collection("tag", 0),
  };
}

function site(configured = true): SiteConfiguration {
  return {
    siteId: "site-acme-example-fresh-site",
    organizationId: "acme",
    siteName: "Example Fresh Site",
    displayName: "Example Fresh Site",
    slug: "example-fresh-site",
    domain: "example-fresh-site.test",
    primaryAddress: null,
    canonicalUrl: "https://example-fresh-site.test",
    environment: "production",
    lifecycleState: "configuring",
    enabled: false,
    healthStatus: "healthy",
    publishingStatus: "disabled",
    publicationPolicy: "draft_only",
    defaultContentType: "article",
    defaultPublicationStatus: "draft",
    defaultAuthorReference: null,
    defaultCategoryReferences: [],
    integrations: {
      wordpressApiBaseUrl: "https://example-fresh-site.test/wp-json/wp/v2",
      wordpressCredentialReference: "credref-wp-test",
      workflowReference: configured ? "profile-workflow-acme" : null,
    },
    profiles: {
      promptProfileReference: configured ? "profile-prompt-acme" : null,
      imageProfileReference: configured ? "profile-image-acme" : null,
      seoProfileReference: configured ? "profile-seo-acme" : null,
      brandProfileReference: configured ? "profile-brand-acme" : null,
      analyticsProfileReference: null,
    },
    onboarding: {
      status: "connected",
      wordpressConnectionVerifiedAt: "2026-09-09T00:00:00.000Z",
      certificationStatus: "not_started",
      certificationPageId: null,
      certificationUrl: null,
      certifiedAt: null,
    },
    lastConnectionTest: "2026-09-09T00:00:00.000Z",
    lastSuccessfulPublication: null,
    lastHealthCheck: null,
    createdAt: "2026-09-09T00:00:00.000Z",
    updatedAt: "2026-09-09T00:00:00.000Z",
    notes: null,
  };
}

describe("fresh-site onboarding assessment", () => {
  test("detects operator capabilities without a write", () => {
    expect(readWordPressOperatorCapabilities({
      capabilities: { edit_posts: true, upload_files: true, publish_posts: false },
    })).toEqual({ editPosts: true, uploadFiles: true, publishPosts: false });
    expect(readWordPressOperatorCapabilities({})).toEqual({
      editPosts: false,
      uploadFiles: false,
      publishPosts: false,
    });
  });

  test("generates site identity from organization and name", () => {
    const slug = slugifySiteName("Example Fresh Site");
    expect(slug).toBe("example-fresh-site");
    expect(createSiteId("acme", slug)).toBe("site-acme-example-fresh-site");
  });

  test("accepts an empty connected site for product onboarding", async () => {
    const result = await inspectFreshWordPressSite({
      site: site(),
      reader: reader(),
      organizationActive: true,
      permissions: new Set(["sites:manage_integrations"]),
    });

    expect(result.inventory).toMatchObject({ pages: 0, posts: 0, media: 0, productCount: 0, emptyContentAccepted: true });
    expect(result.completionState).toBe("SITE_READY_FOR_PRODUCT_ONBOARDING");
    expect(result.complexity).toBe("LOW");
    expect(result.readiness.checkedConditions.map((condition) => condition.key)).toContain("profiles_present");
    expect(result.readiness.ready).toBe(false);
    expect(result.readiness.blockingReasons).toContain("Site is disabled.");
  });

  test("keeps an unconfigured connected site in configuring state", async () => {
    const result = await inspectFreshWordPressSite({
      site: site(false),
      reader: reader(),
      organizationActive: true,
      permissions: new Set(["sites:manage_integrations"]),
    });
    expect(result.completionState).toBe("SITE_CONFIGURING");
  });

  test("raises integration effort for a higher-volume existing estate", async () => {
    const result = await inspectFreshWordPressSite({
      site: site(),
      reader: reader(10),
      organizationActive: true,
      permissions: new Set(["sites:manage_integrations"]),
    });
    expect(result.complexity).toBe("MODERATE");
    expect(result.effort).toBe("MODERATE");
  });
});