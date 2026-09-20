import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { GlwPageExecutionRecord } from "../page-execution";
import { evaluateGlwGeneratedContentQa } from "../generated-content-qa";
import { resolveFinalizationArtifactSource } from "../finalization-artifact-source";
import { enrichGlwGeneratedContentForSeo } from "../seo-enrichment";

function artifact(contentHtml: string) {
  return {
    title: "Outdoor Digital Sphere in Texas",
    contentHtml,
    slug: "outdoor-digital-sphere/texas",
    excerpt: null,
    seoTitle: null,
    metaDescription: null,
    focusKeyphrase: null,
  };
}

function record(input: {
  status?: GlwPageExecutionRecord["status"];
  errorCode?: GlwPageExecutionRecord["errorCode"];
  generated: string;
  raw?: string;
  canonicalized?: string;
}): Pick<GlwPageExecutionRecord, "status" | "errorCode" | "generatedDraft" | "rawGeneratedDraft" | "canonicalizedGeneratedDraft"> {
  return {
    status: input.status ?? "FAILED",
    errorCode: input.errorCode ?? "GENERATED_CONTENT_QA_FAILED",
    generatedDraft: artifact(input.generated),
    rawGeneratedDraft: input.raw ? artifact(input.raw) : null,
    canonicalizedGeneratedDraft: input.canonicalized ? artifact(input.canonicalized) : null,
  };
}

function wordyParagraph(word: string, count: number): string {
  return `<p>${Array.from({ length: count }, () => word).join(" ")}</p>`;
}

describe("continuation finalization artifact source", () => {
  test("uses canonicalized artifact for recoverable FAILED GENERATED_CONTENT_QA_FAILED when available", () => {
    const source = resolveFinalizationArtifactSource({
      job: record({
        status: "FAILED",
        errorCode: "GENERATED_CONTENT_QA_FAILED",
        generated: "<h1>Outdoor Digital Sphere in Texas</h1><p>degraded content</p>",
        raw: "<h1>Outdoor Digital Sphere in Texas</h1><p>raw content</p>",
        canonicalized: "<h1>Outdoor Digital Sphere in Texas</h1><p>canonicalized source</p>",
      }),
      recoverableFailure: true,
    });

    expect(source.sourceField).toBe("canonicalizedGeneratedDraft");
    expect(source.artifactForPipeline.contentHtml).toContain("canonicalized source");
    expect(source.rawGeneratedDraft.contentHtml).toContain("raw content");
  });

  test("uses canonicalized artifact for non-recoverable execution when available", () => {
    const source = resolveFinalizationArtifactSource({
      job: record({
        generated: "<h1>Generated</h1>",
        raw: "<h1>Raw</h1>",
        canonicalized: "<h1>Canonicalized</h1>",
      }),
      recoverableFailure: false,
    });

    expect(source.sourceField).toBe("canonicalizedGeneratedDraft");
    expect(source.artifactForPipeline.contentHtml).toContain("Canonicalized");
    expect(source.rawGeneratedDraft.contentHtml).toContain("Raw");
  });

  test("qa passes product-authority checks when recoverable finalization source already contains required link", () => {
    const selected = resolveFinalizationArtifactSource({
      job: record({
        status: "FAILED",
        errorCode: "GENERATED_CONTENT_QA_FAILED",
        generated: "<h1>Outdoor Digital Sphere in Texas</h1><p>degraded generated artifact</p>",
        raw: "<h1>Outdoor Digital Sphere in Texas</h1><p>stale</p>",
        canonicalized: '<h1>Outdoor Digital Sphere in Texas</h1><p><a href="/outdoor-digital-sphere/">Outdoor Digital Sphere</a> planning guide.</p>',
      }),
      recoverableFailure: true,
    });

    const qa = evaluateGlwGeneratedContentQa({
      artifact: selected.artifactForPipeline,
      request: {
        pageType: "state_service",
        stateCode: "TX",
        stateName: "Texas",
        cityName: null,
        productTopic: "Outdoor Digital Sphere",
        canonicalPath: "outdoor-digital-sphere/texas",
      } as never,
      siteDomain: "leddisplaywarehouse.com",
      minimumWordCount: 1,
      requiredCanonicalProductLink: {
        url: "/outdoor-digital-sphere/",
        anchorText: "Outdoor Digital Sphere",
      },
      authorizedComparisonStateCodes: [],
    });

    expect(qa.checks.stateProductAuthorityLink.ok).toBe(true);
    expect(qa.checks.canonicalProductReference.ok).toBe(true);
  });

  test("production-shaped recoverable QA failure prefers canonicalized source and deterministic repair feeds QA", () => {
    const generated958 = `<h1>Outdoor Digital Sphere in Texas</h1>${wordyParagraph("generated", 955)}`;
    const canonicalized2075 = `<h1>Outdoor Digital Sphere in Texas</h1>${wordyParagraph("canonicalized", 2072)}`;
    const raw2091 = `<h1>Outdoor Digital Sphere in Texas</h1><p><a href="/outdoor-digital-sphere/">Outdoor Digital Sphere</a></p>${wordyParagraph("raw", 2086)}`;

    const selected = resolveFinalizationArtifactSource({
      job: record({
        status: "FAILED",
        errorCode: "GENERATED_CONTENT_QA_FAILED",
        generated: generated958,
        raw: raw2091,
        canonicalized: canonicalized2075,
      }),
      recoverableFailure: true,
    });

    expect(selected.sourceField).toBe("canonicalizedGeneratedDraft");

    const repaired = enrichGlwGeneratedContentForSeo({
      artifact: selected.artifactForPipeline,
      request: {
        pageType: "state_service",
        stateCode: "TX",
        stateName: "Texas",
        cityName: null,
        productTopic: "Outdoor Digital Sphere",
        canonicalPath: "outdoor-digital-sphere/texas",
      } as never,
    });

    const qa = evaluateGlwGeneratedContentQa({
      artifact: repaired.artifact,
      request: {
        pageType: "state_service",
        stateCode: "TX",
        stateName: "Texas",
        cityName: null,
        productTopic: "Outdoor Digital Sphere",
        canonicalPath: "outdoor-digital-sphere/texas",
      } as never,
      siteDomain: "leddisplaywarehouse.com",
      minimumWordCount: 1500,
      requiredCanonicalProductLink: {
        url: "/outdoor-digital-sphere/",
        anchorText: "Outdoor Digital Sphere",
      },
      authorizedComparisonStateCodes: [],
    });

    expect(qa.wordCount).toBeGreaterThanOrEqual(2075);
    expect(qa.checks.minimumWordCount.ok).toBe(true);
    expect(qa.checks.stateProductAuthorityLink.ok).toBe(true);
    expect(qa.checks.canonicalProductReference.ok).toBe(true);
  });

  test("continue branch finalization uses resolved canonical source before QA and without new generation dispatch", () => {
    const route = readFileSync(resolve(process.cwd(), "src/app/api/glw/page-generation/route.ts"), "utf8");
    const resolver = route.indexOf("resolveFinalizationArtifactSource({");
    const qa = route.indexOf("evaluateGlwGeneratedContentQa({", resolver);
    const continueBranch = route.indexOf('if (action === "continue")');
    const finalizeCall = route.indexOf("finalizeContentReadyExecution({", continueBranch);
    const generateDispatch = route.indexOf("service.execute(preview.request)");

    expect(resolver).toBeGreaterThan(0);
    expect(qa).toBeGreaterThan(resolver);
    expect(finalizeCall).toBeGreaterThan(continueBranch);
    expect(generateDispatch).toBeGreaterThan(finalizeCall);
  });
});
