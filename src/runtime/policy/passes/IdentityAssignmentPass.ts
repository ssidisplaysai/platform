import type { RuntimePolicyCompilerPass } from "../RuntimePolicyCompilerPass";
import { appendEvidence, withPassResult } from "../RuntimePolicyCompilerPass";
import { createDigest, deepFreeze } from "../types";

export class IdentityAssignmentPass implements RuntimePolicyCompilerPass {
  readonly name = "IdentityAssignment" as const;

  execute(state: Parameters<RuntimePolicyCompilerPass["execute"]>[0]): Parameters<RuntimePolicyCompilerPass["execute"]>[0] {
    const inputDigest = createDigest(state.normalizedDefinition);
    const policyDefinitionId = state.normalizedDefinition.policyDefinitionId ?? `policy-definition-${state.definitionDigest.slice(0, 16)}`;
    const generatedRuleIds = Object.fromEntries(state.normalizedDefinition.rules.map((rule, index) => {
      const digest = createDigest({
        policyDefinitionId,
        rule,
        index,
      });
      return [`rule-${index}`, `policy-rule-${digest.slice(0, 16)}`];
    }));

    const next = deepFreeze({
      ...state,
      generatedIds: deepFreeze({
        ...state.generatedIds,
        policyDefinitionId,
        ...generatedRuleIds,
      }),
      evidence: appendEvidence(state.evidence, "DeterministicIdentitiesAssigned", {
        policyDefinitionId,
        ruleCount: Object.keys(generatedRuleIds).length,
      }),
    });

    return withPassResult(next, this.name, inputDigest);
  }
}
