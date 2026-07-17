import type { RuntimePolicyFact as RuntimePolicyFactRecord } from "./types";
import { deepFreeze, stablePrimitiveRecord, stableStringArray } from "./types";

export class RuntimePolicyFact {
  constructor(private readonly record: RuntimePolicyFactRecord) {}

  static immutable(record: RuntimePolicyFactRecord): RuntimePolicyFact {
    return new RuntimePolicyFact(deepFreeze({
      ...record,
      provenanceReferences: stableStringArray(record.provenanceReferences ?? []),
      metadata: stablePrimitiveRecord(record.metadata ?? {}),
    }));
  }

  snapshot(): RuntimePolicyFactRecord {
    return deepFreeze(this.record);
  }
}
