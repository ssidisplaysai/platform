import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { DiscoveryEngine } from "../../../src/compiler/discovery/DiscoveryEngine";
import type { KnowledgeSource } from "../../../src/compiler/discovery/KnowledgeSource";

const fixtureRoot = resolve(process.cwd(), "tests", "compiler", "discovery", "fixtures");

function fixturePath(...segments: string[]): string {
  return resolve(fixtureRoot, ...segments);
}

test("repeated ingestion of unchanged sources emits identical EvidenceIR output", async () => {
  const engine = new DiscoveryEngine();
  const source: KnowledgeSource = {
    id: "deterministic-source",
    sourceType: "filesystem",
    origin: fixturePath("filesystem"),
  };

  const first = await engine.ingest(source);
  const second = await engine.ingest(source);

  assert.deepEqual(first.evidenceIR, second.evidenceIR);
  assert.deepEqual(first.artifacts, second.artifacts);
});
