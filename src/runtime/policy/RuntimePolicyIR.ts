import type { RuntimePolicyIR as RuntimePolicyIRRecord } from "./types";
import { deepFreeze } from "./types";

export class RuntimePolicyIR {
  constructor(private readonly record: RuntimePolicyIRRecord) {}

  snapshot(): RuntimePolicyIRRecord {
    return deepFreeze(this.record);
  }
}
