import type { RuntimePolicyCompilerPass } from "../RuntimePolicyCompilerPass";
import { appendEvidence, withPassResult } from "../RuntimePolicyCompilerPass";
import { createDigest, deepFreeze, stablePrimitiveRecord, stableStringArray } from "../types";

export class CanonicalOrderingPass implements RuntimePolicyCompilerPass {
  readonly name = "CanonicalOrdering" as const;

  execute(state: Parameters<RuntimePolicyCompilerPass["execute"]>[0]): Parameters<RuntimePolicyCompilerPass["execute"]>[0] {
    const inputDigest = createDigest(state.normalizedDefinition);
    const orderedRules = [...state.normalizedDefinition.rules]
      .map((rule) => deepFreeze({
        ...rule,
        conditions: Object.freeze([...rule.conditions].sort((a, b) => a.factKey.localeCompare(b.factKey))),
        obligations: Object.freeze([...(rule.obligations ?? [])].sort((a, b) => a.obligationType.localeCompare(b.obligationType))),
        dependencyRuleIds: stableStringArray(rule.dependencyRuleIds ?? []),
        metadata: stablePrimitiveRecord(rule.metadata ?? {}),
        target: deepFreeze({
          ...rule.target,
          selector: stablePrimitiveRecord(rule.target.selector ?? {}),
          metadata: stablePrimitiveRecord(rule.target.metadata ?? {}),
        }),
      }))
      .sort((a, b) => {
        const aPriority = a.priority ?? 0;
        const bPriority = b.priority ?? 0;
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }
        return a.name.localeCompare(b.name);
      });

    const normalizedDefinition = deepFreeze({
      ...state.normalizedDefinition,
      policySetIds: stableStringArray(state.normalizedDefinition.policySetIds ?? []),
      dependencyPolicyIds: stableStringArray(state.normalizedDefinition.dependencyPolicyIds ?? []),
      metadata: stablePrimitiveRecord(state.normalizedDefinition.metadata ?? {}),
      rules: Object.freeze(orderedRules),
    });

    const next = deepFreeze({
      ...state,
      normalizedDefinition,
      evidence: appendEvidence(state.evidence, "CanonicalOrderingApplied", {
        policySetCount: normalizedDefinition.policySetIds.length,
        ruleCount: normalizedDefinition.rules.length,
      }),
    });

    return withPassResult(next, this.name, inputDigest);
  }
}
