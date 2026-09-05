jest.mock("server-only", () => ({}));

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("GLW research source registry", () => {
  const originalRoot = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
  let root = "";

  beforeEach(() => {
    jest.resetModules();
    root = mkdtempSync(join(tmpdir(), "glw-research-source-"));
    process.env.GCP_FOUNDATION_PERSISTENCE_DIR = root;
  });

  afterEach(() => {
    if (originalRoot === undefined) delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
    else process.env.GCP_FOUNDATION_PERSISTENCE_DIR = originalRoot;
    rmSync(root, { recursive: true, force: true });
  });

  test("registers discovery authority idempotently without product-fact authority", async () => {
    const registry = await import("../research-source-registry");
    const source = {
      sourceId: "competitor-example",
      url: "https://competitor.example/guide/",
      domain: "competitor.example",
      title: "Example guide",
      topic: "Market discovery",
      roles: ["COMPETITOR_RESEARCH", "MARKET_DISCOVERY"] as const,
      classification: "DISCOVERY_ONLY" as const,
      mayCreateProductFacts: false,
      accessStatus: "ACCESSIBLE" as const,
      retrievedAt: "2026-09-05T00:00:00.000Z",
      discovery: { headings: [], terminology: [], buyerQuestions: [], applications: [], selectionCriteria: [], environmentalTopics: [], installationTopics: [], nicheAudiences: [], relatedTopicUrls: [], contentOpportunities: [], technicalClaimsRequiringCorroboration: [], competitorOnlyClaims: [] },
    };
    expect(registry.registerGlwResearchSource(source).created).toBe(true);
    expect(registry.registerGlwResearchSource(source).created).toBe(false);
    expect(registry.listGlwResearchSources()).toEqual([source]);
  });

  test("rejects product-fact authority for a discovery-only source", async () => {
    const registry = await import("../research-source-registry");
    expect(() => registry.registerGlwResearchSource({
      sourceId: "unsafe",
      url: "https://competitor.example/guide/",
      domain: "competitor.example",
      title: "Unsafe guide",
      topic: "Discovery",
      roles: ["COMPETITOR_RESEARCH"],
      classification: "DISCOVERY_ONLY",
      mayCreateProductFacts: true,
      accessStatus: "ACCESSIBLE",
      retrievedAt: "2026-09-05T00:00:00.000Z",
      discovery: { headings: [], terminology: [], buyerQuestions: [], applications: [], selectionCriteria: [], environmentalTopics: [], installationTopics: [], nicheAudiences: [], relatedTopicUrls: [], contentOpportunities: [], technicalClaimsRequiringCorroboration: [], competitorOnlyClaims: [] },
    })).toThrow("Discovery-only sources cannot create product facts");
  });
});