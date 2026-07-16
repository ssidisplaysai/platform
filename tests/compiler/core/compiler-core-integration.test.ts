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
  assert.equal(Boolean(result.knowledgeIR), true);
  assert.equal(Boolean(result.businessGenomeIR), true);
  assert.equal(Boolean(result.enterpriseBlueprintIR), true);
  assert.equal(Boolean(result.solutionIR), true);
  assert.equal(Boolean(result.enterpriseRuntimeIR), true);
  assert.equal(result.manifest.sessionId, "core-session-1");
  assert.equal(result.manifest.passManifests.length >= 7, true);

  const passIds = result.manifest.passManifests.map((entry) => entry.id);
  assert.equal(passIds.includes("solution-pass"), true);
  assert.equal(passIds.includes("runtime-pass"), true);

  const solutionPass = result.manifest.passManifests.find((entry) => entry.id === "solution-pass");
  assert.deepEqual(solutionPass?.dependencies, ["blueprint-pass"]);

  const runtimePass = result.manifest.passManifests.find((entry) => entry.id === "runtime-pass");
  assert.deepEqual(runtimePass?.dependencies, ["solution-pass"]);

  const executionPlan = core.getPipeline().registry.createExecutionPlan("1.0.0");
  const orderedPassIds = executionPlan.steps.map((entry) => entry.passId);
  const solutionIndex = orderedPassIds.indexOf("solution-pass");
  const runtimeIndex = orderedPassIds.indexOf("runtime-pass");
  assert.equal(solutionIndex >= 0, true);
  assert.equal(runtimeIndex > solutionIndex, true);
});
