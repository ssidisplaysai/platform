import assert from "node:assert/strict";
import { describe, it } from "@jest/globals";
import { stableStringify } from "../../../../src/compiler/core/stableStringify";
import {
  EvidenceRuntimeFactory,
  EvidenceValidationRuntimeFactory,
  ManifestRuntimeFactory,
  type EvidenceRuntimeCreateInput,
  type EvidenceValidationRuntimeRule,
  type ManifestRuntimeRule,
} from "../../../../src/compiler/runtime";

function createClock() {
  let step = 0;
  return () => {
    const value = new Date(Date.UTC(2026, 0, 7, 0, 0, step)).toISOString();
    step += 1;
    return value;
  };
}

function createEvidenceFactory() {
  return new EvidenceRuntimeFactory({
    configuration: {
      runtimeId: "runtime-gci-p1-0004",
      compilerVersion: "1.0.0",
      specificationVersion: "GCS-0001-v1.0",
      programVersion: "GCI-P1-0004",
      schemaVersion: "1.0.0",
    },
    clock: createClock(),
  });
}

function createValidationFactory() {
  return new EvidenceValidationRuntimeFactory({
    configuration: {
      runtimeId: "runtime-gci-p1-0004",
      compilerVersion: "1.0.0",
      specificationVersion: "GCS-0001-v1.0",
      programVersion: "GCI-P1-0004",
      schemaVersion: "1.0.0",
    },
    clock: createClock(),
  });
}

