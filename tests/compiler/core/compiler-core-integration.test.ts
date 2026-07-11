import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { CompilerCore } from "../../../src/compiler/core/CompilerCore";

function fixturePath(...segments: string[]): string {
  return resolve(process.cwd(), "tests", "compiler", "discovery", "fixtures", ...segments);
}

test("compiler core orchestrates discovery and evidence passes", async () => {
  const core = new CompilerCore();
  const result = await core.compile({
    source: {
      id: "core-sample",
      sourceType: "markdown",
      origin: fixturePath("sample.md"),
    },
  }, "core-session-1");

  assert.equal(result.artifacts.length, 1);
  assert.equal(result.evidenceIR.artifactCount, 1);
  assert.equal(result.manifest.sessionId, "core-session-1");
  assert.equal(result.manifest.passManifests.length >= 2, true);
});
