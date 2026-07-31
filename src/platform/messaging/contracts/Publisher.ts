import type { DeliveryMode, MessageEnvelope } from "./MessageEnvelope";

export type PublishInput<TPayload = unknown> = {
  topic: string;
  envelope: MessageEnvelope<TPayload>;
  mode?: DeliveryMode;
};

export type RequestInput<TPayload = unknown> = {
  topic: string;
  envelope: MessageEnvelope<TPayload>;
  timeoutMs?: number;
};

export interface Publisher {
  publish<TPayload = unknown>(input: PublishInput<TPayload>): Promise<void>;
  request<TPayload = unknown, TReply = unknown>(input: RequestInput<TPayload>): Promise<MessageEnvelope<TReply>>;
}
