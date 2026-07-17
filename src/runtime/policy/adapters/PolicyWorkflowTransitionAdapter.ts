import type { RuntimePolicyDecision } from "../types";
import { deepFreeze } from "../types";

export class PolicyWorkflowTransitionAdapter {
  toWorkflowTransitionGuard(decision: RuntimePolicyDecision) {
    return deepFreeze({
      adapter: "PolicyWorkflowTransitionAdapter",
      decisionId: decision.decisionId,
      allowTransition: decision.decision === "Permit" || decision.decision === "Conditional",
      obligations: decision.obligations,
    });
  }
}
