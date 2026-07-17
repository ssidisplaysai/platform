import type { RuntimePolicyDecision } from "../types";
import { deepFreeze } from "../types";

export class PolicyMessagingPublishAdapter {
  toMessagingDirective(decision: RuntimePolicyDecision) {
    return deepFreeze({
      adapter: "PolicyMessagingPublishAdapter",
      decisionId: decision.decisionId,
      allowPublish: decision.decision === "Permit" || decision.decision === "Conditional",
      obligations: decision.obligations,
    });
  }
}
