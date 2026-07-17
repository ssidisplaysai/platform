import type { RuntimePolicyCompilerPass } from "../RuntimePolicyCompilerPass";
import { appendDiagnostic, appendEvidence, withPassResult } from "../RuntimePolicyCompilerPass";
import { createDigest, deepFreeze } from "../types";

export class ConflictAnalysisPass implements RuntimePolicyCompilerPass {
  readonly name = "ConflictAnalysis" as const;

  execute(state: Parameters<RuntimePolicyCompilerPass["execute"]>[0]): Parameters<RuntimePolicyCompilerPass["execute"]>[0] {
    const inputDigest = createDigest(state.normalizedDefinition);
    const seenNames = new Set<string>();
    let diagnostics = state.diagnostics;
    let duplicates = 0;

    for (const rule of state.normalizedDefinition.rules) {
      const key = `${rule.name}::${rule.target.targetType}::${rule.target.targetId ?? "*"}`;
      if (seenNames.has(key)) {
        duplicates += 1;
        diagnostics = appendDiagnostic(diagnostics, "Warning", "GRT-POL-CONFLICT-001", "Potential duplicate rule target detected.", {
          key,
          ruleName: rule.name,
        });
      }
      seenNames.add(key);
    }

    const next = deepFreeze({
      ...state,
      diagnostics,
      conflictMetadata: deepFreeze({
        ...state.conflictMetadata,
        duplicateRuleTargetCount: duplicates,
      }),
      evidence: appendEvidence(state.evidence, "ConflictAnalysisCompleted", {
        duplicateRuleTargetCount: duplicates,
      }),
    });

    return withPassResult(next, this.name, inputDigest);
  }
}
