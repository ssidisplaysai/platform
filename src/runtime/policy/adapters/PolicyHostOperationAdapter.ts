import type { RuntimePolicyDecision } from "../types";
import { deepFreeze } from "../types";

export class PolicyHostOperationAdapter {
  toHostOperationGuard(decision: RuntimePolicyDecision) {
    return deepFreeze({
      adapter: "PolicyHostOperationAdapter",
      decisionId: decision.decisionId,
      allowOperation: decision.decision === "Permit" || decision.decision === "Conditional",
      obligations: decision.obligations,
    });
  }
}
