import { RuntimeEnvelope } from "./RuntimeEnvelope";
import type { RuntimeQueryEnvelope } from "./types";

export class RuntimeQuery extends RuntimeEnvelope {
  constructor(record: RuntimeQueryEnvelope) {
    super(record);
  }
}
