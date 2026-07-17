import type { RuntimePolicyCompilerPass } from "../RuntimePolicyCompilerPass";
import { appendEvidence, withPassResult } from "../RuntimePolicyCompilerPass";
import {
  createDigest,
  deepFreeze,
  normalizeConflictStrategy,
  stablePrimitiveRecord,
  stableStringArray,
} from "../types";

export class PolicyIRGenerationPass implements RuntimePolicyCompilerPass {
  readonly name = "PolicyIRGeneration" as const;

  execute(state: Parameters<RuntimePolicyCompilerPass["execute"]>[0], context: Parameters<RuntimePolicyCompilerPass["execute"]>[1]): Parameters<RuntimePolicyCompilerPass["execute"]>[0] {
    const inputDigest = createDigest(state.normalizedDefinition);
    const policyDefinitionId = state.generatedIds.policyDefinitionId ?? state.normalizedDefinition.policyDefinitionId ?? `policy-definition-${state.definitionDigest.slice(0, 16)}`;

    const rules = Object.freeze(state.normalizedDefinition.rules.map((rule, index) => {
      const generatedRuleId = state.generatedIds[`rule-${index}`];
      const ruleId = rule.ruleId ?? generatedRuleId ?? `policy-rule-${createDigest({ policyDefinitionId, index, rule }).slice(0, 16)}`;
      const ruleDigest = createDigest({ ruleId, rule });

      return deepFreeze({
        ruleId,
        ruleDigest,
        effect: rule.effect,
        priority: rule.priority ?? index + 1,
        target: deepFreeze({
          ...rule.target,
          selector: stablePrimitiveRecord(rule.target.selector ?? {}),
          metadata: stablePrimitiveRecord(rule.target.metadata ?? {}),
        }),
        conditions: Object.freeze([...rule.conditions]),
        obligations: Object.freeze([...(rule.obligations ?? [])]),
        dependencyRuleIds: stableStringArray(rule.dependencyRuleIds ?? []),
        metadata: stablePrimitiveRecord(rule.metadata ?? {}),
      });
    }));

    const runtimePolicyIrId = `runtime-policy-ir-${createDigest({
      policyDefinitionId,
      rules,
    }).slice(0, 16)}`;

    const runtimePolicyIrDigest = createDigest({
      runtimePolicyIrId,
      policyDefinitionId,
      rules,
      schemaVersion: state.normalizedDefinition.schemaVersion,
      conflictStrategy: state.normalizedDefinition.conflictStrategy,
    });

    const runtimePolicyIr = deepFreeze({
      runtimePolicyIrId,
      runtimePolicyIrDigest,
      policyDefinitionId,
      policyDefinitionDigest: state.definitionDigest,
      schemaVersion: state.normalizedDefinition.schemaVersion,
      conflictStrategy: normalizeConflictStrategy(state.normalizedDefinition.conflictStrategy),
      policySetIds: stableStringArray(state.normalizedDefinition.policySetIds ?? []),
      dependencyPolicyIds: stableStringArray(state.normalizedDefinition.dependencyPolicyIds ?? []),
      rules,
      conflictMetadata: deepFreeze(state.conflictMetadata),
      compilerId: context.config.compilerId,
      compilerVersion: context.config.compilerVersion,
    });

    const next = deepFreeze({
      ...state,
      runtimePolicyIr,
      evidence: appendEvidence(state.evidence, "RuntimePolicyIRGenerated", {
        runtimePolicyIrId,
        ruleCount: runtimePolicyIr.rules.length,
      }),
    });

    return withPassResult(next, this.name, inputDigest);
  }
}
