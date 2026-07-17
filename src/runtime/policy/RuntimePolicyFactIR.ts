import type { RuntimePolicyFactIR as RuntimePolicyFactIRRecord } from "./types";
import { deepFreeze } from "./types";

export class RuntimePolicyFactIR {
  constructor(private readonly record: RuntimePolicyFactIRRecord) {}

  snapshot(): RuntimePolicyFactIRRecord {
    return deepFreeze(this.record);
  }
}
