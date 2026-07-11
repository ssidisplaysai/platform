import assert from "node:assert/strict";
import test from "node:test";
import { CanonicalVerificationPass, EvidenceGroupingPass, InputValidationPass } from "../../../src/compiler/genome";
import { buildCompilerInput } from "./helpers";

const inputPass = new InputValidationPass();
const canonicalPass = new CanonicalVerificationPass();
const groupingPass = new EvidenceGroupingPass();

function canonicalAttestation() {
  const inputResult = inputPass.execute(buildCompilerInput(), { sessionId: "s1", pipelineVersion: "1.0.0" });
  if (inputResult.fatal) {
    throw new Error("Expected input pass success");
  }

  const canon = canonicalPass.execute(inputResult.output, { sessionId: "s1", pipelineVersion: "1.0.0" });
  if (canon.fatal) {
    throw new Error("Expected canonical pass success");
  }

  return canon.output;
}

test("all evidence is preserved and not lost", () => {
  const attestation = canonicalAttestation();
  const result = groupingPass.execute(attestation, { sessionId: "s1", pipelineVersion: "1.0.0" });

  assert.equal(result.fatal, false);

  const groupedEvidence = result.output.groups.flatMap((group) => group.evidenceItemIds).sort();
  const inputEvidence = attestation.validatedEvidence.evidenceItemIds.slice().sort();
  assert.deepEqual(groupedEvidence, inputEvidence);
});

test("input permutations produce identical groups", () => {
  const attestation = canonicalAttestation();
  const permuted = {
    ...attestation,
    validatedEvidence: {
      ...attestation.validatedEvidence,
      evidenceReferences: [...attestation.validatedEvidence.evidenceReferences].reverse(),
    },
  };

  const first = groupingPass.execute(attestation, { sessionId: "s1", pipelineVersion: "1.0.0" });
  const second = groupingPass.execute(permuted, { sessionId: "s1", pipelineVersion: "1.0.0" });

  assert.deepEqual(first.output.groups, second.output.groups);
});

test("group IDs are stable and deterministic", () => {
  const attestation = canonicalAttestation();
  const first = groupingPass.execute(attestation, { sessionId: "s1", pipelineVersion: "1.0.0" });
  const second = groupingPass.execute(attestation, { sessionId: "s1", pipelineVersion: "1.0.0" });

  assert.deepEqual(
    first.output.groups.map((group) => group.id),
    second.output.groups.map((group) => group.id),
  );
});

test("grouping rule IDs are recorded and provenance remains accessible", () => {
  const attestation = canonicalAttestation();
  const result = groupingPass.execute(attestation, { sessionId: "s1", pipelineVersion: "1.0.0" });

  assert.equal(result.output.groupingRuleId.length > 0, true);
  assert.equal(result.output.groupingRuleVersion.length > 0, true);
  assert.equal(result.output.groups.every((group) => group.provenanceReferences.length > 0), true);
});

test("grouping does not assign Business Genome semantic classes", () => {
  const attestation = canonicalAttestation();
  const result = groupingPass.execute(attestation, { sessionId: "s1", pipelineVersion: "1.0.0" });

  const serialized = JSON.stringify(result.output);
  assert.equal(serialized.includes("semanticClass"), false);
  assert.equal(serialized.includes("organization"), false);
});

test("equivalent inputs produce stable-string-equivalent collection", () => {
  const attestation = canonicalAttestation();
  const first = groupingPass.execute(attestation, { sessionId: "s1", pipelineVersion: "1.0.0" });
  const second = groupingPass.execute(attestation, { sessionId: "s1", pipelineVersion: "1.0.0" });

  assert.equal(JSON.stringify(first.output), JSON.stringify(second.output));
});
