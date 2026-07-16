import { RuntimeEnvelope } from "./RuntimeEnvelope";
import type { RuntimeEventEnvelope } from "./types";

export class RuntimeEvent extends RuntimeEnvelope {
  constructor(record: RuntimeEventEnvelope) {
    super(record);
  }
}
