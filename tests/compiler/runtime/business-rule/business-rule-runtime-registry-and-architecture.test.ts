import assert from "node:assert/strict";
import { describe, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BusinessRuleRuntimeFactory,
  BusinessRuleRuntimeRegistry,
  type BusinessRuleRuntimeCreateInput,
} from "../../../../src/compiler/runtime";

function createClock() {
  let step = 0;
  return () => {
    const value = new Date(Date.UTC(2026, 7, 3, 1, 0, step)).toISOString();
    step += 1;
    return value;
  };
}

function createFactory() {
  return new BusinessRuleRuntimeFactory({
    configuration: {
      runtimeId: "runtime-gci-p2-0004",
      compilerVersion: "1.0.0",
      specificationVersion: "GCS-0001-v1.0",
      programVersion: "GCI-P2-0004",
      schemaVersion: "1.0.0",
    },
    clock: createClock(),
  });
}

function createInput(ruleCode: string, replayId: string): BusinessRuleRuntimeCreateInput {
  return {
    canonicalCode: ruleCode,
    title: `Rule ${ruleCode}`,
    domain: "POLICY",
    conditions: [
      {
        factKey: "quote.approved",
        operator: "EQ",
        expectedValue: true,
      },
    ],
    confidence: 0.9,
    evidenceLinks: [
      {
        evidenceId: "evidence-a",
        validationId: "validation-a",
        certificationId: "certification-a",
        stance: "supporting",
      },
    ],
    entityLinks: ["entity:quote:q-1"],
    relationshipLinks: ["relationship:quote-owned-by-customer"],
    replayLink: {
      replayId,
      sourceManifestId: "manifest-0004",
    },
  };
}

const businessRuleRuntimeFiles = [
  "src/compiler/runtime/business-rule/contracts.ts",
  "src/compiler/runtime/business-rule/BusinessRuleRuntimeFactory.ts",
  "src/compiler/runtime/business-rule/BusinessRuleRuntimeRegistry.ts",
  "src/compiler/runtime/business-rule/index.ts",
];

const forbiddenTerms = [
  "BusinessGenomeAssembly",
  "GenomeCompilation",
  "Inference",
  "Planning",
  "OpenAI",
  "LLM",
  "MachineLearning",
  "Heuristic",
  "Probabilistic",
  "Persistence",
  "Scheduling",
  "Worker",
  "Queue",
  "Deployment",
  "Infrastructure",
  "WorkflowExecution",
  "DatabaseOwnership",
  "MessageBus",
  "/genome/",
  "/persistence/",
  "/queue/",
  "/worker/",
  "/schedule/",
  "/deployment/",
];

describe("BusinessRuleRuntimeRegistry and architecture guardrails", () => {
  it("registers immutable records, overwrites duplicate rule identities, and keeps deterministic ordering", () => {
    const factory = createFactory();
    const registry = new BusinessRuleRuntimeRegistry({
      factory,
      clock: createClock(),
      validators: [
        {
          name: "policy-domain",
          validate: (rule) => ({
            status: rule.domain === "POLICY" ? "pass" : "fail",
            code: "POLICY_DOMAIN",
            message: "policy domain checked",
          }),
        },
      ],
    });

    const alpha = factory.createRule(createInput("rule.policy.alpha", "replay-alpha"));
    const beta = factory.createRule(createInput("rule.policy.beta", "replay-beta"));

    const firstRecord = registry.register(alpha);
    registry.register(beta);

    assert.equal(registry.count(), 2);
    assert.equal(Object.isFrozen(firstRecord), true);
    assert.equal(Object.isFrozen(firstRecord.validation), true);

    const listed = registry.listAll();
    assert.equal(listed.length, 2);
    assert.equal(listed[0]?.rule.identity.ruleId <= listed[1]?.rule.identity.ruleId, true);

    const alphaOverwrite = factory.createRule(createInput("rule.policy.alpha", "replay-alpha-v2"));
    registry.register(alphaOverwrite);

    assert.equal(registry.count(), 2);
    const fetched = registry.getByRuleId(alpha.identity.ruleId);
    assert.notEqual(fetched, undefined);
    assert.equal(fetched?.rule.replayLink.replayId, "replay-alpha-v2");

    assert.equal(registry.deleteByRuleId(beta.identity.ruleId), true);
    assert.equal(registry.count(), 1);
  });

  it("rejects registry writes on validator failures and preserves prior state", () => {
    const factory = createFactory();
    const registry = new BusinessRuleRuntimeRegistry({
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

    const rule = factory.createRule(createInput("rule.policy.failure", "replay-failure"));
    assert.throws(() => registry.register(rule), /VALIDATOR_EXCEPTION validator exploded/);
    assert.equal(registry.count(), 0);
  });

  it("covers registry failure path for explicit fail validators and no-op deletion", () => {
    const factory = createFactory();
    const registry = new BusinessRuleRuntimeRegistry({
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

    const rule = factory.createRule(createInput("rule.policy.explicit.fail", "replay-explicit-fail"));
    assert.throws(() => registry.register(rule), /EXPLICIT_FAIL contract violation/);
    assert.equal(registry.count(), 0);
    assert.equal(registry.getByRuleId("missing-rule-id"), undefined);
    assert.equal(registry.deleteByRuleId("missing-rule-id"), false);
    assert.deepEqual(registry.listAll(), []);
  });

  it("replaces prior registration snapshot for duplicate rule identity", () => {
    const factory = createFactory();
    const registry = new BusinessRuleRuntimeRegistry({
      factory,
      validators: [],
      clock: createClock(),
    });

    const first = factory.createRule(createInput("rule.policy.replace", "replay-replace-v1"));
    const second = factory.createRule(createInput("rule.policy.replace", "replay-replace-v2"));

    const firstRegistration = registry.register(first);
    const secondRegistration = registry.register(second);

    assert.equal(registry.count(), 1);
    assert.notEqual(firstRegistration, secondRegistration);
    assert.equal(registry.getByRuleId(first.identity.ruleId), secondRegistration);
    assert.equal(registry.getByRuleId(first.identity.ruleId)?.rule.replayLink.replayId, "replay-replace-v2");
  });

  it("stays within authorized architecture boundaries", () => {
    for (const relativePath of businessRuleRuntimeFiles) {
      const absolutePath = resolve(process.cwd(), relativePath);
      const content = readFileSync(absolutePath, "utf8");

      for (const forbidden of forbiddenTerms) {
        assert.equal(content.includes(forbidden), false, `${relativePath} must not include out-of-scope term: ${forbidden}`);
      }
    }
  });
});
