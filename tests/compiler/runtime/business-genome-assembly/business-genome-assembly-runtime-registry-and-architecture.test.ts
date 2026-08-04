import assert from "node:assert/strict";
import { describe, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BusinessGenomeAssemblyRuntimeFactory,
  BusinessGenomeAssemblyRuntimeRegistry,
  type BusinessGenomeAssemblyRuntimeCreateInput,
} from "../../../../src/compiler/runtime";

function createClock() {
  let step = 0;
  return () => {
    const value = new Date(Date.UTC(2026, 7, 4, 1, 0, step)).toISOString();
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

function createInput(canonicalCode: string, replayId: string): BusinessGenomeAssemblyRuntimeCreateInput {
  return {
    canonicalCode,
    title: `Genome ${canonicalCode}`,
    replayLink: {
      replayId,
      sourceManifestId: "manifest-0005",
    },
    evidenceLinks: [
      {
        evidenceId: "evidence-1",
        validationId: "validation-1",
        certificationId: "certification-1",
      },
    ],
    unresolvedStateIds: ["state:missing"],
    contradictoryEvidenceIds: ["evidence-2"],
    upstreamLinks: {
      evidenceRuntimeObjectIds: ["ev:1"],
      evidenceValidationRecordIds: ["vv:1"],
      manifestRecordIds: ["mf:1"],
      replayRecordIds: ["rp:1"],
      ibrRecordIds: ["ibr:1"],
      entityRecordIds: ["en:1"],
      relationshipRecordIds: ["rel:1"],
      businessRuleRecordIds: ["br:1"],
    },
  };
}

const runtimeFiles = [
  "src/compiler/runtime/business-genome-assembly/contracts.ts",
  "src/compiler/runtime/business-genome-assembly/BusinessGenomeAssemblyRuntimeFactory.ts",
  "src/compiler/runtime/business-genome-assembly/BusinessGenomeAssemblyRuntimeRegistry.ts",
  "src/compiler/runtime/business-genome-assembly/index.ts",
];

const forbiddenTerms = [
  "infer",
  "inference",
  "machineLearning",
  "heuristic",
  "probabilistic",
  "evaluateRule",
  "resolveIdentity",
  "resolveRelationship",
  "mutateUpstream",
  "database",
  "queue",
  "worker",
  "scheduler",
  "deployment",
  "infrastructure",
  "openai",
  "llm",
  "plan",
];

describe("BusinessGenomeAssemblyRuntimeRegistry and architecture guardrails", () => {
  it("registers immutable records, overwrites duplicate genome identities, and keeps deterministic ordering", () => {
    const factory = createFactory();
    const registry = new BusinessGenomeAssemblyRuntimeRegistry({
      factory,
      validators: [
        {
          name: "append-only-lineage",
          validate: (output) => ({
            status: output.lineage.appendOnly ? "pass" : "fail",
            code: "LINEAGE_APPEND_ONLY",
            message: "append-only lineage checked",
          }),
        },
      ],
      clock: createClock(),
    });

    const alpha = factory.createGenome(createInput("genome.alpha", "replay-alpha"));
    const beta = factory.createGenome(createInput("genome.beta", "replay-beta"));

    const firstRecord = registry.register(alpha);
    registry.register(beta);

    assert.equal(registry.count(), 2);
    assert.equal(Object.isFrozen(firstRecord), true);
    assert.equal(Object.isFrozen(firstRecord.validation), true);

    const listed = registry.listAll();
    assert.equal(listed.length, 2);
    assert.equal(listed[0]?.output.identity.genomeId <= listed[1]?.output.identity.genomeId, true);

    const alphaOverwrite = factory.createGenome(createInput("genome.alpha", "replay-alpha-v2"));
    registry.register(alphaOverwrite);

    assert.equal(registry.count(), 2);
    const fetched = registry.getByGenomeId(alpha.identity.genomeId);
    assert.notEqual(fetched, undefined);
    assert.equal(fetched?.output.replayLink.replayId, "replay-alpha-v2");

    assert.equal(registry.deleteByGenomeId(beta.identity.genomeId), true);
    assert.equal(registry.count(), 1);
  });

  it("rejects registry writes on validator failures and preserves prior state", () => {
    const factory = createFactory();
    const registry = new BusinessGenomeAssemblyRuntimeRegistry({
      factory,
      validators: [
        {
          name: "throwing-validator",
          validate: () => {
            throw new Error("validator exploded");
          },
        },
      ],
      clock: createClock(),
    });

    const output = factory.createGenome(createInput("genome.failure", "replay-failure"));
    assert.throws(() => registry.register(output), /VALIDATOR_EXCEPTION validator exploded/);
    assert.equal(registry.count(), 0);
  });

  it("covers registry failure path for explicit fail validators and no-op deletion", () => {
    const factory = createFactory();
    const registry = new BusinessGenomeAssemblyRuntimeRegistry({
      factory,
      validators: [
        {
          name: "explicit-fail",
          validate: () => ({
            status: "fail",
            code: "EXPLICIT_FAIL",
            message: "contract violation",
          }),
        },
      ],
      clock: createClock(),
    });

    const output = factory.createGenome(createInput("genome.explicit.fail", "replay-explicit-fail"));
    assert.throws(() => registry.register(output), /EXPLICIT_FAIL contract violation/);
    assert.equal(registry.count(), 0);
    assert.equal(registry.getByGenomeId("missing-genome-id"), undefined);
    assert.equal(registry.deleteByGenomeId("missing-genome-id"), false);
    assert.deepEqual(registry.listAll(), []);
  });

  it("stays within authorized architecture boundaries", () => {
    for (const relativePath of runtimeFiles) {
      const absolutePath = resolve(process.cwd(), relativePath);
      const content = readFileSync(absolutePath, "utf8").toLowerCase();

      for (const forbidden of forbiddenTerms) {
        assert.equal(content.includes(forbidden), false, `${relativePath} must not include out-of-scope term: ${forbidden}`);
      }
    }
  });
});
