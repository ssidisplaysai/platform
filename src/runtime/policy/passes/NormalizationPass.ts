import type { RuntimePolicyCompilerPass } from "../RuntimePolicyCompilerPass";
import { appendEvidence, withPassResult } from "../RuntimePolicyCompilerPass";
import { createDigest, deepFreeze, normalizeConflictStrategy, normalizePriority } from "../types";

export class NormalizationPass implements RuntimePolicyCompilerPass {
  readonly name = "Normalization" as const;

  execute(state: Parameters<RuntimePolicyCompilerPass["execute"]>[0]): Parameters<RuntimePolicyCompilerPass["execute"]>[0] {
    const inputDigest = createDigest(state.normalizedDefinition);
    const normalizedDefinition = deepFreeze({
      ...state.normalizedDefinition,
      conflictStrategy: normalizeConflictStrategy(state.normalizedDefinition.conflictStrategy),
      rules: Object.freeze(state.normalizedDefinition.rules.map((rule, index) => deepFreeze({
        ...rule,
        priority: normalizePriority(rule.priority, index + 1),
      }))),
    });

    const next = deepFreeze({
      ...state,
      normalizedDefinition,
      evidence: appendEvidence(state.evidence, "NormalizationApplied", {
        conflictStrategy: normalizedDefinition.conflictStrategy,
      }),
    });

    return withPassResult(next, this.name, inputDigest);
  }
}
