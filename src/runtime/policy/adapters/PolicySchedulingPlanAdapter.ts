import type { RuntimePolicyDecision } from "../types";
import { deepFreeze } from "../types";

export class PolicySchedulingPlanAdapter {
  toSchedulingDirective(decision: RuntimePolicyDecision) {
    return deepFreeze({
      adapter: "PolicySchedulingPlanAdapter",
      decisionId: decision.decisionId,
      allowScheduling: decision.decision === "Permit" || decision.decision === "Conditional",
      obligations: decision.obligations,
    });
  }
}
