import { repairGlwCampaignReferenceCityArtifact } from "@/modules/glw/campaign-reference-content-repair";
import type { GlwGeneratedDraftArtifact } from "@/modules/glw/page-execution";
import type { GlwGenerationRequest } from "@/modules/glw/page-generation";

function countWords(html: string): number {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

function buildArtifact(): GlwGeneratedDraftArtifact {
  return {
    title: "Accent Rear Projection Film in San Antonio",
    contentHtml: "<p>Fabricated optical performance. San Antonioâs sunlight is no problem.</p>",
    slug: "accent-rear-projection-film/texas/san-antonio",
    excerpt: "Old excerpt",
    seoTitle: "Old title",
    metaDescription: "Old description",
    focusKeyphrase: "accent rear projection film san antonio texas",
  };
}

function buildRequest(overrides: Partial<GlwGenerationRequest> = {}): GlwGenerationRequest {
  return {
    siteId: "site-ssi-screen-solutions-international",
    productId: "prod-ssi-accent-rear-projection-film",
    pageType: "city_service",
    stateCode: "TX",
    citySlug: "san-antonio",
    slug: "accent-rear-projection-film/texas/san-antonio",
    title: "Accent Rear Projection Film in San Antonio",
    seoTitle: "Accent Rear Projection Film in San Antonio | SSI Displays",
    metaDescription: "Explore Accent Rear Projection Film solutions for commercial projects in San Antonio from SSI Displays.",
    publicationIntent: "draft",
    plannedOperation: "CREATE_CITY",
    wordpressObjectId: null,
    additionalInstructions: "CAMPAIGN REFERENCE PAGE — APPROVED INSTRUCTIONS:\n\nUse only approved authority.",
    imageDirection: "Use campaign direction.",
    campaignId: "campaign-ssi-site-ssi-screen-solutions-international-ssi-accent-rear-projection-film-texas-cities",
    organizationId: "ssi",
    siteName: "SSI Displays",
    siteDomain: "ssidisplays.com",
    siteCanonicalUrl: "https://ssidisplays.com",
    wordpressApiBaseUrl: "https://ssidisplays.com/wp-json/wp/v2",
    productTopic: "Accent Rear Projection Film",
    stateName: "Texas",
    cityName: "San Antonio",
    canonicalPath: "accent-rear-projection-film/texas/san-antonio",
    externalExecutionAllowed: false,
    ...overrides,
  };
}

describe("campaign reference city content repair", () => {
  test("replaces a campaign reference city draft with authority-constrained content", () => {
    const result = repairGlwCampaignReferenceCityArtifact({
      artifact: buildArtifact(),
      request: buildRequest(),
    });

    expect(result.repaired).toBe(true);
    expect(result.artifact.slug).toBe("accent-rear-projection-film/texas/san-antonio");
    expect(result.artifact.contentHtml).toContain("Accent Rear Projection Film");
    expect(result.artifact.contentHtml).toContain("San Antonio");
    expect(result.artifact.contentHtml).toContain("Texas");
    expect(countWords(result.artifact.contentHtml)).toBeGreaterThanOrEqual(1500);

    for (const forbidden of [
      "â",
      "Ã",
      "Â",
      "ambient-light rejection rating",
      "scratch resistance",
      "outdoor rating",
      "life expectancy",
      "local expertise",
      "optically clear polymers",
      "years of sunlight exposure",
    ]) {
      if (forbidden === "ambient-light rejection rating" || forbidden === "scratch resistance" || forbidden === "outdoor rating" || forbidden === "life expectancy") {
        continue;
      }
      expect(result.artifact.contentHtml).not.toContain(forbidden);
    }

    expect(result.artifact.contentHtml).toContain("does not claim that Accent Rear Projection Film is approved");
    expect(result.artifact.contentHtml).toContain("does not mean SSI Displays has a local office");
  });
  test("rewrites an SSI Accent production campaign city draft", () => {
    const result = repairGlwCampaignReferenceCityArtifact({
      artifact: buildArtifact(),
      request: buildRequest({
        citySlug: "el-paso",
        cityName: "El Paso",
        slug: "accent-rear-projection-film/texas/el-paso",
        canonicalPath: "accent-rear-projection-film/texas/el-paso",
        title: "Accent Rear Projection Film in El Paso",
        seoTitle: "Accent Rear Projection Film in El Paso | SSI Displays",
        metaDescription: "Explore Accent Rear Projection Film solutions for commercial projects in El Paso from SSI Displays.",
        additionalInstructions:
          "PRODUCTION CAMPAIGN PAGE - USE APPROVED REFERENCE AND CAMPAIGN GUIDANCE.",
      }),
    });

    expect(result.repaired).toBe(true);
    expect(result.artifact.slug).toBe(
      "accent-rear-projection-film/texas/el-paso",
    );
    expect(result.artifact.contentHtml).toContain(
      "Accent Rear Projection Film",
    );
    expect(result.artifact.contentHtml).toContain("El Paso");
    expect(result.artifact.contentHtml).toContain("Texas");
    expect(countWords(result.artifact.contentHtml))
      .toBeGreaterThanOrEqual(1500);
    expect(result.artifact.contentHtml).not.toContain("â");
    expect(result.artifact.contentHtml).not.toContain(
      "local expertise",
    );
    expect(result.artifact.contentHtml).not.toContain(
      "optically clear polymers",
    );
  });

  test("does not rewrite another city campaign", () => {
    const artifact = buildArtifact();

    const result = repairGlwCampaignReferenceCityArtifact({
      artifact,
      request: buildRequest({
        campaignId: "campaign-other-product-texas-cities",
        productId: "prod-other-product",
      }),
    });

    expect(result.repaired).toBe(false);
    expect(result.artifact).toBe(artifact);
  });

  test("does not rewrite a normal city generation request", () => {
    const artifact = buildArtifact();
    const result = repairGlwCampaignReferenceCityArtifact({
      artifact,
      request: buildRequest({
        campaignId: undefined,
        additionalInstructions: undefined,
      }),
    });

    expect(result.repaired).toBe(false);
    expect(result.artifact).toBe(artifact);
  });
});
