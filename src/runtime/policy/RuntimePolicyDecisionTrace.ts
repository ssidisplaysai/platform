import type { RuntimePolicyDecisionTrace as RuntimePolicyDecisionTraceRecord } from "./types";
import { deepFreeze } from "./types";

export class RuntimePolicyDecisionTrace {
  constructor(private readonly record: RuntimePolicyDecisionTraceRecord) {}

  snapshot(): RuntimePolicyDecisionTraceRecord {
    return deepFreeze(this.record);
  }
}
