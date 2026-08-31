import { evaluateGlwGeneratedContentQa } from "../generated-content-qa";
import type { GlwGeneratedDraftArtifact } from "../page-execution";
import type { GlwGenerationRequest } from "../page-generation";

const request = {
  siteId: "site-ssi-screen-solutions-international",
  productId: "prod-ssi-accent-rear-projection-film",
  pageType: "city_service",
  stateCode: "TX",
  citySlug: "fort-worth",
  slug: "accent-rear-projection-film/texas/fort-worth",
  canonicalPath: "accent-rear-projection-film/texas/fort-worth",
  productTopic: "Accent Rear Projection Film",
  state: "Texas",
  city: "Fort Worth",
  title: "Accent Rear Projection Film in Fort Worth",
  seoTitle: "Accent Rear Projection Film in Fort Worth | SSI Displays",
  metaDescription: "Explore Accent Rear Projection Film solutions in Fort Worth from Screen Solutions International.",
  primaryKeyword: "accent rear projection film fort worth texas",
  publicationIntent: "draft",
  plannedOperation: "CREATE_CITY",
  wordpressObjectId: null,
} as unknown as GlwGenerationRequest;

function artifact(contentHtml: string): GlwGeneratedDraftArtifact {
  return {
    title: "Accent Rear Projection Film in Fort Worth",
    contentHtml,
    slug: "accent-rear-projection-film/texas/fort-worth",
    excerpt: null,
    seoTitle: null,
    metaDescription: null,
    focusKeyphrase: null,
  };
}

describe("evaluateGlwGeneratedContentQa", () => {
  test("fails closed on bare mojibake lead bytes", () => {
    const cleanSentence = "Accent Rear Projection Film solutions for Fort Worth Texas commercial glass applications. ";
    const result = evaluateGlwGeneratedContentQa({
      artifact: artifact(`<h1>Accent Rear Projection Film in Fort Worth</h1><p>Whether youâre planning a display, ${cleanSentence.repeat(170)}</p>`),
      request,
      siteDomain: "ssidisplays.com",
      minimumWordCount: 1500,
    });

    expect(result.ok).toBe(false);
    expect(result.checks.encodingIntegrity.ok).toBe(false);
    expect(result.failureReasons.encodingIntegrity).toContain("mojibake");
  });

  test("passes clean site-isolated SSI content", () => {
    const cleanSentence = "Accent Rear Projection Film solutions for Fort Worth Texas commercial glass applications. ";
    const result = evaluateGlwGeneratedContentQa({
      artifact: artifact(`<h1>Accent Rear Projection Film in Fort Worth</h1><p>${cleanSentence.repeat(170)}</p><a href="https://ssidisplays.com">SSI Displays</a>`),
      request,
      siteDomain: "ssidisplays.com",
      minimumWordCount: 1500,
    });

    expect(result.ok).toBe(true);
    expect(result.checks.encodingIntegrity.ok).toBe(true);
    expect(result.checks.siteDomainIsolation.ok).toBe(true);
    expect(result.checks.minimumWordCount.ok).toBe(true);
  });

  test("fails closed on a foreign absolute link domain", () => {
    const cleanSentence = "Accent Rear Projection Film solutions for Fort Worth Texas commercial glass applications. ";
    const result = evaluateGlwGeneratedContentQa({
      artifact: artifact(`<h1>Accent Rear Projection Film in Fort Worth</h1><p>${cleanSentence.repeat(170)}</p><a href="https://leddisplaywarehouse.com/outdoor-led-displays/">Wrong site</a>`),
      request,
      siteDomain: "ssidisplays.com",
      minimumWordCount: 1500,
    });

    expect(result.ok).toBe(false);
    expect(result.checks.siteDomainIsolation.ok).toBe(false);
    expect(result.failureReasons.siteDomainIsolation).toContain("leddisplaywarehouse.com");
  });
});
