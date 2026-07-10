import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { DiscoveryEngine } from "../../../src/compiler/discovery/DiscoveryEngine";
import { CompilerCore } from "../../../src/compiler/core/CompilerCore";

function fixturePath(...segments: string[]): string {
  return resolve(process.cwd(), "tests", "compiler", "discovery", "fixtures", ...segments);
}

test("compiler core preserves certified discovery and evidence behavior", async () => {
  const source = {
    id: "compatibility-source",
    sourceType: "markdown" as const,
    origin: fixturePath("sample.md"),
  };

  const discoveryEngine = new DiscoveryEngine();
  const direct = await discoveryEngine.ingest(source);

  const core = new CompilerCore();
  const orchestrated = await core.compile({ source }, "core-compatibility-1");

  assert.deepEqual(orchestrated.artifacts, direct.artifacts);
  assert.deepEqual(orchestrated.evidenceIR, direct.evidenceIR);
});
