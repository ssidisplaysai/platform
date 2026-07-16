import { RuntimeEnvelope } from "./RuntimeEnvelope";
import type { RuntimeReplyEnvelope } from "./types";

export class RuntimeReply extends RuntimeEnvelope {
  constructor(record: RuntimeReplyEnvelope) {
    super(record);
  }
}
