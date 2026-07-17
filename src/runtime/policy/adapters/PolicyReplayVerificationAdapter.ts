import type { RuntimePolicyReplayResult } from "../types";
import { deepFreeze } from "../types";

export class PolicyReplayVerificationAdapter {
  toVerificationProjection(replay: RuntimePolicyReplayResult) {
    return deepFreeze({
      adapter: "PolicyReplayVerificationAdapter",
      replayDigest: replay.replayDigest,
      matched: replay.matched,
      baselineDecisionId: replay.leftDecisionId,
      replayDecisionId: replay.rightDecisionId,
    });
  }
}
