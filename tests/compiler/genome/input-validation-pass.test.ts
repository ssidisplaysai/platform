import assert from "node:assert/strict";
import test from "node:test";
import { InputValidationPass } from "../../../src/compiler/genome";
import { buildCompilerInput, buildEvidenceIR } from "./helpers";

const pass = new InputValidationPass();

test("input validation passes for valid Evidence IR", () => {
  const result = pass.execute(buildCompilerInput(), { sessionId: "s1", pipelineVersion: "1.0.0" });

  assert.equal(result.fatal, false);
  assert.equal(result.output.validationStatus, "valid");
  assert.equal(result.output.evidenceItemIds.length, 2);
});

test("missing root identity fails", () => {
  const result = pass.execute(
    buildCompilerInput({ evidenceIrIdentity: "" }),
    { sessionId: "s1", pipelineVersion: "1.0.0" },
  );

  assert.equal(result.fatal, true);
  assert.equal(result.diagnostics.some((entry) => entry.code === "BGC-INPUT-002"), true);
});

test("missing required version fails", () => {
  const evidenceIR = buildEvidenceIR();
  const result = pass.execute(
    buildCompilerInput({ evidenceIR: { ...evidenceIR, schemaVersion: "" as never } }),
    { sessionId: "s1", pipelineVersion: "1.0.0" },
  );

  assert.equal(result.fatal, true);
  assert.equal(result.diagnostics.some((entry) => entry.code === "BGC-INPUT-003"), true);
});

test("missing provenance is diagnosed", () => {
  const evidenceIR = buildEvidenceIR();
  const node = evidenceIR.graph.nodes.find((entry) => entry.id === "artifact:artifact-a");
  if (!node) {
    throw new Error("Expected test node artifact:artifact-a");
  }

  node.lineage = { sourceId: "", parentNodeIds: [] as never, transformationSteps: [] as never } as never;

  const result = pass.execute(buildCompilerInput({ evidenceIR }), { sessionId: "s1", pipelineVersion: "1.0.0" });

  assert.equal(result.fatal, true);
  assert.equal(result.diagnostics.some((entry) => entry.code === "BGC-INPUT-008"), true);
});

test("duplicate evidence identity is diagnosed", () => {
  const evidenceIR = buildEvidenceIR();
  const duplicate = {
    ...evidenceIR.graph.nodes.find((entry) => entry.id === "artifact:artifact-a")!,
    id: "artifact:artifact-a-duplicate",
  };
  duplicate.artifactId = "artifact-a";
  duplicate.versionId = "v1";

  const duplicateGraph = evidenceIR.graph.withNode(duplicate as never);
  const result = pass.execute(
    buildCompilerInput({ evidenceIR: { ...evidenceIR, graph: duplicateGraph, artifactCount: 3 } }),
    { sessionId: "s1", pipelineVersion: "1.0.0" },
  );

  assert.equal(result.fatal, true);
  assert.equal(result.diagnostics.some((entry) => entry.code === "BGC-INPUT-009"), true);
});

test("fatal upstream validation blocks pipeline", () => {
  const result = pass.execute(
    buildCompilerInput({
      upstreamValidation: {
        status: "invalid",
        validator: "evidence-validator",
      },
    }),
    { sessionId: "s1", pipelineVersion: "1.0.0" },
  );

  assert.equal(result.fatal, true);
  assert.equal(result.diagnostics.some((entry) => entry.code === "BGC-INPUT-005"), true);
});

test("diagnostics are deterministic", () => {
  const badInput = buildCompilerInput({ evidenceIrIdentity: "" });
  const first = pass.execute(badInput, { sessionId: "s1", pipelineVersion: "1.0.0" }).diagnostics;
  const second = pass.execute(badInput, { sessionId: "s1", pipelineVersion: "1.0.0" }).diagnostics;

  assert.deepEqual(first, second);
});
