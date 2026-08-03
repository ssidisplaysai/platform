import assert from "node:assert/strict";
import { describe, it } from "@jest/globals";
import {
  EvidenceRuntimeFactory,
  EvidenceValidationRuntimeFactory,
  IBRRuntimeFactory,
  IBRRuntimeRegistry,
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
    reason: "manifest for registry",
  });
  const replay = createRuntimeFactories(9).replayFactory.createReplayRecord(
    {
      manifest,
      validationRecords: [alphaValidation, betaValidation],
      evidenceObjects: [evidenceAlpha, evidenceBeta],
    },
    [],
    {
      reason: "replay for registry",
    },
  );

  return {
    manifest,
    replay,
    validationRecords: [alphaValidation, betaValidation],
    evidenceObjects: [evidenceAlpha, evidenceBeta],
  };
}

describe("IBRRuntimeRegistry", () => {
  it("registers and retrieves IBR records by identity and version", () => {
    const input = createReplayInput();
    const registry = new IBRRuntimeRegistry({
      factory: createRuntimeFactories().ibrFactory,
      rules: [],
      clock: createClock(9),
    });

    const registration = registry.register(
      {
        manifest: input.manifest,
        replayRecord: input.replay,
        validationRecords: input.validationRecords,
        evidenceObjects: input.evidenceObjects,
      },
      {
        reason: "register record",
      },
    );

    const retrieved = registry.getByIbrIdAndVersion(registration.record.ibrId, registration.record.version.versionId);

    assert.equal(retrieved, registration);
    assert.equal(registry.count(), 1);
    assert.equal(registry.listAll()[0], registration);
    assert.equal(Object.isFrozen(registration.validationRecords), true);
    assert.equal(Object.isFrozen(registration.evidenceObjects), true);
  });

  it("overwrites duplicate IBR registrations for the same identity and version key", () => {
    const input = createReplayInput();
    const registry = new IBRRuntimeRegistry({
      factory: createRuntimeFactories().ibrFactory,
      rules: [],
      clock: createClock(9),
    });

    const first = registry.register(
      {
        manifest: input.manifest,
        replayRecord: input.replay,
        validationRecords: input.validationRecords,
        evidenceObjects: input.evidenceObjects,
      },
      {
        reason: "first registration",
      },
    );

    const second = registry.register(
      {
        manifest: input.manifest,
        replayRecord: input.replay,
        validationRecords: input.validationRecords,
        evidenceObjects: input.evidenceObjects,
      },
      {
        reason: "first registration",
      },
    );

    assert.equal(registry.count(), 1);
    assert.equal(registry.getByIbrIdAndVersion(first.record.ibrId, first.record.version.versionId), second);
    assert.equal(registry.getByIbrIdAndVersion(second.record.ibrId, second.record.version.versionId), second);
    assert.equal(registry.listAll().length, 1);
  });

  it("orders registry listings deterministically and supports deletion", () => {
    const input = createReplayInput();
    const registry = new IBRRuntimeRegistry({
      factory: createRuntimeFactories().ibrFactory,
      rules: [],
      clock: createClock(9),
    });

    const alpha = registry.register(
      {
        manifest: input.manifest,
        replayRecord: input.replay,
        validationRecords: input.validationRecords,
        evidenceObjects: input.evidenceObjects,
      },
      {
        reason: "alpha registration",
      },
    );

    const betaInput = createReplayInput();
    const beta = registry.register(
      {
        manifest: betaInput.manifest,
        replayRecord: betaInput.replay,
        validationRecords: betaInput.validationRecords,
        evidenceObjects: betaInput.evidenceObjects,
      },
      {
        reason: "beta registration",
      },
    );

    const ordered = registry.listAll();
    const expectedOrder = [alpha, beta].sort((left, right) =>
      `${left.record.ibrId}:${left.record.version.versionId}`.localeCompare(`${right.record.ibrId}:${right.record.version.versionId}`),
    );

    assert.deepEqual(ordered, expectedOrder);
    assert.equal(registry.deleteByIbrIdAndVersion(alpha.record.ibrId, alpha.record.version.versionId), true);
    assert.equal(registry.getByIbrIdAndVersion(alpha.record.ibrId, alpha.record.version.versionId), undefined);
    assert.equal(registry.count(), 1);
    assert.equal(registry.deleteByIbrIdAndVersion(alpha.record.ibrId, alpha.record.version.versionId), false);
  });

  it("evaluates registry rules through the supplied factory", () => {
    const input = createReplayInput();
    const rules: readonly IBRRuntimeRule[] = [
      {
        name: "has-records",
        validate: (candidate) => ({
          status: candidate.validationRecords.length > 0 ? "pass" : "fail",
          code: "HAS_RECORDS",
          message: "IBR registry requires source records",
        }),
      },
    ];

    const registry = new IBRRuntimeRegistry({
      factory: createRuntimeFactories().ibrFactory,
      rules,
      clock: createClock(9),
    });

    const registration = registry.register(
      {
        manifest: input.manifest,
        replayRecord: input.replay,
        validationRecords: input.validationRecords,
        evidenceObjects: input.evidenceObjects,
      },
      {
        reason: "rule-backed registration",
      },
    );

    assert.equal(registration.record.checks.some((check) => check.validatorName === "has-records" && check.status === "pass"), true);
  });
});
