import type { RuntimeProcessRecord } from "./types";
import { deepFreeze } from "./types";

export class RuntimeProcess {
  constructor(private readonly record: RuntimeProcessRecord) {}

  snapshot(): RuntimeProcessRecord {
    return deepFreeze(this.record);
  }
}