function createManifestFactory() {
  return new ManifestRuntimeFactory({
    configuration: {
      runtimeId: "runtime-gci-p1-0004",
      compilerVersion: "1.0.0",
      specificationVersion: "GCS-0001-v1.0",
      programVersion: "GCI-P1-0004",
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
    certificationEvidenceReferences: ["ev-b", "ev-a"],
  };
}

function createValidationRecord(
  sourceReference: string,
  rules: readonly EvidenceValidationRuntimeRule[] = [
    {
      name: "default-pass",
      validate: () => ({
        status: "pass",
        code: "PASS",
        message: "pass",
      }),
    },
  ],
) {
  const evidence = createEvidenceFactory().createEvidenceObject(createInput(sourceReference));
  return createValidationFactory().createValidationRecord(evidence, rules);
}

describe("ManifestRuntimeFactory", () => {
  it("creates deterministic manifest identity and stable digest", () => {
    const alpha = createValidationRecord("alpha");
    const beta = createValidationRecord("beta");

    const rules: readonly ManifestRuntimeRule[] = [
      {
        name: "at-least-one-entry",
        validate: (records) => ({
          status: records.length > 0 ? "pass" : "fail",
          code: "HAS_ENTRIES",
          message: "manifest requires records",
        }),
      },
      {
        name: "outcome-boundary",
        validate: (records) => ({
          status: records.every((record) => record.outcome !== "INVALID") ? "pass" : "fail",
          code: "OUTCOME_BOUNDARY",
          message: "invalid records are blocked",
        }),
      },
    ];

    const left = createManifestFactory().createManifestRecord([beta, alpha], rules, {
      reason: "initial manifest runtime record",
    });

    const right = createManifestFactory().createManifestRecord([alpha, beta], [...rules].reverse(), {
      reason: "initial manifest runtime record",
    });

    assert.equal(left.manifestId, right.manifestId);
    assert.equal(left.manifestDigest, right.manifestDigest);
    assert.equal(left.outcome, "READY");
    assert.deepEqual(left.entries.map((entry) => entry.evidenceId), right.entries.map((entry) => entry.evidenceId));
    assert.deepEqual(left.checks.map((check) => check.validatorName), ["at-least-one-entry", "outcome-boundary"]);
  });

  it("preserves input immutability and emits lineage, replay, and certification traces", () => {
    const alpha = createValidationRecord("lineage-alpha");
    const beta = createValidationRecord("lineage-beta");
    const before = stableStringify([alpha, beta]);

    const record = createManifestFactory().createManifestRecord([alpha, beta], [], {
      reason: "lineage verification",
    });

    assert.equal(Object.isFrozen(record), true);
    assert.equal(Object.isFrozen(record.entries), true);
    assert.equal(record.replayTrace.sourceReplayIds.length, 2);
    assert.equal(record.replayTrace.sourceManifestIds.length, 2);
    assert.equal(record.certificationTrace.sourceCertificationIds.length, 2);
    assert.equal(record.certificationTrace.sourceValidationDigests.length, 2);
    assert.equal(record.certificationTrace.evidenceReferences[0], "ev-a");
    assert.equal(record.certificationTrace.evidenceReferences[1], "ev-b");

    const after = stableStringify([alpha, beta]);
    assert.equal(before, after);
  });

  it("evolves version lineage when previous manifest exists", () => {
    const alpha = createValidationRecord("version-alpha");
    const beta = createValidationRecord("version-beta");
    const factory = createManifestFactory();

    const first = factory.createManifestRecord([alpha], [], {
      reason: "initial",
    });

    const second = factory.createManifestRecord([alpha, beta], [], {
      reason: "add-beta",
      previousRecord: first,
    });

    assert.equal(first.version.ordinal, 1);
    assert.equal(second.version.ordinal, 2);
    assert.equal(second.version.previousVersionId, first.version.versionId);
    assert.notEqual(second.version.versionId, first.version.versionId);
    assert.equal(second.lifecycleIntegrity.highestSourceVersionOrdinal >= first.lifecycleIntegrity.highestSourceVersionOrdinal, true);
  });

  it("preserves supersedence lineage while keeping prior manifest immutable and reproducible", () => {
    const alpha = createValidationRecord("supersedence-alpha");
    const beta = createValidationRecord("supersedence-beta");
    const factory = createManifestFactory();

    const first = factory.createManifestRecord([alpha], [], {
      reason: "initial-supersedence-base",
    });

    const firstBefore = stableStringify(first);

    const second = factory.createManifestRecord([alpha, beta], [], {
      reason: "supersede-with-beta",
      previousRecord: first,
    });

    const secondRepeat = createManifestFactory().createManifestRecord([alpha, beta], [], {
      reason: "supersede-with-beta",
      previousRecord: first,
    });

    assert.equal(stableStringify(first), firstBefore);
    assert.equal(Object.isFrozen(first), true);
    assert.equal(first.version.previousVersionId, undefined);

    assert.equal(second.version.previousVersionId, first.version.versionId);
    assert.equal(second.version.ordinal, first.version.ordinal + 1);
    assert.equal(second.manifestId, secondRepeat.manifestId);
    assert.equal(second.manifestDigest, secondRepeat.manifestDigest);

    assert.deepEqual(second.replayTrace.sourceReplayIds, secondRepeat.replayTrace.sourceReplayIds);
    assert.deepEqual(second.replayTrace.sourceManifestIds, secondRepeat.replayTrace.sourceManifestIds);
    assert.deepEqual(second.certificationTrace.sourceCertificationIds, secondRepeat.certificationTrace.sourceCertificationIds);
    assert.deepEqual(second.certificationTrace.sourceValidationDigests, secondRepeat.certificationTrace.sourceValidationDigests);
    assert.deepEqual(second.certificationTrace.evidenceReferences, secondRepeat.certificationTrace.evidenceReferences);
  });

  it("captures thrown validator failures as blocked manifest outcomes", () => {
    const alpha = createValidationRecord("throw-alpha");

    const record = createManifestFactory().createManifestRecord(
      [alpha],
      [
        {
          name: "throwing-manifest-rule",
          validate: () => {
            throw new Error("manifest validator exploded");
          },
        },
      ],
      {
        reason: "throw-case",
      },
    );

    assert.equal(record.outcome, "BLOCKED");
    assert.equal(record.checks.length, 1);
    assert.equal(record.checks[0]?.status, "fail");
    assert.equal(record.checks[0]?.code, "VALIDATOR_EXCEPTION");
    assert.equal(record.checks[0]?.message, "manifest validator exploded");
    assert.equal(record.certificationTrace.readiness, "PENDING");
  });
});
