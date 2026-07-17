import type { RuntimePolicyCompilerPass } from "../RuntimePolicyCompilerPass";
import { appendDiagnostic, appendEvidence, withPassResult } from "../RuntimePolicyCompilerPass";
import { createDigest, deepFreeze, stableStringArray } from "../types";

export class DependencyResolutionPass implements RuntimePolicyCompilerPass {
  readonly name = "DependencyResolution" as const;

  execute(state: Parameters<RuntimePolicyCompilerPass["execute"]>[0]): Parameters<RuntimePolicyCompilerPass["execute"]>[0] {
    const inputDigest = createDigest(state.normalizedDefinition);
    const ruleIds = new Set(state.normalizedDefinition.rules.map((rule) => rule.ruleId).filter((entry): entry is string => typeof entry === "string"));
    let diagnostics = state.diagnostics;
    let evidence = state.evidence;

    for (const rule of state.normalizedDefinition.rules) {
      for (const dependencyRuleId of stableStringArray(rule.dependencyRuleIds ?? [])) {
        if (!ruleIds.has(dependencyRuleId)) {
          diagnostics = appendDiagnostic(diagnostics, "Error", "GRT-POL-DEP-001", "Missing rule dependency reference.", {
            ruleName: rule.name,
            dependencyRuleId,
          });
          evidence = appendEvidence(evidence, "DependencyResolutionFailed", {
            dependencyRuleId,
            ruleName: rule.name,
          });

          const next = deepFreeze({
            ...state,
            diagnostics,
            evidence,
            failed: true,
            failureReason: `GRT-POL-DEP-001: Missing dependency rule: ${dependencyRuleId}`,
          });
          return withPassResult(next, this.name, inputDigest, {
            success: false,
            failureReason: next.failureReason,
          });
        }
      }
    }

    const next = deepFreeze({
      ...state,
      diagnostics,
      evidence: appendEvidence(evidence, "DependenciesResolved", {
        dependencyPolicyIds: stableStringArray(state.normalizedDefinition.dependencyPolicyIds ?? []),
      }),
    });

    return withPassResult(next, this.name, inputDigest);
  }
}
