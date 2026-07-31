import type { DeliveryMode, MessageEnvelope } from "./MessageEnvelope";

export type Message<TPayload = unknown> = {
  topic: string;
  envelope: MessageEnvelope<TPayload>;
  mode: DeliveryMode;
};
