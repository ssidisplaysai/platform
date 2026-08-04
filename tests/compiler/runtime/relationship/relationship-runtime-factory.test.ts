import assert from "node:assert/strict";
import { describe, it } from "@jest/globals";
import {
  RelationshipRuntimeFactory,
  type RelationshipClassification,
  type RelationshipRuntimeCreateInput,
} from "../../../../src/compiler/runtime";

function createClock() {
  let step = 0;
  return () => {
    const value = new Date(Date.UTC(2026, 0, 7, 0, 0, step)).toISOString();
    step += 1;
    return value;
  };
}

function createFactory() {
  return new RelationshipRuntimeFactory({
    configuration: {
      runtimeId: "runtime-gci-p2-0003",
      compilerVersion: "1.0.0",
      specificationVersion: "GCS-0001-v1.0",
      programVersion: "GCI-P2-0003",
      schemaVersion: "1.0.0",
    },
    clock: createClock(),
  });
}

function createInput(classification: RelationshipClassification): RelationshipRuntimeCreateInput {
  const byClassification: Record<RelationshipClassification, Pick<RelationshipRuntimeCreateInput, "directionality" | "cardinality">> = {
    PARENT_CHILD: { directionality: "UNIDIRECTIONAL", cardinality: "ONE_TO_MANY" },
    OWNERSHIP: { directionality: "UNIDIRECTIONAL", cardinality: "ONE_TO_ONE" },
    MEMBERSHIP: { directionality: "BIDIRECTIONAL", cardinality: "MANY_TO_MANY" },
    CONTAINMENT: { directionality: "UNIDIRECTIONAL", cardinality: "ONE_TO_MANY" },
    DEPENDENCY: { directionality: "UNIDIRECTIONAL", cardinality: "MANY_TO_ONE" },
    REFERENCE: { directionality: "BIDIRECTIONAL", cardinality: "MANY_TO_MANY" },
    ASSOCIATION: { directionality: "BIDIRECTIONAL", cardinality: "ONE_TO_ONE" },
  };

  return {
    fromEntityId: `entity:${classification}:from`,
    toEntityId: `entity:${classification}:to`,
    classification,
    directionality: byClassification[classification].directionality,
    cardinality: byClassification[classification].cardinality,
    confidence: {
      score: 0.93,
      method: "deterministic-observation",
      rationale: "Certified source alignment",
    },
    provenance: [
      {
        sourceSystem: "ibr-runtime",
        sourceLocator: `ibr://relationship/${classification.toLowerCase()}`,
        recordedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        sourceSystem: "entity-runtime",
        sourceLocator: `entity://link/${classification.toLowerCase()}`,
        recordedAt: "2026-01-01T00:00:01.000Z",
      },
    ],
    lineage: {
      rootRelationshipId: `root:${classification}`,
      parentRelationshipId: `parent:${classification}`,
      capturedAt: "2026-01-01T00:00:02.000Z",
    },
    replay: {
      sourceManifestId: `manifest:${classification}`,
      replaySalt: "phase-2",
    },
  };
}

describe("RelationshipRuntimeFactory", () => {
  it("creates deterministic immutable relationship records and preserves linkage fields", () => {
    const left = createFactory().createRelationship(createInput("PARENT_CHILD"));
    const right = createFactory().createRelationship(createInput("PARENT_CHILD"));

    assert.equal(Object.isFrozen(left), true);
    assert.equal(Object.isFrozen(left.entityLinkage), true);
    assert.equal(Object.isFrozen(left.provenance), true);
    assert.equal(Object.isFrozen(left.lineage), true);
    assert.equal(Object.isFrozen(left.replayLink), true);

    assert.equal(left.identity.relationshipId, right.identity.relationshipId);
    assert.equal(left.objectId, right.objectId);
    assert.equal(left.replayLink.deterministicFingerprint, right.replayLink.deterministicFingerprint);
    assert.equal(left.directionality, "UNIDIRECTIONAL");
    assert.equal(left.cardinality, "ONE_TO_MANY");
    assert.equal(left.classification, "PARENT_CHILD");

    assert.equal(left.confidence.score, 0.93);
    assert.equal(left.confidence.method, "deterministic-observation");
    assert.equal(left.provenance.length, 2);
    assert.equal(left.lineage.rootRelationshipId, "root:PARENT_CHILD");
    assert.equal(left.lineage.parentRelationshipId, "parent:PARENT_CHILD");
    assert.equal(left.replayLink.sourceManifestId, "manifest:PARENT_CHILD");
    assert.equal(left.entityLinkage.fromEntityId, "entity:PARENT_CHILD:from");
    assert.equal(left.entityLinkage.toEntityId, "entity:PARENT_CHILD:to");
  });

  it("creates canonical relationships for all authorized classifications", () => {
    const factory = createFactory();
    const classifications: readonly RelationshipClassification[] = [
      "PARENT_CHILD",
      "OWNERSHIP",
      "MEMBERSHIP",
      "CONTAINMENT",
      "DEPENDENCY",
      "REFERENCE",
      "ASSOCIATION",
    ];

    for (const classification of classifications) {
      const relationship = factory.createRelationship(createInput(classification));
      assert.equal(relationship.classification, classification);
      assert.equal(relationship.identity.relationshipId.length, 64);
      assert.equal(relationship.lineage.lineageId.length, 64);
      assert.equal(relationship.replayLink.replayId.length, 64);
      assert.equal(relationship.provenance.every((item) => item.provenanceId.length === 64), true);
    }
  });

  it("enforces directionality and cardinality constraints by classification", () => {
    const factory = createFactory();

    assert.throws(
      () =>
        factory.createRelationship({
          ...createInput("PARENT_CHILD"),
          directionality: "BIDIRECTIONAL",
        }),
      /directionality BIDIRECTIONAL is not allowed for classification PARENT_CHILD/,
    );

    assert.throws(
      () =>
        factory.createRelationship({
          ...createInput("OWNERSHIP"),
          cardinality: "MANY_TO_MANY",
        }),
      /cardinality MANY_TO_MANY is not allowed for classification OWNERSHIP/,
    );
  });

  it("fails invalid confidence and invalid entity linkage", () => {
    const factory = createFactory();

    assert.throws(
      () =>
        factory.createRelationship({
          ...createInput("ASSOCIATION"),
          confidence: {
            score: 1.2,
            method: "bad-score",
          },
        }),
      /confidence score must be between 0 and 1/,
    );

    assert.throws(
      () =>
        factory.createRelationship({
          ...createInput("ASSOCIATION"),
          toEntityId: "entity:ASSOCIATION:from",
        }),
      /must reference two distinct entities/,
    );
  });
});
