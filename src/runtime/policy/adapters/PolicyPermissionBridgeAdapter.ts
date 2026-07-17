import type { RuntimePolicyDecision } from "../types";
import { deepFreeze } from "../types";

export class PolicyPermissionBridgeAdapter {
  toPermissionResult(decision: RuntimePolicyDecision) {
    return deepFreeze({
      adapter: "PolicyPermissionBridgeAdapter",
      decisionId: decision.decisionId,
      permitted: decision.decision === "Permit",
      conditional: decision.decision === "Conditional",
    });
  }
}
