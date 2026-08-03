import assert from "node:assert/strict";
import { describe, it } from "@jest/globals";
import {
  EvidenceRuntimeFactory,
  EvidenceValidationRuntimeFactory,
  IBRRuntimeFactory,
  ManifestRuntimeFactory,
  ReplayRuntimeFactory,
  type EvidenceRuntimeCreateInput,
  type IBRRuntimeRule,
} from "../../../../src/compiler/runtime";

function createClock(seed: number) {
  let step = 0;
  return () => {
    const value = new Date(Date.UTC(2026, 0, seed, 0, 0, step)).toISOString();
    step += 1;
    return value;
  };
}

function createRuntimeFactories(seed = 9) {
  const runtimeConfiguration = {
    runtimeId: "runtime-gci-p2-0001",
    compilerVersion: "1.0.0",
    specificationVersion: "GCS-0001-v1.0",
    programVersion: "GCI-P2-0001",
    schemaVersion: "1.0.0",
  };

  return {
    evidenceFactory: new EvidenceRuntimeFactory({ configuration: runtimeConfiguration, clock: createClock(seed) }),
    validationFactory: new EvidenceValidationRuntimeFactory({ configuration: runtimeConfiguration, clock: createClock(seed) }),
    manifestFactory: new ManifestRuntimeFactory({ configuration: runtimeConfiguration, clock: createClock(seed) }),
    replayFactory: new ReplayRuntimeFactory({ configuration: runtimeConfiguration, clock: createClock(seed) }),
    ibrFactory: new IBRRuntimeFactory({ configuration: runtimeConfiguration, clock: createClock(seed) }),
  };
}

function createInput(sourceReference: string): EvidenceRuntimeCreateInput {
  return {
    sourceNamespace: "ibr",
    sourceReference,
    canonicalLocator: `evidence://ibr/${sourceReference}`,
    title: `Evidence ${sourceReference}`,
    mediaType: "application/json",
    producer: "runtime-tests",
    capturedAt: "2026-01-09T00:00:00.000Z",
    payloadReference: `sha256:${sourceReference}`,
    certificationEvidenceReferences: ["ev-b", "ev-a"],
  };
}

