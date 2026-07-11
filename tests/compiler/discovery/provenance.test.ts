import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { DiscoveryEngine } from "../../../src/compiler/discovery/DiscoveryEngine";
import type { KnowledgeSource } from "../../../src/compiler/discovery/KnowledgeSource";

const fixtureRoot = resolve(process.cwd(), "tests", "compiler", "discovery", "fixtures");

function fixturePath(file: string): string {
  return resolve(fixtureRoot, file);
}

test("provenance fields are present for every discovered artifact", async () => {
  const engine = new DiscoveryEngine();
  const source: KnowledgeSource = {
    id: "provenance-source",
    sourceType: "markdown",
    origin: fixturePath("sample.md"),
  };

  const result = await engine.ingest(source);
  const artifact = result.artifacts[0];

  assert.ok(artifact.id);
  assert.ok(artifact.sourceId);
  assert.ok(artifact.artifactId);
  assert.ok(artifact.versionId);
  assert.ok(artifact.sourceType);
  assert.ok(artifact.origin);
  assert.ok(artifact.checksum);
  assert.ok(artifact.createdAt);
  assert.ok(artifact.modifiedAt);
  assert.ok(artifact.discoveredAt);
  assert.ok(artifact.metadata);
  assert.ok(artifact.lineage);
  assert.ok(typeof artifact.confidence === "number");

  assert.equal(artifact.version.checksum, artifact.checksum);
  assert.equal(artifact.version.versionId, artifact.versionId);
});
