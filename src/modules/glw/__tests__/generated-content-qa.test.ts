import { evaluateGlwGeneratedContentQa } from "../generated-content-qa";
import type { GlwGeneratedDraftArtifact } from "../page-execution";
import type { GlwGenerationRequest } from "../page-generation";

const request: GlwGenerationRequest = {
  siteId: "site-ssi-screen-solutions-international",
  productId: "prod-ssi-accent-rear-projection-film",
  pageType: "city_service",
  stateCode: "TX",
  citySlug: "fort-worth",
  slug: "accent-rear-projection-film/texas/fort-worth",
  canonicalPath: "accent-rear-projection-film/texas/fort-worth",
  organizationId: "ssi",
  siteName: "Screen Solutions International",
  siteDomain: "ssidisplays.com",
  siteCanonicalUrl: "https://ssidisplays.com",
  wordpressApiBaseUrl: "https://ssidisplays.com/wp-json/wp/v2",
  productTopic: "Accent Rear Projection Film",
  stateName: "Texas",
  cityName: "Fort Worth",
  title: "Accent Rear Projection Film in Fort Worth",
  seoTitle: "Accent Rear Projection Film in Fort Worth | SSI Displays",
  metaDescription: "Explore Accent Rear Projection Film solutions in Fort Worth from Screen Solutions International.",
  publicationIntent: "draft",
  plannedOperation: "CREATE_CITY",
  wordpressObjectId: null,
  externalExecutionAllowed: false,
};

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
      artifact: artifact(`<h1>Accent Rear Projection Film in Fort Worth</h1><p>Whether youÃ¢re planning a display, ${cleanSentence.repeat(170)}</p>`),
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
    expect(result.checks.textIntegrity.ok).toBe(true);
    expect(result.checks.siteDomainIsolation.ok).toBe(true);
    expect(result.checks.minimumWordCount.ok).toBe(true);
    expect(result.checks.expectedState.ok).toBe(true);
    expect(result.checks.expectedCity.ok).toBe(true);
  });

  test("allows a visible configured-site hostname in body text", () => {
    const cleanSentence = "Accent Rear Projection Film solutions for Fort Worth Texas commercial glass applications. ";
    const result = evaluateGlwGeneratedContentQa({
      artifact: artifact(`<h1>Accent Rear Projection Film in Fort Worth</h1><p>${cleanSentence.repeat(170)} Visit ssidisplays.com for project assistance.</p>`),
      request,
      siteDomain: "ssidisplays.com",
      minimumWordCount: 1500,
    });

    expect(result.ok).toBe(true);
    expect(result.checks.textIntegrity.ok).toBe(true);
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

  test("fails closed on joined-word and punctuation spacing corruption", () => {
    const cleanSentence = "Accent Rear Projection Film solutions for Fort Worth Texas commercial glass applications. ";
    const result = evaluateGlwGeneratedContentQa({
      artifact: artifact(`<h1>Accent Rear Projection Film in Fort Worth</h1><p>Businesses needfor reliable display planning. Selecting film carefully matters.${cleanSentence.repeat(170)}</p>`),
      request,
      siteDomain: "ssidisplays.com",
      minimumWordCount: 1500,
    });

    expect(result.ok).toBe(false);
    expect(result.checks.textIntegrity.ok).toBe(false);
    expect(result.failureReasons.textIntegrity).toContain("text-integrity");
  });

  test("fails closed on generic Plano-style spacing corruption", () => {
    const cleanSentence = "Accent Rear Projection Film solutions for Fort Worth Texas commercial glass applications. ";
    const result = evaluateGlwGeneratedContentQa({
      artifact: artifact(`<h1>Accent Rear Projection Film in Fort Worth</h1><p>Film,Plano teams can improve colors forsuperior presentation across glasswalls and windowsinto active displays. Poor maintenance may result inreduced clarity at the final stepof installation. ${cleanSentence.repeat(170)}</p>`),
      request,
      siteDomain: "ssidisplays.com",
      minimumWordCount: 1500,
    });

    expect(result.ok).toBe(false);
    expect(result.checks.textIntegrity.ok).toBe(false);
    expect(result.checks.textIntegrity.message).toContain(",P");
    expect(result.failureReasons.textIntegrity).toContain(",P");
  });
});
