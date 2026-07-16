import type { RuntimeWorkflowInstanceRecord } from "./types";
import { deepFreeze } from "./types";

export class RuntimeWorkflowInstance {
  constructor(private readonly record: RuntimeWorkflowInstanceRecord) {}

  snapshot(): RuntimeWorkflowInstanceRecord {
    return deepFreeze(this.record);
  }
}
