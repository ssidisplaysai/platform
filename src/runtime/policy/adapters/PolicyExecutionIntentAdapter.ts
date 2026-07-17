import type { RuntimePolicyDecision } from "../types";
import { deepFreeze } from "../types";

export class PolicyExecutionIntentAdapter {
  toExecutionIntentConstraint(decision: RuntimePolicyDecision) {
    return deepFreeze({
      adapter: "PolicyExecutionIntentAdapter",
      decisionId: decision.decisionId,
      allowed: decision.decision !== "Deny",
      notApplicable: decision.decision === "NotApplicable",
      obligations: decision.obligations,
    });
  }
}