function createValidationRecord(sourceReference: string, seed = 9) {
  const factories = createRuntimeFactories(seed);
  const evidence = factories.evidenceFactory.createEvidenceObject(createInput(sourceReference));
  return factories.validationFactory.createValidationRecord(evidence, [
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
  const evidenceAlpha = createRuntimeFactories(9).evidenceFactory.createEvidenceObject(createInput("alpha"));
  const evidenceBeta = createRuntimeFactories(10).evidenceFactory.createEvidenceObject(createInput("beta"));
  const manifest = createRuntimeFactories(9).manifestFactory.createManifestRecord([alphaValidation, betaValidation], [], {
    reason: "manifest for ibR",
  });
  const replay = createRuntimeFactories(9).replayFactory.createReplayRecord(
    {
      manifest,
      validationRecords: [alphaValidation, betaValidation],
      evidenceObjects: [evidenceAlpha, evidenceBeta],
    },
    [],
    {
      reason: "replay for ibR",
    },
  );

  return {
    manifest,
    replay,
    validationRecords: [alphaValidation, betaValidation],
    evidenceObjects: [evidenceAlpha, evidenceBeta],
  };
}

describe("IBRRuntimeFactory", () => {
  it("creates deterministic IBR identity and reproducible lineage", () => {
    const input = createReplayInput();
    const rules: readonly IBRRuntimeRule[] = [
      {
        name: "has-manifest",
        validate: (candidate) => ({
          status: candidate.manifest.manifestId.length > 0 ? "pass" : "fail",
          code: "HAS_MANIFEST",
          message: "IBR requires a manifest",
        }),
      },
      {
        name: "has-replay",
        validate: (candidate) => ({
          status: candidate.replayRecord.replayId.length > 0 ? "pass" : "fail",
          code: "HAS_REPLAY",
          message: "IBR requires a replay record",
        }),
      },
    ];

    const left = createRuntimeFactories(9).ibrFactory.createIBRRecord(
      {
        manifest: input.manifest,
        replayRecord: input.replay,
        validationRecords: input.validationRecords,
        evidenceObjects: input.evidenceObjects,
      },
      rules,
      {
        reason: "initial IBR record",
      },
    );
    const right = createRuntimeFactories(11).ibrFactory.createIBRRecord(
      {
        manifest: input.manifest,
        replayRecord: input.replay,
        validationRecords: [...input.validationRecords].reverse(),
        evidenceObjects: [...input.evidenceObjects].reverse(),
      },
      [...rules].reverse(),
      {
        reason: "initial IBR record",
      },
    );

    assert.equal(left.ibrId, right.ibrId);
    assert.equal(left.ibrDigest, right.ibrDigest);
    assert.equal(left.graph.deterministicFingerprint, right.graph.deterministicFingerprint);
    assert.equal(left.outcome, "READY");
    assert.deepEqual(left.trace.sourceEvidenceIds, right.trace.sourceEvidenceIds);
    assert.deepEqual(left.trace.sourceValidationIds, right.trace.sourceValidationIds);
    assert.deepEqual(left.graph.nodes.map((node) => node.nodeId), right.graph.nodes.map((node) => node.nodeId));
  });

  it("preserves immutable IBR records and emits lineage, linkage, and certification traces", () => {
    const input = createReplayInput();
    const record = createRuntimeFactories().ibrFactory.createIBRRecord(
      {
        manifest: input.manifest,
        replayRecord: input.replay,
        validationRecords: input.validationRecords,
        evidenceObjects: input.evidenceObjects,
      },
      [],
      {
        reason: "lineage verification",
      },
    );

    assert.equal(Object.isFrozen(record), true);
    assert.equal(Object.isFrozen(record.graph), true);
    assert.equal(Object.isFrozen(record.trace), true);
    assert.equal(record.trace.sourceManifestIds[0], input.manifest.manifestId);
    assert.equal(record.trace.sourceReplayIds.includes(input.replay.replayId), true);
    assert.equal(record.trace.sourceValidationIds.length, 2);
    assert.equal(record.trace.sourceEvidenceIds.length, 2);
    assert.equal(record.trace.sourceCertificationIds.length, 2);
    assert.equal(record.certificationTrace.evidenceReferences[0], "ev-a");
    assert.equal(record.certificationTrace.evidenceReferences[1], "ev-b");
    assert.equal(record.trace.sourceManifestIds.includes(input.manifest.manifestId), true);
    assert.equal(record.trace.sourceReplayIds.includes(input.replay.replayId), true);
    assert.equal(record.lineageIntegrity.immutableInputPreserved, true);
    assert.equal(record.lineageIntegrity.highestSourceVersionOrdinal > 0, true);
    assert.equal(record.graph.nodes.some((node) => node.nodeType === "manifest"), true);
    assert.equal(record.graph.nodes.some((node) => node.nodeType === "replay"), true);
    assert.equal(record.graph.nodes.some((node) => node.nodeType === "validation"), true);
    assert.equal(record.graph.nodes.some((node) => node.nodeType === "evidence"), true);
    assert.equal(record.graph.nodes.some((node) => node.nodeType === "certification"), true);
    assert.equal(record.graph.edges.some((edge) => edge.relation === "CERTIFIES"), true);
    assert.equal(Object.keys(record).includes("entity"), false);
    assert.equal(Object.keys(record).includes("relationship"), false);
    assert.equal(Object.keys(record).includes("rule"), false);
    assert.equal(Object.keys(record).includes("genome"), false);
  });

  it("evolves IBR version lineage when a previous record exists", () => {
    const input = createReplayInput();
    const factory = createRuntimeFactories().ibrFactory;

    const first = factory.createIBRRecord(
      {
        manifest: input.manifest,
        replayRecord: input.replay,
        validationRecords: input.validationRecords,
        evidenceObjects: input.evidenceObjects,
      },
      [],
      {
        reason: "initial",
      },
    );

    const second = factory.createIBRRecord(
      {
        manifest: input.manifest,
        replayRecord: input.replay,
        validationRecords: input.validationRecords,
        evidenceObjects: input.evidenceObjects,
      },
      [],
      {
        reason: "supersede",
        previousRecord: first,
      },
    );

    assert.equal(first.version.ordinal, 1);
    assert.equal(second.version.ordinal, 2);
    assert.equal(second.version.previousVersionId, first.version.versionId);
    assert.notEqual(second.version.versionId, first.version.versionId);
  });

  it("blocks when certification readiness is incomplete", () => {
    const input = createReplayInput();
    const blocked = createRuntimeFactories().ibrFactory.createIBRRecord(
      {
        manifest: input.manifest,
        replayRecord: input.replay,
        validationRecords: input.validationRecords,
        evidenceObjects: [
          {
            ...input.evidenceObjects[0],
            certification: {
              ...input.evidenceObjects[0].certification,
              readiness: "PENDING",
            },
          },
        ],
      },
      [],
      {
        reason: "pending certification",
      },
    );

    assert.equal(blocked.outcome, "BLOCKED");
    assert.equal(blocked.checks.some((check) => check.code === "CERTIFICATION_LINKAGE" && check.status === "fail"), true);
    assert.equal(blocked.lifecycle.currentState, "BLOCKED");
  });

  it("blocks when manifest, replay, validation, or evidence linkage is broken", () => {
    const input = createReplayInput();

    const brokenManifest = createRuntimeFactories().ibrFactory.createIBRRecord(
      {
        manifest: {
          ...input.manifest,
          entries: [],
        },
        replayRecord: input.replay,
        validationRecords: input.validationRecords,
        evidenceObjects: input.evidenceObjects,
      },
      [],
      {
        reason: "broken manifest linkage",
      },
    );

    const brokenEvidence = createRuntimeFactories().ibrFactory.createIBRRecord(
      {
        manifest: input.manifest,
        replayRecord: input.replay,
        validationRecords: input.validationRecords,
        evidenceObjects: [
          {
            ...input.evidenceObjects[0],
            manifestReference: {
              ...input.evidenceObjects[0].manifestReference,
              manifestId: "unexpected-manifest",
            },
          },
        ],
      },
      [],
      {
        reason: "broken evidence linkage",
      },
    );

    assert.equal(brokenManifest.outcome, "BLOCKED");
    assert.equal(brokenManifest.checks.some((check) => check.code === "MANIFEST_LINKAGE" && check.status === "fail"), true);
    assert.equal(brokenManifest.checks.some((check) => check.code === "REPLAY_LINKAGE" && check.status === "pass"), true);
    assert.equal(brokenEvidence.outcome, "BLOCKED");
    assert.equal(brokenEvidence.checks.some((check) => check.code === "EVIDENCE_LINKAGE" && check.status === "fail"), true);
      assert.equal(brokenEvidence.checks.some((check) => check.code === "VALIDATION_LINKAGE"), true);
  });
});
