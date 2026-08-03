import assert from "node:assert/strict";
import { describe, it } from "@jest/globals";
import {
  EntityRuntimeFactory,
  EntityRuntimeRegistry,
  EvidenceRuntimeFactory,
  EvidenceValidationRuntimeFactory,
  IBRRuntimeFactory,
  ManifestRuntimeFactory,
  ReplayRuntimeFactory,
  type EntityRuntimeCreateInput,
  type EntityRuntimeRule,
  type EvidenceRuntimeCreateInput,
} from "../../../../src/compiler/runtime";

function createClock(seed: number) {
  let step = 0;
  return () => {
    const value = new Date(Date.UTC(2026, 1, seed, 0, 0, step)).toISOString();
    step += 1;
    return value;
  };
}

function createRuntimeFactories(seed = 8) {
  const runtimeConfiguration = {
    runtimeId: "runtime-gci-p2-0002",
    compilerVersion: "1.0.0",
    specificationVersion: "GCS-0001-v1.0",
    programVersion: "GCI-P2-0002",
    schemaVersion: "1.0.0",
  };

  return {
    evidenceFactory: new EvidenceRuntimeFactory({ configuration: runtimeConfiguration, clock: createClock(seed) }),
    validationFactory: new EvidenceValidationRuntimeFactory({ configuration: runtimeConfiguration, clock: createClock(seed) }),
    manifestFactory: new ManifestRuntimeFactory({ configuration: runtimeConfiguration, clock: createClock(seed) }),
    replayFactory: new ReplayRuntimeFactory({ configuration: runtimeConfiguration, clock: createClock(seed) }),
    ibrFactory: new IBRRuntimeFactory({ configuration: runtimeConfiguration, clock: createClock(seed) }),
    entityFactory: new EntityRuntimeFactory({ configuration: runtimeConfiguration, clock: createClock(seed) }),
  };
}

function createEvidenceInput(sourceReference: string): EvidenceRuntimeCreateInput {
  return {
    sourceNamespace: "entity",
    sourceReference,
    canonicalLocator: `evidence://entity/${sourceReference}`,
    title: `Evidence ${sourceReference}`,
    mediaType: "application/json",
    producer: "entity-runtime-tests",
    capturedAt: "2026-02-08T00:00:00.000Z",
    payloadReference: `sha256:${sourceReference}`,
    certificationEvidenceReferences: ["ev-b", "ev-a"],
  };
}

function createEntityInput(seed = 8): EntityRuntimeCreateInput {
  const factories = createRuntimeFactories(seed);
  const alphaEvidence = factories.evidenceFactory.createEvidenceObject(createEvidenceInput(`alpha-${seed}`));
  const alphaValidation = factories.validationFactory.createValidationRecord(alphaEvidence, [
    {
      name: "always-pass",
      validate: () => ({
        status: "pass",
        code: "PASS",
        message: "pass",
      }),
    },
  ]);

  const manifest = factories.manifestFactory.createManifestRecord([alphaValidation], [], { reason: "manifest" });
  const replay = factories.replayFactory.createReplayRecord(
    {
      manifest,
      validationRecords: [alphaValidation],
      evidenceObjects: [alphaEvidence],
    },
    [],
    { reason: "replay" },
  );

  const ibrRecord = factories.ibrFactory.createIBRRecord(
    {
      manifest,
      replayRecord: replay,
      validationRecords: [alphaValidation],
      evidenceObjects: [alphaEvidence],
    },
    [],
    { reason: "ibr" },
  );

  return {
    ibrRecord,
    entityClass: "Organization",
    observations: [
      {
        observationId: `obs-${seed}-001`,
        sourceEvidenceId: alphaEvidence.identity.evidenceId,
        sourceValidationId: alphaValidation.validationId,
        sourceCertificationId: alphaEvidence.certification.certificationId,
        nameType: "LEGAL",
        rawName: `Acme ${seed}`,
        confidence: 0.9,
        stance: "supporting",
      },
    ],
  };
}

describe("EntityRuntimeRegistry", () => {
  it("registers and retrieves entity records by entityId and version", () => {
    const registry = new EntityRuntimeRegistry({
      factory: createRuntimeFactories().entityFactory,
      rules: [],
      clock: createClock(8),
    });

    const registration = registry.register(createEntityInput(), { reason: "register" });
    const retrieved = registry.getByEntityIdAndVersion(registration.record.entityId, registration.record.version.versionId);

    assert.equal(retrieved, registration);
    assert.equal(registry.count(), 1);
    assert.equal(Object.isFrozen(registration.observations), true);
  });

  it("overwrites duplicate registration for the same deterministic key", () => {
    const registry = new EntityRuntimeRegistry({
      factory: createRuntimeFactories().entityFactory,
      rules: [],
      clock: createClock(8),
    });

    const first = registry.register(createEntityInput(), { reason: "same-key" });
    const second = registry.register(createEntityInput(), { reason: "same-key" });

    assert.equal(registry.count(), 1);
    assert.equal(registry.getByEntityIdAndVersion(first.record.entityId, first.record.version.versionId), second);
  });

  it("lists in deterministic order and supports deletion", () => {
    const registry = new EntityRuntimeRegistry({
      factory: createRuntimeFactories().entityFactory,
      rules: [],
      clock: createClock(8),
    });

    const alpha = registry.register(createEntityInput(8), { reason: "alpha" });
    const beta = registry.register(createEntityInput(9), { reason: "beta" });

    const ordered = registry.listAll();
    const expectedOrder = [alpha, beta].sort((left, right) =>
      `${left.record.entityId}:${left.record.version.versionId}`.localeCompare(
        `${right.record.entityId}:${right.record.version.versionId}`,
      ),
    );

    assert.deepEqual(ordered, expectedOrder);
    assert.equal(registry.deleteByEntityIdAndVersion(alpha.record.entityId, alpha.record.version.versionId), true);
    assert.equal(registry.getByEntityIdAndVersion(alpha.record.entityId, alpha.record.version.versionId), undefined);
    assert.equal(registry.count(), 1);
  });

  it("passes registry rules into factory evaluation", () => {
    const rules: readonly EntityRuntimeRule[] = [
      {
        name: "require-observation",
        validate: (candidate) => ({
          status: candidate.observations.length > 0 ? "pass" : "fail",
          code: "REQUIRE_OBSERVATION",
          message: "observations required",
        }),
      },
    ];

    const registry = new EntityRuntimeRegistry({
      factory: createRuntimeFactories().entityFactory,
      rules,
      clock: createClock(8),
    });

    const registration = registry.register(createEntityInput(), { reason: "rule check" });
    assert.equal(
      registration.record.checks.some((check) => check.validatorName === "require-observation" && check.status === "pass"),
      true,
    );
  });
});
