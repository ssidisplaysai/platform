import assert from "node:assert/strict";
import { describe, it } from "@jest/globals";
import {
  EvidenceRuntimeFactory,
  EvidenceValidationRuntimeFactory,
  ManifestRuntimeFactory,
  ReplayRuntimeFactory,
  type EvidenceRuntimeCreateInput,
  type EvidenceValidationRuntimeRule,
  type ManifestRuntimeRule,
  type ReplayRuntimeCreateInput,
  type ReplayRuntimeRule,
} from "../../../../src/compiler/runtime";

function createClock(seed: number) {
  let step = 0;
  return () => {
    const value = new Date(Date.UTC(2026, 0, seed, 0, 0, step)).toISOString();
    step += 1;
    return value;
  };
}

function createReplayFactory(clockSeed = 9) {
  return new ReplayRuntimeFactory({
    configuration: {
      runtimeId: "runtime-gci-p1-0005",
      compilerVersion: "1.0.0",
      specificationVersion: "GCS-0001-v1.0",
      programVersion: "GCI-P1-0005",
      schemaVersion: "1.0.0",
    },
    clock: createClock(clockSeed),
  });
}

function createEvidenceFactory(seed = 9) {
  return new EvidenceRuntimeFactory({
    configuration: {
      runtimeId: "runtime-gci-p1-0005",
      compilerVersion: "1.0.0",
      specificationVersion: "GCS-0001-v1.0",
      programVersion: "GCI-P1-0005",
      schemaVersion: "1.0.0",
    },
    clock: createClock(seed),
  });
}

function createValidationFactory(seed = 9) {
  return new EvidenceValidationRuntimeFactory({
    configuration: {
      runtimeId: "runtime-gci-p1-0005",
      compilerVersion: "1.0.0",
      specificationVersion: "GCS-0001-v1.0",
      programVersion: "GCI-P1-0005",
      schemaVersion: "1.0.0",
    },
    clock: createClock(seed),
  });
}

function createManifestFactory(seed = 9) {
  return new ManifestRuntimeFactory({
    configuration: {
      runtimeId: "runtime-gci-p1-0005",
      compilerVersion: "1.0.0",
      specificationVersion: "GCS-0001-v1.0",
      programVersion: "GCI-P1-0005",
      schemaVersion: "1.0.0",
    },
    clock: createClock(seed),
  });
}

function createInput(sourceReference: string): EvidenceRuntimeCreateInput {
  return {
    sourceNamespace: "replay",
    sourceReference,
    canonicalLocator: `evidence://replay/${sourceReference}`,
    title: `Evidence ${sourceReference}`,
    mediaType: "application/json",
    producer: "runtime-tests",
    capturedAt: "2026-01-09T00:00:00.000Z",
    payloadReference: `sha256:${sourceReference}`,
    certificationEvidenceReferences: ["ev-b", "ev-a"],
  };
}

function createValidationRecord(sourceReference: string, seed = 9) {
  const evidence = createEvidenceFactory(seed).createEvidenceObject(createInput(sourceReference));
  return createValidationFactory(seed).createValidationRecord(evidence, [
    {
      name: "always-pass",
      validate: () => ({
        status: "pass",
        code: "PASS",
        message: "pass",
      }),
    },
  ]);
}

function createReplayInput() {
  const alphaValidation = createValidationRecord("alpha", 9);
  const betaValidation = createValidationRecord("beta", 10);

  const evidenceAlpha = createEvidenceFactory(9).createEvidenceObject(createInput("alpha"));
  const evidenceBeta = createEvidenceFactory(10).createEvidenceObject(createInput("beta"));

  const manifest = createManifestFactory(9).createManifestRecord([alphaValidation, betaValidation], [], {
    reason: "manifest for replay",
  });

  return {
    manifest,
    validationRecords: [alphaValidation, betaValidation],
    evidenceObjects: [alphaValidation ? evidenceAlpha : evidenceAlpha, betaValidation ? evidenceBeta : evidenceBeta],
  } satisfies ReplayRuntimeCreateInput;
}

