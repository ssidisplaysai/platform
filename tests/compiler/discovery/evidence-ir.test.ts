import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { DiscoveryEngine } from "../../../src/compiler/discovery/DiscoveryEngine";
import type { KnowledgeSource } from "../../../src/compiler/discovery/KnowledgeSource";

const fixtureRoot = resolve(process.cwd(), "tests", "compiler", "discovery", "fixtures");

function fixturePath(...segments: string[]): string {
  return resolve(fixtureRoot, ...segments);
}

test("evidence emitter produces graph with source and artifact nodes", async () => {
  const engine = new DiscoveryEngine();
  const source: KnowledgeSource = {
    id: "evidence-source",
    sourceType: "filesystem",
    origin: fixturePath("filesystem"),
  };

  const result = await engine.ingest(source);
  const ir = result.evidenceIR;

  assert.equal(ir.schemaVersion, "1.0.0");
  assert.equal(ir.artifactCount, 3);
  assert.equal(ir.graph.nodes.some((node) => node.nodeType === "source"), true);
  assert.equal(ir.graph.nodes.filter((node) => node.nodeType === "artifact").length, 3);
  assert.equal(ir.graph.relationships.length, 3);
  assert.ok(ir.deterministicHash);
});
