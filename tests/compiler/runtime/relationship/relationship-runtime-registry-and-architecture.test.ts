import assert from "node:assert/strict";
import { describe, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  RelationshipRuntimeFactory,
  RelationshipRuntimeRegistry,
  type RelationshipRuntimeCreateInput,
} from "../../../../src/compiler/runtime";

function createClock() {
  let step = 0;
  return () => {
    const value = new Date(Date.UTC(2026, 0, 8, 0, 0, step)).toISOString();
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

function createInput(fromEntityId: string, toEntityId: string, sourceManifestId: string): RelationshipRuntimeCreateInput {
  return {
    fromEntityId,
    toEntityId,
    classification: "DEPENDENCY",
    directionality: "UNIDIRECTIONAL",
    cardinality: "MANY_TO_ONE",
    confidence: {
      score: 0.88,
      method: "evidence-aggregation",
    },
    provenance: [
      {
        sourceSystem: "ibr-runtime",
        sourceLocator: `ibr://${fromEntityId}/${toEntityId}`,
        recordedAt: "2026-01-02T00:00:00.000Z",
      },
    ],
    replay: {
      sourceManifestId,
    },
  };
}

const relationshipRuntimeFiles = [
  "src/compiler/runtime/relationship/contracts.ts",
  "src/compiler/runtime/relationship/RelationshipRuntimeFactory.ts",
  "src/compiler/runtime/relationship/RelationshipRuntimeRegistry.ts",
  "src/compiler/runtime/relationship/index.ts",
];

const forbiddenTerms = [
  "BusinessRuleRuntime",
  "BusinessGenomeAssembly",
  "Persistence",
  "Scheduling",
  "Orchestration",
  "Deployment",
  "AIModel",
  "LLM",
  "Inference",
  "Heuristic",
  "ConflictResolution",
  "RelationshipResolutionAuthority",
];

describe("RelationshipRuntimeRegistry and architecture guardrails", () => {
  it("registers immutable records with deterministic registry ordering and supports overwrite/delete behavior", () => {
    const factory = createFactory();
    const registry = new RelationshipRuntimeRegistry({
      factory,
      clock: createClock(),
      validators: [
        {
          name: "confidence-minimum",
          validate: (relationship) => ({
            status: relationship.confidence.score >= 0.5 ? "pass" : "fail",
            code: "CONFIDENCE_MINIMUM",
            message: "confidence checked",
          }),
        },
      ],
    });

    const left = factory.createRelationship(createInput("entity:a", "entity:b", "manifest:a"));
    const right = factory.createRelationship(createInput("entity:c", "entity:d", "manifest:b"));

    const firstRecord = registry.register(left);
    registry.register(right);

    assert.equal(registry.count(), 2);
    assert.equal(Object.isFrozen(firstRecord), true);
    assert.equal(firstRecord.validation.length, 1);

    const listed = registry.listAll();
    assert.equal(listed.length, 2);
    assert.equal(listed[0]?.relationship.identity.relationshipId <= listed[1]?.relationship.identity.relationshipId, true);

    const duplicate = factory.createRelationship(createInput("entity:a", "entity:b", "manifest:a-v2"));
    registry.register(duplicate);
    assert.equal(registry.count(), 2);

    const fetched = registry.getByRelationshipId(left.identity.relationshipId);
    assert.notEqual(fetched, undefined);
    assert.equal(fetched?.relationship.replayLink.sourceManifestId, "manifest:a-v2");

    assert.equal(registry.deleteByRelationshipId(right.identity.relationshipId), true);
    assert.equal(registry.count(), 1);
  });

  it("captures validator exceptions deterministically and fails registration without mutating prior state", () => {
    const factory = createFactory();
    const registry = new RelationshipRuntimeRegistry({
      factory,
      clock: createClock(),
      validators: [
        {
          name: "throwing-validator",
          validate: () => {
            throw new Error("validator exploded");
          },
        },
      ],
    });

    const relationship = factory.createRelationship(createInput("entity:x", "entity:y", "manifest:x"));
    assert.throws(() => registry.register(relationship), /VALIDATOR_EXCEPTION validator exploded/);
    assert.equal(registry.count(), 0);

    const validation = factory.validateRelationship(relationship, [
      {
        name: "throwing-validator",
        validate: () => {
          throw new Error("validator exploded");
        },
      },
    ]);

    assert.equal(validation.length, 1);
    assert.equal(validation[0]?.status, "fail");
    assert.equal(validation[0]?.code, "VALIDATOR_EXCEPTION");
    assert.equal(validation[0]?.message, "validator exploded");
  });

  it("stays within authorized architecture boundaries", () => {
    for (const relativePath of relationshipRuntimeFiles) {
      const absolutePath = resolve(process.cwd(), relativePath);
      const content = readFileSync(absolutePath, "utf8");

      for (const forbidden of forbiddenTerms) {
        assert.equal(
          content.includes(forbidden),
          false,
          `${relativePath} must not include out-of-scope term: ${forbidden}`,
        );
      }
    }
  });
});