describe("ReplayRuntimeFactory", () => {
  it("creates deterministic replay identity and reproducible graph lineage", () => {
    const input = createReplayInput();
    const rules: readonly ReplayRuntimeRule[] = [
      {
        name: "has-manifest",
        validate: (candidate) => ({
          status: candidate.manifest.manifestId.length > 0 ? "pass" : "fail",
          code: "HAS_MANIFEST",
          message: "replay requires a manifest",
        }),
      },
      {
        name: "has-validations",
        validate: (candidate) => ({
          status: candidate.validationRecords.length > 0 ? "pass" : "fail",
          code: "HAS_VALIDATIONS",
          message: "replay requires validation records",
        }),
      },
    ];

    const left = createReplayFactory(9).createReplayRecord(input, rules, {
      reason: "initial replay record",
    });
    const right = createReplayFactory(11).createReplayRecord(input, [...rules].reverse(), {
      reason: "initial replay record",
    });

    assert.equal(left.replayId, right.replayId);
    assert.equal(left.replayDigest, right.replayDigest);
    assert.equal(left.graph.deterministicFingerprint, right.graph.deterministicFingerprint);
    assert.equal(left.outcome, "READY");
    assert.deepEqual(left.trace.sourceValidationIds, right.trace.sourceValidationIds);
    assert.deepEqual(left.trace.sourceEvidenceIds, right.trace.sourceEvidenceIds);
    assert.deepEqual(left.graph.nodes.map((node) => node.nodeId), right.graph.nodes.map((node) => node.nodeId));
  });

  it("preserves immutable replay records and emits lineage, linkage, and certification traces", () => {
    const input = createReplayInput();
    const record = createReplayFactory().createReplayRecord(input, [], {
      reason: "lineage verification",
    });

    assert.equal(Object.isFrozen(record), true);
    assert.equal(Object.isFrozen(record.graph), true);
    assert.equal(Object.isFrozen(record.trace), true);
    assert.equal(record.trace.sourceManifestIds[0], input.manifest.manifestId);
    assert.equal(record.trace.sourceValidationIds.length, 2);
    assert.equal(record.trace.sourceEvidenceIds.length, 2);
    assert.equal(record.trace.sourceReplayIds.length, 2);
    assert.equal(record.trace.sourceCertificationIds.length, 2);
    assert.equal(record.certificationTrace.evidenceReferences[0], "ev-a");
    assert.equal(record.certificationTrace.evidenceReferences[1], "ev-b");
    assert.equal(record.lineageIntegrity.immutableInputPreserved, true);
    assert.equal(record.lineageIntegrity.highestSourceVersionOrdinal > 0, true);
    assert.equal(record.graph.nodes.some((node) => node.nodeType === "manifest"), true);
    assert.equal(record.graph.edges.some((edge) => edge.relation === "DERIVES_FROM"), true);
  });

  it("evolves replay version lineage when previous replay exists", () => {
    const input = createReplayInput();
    const factory = createReplayFactory();

    const first = factory.createReplayRecord(input, [], {
      reason: "initial",
    });

    const second = factory.createReplayRecord(input, [], {
      reason: "supersede",
      previousRecord: first,
    });

    assert.equal(first.version.ordinal, 1);
    assert.equal(second.version.ordinal, 2);
    assert.equal(second.version.previousVersionId, first.version.versionId);
    assert.notEqual(second.version.versionId, first.version.versionId);
  });

  it("captures thrown validator failures as blocked replay outcomes", () => {
    const input = createReplayInput();

    const record = createReplayFactory().createReplayRecord(
      input,
      [
        {
          name: "throwing-replay-rule",
          validate: () => {
            throw new Error("replay validator exploded");
          },
        },
      ],
      {
        reason: "throw-case",
      },
    );

    assert.equal(record.outcome, "BLOCKED");
    assert.equal(record.checks.some((check) => check.code === "VALIDATOR_EXCEPTION"), true);
    assert.equal(record.certificationTrace.readiness, "PENDING");
    assert.equal(record.lifecycle.currentState, "BLOCKED");
  });

  it("blocks when evidence linkage is incomplete", () => {
    const input = createReplayInput();

    const record = createReplayFactory().createReplayRecord(
      {
        manifest: input.manifest,
        validationRecords: input.validationRecords,
        evidenceObjects: [input.evidenceObjects[0]!],
      },
      [],
      {
        reason: "missing evidence",
      },
    );

    assert.equal(record.outcome, "BLOCKED");
    assert.equal(record.checks.some((check) => check.code === "EVIDENCE_LINKAGE" && check.status === "fail"), true);
  });
});