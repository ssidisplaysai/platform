import { RuntimePolicyConflictResolver } from "./RuntimePolicyConflictResolver";
import type {
  RuntimePolicyConditionDefinition,
  RuntimePolicyDecision,
  RuntimePolicyDecisionTrace,
  RuntimePolicyDecisionTraceStep,
  RuntimePolicyEvaluationRequest,
  RuntimePolicyEffect,
  RuntimePolicyFactIR,
} from "./types";
import { createDigest, deepFreeze, stableSerialize, stableStringArray } from "./types";

export class RuntimePolicyEvaluator {
  private readonly conflicts = new RuntimePolicyConflictResolver();

  evaluate(request: RuntimePolicyEvaluationRequest): RuntimePolicyDecision {
    this.assertFactIrInputs(request.facts);
    const factMap = new Map<string, RuntimePolicyFactIR>(request.facts.map((fact) => [fact.factKey, fact]));
    const matchedRules = request.runtimePolicyIr.rules.filter((rule) =>
      rule.conditions.every((condition) => this.conditionMatches(condition, factMap.get(condition.factKey))),
    );

    const effects: RuntimePolicyEffect[] = matchedRules.map((rule) => rule.effect);
    const resolvedDecision = this.conflicts.resolve({
      strategy: request.runtimePolicyIr.conflictStrategy,
      effects,
    });

    const obligations = Object.freeze(matchedRules.flatMap((rule) => rule.obligations));

    const trace = this.createTrace(request, matchedRules.map((rule) => rule.ruleId), resolvedDecision);
    const factDigests = stableStringArray(request.facts.map((fact) => createDigest(fact)));
    const contextDigest = createDigest(request.context);
    const decisionId = `policy-decision-${createDigest({
      runtimePolicyIrId: request.runtimePolicyIr.runtimePolicyIrId,
      matchedRuleIds: matchedRules.map((rule) => rule.ruleId),
      decision: resolvedDecision,
      factDigests,
      contextDigest,
    }).slice(0, 16)}`;

    return deepFreeze({
      decisionId,
      policyDefinitionId: request.runtimePolicyIr.policyDefinitionId,
      runtimePolicyIrId: request.runtimePolicyIr.runtimePolicyIrId,
      decision: resolvedDecision,
      matchedPolicyIds: Object.freeze([request.runtimePolicyIr.policyDefinitionId]),
      matchedRuleIds: Object.freeze(matchedRules.map((rule) => rule.ruleId)),
      obligations,
      trace: deepFreeze({
        ...trace,
        decisionId,
      }),
      factDigests,
      contextDigest,
    });
  }

  private assertFactIrInputs(facts: readonly RuntimePolicyFactIR[]): void {
    for (const fact of facts) {
      if (!fact || typeof fact !== "object") {
        throw new Error("GRT-POL-EVAL-FACT-001: Facts must be RuntimePolicyFactIR objects.");
      }
      if (typeof fact.factId !== "string" || !fact.factId.startsWith("fact-ir-")) {
        throw new Error("GRT-POL-EVAL-FACT-002: FactIR.factId is missing or invalid.");
      }
      if (typeof fact.provenanceDigest !== "string") {
        throw new Error("GRT-POL-EVAL-FACT-003: FactIR.provenanceDigest is required.");
      }
      if (!fact.provenance || typeof fact.provenance !== "object") {
        throw new Error("GRT-POL-EVAL-FACT-004: FactIR.provenance is required.");
      }
    }
  }

  private createTrace(
    request: RuntimePolicyEvaluationRequest,
    matchedRuleIds: readonly string[],
    decision: RuntimePolicyDecision["decision"],
  ): RuntimePolicyDecisionTrace {
    const steps: RuntimePolicyDecisionTraceStep[] = [
      deepFreeze({
        sequence: 1,
        phase: "Evaluation",
        code: "GRT-POL-EVAL-001",
        message: "Evaluating RuntimePolicyIR with RuntimePolicyFactIR inputs.",
        details: deepFreeze({
          runtimePolicyIrId: request.runtimePolicyIr.runtimePolicyIrId,
          factCount: request.facts.length,
        }),
      }),
      deepFreeze({
        sequence: 2,
        phase: "ConflictResolution",
        code: "GRT-POL-EVAL-002",
        message: "Conflict strategy resolved deterministic decision.",
        details: deepFreeze({
          conflictStrategy: request.runtimePolicyIr.conflictStrategy,
          matchedRuleIds: stableStringArray(matchedRuleIds),
          decision,
        }),
      }),
      deepFreeze({
        sequence: 3,
        phase: "Decision",
        code: "GRT-POL-EVAL-003",
        message: "Immutable RuntimePolicyDecision emitted.",
      }),
    ];

    const traceId = `policy-trace-${createDigest({
      runtimePolicyIrId: request.runtimePolicyIr.runtimePolicyIrId,
      matchedRuleIds,
      steps,
      decision,
      evaluationDigest: stableSerialize(request.context),
    }).slice(0, 16)}`;

    return deepFreeze({
      traceId,
      decisionId: "pending",
      steps: Object.freeze(steps),
    });
  }

  private conditionMatches(condition: RuntimePolicyConditionDefinition, fact: RuntimePolicyFactIR | undefined): boolean {
    if (!fact) {
      return condition.operator === "NotEquals" ? condition.expectedValue !== undefined : false;
    }

    const actual = fact.canonicalValue;
    const expected = condition.expectedValue;

    if (condition.operator === "Exists") {
      return actual !== undefined;
    }
    if (condition.operator === "Equals") {
      return actual === expected;
    }
    if (condition.operator === "NotEquals") {
      return actual !== expected;
    }
    if (condition.operator === "GreaterThan") {
      return typeof actual === "number" && typeof expected === "number" && actual > expected;
    }
    if (condition.operator === "GreaterThanOrEquals") {
      return typeof actual === "number" && typeof expected === "number" && actual >= expected;
    }
    if (condition.operator === "LessThan") {
      return typeof actual === "number" && typeof expected === "number" && actual < expected;
    }
    if (condition.operator === "LessThanOrEquals") {
      return typeof actual === "number" && typeof expected === "number" && actual <= expected;
    }
    if (condition.operator === "Contains") {
      if (typeof actual === "string" && typeof expected === "string") {
        return actual.includes(expected);
      }
      if (Array.isArray(actual)) {
        return actual.includes(expected);
      }
      return false;
    }
    return false;
  }
}
