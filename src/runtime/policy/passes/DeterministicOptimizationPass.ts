import type { RuntimePolicyCompilerPass } from "../RuntimePolicyCompilerPass";
import { appendEvidence, withPassResult } from "../RuntimePolicyCompilerPass";
import { createDigest, deepFreeze } from "../types";

export class DeterministicOptimizationPass implements RuntimePolicyCompilerPass {
  readonly name = "DeterministicOptimization" as const;

  execute(state: Parameters<RuntimePolicyCompilerPass["execute"]>[0]): Parameters<RuntimePolicyCompilerPass["execute"]>[0] {
    const inputDigest = createDigest(state.normalizedDefinition);
    const optimizedRules = [...state.normalizedDefinition.rules].sort((a, b) => {
      const priorityDelta = (a.priority ?? 0) - (b.priority ?? 0);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      return a.name.localeCompare(b.name);
    });

    const next = deepFreeze({
      ...state,
      normalizedDefinition: deepFreeze({
        ...state.normalizedDefinition,
        rules: Object.freeze(optimizedRules),
      }),
      conflictMetadata: deepFreeze({
        ...state.conflictMetadata,
        deterministicRuleOrder: Object.freeze(optimizedRules.map((rule) => rule.name)),
      }),
      evidence: appendEvidence(state.evidence, "DeterministicOptimizationApplied", {
        orderedRuleNames: optimizedRules.map((rule) => rule.name),
      }),
    });

    return withPassResult(next, this.name, inputDigest);
  }
}
