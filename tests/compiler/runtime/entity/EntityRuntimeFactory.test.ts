import assert from "node:assert/strict";
import { describe, it } from "@jest/globals";
import {
  EntityRuntimeFactory,
  EvidenceRuntimeFactory,
  EvidenceValidationRuntimeFactory,
  IBRRuntimeFactory,
  ManifestRuntimeFactory,
  ReplayRuntimeFactory,
  type EntityIdentityObservation,
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

function createRuntimeFactories(seed = 7) {
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
    capturedAt: "2026-02-07T00:00:00.000Z",
    payloadReference: `sha256:${sourceReference}`,
    certificationEvidenceReferences: ["ev-b", "ev-a"],
  };
}

function createValidationRecord(sourceReference: string, seed = 7) {
  const factories = createRuntimeFactories(seed);
  const evidence = factories.evidenceFactory.createEvidenceObject(createEvidenceInput(sourceReference));
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

function createEntityInput(): EntityRuntimeCreateInput {
  const alphaValidation = createValidationRecord("alpha", 7);
  const betaValidation = createValidationRecord("beta", 8);
  const evidenceAlpha = createRuntimeFactories(7).evidenceFactory.createEvidenceObject(createEvidenceInput("alpha"));
  const evidenceBeta = createRuntimeFactories(8).evidenceFactory.createEvidenceObject(createEvidenceInput("beta"));

  const manifest = createRuntimeFactories(7).manifestFactory.createManifestRecord([alphaValidation, betaValidation], [], {
    reason: "manifest for entity",
  });

  const replay = createRuntimeFactories(7).replayFactory.createReplayRecord(
    {
      manifest,
      validationRecords: [alphaValidation, betaValidation],
      evidenceObjects: [evidenceAlpha, evidenceBeta],
    },
    [],
    {
      reason: "replay for entity",
    },
  );

  const ibrRecord = createRuntimeFactories(7).ibrFactory.createIBRRecord(
    {
      manifest,
      replayRecord: replay,
      validationRecords: [alphaValidation, betaValidation],
      evidenceObjects: [evidenceAlpha, evidenceBeta],
    },
    [],
    {
      reason: "ibr for entity",
    },
  );

  const observations: readonly EntityIdentityObservation[] = [
    {
      observationId: "obs-002",
      sourceEvidenceId: evidenceBeta.identity.evidenceId,
      sourceValidationId: betaValidation.validationId,
      sourceCertificationId: evidenceBeta.certification.certificationId,
      nameType: "TRADE",
      rawName: "ACME Holdings",
      confidence: 0.82,
      stance: "supporting",
    },
    {
      observationId: "obs-001",
      sourceEvidenceId: evidenceAlpha.identity.evidenceId,
      sourceValidationId: alphaValidation.validationId,
      sourceCertificationId: evidenceAlpha.certification.certificationId,
      nameType: "LEGAL",
      rawName: "Acme Holdings LLC",
      confidence: 0.91,
      stance: "supporting",
    },
  ];

  return {
    ibrRecord,
    entityClass: "Organization",
    observations,
  };
}

describe("EntityRuntimeFactory", () => {
  it("creates deterministic identity with identical-input reproducibility and canonical ordering", () => {
    const input = createEntityInput();
    const rules: readonly EntityRuntimeRule[] = [
      {
        name: "has-observations",
        validate: (candidate) => ({
          status: candidate.observations.length > 0 ? "pass" : "fail",
          code: "HAS_OBSERVATIONS",
          message: "entity requires observations",
        }),
      },
      {
        name: "has-ibr",
        validate: (candidate) => ({
          status: candidate.ibrRecord.ibrId.length > 0 ? "pass" : "fail",
          code: "HAS_IBR",
          message: "entity requires ibr",
        }),
      },
    ];

    const left = createRuntimeFactories(7).entityFactory.createEntityRecord(
      input,
      rules,
      {
        reason: "initial entity",
      },
    );

    const right = createRuntimeFactories(9).entityFactory.createEntityRecord(
      {
        ...input,
        observations: [...input.observations].reverse(),
      },
      [...rules].reverse(),
      {
        reason: "initial entity",
      },
    );

    assert.equal(left.entityId, right.entityId);
    assert.equal(left.entityDigest, right.entityDigest);
    assert.equal(left.candidateId, right.candidateId);
    assert.deepEqual(left.aliases.map((alias) => alias.normalizedAlias), right.aliases.map((alias) => alias.normalizedAlias));
    assert.equal(left.identityStatus, "RESOLVED");
    assert.equal(left.outcome, "READY");
  });

  it("produces immutable records and preserves confidence, contradiction, provenance, and lineage", () => {
    const input = createEntityInput();
    const contradictory: EntityIdentityObservation = {
      ...input.observations[0],
      observationId: "obs-003",
      rawName: "Acme Liquidated",
      confidence: 0.4,
      stance: "contradicting",
      contradictsObservationIds: ["obs-001"],
    };

    const record = createRuntimeFactories().entityFactory.createEntityRecord(
      {
        ...input,
        observations: [...input.observations, contradictory],
      },
      [],
      {
        reason: "lineage validation",
      },
    );

    assert.equal(Object.isFrozen(record), true);
    assert.equal(Object.isFrozen(record.aliases), true);
    assert.equal(Object.isFrozen(record.contradictionObservationIds), true);
    assert.equal(record.lineage.sourceIbrId, input.ibrRecord.ibrId);
    assert.equal(record.lineage.sourceReplayId, input.ibrRecord.replayId);
    assert.equal(record.lineage.sourceValidationIds.length, 2);
    assert.equal(record.lineage.sourceEvidenceIds.length, 2);
    assert.equal(record.confidence.reproducible, true);
    assert.equal(record.contradictionObservationIds.includes("obs-001"), true);
    assert.equal(record.contradictionObservationIds.includes("obs-003"), true);
  });

  it("normalizes aliases, emits duplicate evidence before collapse, and keeps deterministic link ordering", () => {
    const input = createEntityInput();

    const remediationInput: EntityRuntimeCreateInput = {
      ...input,
      observations: [
        ...input.observations,
        {
          ...input.observations[0],
          observationId: "obs-004",
          nameType: "ALIAS",
          rawName: "  acme holdings  ",
          confidence: 0.8,
        },
        {
          ...input.observations[0],
          observationId: "obs-005",
          nameType: "ALIAS",
          rawName: "Acme Holding",
          confidence: 0.7,
        },
      ],
    };

    const record = createRuntimeFactories().entityFactory.createEntityRecord(
      remediationInput,
      [],
      {
        reason: "duplicate and near-duplicate check",
      },
    );

    const deterministicReplayRecord = createRuntimeFactories(12).entityFactory.createEntityRecord(
      {
        ...remediationInput,
        observations: [...remediationInput.observations].reverse(),
      },
      [],
      {
        reason: "duplicate and near-duplicate check",
      },
    );

    assert.equal(record.aliases.some((alias) => alias.normalizedAlias === "acme holdings"), true);
    assert.equal(record.aliases.filter((alias) => alias.normalizedAlias === "acme holdings").length, 1);
    assert.equal(record.duplicateLinks.some((link) => link.matchType === "duplicate"), true);
    assert.equal(record.duplicateLinks.some((link) => link.matchType === "near-duplicate"), true);
    assert.deepEqual(record.duplicateLinks, deterministicReplayRecord.duplicateLinks);
  });

  it("keeps unresolved identity unresolved when evidence is insufficient", () => {
    const input = createEntityInput();
    const unresolved = createRuntimeFactories().entityFactory.createEntityRecord(
      {
        ...input,
        observations: [
          {
            ...input.observations[0],
            observationId: "obs-u-001",
            rawName: "",
            confidence: 0,
            stance: "unknown",
          },
        ],
      },
      [],
      {
        reason: "insufficient evidence",
      },
    );

    assert.equal(unresolved.identityStatus, "UNRESOLVED");
    assert.equal(unresolved.unresolvedReason, "INSUFFICIENT_EVIDENCE");
    assert.equal(unresolved.canonicalName, "UNRESOLVED");
    assert.equal(unresolved.outcome, "WARN");
  });

  it("preserves contradictory evidence without guessing and can become conflicted", () => {
    const input = createEntityInput();
    const record = createRuntimeFactories().entityFactory.createEntityRecord(
      {
        ...input,
        observations: [
          {
            ...input.observations[0],
            observationId: "obs-c-001",
            confidence: 0.4,
            rawName: "Acme Holdings LLC",
            stance: "supporting",
          },
          {
            ...input.observations[1],
            observationId: "obs-c-002",
            confidence: 0.9,
            rawName: "Acme Holdings LLC",
            stance: "contradicting",
            contradictsObservationIds: ["obs-c-001"],
          },
        ],
      },
      [],
      {
        reason: "conflict handling",
      },
    );

    assert.equal(record.identityStatus, "CONFLICTED");
    assert.equal(record.unresolvedReason, "CONTRADICTORY_OBSERVATIONS");
    assert.equal(record.contradictionObservationIds.includes("obs-c-001"), true);
    assert.equal(record.contradictionObservationIds.includes("obs-c-002"), true);
  });

  it("supports version lineage, supersedence, and retirement without mutating prior records", () => {
    const input = createEntityInput();
    const factory = createRuntimeFactories().entityFactory;

    const first = factory.createEntityRecord(input, [], {
      reason: "initial",
    });

    const superseded = factory.createEntityRecord(input, [], {
      reason: "supersede",
      previousRecord: first,
      lifecycleTransition: "SUPERSEDED",
    });

    const retired = factory.createEntityRecord(input, [], {
      reason: "retire",
      previousRecord: superseded,
      lifecycleTransition: "RETIRED",
    });

    assert.equal(first.version.ordinal, 1);
    assert.equal(superseded.version.ordinal, 2);
    assert.equal(retired.version.ordinal, 3);
    assert.equal(superseded.lifecycle.currentState, "SUPERSEDED");
    assert.equal(retired.lifecycle.currentState, "RETIRED");
    assert.equal(retired.version.previousVersionId, superseded.version.versionId);
    assert.equal(first.lifecycle.currentState, "ACTIVE");
  });

  it("captures validator failures as deterministic blocking checks", () => {
    const input = createEntityInput();
    const rules: readonly EntityRuntimeRule[] = [
      {
        name: "throwing-rule",
        validate: () => {
          throw new Error("validator failed");
        },
      },
    ];

    const blocked = createRuntimeFactories().entityFactory.createEntityRecord(input, rules, {
      reason: "validator failure",
    });

    assert.equal(blocked.outcome, "BLOCKED");
    assert.equal(blocked.lifecycle.currentState, "BLOCKED");
    assert.equal(blocked.checks.some((check) => check.code === "VALIDATOR_EXCEPTION"), true);
  });

  it("blocks when observations are not linked to IBR lineage evidence", () => {
    const input = createEntityInput();
    const blocked = createRuntimeFactories().entityFactory.createEntityRecord(
      {
        ...input,
        observations: [
          {
            ...input.observations[0],
            sourceEvidenceId: "missing-evidence-id",
          },
        ],
      },
      [],
      {
        reason: "invalid observation linkage",
      },
    );

    assert.equal(blocked.outcome, "BLOCKED");
    assert.equal(blocked.checks.some((check) => check.code === "OBSERVATION_LINKAGE" && check.status === "fail"), true);
  });
});
