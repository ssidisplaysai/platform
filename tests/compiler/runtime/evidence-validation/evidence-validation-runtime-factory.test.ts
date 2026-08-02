import assert from "node:assert/strict";
import { describe, it } from "@jest/globals";
import { stableStringify } from "../../../../src/compiler/core/stableStringify";
import {
  EvidenceRuntimeFactory,
  EvidenceValidationRuntimeFactory,
  type EvidenceRuntimeCreateInput,
  type EvidenceValidationRuntimeRule,
} from "../../../../src/compiler/runtime";

function createClock() {
  let step = 0;
  return () => {
    const value = new Date(Date.UTC(2026, 0, 5, 0, 0, step)).toISOString();
    step += 1;
    return value;
  };
}

function createEvidenceFactory() {
  return new EvidenceRuntimeFactory({
    configuration: {
      runtimeId: "runtime-gci-p1-0003",
      compilerVersion: "1.0.0",
      specificationVersion: "GCS-0001-v1.0",
      programVersion: "GCI-P1-0003",
      schemaVersion: "1.0.0",
    },
    clock: createClock(),
  });
}

function createValidationFactory() {
  return new EvidenceValidationRuntimeFactory({
    configuration: {
      runtimeId: "runtime-gci-p1-0003",
      compilerVersion: "1.0.0",
      specificationVersion: "GCS-0001-v1.0",
      programVersion: "GCI-P1-0003",
      schemaVersion: "1.0.0",
    },
    clock: createClock(),
  });
}

function createInput(sourceReference: string): EvidenceRuntimeCreateInput {
  return {
    sourceNamespace: "discovery",
    sourceReference,
    canonicalLocator: `evidence://discovery/${sourceReference}`,
    title: `Evidence ${sourceReference}`,
    mediaType: "application/json",
    producer: "runtime-tests",
    capturedAt: "2026-01-01T00:00:00.000Z",
    payloadReference: `sha256:${sourceReference}`,
    certificationEvidenceReferences: ["ev-c", "ev-a"],
  };
}

describe("EvidenceValidationRuntimeFactory", () => {
  it("produces deterministic validation output and preserves immutable evidence", () => {
    const evidence = createEvidenceFactory().createEvidenceObject(createInput("deterministic-ref"));
    const before = stableStringify(evidence);

    const rules: readonly EvidenceValidationRuntimeRule[] = [
      {
        name: "title-present",
        validate: (candidate) => ({
          status: candidate.metadata.title.length > 0 ? "pass" : "fail",
          code: "TITLE_PRESENT",
          message: "title must exist",
        }),
      },
      {
        name: "ready-state",
        validate: () => ({
          status: "pass",
          code: "STATE_READY",
          message: "state accepted",
        }),
      },
    ];

    const left = createValidationFactory().createValidationRecord(evidence, rules);
    const right = createValidationFactory().createValidationRecord(evidence, [...rules].reverse());

    assert.equal(Object.isFrozen(left), true);
    assert.equal(left.validationId, right.validationId);
    assert.equal(left.certificationTrace.validationDigest, right.certificationTrace.validationDigest);
    assert.equal(left.replayTrace.validationDeterministicFingerprint, right.replayTrace.validationDeterministicFingerprint);
    assert.deepEqual(left.checks.map((check) => check.validatorName), ["ready-state", "title-present"]);

    const after = stableStringify(evidence);
    assert.equal(before, after);
  });

  it("reports validation failure and preserves lifecycle and replay linkage", () => {
    const evidence = createEvidenceFactory().createEvidenceObject(createInput("failure-ref"));

    const record = createValidationFactory().createValidationRecord(evidence, [
      {
        name: "always-fail",
        validate: () => ({
          status: "fail",
          code: "FORCED_FAIL",
          message: "forced failure",
        }),
      },
    ]);

    assert.equal(record.outcome, "INVALID");
    assert.equal(record.certificationTrace.readiness, "PENDING");
    assert.equal(record.replayTrace.sourceManifestId, evidence.replayReference.sourceManifestId);
    assert.equal(record.replayTrace.sourceReplayId, evidence.replayReference.replayId);
    assert.equal(record.lifecycleIntegrity.lifecycleState, evidence.lifecycle.currentState);
    assert.equal(record.lifecycleIntegrity.versionOrdinal, evidence.version.ordinal);
  });

  it("captures thrown validator paths deterministically as failure checks", () => {
    const evidence = createEvidenceFactory().createEvidenceObject(createInput("throw-ref"));

    const record = createValidationFactory().createValidationRecord(evidence, [
      {
        name: "throwing-rule",
        validate: () => {
          throw new Error("validator exploded");
        },
      },
    ]);

    assert.equal(record.outcome, "INVALID");
    assert.equal(record.checks.length, 1);
    assert.equal(record.checks[0]?.status, "fail");
    assert.equal(record.checks[0]?.code, "VALIDATOR_EXCEPTION");
    assert.equal(record.checks[0]?.message, "validator exploded");
  });
});
