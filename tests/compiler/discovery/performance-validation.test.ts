import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { DiscoveryEngine } from "../../../src/compiler/discovery/DiscoveryEngine";
import type { KnowledgeSource } from "../../../src/compiler/discovery/KnowledgeSource";

const fixtureRoot = resolve(process.cwd(), "tests", "compiler", "discovery", "fixtures");

function fixturePath(...segments: string[]): string {
  return resolve(fixtureRoot, ...segments);
}

test("large filesystem ingestion remains deterministic with stable traversal", async () => {
  const engine = new DiscoveryEngine();
  const source: KnowledgeSource = {
    id: "large-fs-source",
    sourceType: "filesystem",
    origin: fixturePath("large-filesystem"),
  };

  const startA = performance.now();
  const first = await engine.ingest(source);
  const durationA = performance.now() - startA;

  const startB = performance.now();
  const second = await engine.ingest(source);
  const durationB = performance.now() - startB;

  assert.equal(first.artifacts.length, 60);
  assert.equal(second.artifacts.length, 60);
  assert.deepEqual(first.evidenceIR, second.evidenceIR);

  // Benchmark-style sanity guard: keep this broad to avoid environment flakiness.
  assert.equal(durationA < 5000, true);
  assert.equal(durationB < 5000, true);

  const firstOrigins = first.artifacts.map((artifact) => artifact.origin);
  const secondOrigins = second.artifacts.map((artifact) => artifact.origin);
  assert.deepEqual(firstOrigins, secondOrigins);
});
