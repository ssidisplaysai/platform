import type { RuntimePolicyConflictInput, RuntimePolicyDecisionType } from "./types";

export class RuntimePolicyConflictResolver {
  resolve(input: RuntimePolicyConflictInput): RuntimePolicyDecisionType {
    if (input.effects.length === 0) {
      return "NotApplicable";
    }

    if (input.strategy === "deny-overrides") {
      if (input.effects.includes("Deny")) {
        return "Deny";
      }
      if (input.effects.includes("Conditional")) {
        return "Conditional";
      }
      return "Permit";
    }

    if (input.strategy === "permit-overrides") {
      if (input.effects.includes("Permit")) {
        return "Permit";
      }
      if (input.effects.includes("Conditional")) {
        return "Conditional";
      }
      return "Deny";
    }

    if (input.strategy === "first-applicable") {
      return input.effects[0] ?? "NotApplicable";
    }

    const unique = new Set(input.effects);
    if (unique.size > 1) {
      return "Indeterminate";
    }
    return input.effects[0] ?? "NotApplicable";
  }
}
