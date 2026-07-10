import assert from "node:assert/strict";
import test from "node:test";
import { CanonicalVerificationPass, InputValidationPass } from "../../../src/compiler/genome";
import { buildCompilerInput } from "./helpers";

const inputPass = new InputValidationPass();
const canonicalPass = new CanonicalVerificationPass();

function validatedView() {
  const result = inputPass.execute(buildCompilerInput(), { sessionId: "s1", pipelineVersion: "1.0.0" });
  if (result.fatal) {
    throw new Error("Expected valid input view");
  }
  return result.output;
}

test("valid canonical metadata passes", () => {
  const result = canonicalPass.execute(validatedView(), { sessionId: "s1", pipelineVersion: "1.0.0" });

  assert.equal(result.fatal, false);
  assert.equal(result.output.verificationStatus === "verified" || result.output.verificationStatus === "verified-with-gaps", true);
});

test("missing GPS version is diagnosed", () => {
  const view = validatedView();
  const mutated = {
    ...view,
    canonicalMetadata: {
      ...view.canonicalMetadata,
      gps0001Version: undefined,
    },
  };

  const result = canonicalPass.execute(mutated, { sessionId: "s1", pipelineVersion: "1.0.0" });
  assert.equal(result.diagnostics.some((entry) => entry.code === "BGC-CANON-001"), true);
});

test("invalid canonical identity is diagnosed", () => {
  const view = validatedView();
  const mutated = {
    ...view,
    sourceEvidenceIrIdentity: "not_gps_format",
  };

  const result = canonicalPass.execute(mutated, { sessionId: "s1", pipelineVersion: "1.0.0" });
  assert.equal(result.diagnostics.some((entry) => entry.code === "BGC-CANON-002"), true);
});

test("canonical checksum verification is stable", () => {
  const view = validatedView();
  const first = canonicalPass.execute(view, { sessionId: "s1", pipelineVersion: "1.0.0" });
  const second = canonicalPass.execute(view, { sessionId: "s1", pipelineVersion: "1.0.0" });

  assert.deepEqual(first.output.checksumReferences, second.output.checksumReferences);
  assert.deepEqual(first.diagnostics, second.diagnostics);
});

test("input permutation does not affect attestation", () => {
  const view = validatedView();
  const permuted = {
    ...view,
    evidenceReferences: [...view.evidenceReferences].reverse(),
  };

  const first = canonicalPass.execute(view, { sessionId: "s1", pipelineVersion: "1.0.0" });
  const second = canonicalPass.execute(permuted, { sessionId: "s1", pipelineVersion: "1.0.0" });

  assert.equal(first.output.verificationStatus, second.output.verificationStatus);
  assert.deepEqual(first.output.verifiedChecks, second.output.verifiedChecks);
});
