import { RuntimeEnvelope } from "./RuntimeEnvelope";
import type { RuntimeCommandEnvelope } from "./types";

export class RuntimeCommand extends RuntimeEnvelope {
  constructor(record: RuntimeCommandEnvelope) {
    super(record);
  }
}
