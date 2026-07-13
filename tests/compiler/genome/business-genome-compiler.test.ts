import assert from "node:assert/strict";
import test from "node:test";
import { BusinessGenomeCompiler } from "../../../src/compiler/genome";
import { buildCompilerInput } from "./helpers";

test("pipeline executes passes in correct order", () => {
  const compiler = new BusinessGenomeCompiler();
  const result = compiler.compile(buildCompilerInput());

  assert.deepEqual(result.execution.completedPasses, [
    "bgc.input-validation",
    "bgc.canonical-verification",
    "bgc.evidence-grouping",
    "bgc.evidence-correlation",
    "bgc.semantic-resolution",
    "bgc.semantic-consolidation",
  ]);
  assert.equal(result.execution.passOrder[0], "bgc.input-validation");
  assert.equal(result.execution.passOrder[1], "bgc.canonical-verification");
  assert.equal(result.execution.passOrder[2], "bgc.evidence-grouping");
  assert.equal(result.execution.passOrder[3], "bgc.evidence-correlation");
  assert.equal(result.execution.passOrder[4], "bgc.semantic-resolution");
  assert.equal(result.execution.passOrder[5], "bgc.semantic-consolidation");
});;

test("fatal Pass 1 failure prevents Pass 2 and Pass 3", () => {
  const compiler = new BusinessGenomeCompiler();
  const result = compiler.compile(buildCompilerInput({ evidenceIrIdentity: "" }));

  assert.equal(result.status, "failed");
  assert.deepEqual(result.execution.completedPasses, []);
  assert.equal(result.execution.haltedByPassId, "bgc.input-validation");
});

test("fatal Pass 2 failure prevents Pass 3", () => {
  const compiler = new BusinessGenomeCompiler();
  const result = compiler.compile(
    buildCompilerInput({
      canonicalMetadata: {
        gps0001Version: "1.0",
        gps0002Version: "1.0",
        canonicalizationVersion: "1.0",
        identityStandardVersion: "1.0",
        canonicalValidationStatus: "failed",
        checksumReferences: ["checksum-a", "checksum-b"],
      },
    }),
  );

  assert.equal(result.status, "failed");
  assert.deepEqual(result.execution.completedPasses, ["bgc.input-validation"]);
  assert.equal(result.execution.haltedByPassId, "bgc.canonical-verification");
});

test("diagnostics aggregate deterministically across runs", () => {
  const compiler = new BusinessGenomeCompiler();
  const input = buildCompilerInput({ evidenceIrIdentity: "" });

  const first = compiler.compile(input);
  const second = compiler.compile(input);

  assert.deepEqual(first.diagnostics, second.diagnostics);
});

test("repeated runs produce equivalent intermediate results", () => {
  const compiler = new BusinessGenomeCompiler();
  const input = buildCompilerInput();

  const first = compiler.compile(input);
  const second = compiler.compile(input);

  assert.equal(first.status, "intermediate");
  assert.equal(second.status, "intermediate");
  assert.equal(JSON.stringify(first.intermediate), JSON.stringify(second.intermediate));
});

test("canonical Business Genome artifact is not emitted prematurely", () => {
  const compiler = new BusinessGenomeCompiler();
  const result = compiler.compile(buildCompilerInput());

  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("semanticGraph"), false);
  assert.equal(result.status, "intermediate");
});
