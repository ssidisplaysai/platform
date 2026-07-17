import type { RuntimePolicyDecision as RuntimePolicyDecisionRecord } from "./types";
import { deepFreeze } from "./types";

export class RuntimePolicyDecision {
  constructor(private readonly record: RuntimePolicyDecisionRecord) {}

  snapshot(): RuntimePolicyDecisionRecord {
    return deepFreeze(this.record);
  }
}
