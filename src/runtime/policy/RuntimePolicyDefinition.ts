import type { RuntimePolicyDefinition as RuntimePolicyDefinitionRecord } from "./types";
import { deepFreeze, stablePrimitiveRecord, stableStringArray } from "./types";

export class RuntimePolicyDefinition {
  constructor(private readonly record: RuntimePolicyDefinitionRecord) {}

  static immutable(record: RuntimePolicyDefinitionRecord): RuntimePolicyDefinition {
    const normalized = deepFreeze({
      ...record,
      policySetIds: stableStringArray(record.policySetIds ?? []),
      dependencyPolicyIds: stableStringArray(record.dependencyPolicyIds ?? []),
      metadata: stablePrimitiveRecord(record.metadata ?? {}),
      rules: Object.freeze(record.rules.map((rule) => deepFreeze({
        ...rule,
        conditions: Object.freeze([...rule.conditions]),
        obligations: Object.freeze([...(rule.obligations ?? [])]),
        dependencyRuleIds: stableStringArray(rule.dependencyRuleIds ?? []),
        metadata: stablePrimitiveRecord(rule.metadata ?? {}),
        target: deepFreeze({
          ...rule.target,
          selector: stablePrimitiveRecord(rule.target.selector ?? {}),
          metadata: stablePrimitiveRecord(rule.target.metadata ?? {}),
        }),
      }))),
    });
    return new RuntimePolicyDefinition(normalized);
  }

  snapshot(): RuntimePolicyDefinitionRecord {
    return deepFreeze(this.record);
  }
}
