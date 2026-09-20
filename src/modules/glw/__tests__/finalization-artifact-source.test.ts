import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { GlwPageExecutionRecord } from "../page-execution";
import { evaluateGlwGeneratedContentQa } from "../generated-content-qa";
import { resolveFinalizationArtifactSource } from "../finalization-artifact-source";

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
  generated: string;
  raw?: string;
  canonicalized?: string;
}): Pick<GlwPageExecutionRecord, "generatedDraft" | "rawGeneratedDraft" | "canonicalizedGeneratedDraft"> {
  return {
    generatedDraft: artifact(input.generated),
    rawGeneratedDraft: input.raw ? artifact(input.raw) : null,
    canonicalizedGeneratedDraft: input.canonicalized ? artifact(input.canonicalized) : null,
  };
}

describe("continuation finalization artifact source", () => {
  test("uses persisted generatedDraft for recoverable failures even when stale snapshots exist", () => {
    const source = resolveFinalizationArtifactSource({
      job: record({
        generated: '<h1>Outdoor Digital Sphere in Texas</h1><p>Explore our <a href="/outdoor-digital-sphere/">Outdoor Digital Sphere</a> solutions.</p>',
        raw: "<h1>Outdoor Digital Sphere in Texas</h1><p>stale raw without required link</p>",
        canonicalized: "<h1>Outdoor Digital Sphere in Texas</h1><p>stale canonicalized without required link</p>",
      }),
      recoverableFailure: true,
    });

    expect(source.sourceField).toBe("generatedDraft");
    expect(source.artifactForPipeline.contentHtml).toContain('href="/outdoor-digital-sphere/"');
    expect(source.rawGeneratedDraft.contentHtml).toContain('href="/outdoor-digital-sphere/"');
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
        generated: '<h1>Outdoor Digital Sphere in Texas</h1><p><a href="/outdoor-digital-sphere/">Outdoor Digital Sphere</a> planning guide.</p>',
        raw: "<h1>Outdoor Digital Sphere in Texas</h1><p>stale</p>",
        canonicalized: "<h1>Outdoor Digital Sphere in Texas</h1><p>stale</p>",
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
