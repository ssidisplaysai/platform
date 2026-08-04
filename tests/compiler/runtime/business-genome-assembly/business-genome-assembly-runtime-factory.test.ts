import assert from "node:assert/strict";
import { describe, it } from "@jest/globals";
import {
  BusinessGenomeAssemblyRuntimeFactory,
  type BusinessGenomeAssemblyRuntimeCreateInput,
} from "../../../../src/compiler/runtime";

function createClock() {
  let step = 0;
  return () => {
    const value = new Date(Date.UTC(2026, 7, 4, 0, 0, step)).toISOString();
    step += 1;
    return value;
  };
}

function createFactory() {
  return new BusinessGenomeAssemblyRuntimeFactory({
    configuration: {
      runtimeId: "runtime-gci-p2-0005",
      compilerVersion: "1.0.0",
      specificationVersion: "GCS-0001-v1.0",
      programVersion: "GCI-P2-0005",
      schemaVersion: "1.0.0",
    },
    clock: createClock(),
  });
}

function createInput(): BusinessGenomeAssemblyRuntimeCreateInput {
  return {
    canonicalCode: "genome.quote.authorization.v1",
    title: "Quote Authorization Genome",
    description: "Assembly for quote authorization decisions",
    replayLink: {
      replayId: "replay-0005-a",
      sourceManifestId: "manifest-0005-a",
    },
    evidenceLinks: [
      {
        evidenceId: "evidence-z",
        validationId: "validation-z",
        certificationId: "certification-z",
      },
      {
        evidenceId: "evidence-a",
        validationId: "validation-a",
        certificationId: "certification-a",
      },
    ],
    provenance: [
      {
        sourceSystem: "policy-catalog",
        sourceLocator: "policy://quote/authorization",
        recordedAt: "2026-08-04T00:00:00.000Z",
      },
      {
        sourceSystem: "governance-registry",
        sourceLocator: "governance://runtime/gci-p2-0005",
        recordedAt: "2026-08-03T00:00:00.000Z",
      },
    ],
    unresolvedStateIds: ["state:unknown-owner", "state:missing-approval", "state:unknown-owner"],
    contradictoryEvidenceIds: ["evidence-z", "evidence-z", "evidence-a"],
    upstreamLinks: {
      evidenceRuntimeObjectIds: ["ev:2", "ev:1"],
      evidenceValidationRecordIds: ["vv:2", "vv:1"],
      manifestRecordIds: ["mf:2", "mf:1"],
      replayRecordIds: ["rp:2", "rp:1"],
      ibrRecordIds: ["ibr:2", "ibr:1"],
      entityRecordIds: ["en:2", "en:1"],
      relationshipRecordIds: ["rel:2", "rel:1"],
      businessRuleRecordIds: ["br:2", "br:1"],
    },
  };
}

describe("BusinessGenomeAssemblyRuntimeFactory", () => {
  it("creates deterministic immutable genomes and canonical ordering", () => {
    const left = createFactory().createGenome(createInput());
    const right = createFactory().createGenome({
      ...createInput(),
      evidenceLinks: [...(createInput().evidenceLinks ?? [])].reverse(),
      provenance: [...(createInput().provenance ?? [])].reverse(),
      unresolvedStateIds: [...(createInput().unresolvedStateIds ?? [])].reverse(),
      contradictoryEvidenceIds: [...(createInput().contradictoryEvidenceIds ?? [])].reverse(),
      upstreamLinks: {
        evidenceRuntimeObjectIds: [...createInput().upstreamLinks.evidenceRuntimeObjectIds].reverse(),
        evidenceValidationRecordIds: [...createInput().upstreamLinks.evidenceValidationRecordIds].reverse(),
        manifestRecordIds: [...createInput().upstreamLinks.manifestRecordIds].reverse(),
        replayRecordIds: [...createInput().upstreamLinks.replayRecordIds].reverse(),
        ibrRecordIds: [...createInput().upstreamLinks.ibrRecordIds].reverse(),
        entityRecordIds: [...createInput().upstreamLinks.entityRecordIds].reverse(),
        relationshipRecordIds: [...createInput().upstreamLinks.relationshipRecordIds].reverse(),
        businessRuleRecordIds: [...createInput().upstreamLinks.businessRuleRecordIds].reverse(),
      },
    });

    assert.equal(left.identity.genomeId, right.identity.genomeId);
    assert.equal(left.objectId, right.objectId);
    assert.equal(left.replayLink.deterministicFingerprint, right.replayLink.deterministicFingerprint);

    assert.equal(Object.isFrozen(left), true);
    assert.equal(Object.isFrozen(left.lifecycle), true);
    assert.equal(Object.isFrozen(left.lifecycle.history), true);
    assert.equal(Object.isFrozen(left.upstreamLinks), true);

    assert.deepEqual(left.unresolvedStateIds, ["state:missing-approval", "state:unknown-owner"]);
    assert.deepEqual(left.contradictoryEvidenceIds, ["evidence-a", "evidence-z"]);
    assert.deepEqual(left.evidenceLinks.map((link) => link.evidenceId), ["evidence-a", "evidence-z"]);
  });

  it("preserves unresolved and contradictory states without resolving them", () => {
    const output = createFactory().createGenome(createInput());

    assert.deepEqual(output.unresolvedStateIds, ["state:missing-approval", "state:unknown-owner"]);
    assert.deepEqual(output.contradictoryEvidenceIds, ["evidence-a", "evidence-z"]);
  });

  it("creates append-only versions with supersedence and retirement markers", () => {
    const factory = createFactory();
    const first = factory.createGenome(createInput());
    const superseded = factory.createNextVersion(first, {
      reason: "superseded by refreshed replay baseline",
      lifecycleTransition: "SUPERSEDED",
    });
    const retired = factory.createNextVersion(superseded, {
      reason: "retired by governance decision",
      lifecycleTransition: "RETIRED",
    });

    assert.equal(first.version.ordinal, 1);
    assert.equal(superseded.version.ordinal, 2);
    assert.equal(retired.version.ordinal, 3);
    assert.equal(superseded.version.previousVersionId, first.version.versionId);
    assert.equal(retired.version.previousVersionId, superseded.version.versionId);

    assert.equal(superseded.lifecycle.currentState, "SUPERSEDED");
    assert.equal(retired.lifecycle.currentState, "RETIRED");
    assert.equal(superseded.lineage.supersedesVersionId, first.version.versionId);
    assert.equal(retired.lineage.retiredVersionId, superseded.version.versionId);
    assert.equal(retired.lineage.appendOnly, true);
  });

  it("retains upstream linkage without mutating referenced runtime artifacts", () => {
    const output = createFactory().createGenome(createInput());

    assert.deepEqual(output.upstreamLinks.evidenceRuntimeObjectIds, ["ev:1", "ev:2"]);
    assert.deepEqual(output.upstreamLinks.businessRuleRecordIds, ["br:1", "br:2"]);
    assert.equal(output.upstreamLinks.evidenceRuntimeObjectIds.includes("ev:1"), true);
    assert.equal(output.upstreamLinks.businessRuleRecordIds.includes("br:2"), true);
  });

  it("does not expose inference, rule-evaluation, identity-resolution, or mutation APIs", () => {
    const factory = createFactory() as unknown as Record<string, unknown>;

    assert.equal(typeof factory["infer"], "undefined");
    assert.equal(typeof factory["evaluateRule"], "undefined");
    assert.equal(typeof factory["resolveIdentity"], "undefined");
    assert.equal(typeof factory["resolveRelationship"], "undefined");
    assert.equal(typeof factory["mutateUpstream"], "undefined");
  });
});
