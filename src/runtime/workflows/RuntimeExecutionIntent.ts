import { createHash } from "node:crypto";

import type { RuntimeExecutionIntentRecord } from "./types";
import { deepFreeze, stableSerialize } from "./types";

export class RuntimeExecutionIntent {
  constructor(private readonly record: RuntimeExecutionIntentRecord) {}

  static identityFor(record: Omit<RuntimeExecutionIntentRecord, "intentId">, ordinal: number): string {
    const canonical = stableSerialize({
      workflowInstanceId: record.workflowInstanceId,
      activityId: record.activityId,
      descriptor: record,
      ordinal,
    });
    return `intent-${createHash("sha256").update(canonical).digest("hex").slice(0, 16)}`;
  }

  snapshot(): RuntimeExecutionIntentRecord {
    return deepFreeze(this.record);
  }
}
