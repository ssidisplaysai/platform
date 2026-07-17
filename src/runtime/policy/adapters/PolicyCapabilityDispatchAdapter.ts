import type { RuntimePolicyDecision } from "../types";
import { deepFreeze } from "../types";

export class PolicyCapabilityDispatchAdapter {
  toDispatchIntent(decision: RuntimePolicyDecision) {
    return deepFreeze({
      adapter: "PolicyCapabilityDispatchAdapter",
      decisionId: decision.decisionId,
      decision: decision.decision,
      obligations: decision.obligations,
    });
  }
}
