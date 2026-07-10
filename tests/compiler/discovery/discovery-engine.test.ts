import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { DiscoveryEngine } from "../../../src/compiler/discovery/DiscoveryEngine";
import type { KnowledgeSource } from "../../../src/compiler/discovery/KnowledgeSource";

const fixtureRoot = resolve(process.cwd(), "tests", "compiler", "discovery", "fixtures");

function fixturePath(...segments: string[]): string {
  return resolve(fixtureRoot, ...segments);
}

test("discovery engine ingests markdown/json/yaml sources", async () => {
  const engine = new DiscoveryEngine();

  const sources: KnowledgeSource[] = [
    { id: "md-source", sourceType: "markdown", origin: fixturePath("sample.md") },
    { id: "json-source", sourceType: "json", origin: fixturePath("sample.json") },
    { id: "yaml-source", sourceType: "yaml", origin: fixturePath("sample.yaml") },
  ];

  for (const source of sources) {
    const result = await engine.ingest(source);
    assert.equal(result.artifacts.length, 1);
    assert.equal(result.evidenceIR.artifactCount, 1);
  }
});

test("discovery engine ingests filesystem source through same interface", async () => {
  const engine = new DiscoveryEngine();
  const source: KnowledgeSource = {
    id: "fs-source",
    sourceType: "filesystem",
    origin: fixturePath("filesystem"),
  };

  const result = await engine.ingest(source);

  assert.equal(result.artifacts.length, 3);
  assert.equal(result.evidenceIR.artifactCount, 3);
  assert.equal(result.artifacts.every((artifact) => ["markdown", "json", "yaml"].includes(artifact.sourceType)), true);
});
