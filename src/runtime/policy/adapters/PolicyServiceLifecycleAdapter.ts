import type { RuntimePolicyDecision } from "../types";
import { deepFreeze } from "../types";

export class PolicyServiceLifecycleAdapter {
  toServiceLifecycleGuard(decision: RuntimePolicyDecision) {
    return deepFreeze({
      adapter: "PolicyServiceLifecycleAdapter",
      decisionId: decision.decisionId,
      allowLifecycleAction: decision.decision !== "Deny",
      obligations: decision.obligations,
    });
  }
}
