import type { RuntimePolicyDecision } from "../types";
import { createDigest, deepFreeze } from "../types";

export class PolicyDecisionEvidenceAdapter {
  toEvidenceLink(decision: RuntimePolicyDecision) {
    return deepFreeze({
      adapter: "PolicyDecisionEvidenceAdapter",
      decisionId: decision.decisionId,
      traceId: decision.trace.traceId,
      evidenceDigest: createDigest({
        decisionId: decision.decisionId,
        matchedRuleIds: decision.matchedRuleIds,
        obligations: decision.obligations,
      }),
    });
  }
}
