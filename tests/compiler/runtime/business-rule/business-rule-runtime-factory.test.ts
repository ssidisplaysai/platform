import assert from "node:assert/strict";
import { describe, it } from "@jest/globals";
import {
  BusinessRuleRuntimeFactory,
  type BusinessRuleRuntimeCreateInput,
  type BusinessRuleValidator,
} from "../../../../src/compiler/runtime";

function createClock() {
  let step = 0;
  return () => {
    const value = new Date(Date.UTC(2026, 7, 3, 0, 0, step)).toISOString();
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

function createValidationRuleInput(): BusinessRuleRuntimeCreateInput {
  return {
    canonicalCode: "rule.customer.credit.required",
    title: "Customer credit required",
    domain: "VALIDATION",
    conditions: [
      {
        factKey: "customer.creditScore",
        operator: "GTE",
        expectedValue: 650,
      },
      {
        factKey: "quote.total",
        operator: "GT",
        expectedValue: 0,
      },
    ],
    confidence: 0.91,
    provenance: [
      {
        sourceSystem: "policy-catalog",
        sourceLocator: "policy://credit/required",
        recordedAt: "2026-08-01T00:00:00.000Z",
      },
    ],
    evidenceLinks: [
      {
        evidenceId: "evidence-2",
        validationId: "validation-2",
        certificationId: "certification-2",
        stance: "contradicting",
      },
      {
        evidenceId: "evidence-1",
        validationId: "validation-1",
        certificationId: "certification-1",
        stance: "supporting",
      },
    ],
    entityLinks: ["entity:customer:acme", "entity:quote:q-1"],
    relationshipLinks: ["relationship:customer-owns-quote"],
    replayLink: {
      replayId: "replay-0004-a",
      sourceManifestId: "manifest-0004-a",
    },
  };
}

function createCalculationRuleInput(): BusinessRuleRuntimeCreateInput {
  return {
    canonicalCode: "rule.quote.total.calculate",
    title: "Quote total calculation",
    domain: "CALCULATION",
    conditions: [
      {
        factKey: "quote.items.count",
        operator: "GT",
        expectedValue: 0,
      },
    ],
    calculations: [
      {
        outputFactKey: "quote.subtotal",
        operation: "SUM",
        operandFactKeys: ["line.itemA", "line.itemB"],
      },
      {
        outputFactKey: "quote.total",
        operation: "SUM",
        operandFactKeys: ["quote.subtotal", "quote.tax"],
      },
    ],
    confidence: 0.84,
    replayLink: {
      replayId: "replay-0004-b",
      sourceManifestId: "manifest-0004-b",
    },
  };
}

describe("BusinessRuleRuntimeFactory", () => {
  it("creates deterministic immutable rule identity and canonical ordering", () => {
    const left = createFactory().createRule(createValidationRuleInput());
    const right = createFactory().createRule({
      ...createValidationRuleInput(),
      evidenceLinks: [...(createValidationRuleInput().evidenceLinks ?? [])].reverse(),
      conditions: [...createValidationRuleInput().conditions].reverse(),
      entityLinks: [...(createValidationRuleInput().entityLinks ?? [])].reverse(),
      relationshipLinks: [...(createValidationRuleInput().relationshipLinks ?? [])].reverse(),
    });

    assert.equal(left.identity.ruleId, right.identity.ruleId);
    assert.equal(left.objectId, right.objectId);
    assert.equal(left.replayLink.deterministicFingerprint, right.replayLink.deterministicFingerprint);
    assert.equal(Object.isFrozen(left), true);
    assert.equal(Object.isFrozen(left.conditions), true);
    assert.equal(Object.isFrozen(left.evidenceLinks), true);
    assert.equal(Object.isFrozen(left.lifecycle.history), true);
  });

  it("evaluates validation, compliance, eligibility, and policy conditions deterministically", () => {
    const factory = createFactory();
    const validationRule = factory.createRule(createValidationRuleInput());
    const complianceRule = factory.createRule({
      ...createValidationRuleInput(),
      canonicalCode: "rule.compliance.geo",
      domain: "COMPLIANCE",
      conditions: [
        {
          factKey: "order.country",
          operator: "IN",
          expectedValue: ["US", "CA"],
        },
      ],
    });
    const eligibilityRule = factory.createRule({
      ...createValidationRuleInput(),
      canonicalCode: "rule.eligibility.tier",
      domain: "ELIGIBILITY",
      conditions: [
        {
          factKey: "customer.tier",
          operator: "IN",
          expectedValue: ["GOLD", "PLATINUM"],
        },
      ],
    });
    const policyRule = factory.createRule({
      ...createValidationRuleInput(),
      canonicalCode: "rule.policy.credit-hold",
      domain: "POLICY",
      conditions: [
        {
          factKey: "customer.creditHold",
          operator: "EQ",
          expectedValue: false,
        },
      ],
    });

    const facts = {
      "customer.creditScore": 700,
      "quote.total": 125,
      "order.country": "US",
      "customer.tier": "PLATINUM",
      "customer.creditHold": false,
    } as const;

    const validationOutcome = factory.evaluateRule(validationRule, { facts });
    const complianceOutcome = factory.evaluateRule(complianceRule, { facts });
    const eligibilityOutcome = factory.evaluateRule(eligibilityRule, { facts });
    const policyOutcome = factory.evaluateRule(policyRule, { facts });

    assert.equal(validationOutcome.status, "PASS");
    assert.equal(complianceOutcome.status, "PASS");
    assert.equal(eligibilityOutcome.status, "PASS");
    assert.equal(policyOutcome.status, "PASS");
    assert.equal(validationOutcome.conditionResults.every((result) => result.status === "pass"), true);
    assert.equal(validationOutcome.confidence, validationRule.confidence);
    assert.equal(validationOutcome.provenance.length, validationRule.provenance.length);
    assert.equal(validationOutcome.evidenceLinks.length, validationRule.evidenceLinks.length);
    assert.equal(validationOutcome.entityLinks.length, validationRule.entityLinks.length);
    assert.equal(validationOutcome.relationshipLinks.length, validationRule.relationshipLinks.length);
  });

  it("derives calculation facts and preserves deterministic output ordering", () => {
    const factory = createFactory();
    const calculationRule = factory.createRule(createCalculationRuleInput());

    const left = factory.evaluateRule(calculationRule, {
      facts: {
        "quote.items.count": 2,
        "line.itemA": 100,
        "line.itemB": 25,
        "quote.tax": 10,
      },
    });

    const right = factory.evaluateRule(calculationRule, {
      facts: {
        "quote.tax": 10,
        "line.itemB": 25,
        "line.itemA": 100,
        "quote.items.count": 2,
      },
    });

    assert.equal(left.status, "PASS");
    assert.deepEqual(left.derivedFacts, right.derivedFacts);
    assert.equal(left.derivedFacts.length, 2);
    assert.equal(left.derivedFacts[0]?.factKey, "quote.subtotal");
    assert.equal(left.derivedFacts[0]?.value, 125);
    assert.equal(left.derivedFacts[1]?.factKey, "quote.total");
    assert.equal(left.derivedFacts[1]?.value, 135);
  });

  it("returns unresolved outcomes when required facts are missing", () => {
    const factory = createFactory();
    const rule = factory.createRule(createValidationRuleInput());

    const unresolved = factory.evaluateRule(rule, {
      facts: {
        "customer.creditScore": 700,
      },
    });

    assert.equal(unresolved.status, "UNRESOLVED");
    assert.equal(unresolved.conditionResults.some((result) => result.status === "unresolved"), true);
  });

  it("preserves contradictory evidence without exercising contradiction resolution authority", () => {
    const factory = createFactory();
    const rule = factory.createRule(createValidationRuleInput());

    const contradicted = factory.evaluateRule(rule, {
      facts: {
        "customer.creditScore": 700,
        "quote.total": 125,
      },
      contradictoryEvidenceIds: ["evidence-2"],
    });

    assert.equal(contradicted.status, "CONTRADICTED");
    assert.deepEqual(contradicted.contradictoryEvidenceIds, ["evidence-2"]);
  });

  it("supports append-only lineage, supersedence, and retirement", () => {
    const factory = createFactory();
    const first = factory.createRule(createValidationRuleInput());
    const superseded = factory.createNextVersion(first, {
      reason: "new policy supersedes old policy",
      lifecycleTransition: "SUPERSEDED",
      confidence: 0.92,
    });
    const retired = factory.createNextVersion(superseded, {
      reason: "retire policy",
      lifecycleTransition: "RETIRED",
    });

    assert.equal(first.version.ordinal, 1);
    assert.equal(superseded.version.ordinal, 2);
    assert.equal(retired.version.ordinal, 3);
    assert.equal(superseded.lifecycle.currentState, "SUPERSEDED");
    assert.equal(retired.lifecycle.currentState, "RETIRED");
    assert.equal(superseded.lineage.parentVersionId, first.version.versionId);
    assert.equal(retired.lineage.parentVersionId, superseded.version.versionId);
    assert.equal(retired.lineage.appendOnly, true);
  });

  it("captures validator failures deterministically and supports domain and contradiction validators", () => {
    const factory = createFactory();
    const validationRule = factory.createRule(createValidationRuleInput());

    const validators: readonly BusinessRuleValidator[] = [
      factory.createDomainGuardValidator("VALIDATION"),
      factory.createContradictionPreservationValidator(),
      {
        name: "throwing-validator",
        validate: () => {
          throw new Error("validator exploded");
        },
      },
    ];

    const results = factory.validateRule(validationRule, validators);
    assert.equal(results.length, 3);
    assert.equal(results.some((result) => result.code === "DOMAIN_OK" && result.status === "pass"), true);
    assert.equal(results.some((result) => result.code === "CONTRADICTION_PRESERVED" && result.status === "warn"), true);
    assert.equal(results.some((result) => result.code === "VALIDATOR_EXCEPTION" && result.status === "fail"), true);
  });

  it("evaluates all supported condition operators deterministically", () => {
    const factory = createFactory();

    const rule = factory.createRule({
      canonicalCode: "rule.operator.matrix",
      title: "Operator matrix",
      domain: "COMPLIANCE",
      conditions: [
        { factKey: "eq.fact", operator: "EQ", expectedValue: "x" },
        { factKey: "neq.fact", operator: "NEQ", expectedValue: "z" },
        { factKey: "gt.fact", operator: "GT", expectedValue: 4 },
        { factKey: "gte.fact", operator: "GTE", expectedValue: 5 },
        { factKey: "lt.fact", operator: "LT", expectedValue: 8 },
        { factKey: "lte.fact", operator: "LTE", expectedValue: 7 },
        { factKey: "in.fact", operator: "IN", expectedValue: ["a", "b", "c"] },
        { factKey: "notin.fact", operator: "NOT_IN", expectedValue: ["u", "v"] },
        { factKey: "exists.fact", operator: "EXISTS" },
        { factKey: "missing.fact", operator: "NOT_EXISTS" },
      ],
      confidence: 0.9,
      replayLink: {
        replayId: "replay-operators",
        sourceManifestId: "manifest-operators",
      },
    });

    const outcome = factory.evaluateRule(rule, {
      facts: {
        "eq.fact": "x",
        "neq.fact": "y",
        "gt.fact": 5,
        "gte.fact": 5,
        "lt.fact": 7,
        "lte.fact": 7,
        "in.fact": "b",
        "notin.fact": "w",
        "exists.fact": true,
      },
    });

    assert.equal(outcome.status, "PASS");
    assert.equal(outcome.conditionResults.every((result) => result.status === "pass"), true);
  });

  it("returns FAIL when a condition comparison fails without contradictions or unresolved facts", () => {
    const factory = createFactory();
    const rule = factory.createRule({
      ...createValidationRuleInput(),
      canonicalCode: "rule.fail.path",
      conditions: [
        {
          factKey: "customer.creditScore",
          operator: "GT",
          expectedValue: 900,
        },
      ],
    });

    const outcome = factory.evaluateRule(rule, {
      facts: {
        "customer.creditScore": 700,
      },
    });

    assert.equal(outcome.status, "FAIL");
    assert.equal(outcome.conditionResults[0]?.status, "fail");
  });

  it("keeps contradiction validator on pass path when no contradictory stances exist", () => {
    const factory = createFactory();
    const rule = factory.createRule({
      ...createValidationRuleInput(),
      canonicalCode: "rule.no.contradiction",
      evidenceLinks: [
        {
          evidenceId: "evidence-1",
          validationId: "validation-1",
          certificationId: "certification-1",
          stance: "supporting",
        },
      ],
    });

    const result = factory.validateRule(rule, [factory.createContradictionPreservationValidator()]);
    assert.equal(result[0]?.status, "pass");
    assert.equal(result[0]?.code, "CONTRADICTION_OK");
  });

  it("covers calculation operation branches including multiply, min, max, and missing operands", () => {
    const factory = createFactory();
    const rule = factory.createRule({
      canonicalCode: "rule.calculation.ops",
      title: "Calculation branch coverage",
      domain: "CALCULATION",
      conditions: [
        {
          factKey: "base",
          operator: "EXISTS",
        },
      ],
      calculations: [
        {
          outputFactKey: "calc.multiply",
          operation: "MULTIPLY",
          operandFactKeys: ["a", "b"],
        },
        {
          outputFactKey: "calc.min",
          operation: "MIN",
          operandFactKeys: ["a", "c"],
        },
        {
          outputFactKey: "calc.max",
          operation: "MAX",
          operandFactKeys: ["b", "c"],
        },
        {
          outputFactKey: "calc.missing",
          operation: "SUM",
          operandFactKeys: ["a", "missing"],
        },
      ],
      confidence: 0.7,
      replayLink: {
        replayId: "replay-calculation-ops",
        sourceManifestId: "manifest-calculation-ops",
      },
    });

    const outcome = factory.evaluateRule(rule, {
      facts: {
        base: 1,
        a: 2,
        b: 3,
        c: 4,
      },
    });

    const byKey = new Map(outcome.derivedFacts.map((fact) => [fact.factKey, fact.value] as const));
    assert.equal(byKey.get("calc.multiply"), 6);
    assert.equal(byKey.get("calc.min"), 2);
    assert.equal(byKey.get("calc.max"), 4);
    assert.equal(byKey.has("calc.missing"), false);
  });

  it("covers createRule input contract errors and domain-calculation constraints", () => {
    const factory = createFactory();

    assert.throws(
      () =>
        factory.createRule({
          ...createValidationRuleInput(),
          canonicalCode: "  ",
        }),
      /canonicalCode is required/,
    );

    assert.throws(
      () =>
        factory.createRule({
          ...createValidationRuleInput(),
          title: "  ",
        }),
      /title is required/,
    );

    assert.throws(
      () =>
        factory.createRule({
          ...createValidationRuleInput(),
          confidence: 1.1,
        }),
      /confidence must be between 0 and 1/,
    );

    assert.throws(
      () =>
        factory.createRule({
          ...createValidationRuleInput(),
          confidence: Number.NaN,
        }),
      /confidence must be between 0 and 1/,
    );

    assert.throws(
      () =>
        factory.createRule({
          ...createValidationRuleInput(),
          conditions: [],
        }),
      /require at least one condition/,
    );

    assert.throws(
      () =>
        factory.createRule({
          ...createValidationRuleInput(),
          replayLink: {
            replayId: "  ",
            sourceManifestId: "manifest-a",
          },
        }),
      /replayLink.replayId is required/,
    );

    assert.throws(
      () =>
        factory.createRule({
          ...createValidationRuleInput(),
          replayLink: {
            replayId: "replay-a",
            sourceManifestId: "  ",
          },
        }),
      /replayLink.sourceManifestId is required/,
    );

    assert.throws(
      () =>
        factory.createRule({
          ...createValidationRuleInput(),
          calculations: [
            {
              outputFactKey: "x",
              operation: "SUM",
              operandFactKeys: ["a", "b"],
            },
          ],
        }),
      /Only calculation rules may define calculations/,
    );

    assert.throws(
      () =>
        factory.createRule({
          ...createCalculationRuleInput(),
          calculations: [],
        }),
      /must include at least one calculation/,
    );
  });

  it("covers provenance and evidence normalization errors", () => {
    const factory = createFactory();

    assert.throws(
      () =>
        factory.createRule({
          ...createValidationRuleInput(),
          provenance: [
            {
              sourceSystem: " ",
              sourceLocator: "locator",
              recordedAt: "2026-08-01T00:00:00.000Z",
            },
          ],
        }),
      /provenance.sourceSystem is required/,
    );

    assert.throws(
      () =>
        factory.createRule({
          ...createValidationRuleInput(),
          evidenceLinks: [
            {
              evidenceId: " ",
              validationId: "validation-1",
              certificationId: "certification-1",
              stance: "supporting",
            },
          ],
        }),
      /evidenceLink.evidenceId is required/,
    );
  });

  it("covers version evolution default transition and confidence fallback", () => {
    const factory = createFactory();
    const first = factory.createRule(createValidationRuleInput());
    const next = factory.createNextVersion(first, {
      reason: "confidence unchanged",
    });

    assert.equal(next.lifecycle.currentState, "ACTIVE");
    assert.equal(next.confidence, first.confidence);
    assert.equal(next.lineage.supersedesVersionId, undefined);
    assert.equal(next.lineage.retiredVersionId, undefined);
  });

  it("covers domain guard failure and non-Error validator exception branch", () => {
    const factory = createFactory();
    const validationRule = factory.createRule(createValidationRuleInput());

    const results = factory.validateRule(validationRule, [
      factory.createDomainGuardValidator("POLICY"),
      {
        name: "non-error-throw",
        validate: () => {
          throw "non-error";
        },
      },
    ]);

    assert.equal(results.some((result) => result.code === "DOMAIN_MISMATCH" && result.status === "fail"), true);
    assert.equal(results.some((result) => result.code === "VALIDATOR_EXCEPTION" && result.message === "Validator threw unknown error"), true);
  });

  it("covers invalid operator fallback branch as contract hardening", () => {
    const factory = createFactory();
    const invalidOperatorRule = factory.createRule({
      canonicalCode: "rule.invalid.operator",
      title: "Invalid operator branch",
      domain: "VALIDATION",
      conditions: [
        {
          factKey: "x",
          operator: "UNSUPPORTED" as any,
          expectedValue: 1,
        },
      ],
      confidence: 0.6,
      replayLink: {
        replayId: "replay-invalid-op",
        sourceManifestId: "manifest-invalid-op",
      },
    });

    const outcome = factory.evaluateRule(invalidOperatorRule, {
      facts: {
        x: 1,
      },
    });

    assert.equal(outcome.status, "FAIL");
    assert.equal(outcome.conditionResults[0]?.status, "fail");
  });
});
